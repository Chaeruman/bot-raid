const {
  MessageFlags,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require("discord.js");
const config = require("../../config");
const {
  bountyCards,
  saveState,
  getChars,
  getAllChars,
  getBountyWeek,
  saveBountyWeek,
  getBountyWeekAll,
} = require("../../state");
const {
  BY_POOL_KEY,
  weekKey,
  weekLabel,
  buildPlan,
  fillerCandidates,
  parseRoster,
  matchName,
  claimsLeft,
  questLabel,
  ckey,
} = require("../../bounty");
const { assignRoles, renderParty } = require("../../bountyBoard");
const { WEEKLY_CLAIMS, rankOf } = require("../../data/bounty");

// A card appears once this many people hold the same quest. 1 while testing —
// raise it to 2 once there's enough traffic that single-holder cards are noise.
const AUTO_POST_MIN = 1;

const MODAL_ID = "bounty:modal";
const BTN = "bounty-card:"; // bounty-card:<action>:<poolKey>
const cardKey = (wk, poolKey) => `${wk}:${poolKey}`;

// ── /bounty ──────────────────────────────────────────────────────────────────

const handleBounty = (interaction) =>
  interaction.showModal(
    new ModalBuilder()
      .setCustomId(MODAL_ID)
      .setTitle(`Bounty ${weekLabel()}`.slice(0, 45))
      .addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("lines")
            .setLabel("Satu baris per quest")
            .setPlaceholder("elestra: gdn cl u wep\nsaint: ddn hc leg acc box")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setMaxLength(2000),
        ),
      ),
  );

async function handleBountyModal(interaction) {
  const userId = interaction.user.id;
  const { byChar, errors } = parseRoster(interaction.fields.getTextInputValue("lines"));
  const chars = await getChars(userId);
  const names = chars.map((c) => c.name);

  const wk = weekKey();
  const doc = (await getBountyWeek(userId, wk)) || {
    _id: `${userId}:${wk}`,
    owners: [userId],
    weekKey: wk,
    chars: {},
  };
  if (!doc.chars) doc.chars = {};

  const saved = [];
  const touched = new Set();

  for (const [typed, quests] of byChar) {
    const name = matchName(typed, names);
    if (!name) {
      errors.push({ raw: typed, error: `karakter tidak ada di roster`, hint: names.join(", ") });
      continue;
    }
    const charWeek = doc.chars[name] || (doc.chars[name] = { board: [], shares: [] });
    // Re-running /bounty replaces only the characters you mentioned, and only
    // their unclaimed quests — so fixing a typo is retyping one line, and
    // anything already run stays as history.
    charWeek.board = charWeek.board.filter((q) => q.runId);
    for (const q of quests.slice(0, WEEKLY_CLAIMS)) {
      charWeek.board.push({
        poolKey: q.poolKey,
        rarity: q.rarity,
        scroll: q.scroll,
        box: !!q.box,
        runId: null,
      });
      saved.push({ name, ...q });
      touched.add(q.poolKey);
    }
  }

  if (saved.length && !(await saveBountyWeek(doc)))
    return interaction.reply({
      content: "⚠️ MongoDB tidak aktif — tidak tersimpan.",
      flags: MessageFlags.Ephemeral,
    });

  const lines = saved.length
    ? [`✅ ${saved.length} quest tercatat:`, ...saved.map((s) => `• **${s.name}** — ${questLabel(s)}`)]
    : ["Tidak ada yang tercatat."];
  if (errors.length) {
    lines.push("", `❌ ${errors.length} baris gagal:`);
    errors.slice(0, 6).forEach((e) =>
      lines.push(`• \`${e.raw}\` — ${e.error}${e.hint ? `\n  ↳ ${e.hint}` : ""}`),
    );
  }

  await interaction.reply({ content: lines.join("\n").slice(0, 2000), flags: MessageFlags.Ephemeral });
  for (const poolKey of touched) await syncCard(interaction.client, interaction.channel, poolKey);
}

// ── The card ─────────────────────────────────────────────────────────────────

// Everything shown is derived from the week's documents, so a card can be
// rebuilt from scratch at any time and can never disagree with the data.
async function buildCard(poolKey) {
  const wk = weekKey();
  const variant = BY_POOL_KEY.get(poolKey);
  const [weekDocs, charDocs] = await Promise.all([getBountyWeekAll(wk), getAllChars()]);
  const { rows, committed } = buildPlan(weekDocs, charDocs);
  const parties = rows.filter((r) => r.variant.poolKey === poolKey);

  const state = bountyCards[cardKey(wk, poolKey)];
  const fillers = state?.fillers || [];
  const done = !!state?.runId;

  const embed = new EmbedBuilder()
    .setTitle(`${variant.name} · ${weekLabel()}`)
    .setColor(done ? 0x95a5a6 : parties.length ? 0x2ecc71 : 0x5865f2);

  if (!parties.length) {
    embed.setDescription("_Belum ada yang punya quest di sini._");
  } else {
    const first = parties[0];
    embed.setDescription(
      `stack **${first.cost}** — semua yang ikut pakai **${first.cost}** claim dan dapat semuanya` +
        (done ? "\n\n✅ **Sudah selesai**" : ""),
    );

    parties.forEach((row, i) => {
      const entries = i === 0 ? [...row.stack, ...fillers] : row.stack;
      const assigned = assignRoles(entries, variant.capacity);
      const extra = assigned.overflow.length ? `\n_${assigned.overflow.length} tanpa slot role._` : "";
      embed.addFields({
        name: parties.length > 1 ? `Party ${i + 1}` : "Party",
        value: (renderParty(assigned) + extra).slice(0, 1024),
      });
    });

    const seats = variant.capacity - (first.stack.length + fillers.length);
    const spare = fillerCandidates(first, charDocs, committed).length;
    embed.setFooter({
      text: `${Math.max(0, seats)} kursi kosong · ${spare} karakter masih punya claim`,
    });
  }

  const btn = (action, label, style, disabled = false) =>
    new ButtonBuilder()
      .setCustomId(`${BTN}${action}:${poolKey}`)
      .setLabel(label)
      .setStyle(style)
      .setDisabled(disabled);

  const row = done
    ? new ActionRowBuilder().addComponents(btn("undo", "↩️ Batal selesai", ButtonStyle.Secondary))
    : new ActionRowBuilder().addComponents(
        btn("join", "➕ Gabung", ButtonStyle.Primary),
        btn("leave", "❌ Keluar", ButtonStyle.Secondary),
        btn("done", "✅ Selesai", ButtonStyle.Success, !parties.length),
      );

  return { embeds: [embed], components: [row], holders: parties[0]?.stack.length || 0 };
}

// Post the card the first time enough people hold the quest, edit it after.
async function syncCard(client, fallbackChannel, poolKey) {
  const wk = weekKey();
  const key = cardKey(wk, poolKey);
  const card = await buildCard(poolKey);
  const state = bountyCards[key];

  if (!state) {
    if (card.holders < AUTO_POST_MIN) return;
    const channel = config.bountyChannelId
      ? await client.channels.fetch(config.bountyChannelId).catch(() => null)
      : fallbackChannel;
    if (!channel) return;
    const msg = await channel.send({ embeds: card.embeds, components: card.components });
    bountyCards[key] = { messageId: msg.id, channelId: channel.id, fillers: [], runId: null };
    saveState();
    return;
  }

  const channel = await client.channels.fetch(state.channelId).catch(() => null);
  const msg = await channel?.messages.fetch(state.messageId).catch(() => null);
  if (!msg) {
    delete bountyCards[key]; // card was deleted — let the next quest repost it
    saveState();
    return;
  }
  await msg.edit({ embeds: card.embeds, components: card.components });
}

// ── Card buttons ─────────────────────────────────────────────────────────────

async function handleCardButton(interaction) {
  const [, action, poolKey] = interaction.customId.split(":");
  const wk = weekKey();
  const state = bountyCards[cardKey(wk, poolKey)];
  if (!state)
    return interaction.reply({ content: "❌ Kartu ini sudah tidak aktif.", flags: MessageFlags.Ephemeral });

  const userId = interaction.user.id;
  const say = (content) => interaction.reply({ content, flags: MessageFlags.Ephemeral });

  if (action === "join") {
    if (state.runId) return say("❌ Party ini sudah selesai.");
    const [chars, week] = await Promise.all([getChars(userId), getBountyWeek(userId, wk)]);
    if (!chars.length) return say("Kamu belum punya karakter. `/bounty-char add` dulu.");
    if (state.fillers.some((f) => f.userId === userId)) return say("Kamu sudah ikut.");

    // Pick the character with the most claims left — the one whose week is most
    // wasted by sitting out.
    const best = [...chars].sort(
      (a, b) => claimsLeft(week?.chars?.[b.name]) - claimsLeft(week?.chars?.[a.name]),
    )[0];
    state.fillers.push({ userId, charName: best.name, role: best.role, dpsTier: best.dpsTier });
    saveState();
    await say(`✅ **${best.name}** ikut.`);
  } else if (action === "leave") {
    const i = state.fillers.findIndex((f) => f.userId === userId);
    if (i === -1) return say("Kamu tidak ada di daftar tumpangan.");
    state.fillers.splice(i, 1);
    saveState();
    await say("❌ Kamu keluar.");
  } else if (action === "done") {
    if (state.runId) return say("Sudah selesai.");
    const onCard = await isOnCard(userId, poolKey, state, wk);
    if (!onCard) return say("❌ Cuma yang ada di party ini yang bisa menyelesaikan.");
    await finishCard(poolKey, state, wk);
    await say("✅ Claim tercatat. Salah pencet? Klik **Batal selesai**.");
  } else if (action === "undo") {
    if (!state.runId) return say("Belum selesai.");
    await undoCard(state, wk);
    await say("↩️ Dibatalkan — claim dikembalikan.");
  } else return;

  return syncCard(interaction.client, interaction.channel, poolKey);
}

async function isOnCard(userId, poolKey, state, wk) {
  if (state.fillers.some((f) => f.userId === userId)) return true;
  const doc = await getBountyWeek(userId, wk);
  return Object.values(doc?.chars || {}).some((c) =>
    (c.board || []).some((q) => q.poolKey === poolKey && !q.runId),
  );
}

// Everyone on the card completes every quest in the stack and spends one claim
// each, capped by what they have left.
async function finishCard(poolKey, state, wk) {
  const [weekDocs, charDocs] = await Promise.all([getBountyWeekAll(wk), getAllChars()]);
  const { rows } = buildPlan(weekDocs, charDocs);
  const first = rows.find((r) => r.variant.poolKey === poolKey);
  if (!first) return;

  const stack = first.stack.map((q) => ({
    poolKey: q.poolKey, rarity: q.rarity, scroll: q.scroll, box: q.box,
  }));
  const runId = state.messageId;
  const members = [
    ...first.stack.map((q) => ({ userId: q.userId, charName: q.charName })),
    ...state.fillers,
  ];

  for (const m of members) {
    const doc = (await getBountyWeek(m.userId, wk)) || {
      _id: `${m.userId}:${wk}`, owners: [m.userId], weekKey: wk, chars: {},
    };
    if (!doc.chars) doc.chars = {};
    const charWeek = doc.chars[m.charName] || (doc.chars[m.charName] = { board: [], shares: [] });

    for (const q of [...stack].sort((a, b) => rankOf(b) - rankOf(a)).slice(0, claimsLeft(charWeek))) {
      const own = (charWeek.board || []).find(
        (b) => !b.runId && b.poolKey === q.poolKey && b.rarity === q.rarity &&
          b.scroll === q.scroll && !!b.box === !!q.box,
      );
      if (own) own.runId = runId;
      else charWeek.shares.push({ ...q, runId });
    }
    await saveBountyWeek(doc);
  }

  state.runId = runId;
  saveState();
}

// Undo is why Selesai is safe to leave unlocked: a wrong click costs one more
// click, not someone's week.
async function undoCard(state, wk) {
  const runId = state.runId;
  for (const doc of await getBountyWeekAll(wk)) {
    let changed = false;
    for (const charWeek of Object.values(doc.chars || {})) {
      for (const q of charWeek.board || []) {
        if (q.runId === runId) {
          q.runId = null;
          changed = true;
        }
      }
      const before = (charWeek.shares || []).length;
      charWeek.shares = (charWeek.shares || []).filter((s) => s.runId !== runId);
      if (charWeek.shares.length !== before) changed = true;
    }
    if (changed) await saveBountyWeek(doc);
  }
  state.runId = null;
  saveState();
}

module.exports = { handleBounty, handleBountyModal, handleCardButton, BTN, MODAL_ID, AUTO_POST_MIN };
