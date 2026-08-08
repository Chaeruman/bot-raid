// The weekly bounty board — one message in #bounty-board, posted at reset and
// edited for the rest of the week. Answers "siapa lagi yang punya GDN CL?"
// without anyone running a command.
//
// Deliberately NOT the matcher: the board lists every recorded quest grouped by
// nest, flat. Splitting into 6-quest runs is a party-forming concern, and the
// board is a noticeboard.
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  MessageFlags,
} = require("discord.js");
const config = require("./config");
const templates = require("./templates");
const { updateMessage } = require("./builders/content");
const {
  bountyBoard, bountyRequests, activeEvents, saveState, getBountyWeekAll, getAllChars,
} = require("./state");
const { BY_POOL_KEY, weekKey, ckey, resetSaturday, weekOrdinal, rewardText } = require("./bounty");

const REQ_SELECT = "bounty-req:pick";
const NEW_SELECT = "bounty-req:new";
const REQ_OK = "bounty-req:ok";
const REQ_GO = "bounty-req:go";
const REQ_PICK = "bounty-req:char";

const HOUR_MS = 60 * 60 * 1000;

const MONTHS_ID = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

// "minggu ke-1 Agustus 2026" — the board is read by players, so it gets the
// Indonesian label rather than the storage key.
function weekLabelId(now = new Date()) {
  const sat = resetSaturday(now);
  return `minggu ke-${weekOrdinal(sat)} ${MONTHS_ID[sat.getUTCMonth()]} ${sat.getUTCFullYear()}`;
}

// Unclaimed quests grouped by variant, then by character. Sorted by quest count
// so the first entry is the one worth rallying for.
function groupByVariant(weekDocs) {
  const byVariant = new Map();

  for (const doc of weekDocs) {
    const userId = doc.owners?.[0] || String(doc._id).split(":")[0];
    for (const [charName, charWeek] of Object.entries(doc.chars || {})) {
      for (const q of charWeek.board || []) {
        if (q.runId) continue;
        if (!BY_POOL_KEY.has(q.poolKey)) continue;

        if (!byVariant.has(q.poolKey)) byVariant.set(q.poolKey, new Map());
        const chars = byVariant.get(q.poolKey);
        const k = ckey(userId, charName);
        if (!chars.has(k)) chars.set(k, { userId, charName, quests: [] });
        chars.get(k).quests.push(q);
      }
    }
  }

  return [...byVariant.entries()]
    .map(([poolKey, chars]) => {
      const entries = [...chars.values()].sort((a, b) => b.quests.length - a.quests.length);
      return {
        variant: BY_POOL_KEY.get(poolKey),
        entries,
        total: entries.reduce((n, e) => n + e.quests.length, 0),
      };
    })
    .sort((a, b) => b.total - a.total || a.variant.name.localeCompare(b.variant.name));
}

// A character with two quests for one nest is ONE line — clearing once completes
// both, so showing two lines would read as two people.
const renderEntry = (e) =>
  `<@${e.userId}> **${e.charName}**${e.quests.length > 1 ? ` (${e.quests.length} quest)` : ""} — ` +
  e.quests.map(rewardText).join(" | ");

function buildBoardEmbed(weekDocs, now = new Date()) {
  const groups = groupByVariant(weekDocs);
  const embed = new EmbedBuilder()
    .setTitle("📋 BOUNTY BOARD")
    .setColor(0xe67e22)
    .setFooter({ text: weekLabelId(now) });

  if (!groups.length) {
    embed.setDescription("Belum ada yang mencatat bounty minggu ini.\nCatat punyamu dengan `/bounty`.");
    return embed;
  }

  const section = (g) =>
    [`**${g.variant.name}** — ${g.total} bounty`, ...g.entries.map(renderEntry)].join("\n");

  const [first, ...rest] = groups;
  const lines = ["**Most Wanted Dungeon**", section(first)];
  if (rest.length) lines.push("", "**Dungeon Lainnya**", ...rest.map(section));

  embed.setDescription(lines.join("\n").slice(0, 4000));
  return embed;
}

// The board's one action: pick a nest, and everyone holding a quest there gets
// tagged in #bounty-request. Anyone may ask — the bot only knows who to call.
function buildBoardComponents(groups) {
  if (!groups.length || !config.bountyRequestChannelId) return [];
  return [
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(REQ_SELECT)
        .setPlaceholder("📣 Ajak party untuk…")
        .addOptions(options(groups)),
    ),
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(NEW_SELECT)
        .setPlaceholder("⚔️ Buat party untuk…")
        .addOptions(options(groups)),
    ),
  ];
}

const options = (groups) =>
  groups.slice(0, 25).map((g) => ({
    label: g.variant.name.slice(0, 100),
    value: g.variant.poolKey,
    description: `${g.total} bounty · ${g.entries.length} karakter`.slice(0, 100),
  }));

// Posts the board when the week has rolled over, edits it otherwise. Keyed by
// weekKey rather than a timestamp: a new week is a new key, so a restart across
// reset can neither miss nor duplicate — the same trick the rest of the feature
// uses instead of a scheduled job.
async function syncBoard(client) {
  if (!config.bountyBoardChannelId) return;

  const wk = weekKey();
  const channel = await client.channels.fetch(config.bountyBoardChannelId).catch(() => null);
  if (!channel) return;

  const weekDocs = await getBountyWeekAll(wk);
  const embed = buildBoardEmbed(weekDocs);
  const components = buildBoardComponents(groupByVariant(weekDocs));

  // Week rolled over — drop last week's board and start a fresh one.
  if (bountyBoard.weekKey && bountyBoard.weekKey !== wk) {
    await channel.messages
      .fetch(bountyBoard.messageId)
      .then((m) => m.delete())
      .catch(() => {});
    bountyBoard.messageId = null;
    // Last week's requests can never be acted on again.
    for (const [id, r] of Object.entries(bountyRequests))
      if (r.weekKey !== wk) delete bountyRequests[id];
  }

  if (bountyBoard.messageId) {
    const msg = await channel.messages.fetch(bountyBoard.messageId).catch(() => null);
    if (msg) return msg.edit({ embeds: [embed], components });
    bountyBoard.messageId = null; // deleted by hand — repost below
  }

  const msg = await channel.send({ embeds: [embed], components });
  bountyBoard.messageId = msg.id;
  bountyBoard.weekKey = wk;
  saveState();
}

// ── Create a party ───────────────────────────────────────────────────────────
// No template registry for the 20 variants: `createEvent` only exists to read
// `templates[key]`, and building the event here directly avoids 20 generated
// entries for nests nobody opens. The panel itself is the untouched raid panel,
// so lock / cancel / remove / done all keep working.
function partyShape(variant) {
  if (variant.party === "memo") return { roles: templates.memo.roles, jobs: templates.memo.jobs };
  if (variant.capacity === 4) return { roles: templates.tkn_hell.roles, jobs: null };
  return { roles: templates.gdn_cl.roles, jobs: null };
}

// The bot already knows who holds the quest, so it seats them. Anyone who can't
// come clicks "Cancel My Role" — the panel has always had that, so there is no
// second "pick who joins" step to build.
function seatHolders(event, shape, entries, roleOf) {
  const skipped = [];
  const separate = [];
  for (const e of entries) {
    // A Discord panel seats a person once. So a second character of the same
    // player — even on another game account — cannot share this party: they
    // need their own run, and the caller says so rather than dropping it.
    if (event.users[e.userId]) {
      separate.push(e);
      continue;
    }
    if (Object.keys(event.users).length >= event.maxSlot) {
      skipped.push(e);
      continue;
    }

    const label = roleOf.get(ckey(e.userId, e.charName)) || null;
    const slot = shape.jobs
      ? Object.keys(event.roles).find((k) => event.roles[k].users.length === 0)
      : Object.keys(event.roles).find(
          (k) => (event.roles[k].label || k) === label && event.roles[k].users.length < event.roles[k].max,
        );

    if (!slot) {
      skipped.push(e); // role already full, or no role on the character sheet
      continue;
    }
    event.roles[slot].users.push(e.userId);
    event.users[e.userId] = { slot, subRole: shape.jobs ? label : null };
  }
  return { skipped, separate };
}

// 8 players is a raid, 4 is a nest — the same split the guild already uses for
// its channels. Falls back to the request channel, then to wherever the click
// happened, so an unset env var degrades instead of failing.
async function partyChannel(interaction, variant) {
  const fetch = (id) =>
    id ? interaction.client.channels.fetch(id).catch(() => null) : Promise.resolve(null);
  return (
    (await fetch(variant.capacity >= 8 ? config.publicRaidChannelId : config.publicNestChannelId)) ||
    (await fetch(config.bountyRequestChannelId)) ||
    interaction.channel
  );
}

// `onlyChars` seats just those characters. The request flow passes the people who
// actually ticked ✅ — someone on the tag list may simply not be able to log in,
// and seating them would only create slots somebody has to clear by hand.
async function createParty(interaction, poolKey, onlyChars = null) {
  const variant = BY_POOL_KEY.get(poolKey);
  if (!variant) return interaction.editReply("❌ Nest tidak dikenal.");

  const wk = weekKey();
  const [weekDocs, charDocs] = await Promise.all([getBountyWeekAll(wk), getAllChars()]);
  const group = groupByVariant(weekDocs).find((g) => g.variant.poolKey === poolKey);
  if (!group) return interaction.editReply("❌ Sudah tidak ada yang punya quest di sini.");

  const entries = onlyChars
    ? group.entries.filter((e) => onlyChars.includes(ckey(e.userId, e.charName)))
    : group.entries;
  if (!entries.length) return interaction.editReply("❌ Belum ada yang siap.");

  const roleOf = new Map();
  for (const d of charDocs) for (const c of d.chars || []) roleOf.set(ckey(d._id, c.name), c.role);

  const shape = partyShape(variant);
  const roles = {};
  for (const [k, r] of Object.entries(shape.roles)) roles[k] = { ...r, users: [] };

  const event = {
    messageId: null,
    createdAt: Date.now(),
    hostId: interaction.user.id,
    label: variant.name,
    title: `Bounty — ${variant.name}`,
    maxSlot: variant.capacity,
    noThread: true,
    forumTagKey: null,
    hcGoldSplit: false,
    subruns: null,
    jobs: shape.jobs,
    poolKeys: [poolKey],
    roles,
    users: {},
    locked: false,
  };

  const { skipped, separate } = seatHolders(event, shape, entries, roleOf);

  const channel = await partyChannel(interaction, variant);
  if (!channel) return interaction.editReply("❌ Channel tujuan tidak ditemukan.");

  const msg = await channel.send({ content: "Loading…" });
  event.messageId = msg.id;
  activeEvents[msg.id] = event;
  saveState();
  await updateMessage(msg, event);

  const seated = Object.keys(event.users).length;
  await interaction.editReply(
    `⚔️ Party dibuat di <#${channel.id}> — ${seated} orang sudah didudukkan.` +
      (skipped.length
        ? `\n${skipped.length} belum kebagian slot (role penuh atau belum set role): ` +
          skipped.map((e) => e.charName).join(", ")
        : ""),
  );
  return msg;
}

async function handleCreateSelect(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  return createParty(interaction, interaction.values[0]);
}

// ── Request a party ──────────────────────────────────────────────────────────

const renderRequest = (req) =>
  [
    `📣 **Ajak party — ${BY_POOL_KEY.get(req.poolKey)?.name || req.poolKey}**`,
    `Diminta oleh <@${req.byUserId}>`,
    "",
    ...req.members.map(
      (m) =>
        `${req.confirmed.includes(ckey(m.userId, m.charName)) ? "✅" : "▫️"} <@${m.userId}> **${m.charName}**` +
        `${m.quests > 1 ? ` (${m.quests} quest)` : ""}`,
    ),
    "",
    `_${req.confirmed.length}/${req.members.length} siap — yang ✅ saja yang didudukkan_`,
  ].join("\n");

// "Buat party" unlocks on the first ✅ and is clickable only by someone who
// ticked — they are the ones who said they can actually log in.
const requestButtons = (req) =>
  new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(REQ_OK).setLabel("✅ Saya ikut").setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(REQ_GO)
      .setLabel("⚔️ Buat party sekarang")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(req.confirmed.length === 0),
  );

async function handleRequestSelect(interaction) {
  const poolKey = interaction.values[0];
  const channel = await interaction.client.channels
    .fetch(config.bountyRequestChannelId)
    .catch(() => null);
  if (!channel)
    return interaction.reply({
      content: "❌ BOUNTY_REQUEST_CHANNEL_ID belum diset.",
      flags: MessageFlags.Ephemeral,
    });

  const wk = weekKey();
  const group = groupByVariant(await getBountyWeekAll(wk)).find(
    (g) => g.variant.poolKey === poolKey,
  );
  if (!group)
    return interaction.reply({ content: "❌ Sudah tidak ada yang punya quest di sini.", flags: MessageFlags.Ephemeral });

  const req = {
    poolKey,
    weekKey: wk,
    byUserId: interaction.user.id,
    members: group.entries.map((e) => ({ userId: e.userId, charName: e.charName, quests: e.quests.length })),
    confirmed: [],
  };

  const msg = await channel.send({ content: renderRequest(req), components: [requestButtons(req)] });
  bountyRequests[msg.id] = req;
  saveState();

  return interaction.reply({
    content: `📣 Sudah diajak di <#${channel.id}> — ${req.members.length} orang di-tag.`,
    flags: MessageFlags.Ephemeral,
  });
}

async function handleRequestButton(interaction) {
  const req = bountyRequests[interaction.message.id];
  if (!req)
    return interaction.reply({ content: "❌ Ajakan ini sudah kedaluwarsa.", flags: MessageFlags.Ephemeral });

  // Confirmation is per CHARACTER, not per player: someone with two accounts
  // holding this quest has two lines, and one click must not tick both. Each
  // click ticks their next unconfirmed character — so two characters is two
  // clicks, and no picker menu has to exist.
  const userId = interaction.user.id;
  const mine = req.members.filter((m) => m.userId === userId);
  if (!mine.length)
    return interaction.reply({
      content: "Kamu tidak punya bounty di nest ini, jadi tidak ada barismu untuk dicentang.",
      flags: MessageFlags.Ephemeral,
    });

  // More than one character here means the bot cannot know which one you intend
  // to bring — the order is its own, not yours. So it asks, and the menu doubles
  // as the un-tick: whatever you leave unselected becomes unconfirmed.
  if (mine.length > 1) {
    return interaction.reply({
      content: "Karakter mana yang mau kamu bawa?",
      flags: MessageFlags.Ephemeral,
      components: [
        new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(`${REQ_PICK}:${interaction.message.id}`)
            .setPlaceholder("Pilih karakter — boleh lebih dari satu")
            .setMinValues(0)
            .setMaxValues(mine.length)
            .addOptions(
              mine.map((m) => ({
                label: m.charName.slice(0, 100),
                value: ckey(m.userId, m.charName).slice(0, 100),
                description: `${m.quests} quest`,
                default: req.confirmed.includes(ckey(m.userId, m.charName)),
              })),
            ),
        ),
      ],
    });
  }

  // Exactly one character: the click is unambiguous, so it just toggles.
  const only = ckey(mine[0].userId, mine[0].charName);
  const at = req.confirmed.indexOf(only);
  if (at === -1) req.confirmed.push(only);
  else req.confirmed.splice(at, 1);
  saveState();

  await interaction.deferUpdate();
  return interaction.message.edit({ content: renderRequest(req), components: [requestButtons(req)] });
}

async function handleRequestPick(interaction) {
  const requestMsgId = interaction.customId.split(":").pop();
  const req = bountyRequests[requestMsgId];
  if (!req)
    return interaction.reply({ content: "❌ Ajakan ini sudah kedaluwarsa.", flags: MessageFlags.Ephemeral });

  const userId = interaction.user.id;
  // Replace this player's picks wholesale — the menu already showed their
  // current state, so what comes back IS their answer.
  req.confirmed = req.confirmed.filter((c) => !c.startsWith(`${userId}:`)).concat(interaction.values);
  saveState();

  await interaction.update({
    content: interaction.values.length
      ? `✅ ${interaction.values.length} karakter siap.`
      : "Semua centangmu dilepas.",
    components: [],
  });

  const msg = await interaction.channel.messages.fetch(requestMsgId).catch(() => null);
  if (msg) await msg.edit({ content: renderRequest(req), components: [requestButtons(req)] });
}

async function handleRequestGo(interaction) {
  const req = bountyRequests[interaction.message.id];
  if (!req)
    return interaction.reply({ content: "❌ Ajakan ini sudah kedaluwarsa.", flags: MessageFlags.Ephemeral });
  if (!req.confirmed.some((c) => c.startsWith(`${interaction.user.id}:`)))
    return interaction.reply({
      content: "Centang **✅ Saya ikut** dulu — yang buat party harus orang yang memang bisa jalan.",
      flags: MessageFlags.Ephemeral,
    });

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const panel = await createParty(interaction, req.poolKey, req.confirmed);
  if (!panel) return; // createParty already explained why

  // Close the request: the party exists now, so a second click would only make
  // a duplicate panel.
  delete bountyRequests[interaction.message.id];
  saveState();
  return interaction.message.edit({
    content: `${renderRequest(req)}\n\n⚔️ Party sudah dibuat → ${panel.url}`,
    components: [],
  });
}

function startBoard(client) {
  if (!config.bountyBoardChannelId) {
    console.log("📋 Bounty board off (BOUNTY_BOARD_CHANNEL_ID belum diset)");
    return;
  }
  const tick = () => syncBoard(client).catch((err) => console.error("❌ syncBoard:", err.message));
  tick(); // catch up immediately on boot, in case reset passed while we were down
  setInterval(tick, HOUR_MS);
  console.log("📋 Bounty board aktif — dicek tiap jam, ganti pesan tiap reset Sabtu 08:00 WIB");
}

module.exports = {
  buildBoardEmbed, buildBoardComponents, groupByVariant, weekLabelId,
  renderRequest, handleRequestSelect, handleRequestButton,
  handleCreateSelect, handleRequestGo, handleRequestPick, createParty, partyShape, seatHolders, requestButtons,
  syncBoard, startBoard, REQ_SELECT, REQ_OK, REQ_GO, REQ_PICK, NEW_SELECT,
};
