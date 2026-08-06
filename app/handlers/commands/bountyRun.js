const {
  MessageFlags,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const {
  activeEvents,
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
  buildPlan,
  fillerCandidates,
  claimsLeft,
} = require("../../bounty");
const { RARITY, WEEKLY_CLAIMS, rankOf } = require("../../data/bounty");

// A bounty run is ad-hoc: everyone is already online and the party is decided
// before the panel exists. So the bot BUILDS the party and people only correct
// it — the opposite of the raid signup, where an empty sheet fills up over time.
// The one thing the bot can't know is who is online, and that's exactly what
// "Can't make it" is for.

// Fill empty seats from the bench, best candidate first. Pure — the only bit of
// this file with logic worth a check.
function fillSeats(party, bench, capacity) {
  while (party.length < capacity && bench.length) party.push({ ...bench.shift(), quest: null });
  return party;
}

const stackCost = (event) => event.party.filter((p) => p.quest).length;

// poolKey omitted → take the top of the plan. buildPlan already sorted by value
// (reward per clear), so rows[0] IS "the one most worth running right now" and
// there is no second opinion to compute.
async function buildParty(poolKey) {
  const wk = weekKey();
  const [weekDocs, charDocs] = await Promise.all([getBountyWeekAll(wk), getAllChars()]);
  const { rows, committed } = buildPlan(weekDocs, charDocs);

  const row = poolKey ? rows.find((r) => r.variant.poolKey === poolKey) : rows[0];
  const variant = poolKey ? BY_POOL_KEY.get(poolKey) : row?.variant;
  if (!variant) return null; // nothing stacked anywhere, and no variant asked for

  const stack = row ? row.stack : [];

  const party = stack.map((q) => ({
    userId: q.userId,
    charName: q.charName,
    role: q.role,
    dpsTier: q.dpsTier,
    claimsLeft: WEEKLY_CLAIMS,
    quest: { poolKey: q.poolKey, rarity: q.rarity, scroll: q.scroll, box: q.box },
  }));

  const bench = fillerCandidates(row || { stack: [], cost: 1 }, charDocs, committed);
  fillSeats(party, bench, variant.capacity);

  return { party, bench, wk, variant, picked: !poolKey };
}

function buildPartyMessage(event) {
  const cost = stackCost(event);
  const desc = [`**Host:** <@${event.hostId}>`];

  desc.push(
    cost
      ? `🎯 Stack **${cost}** — everyone here spends **${cost}** claim${cost === 1 ? "" : "s"} and receives all ${cost}`
      : "🎯 No quests stacked — nobody gets paid unless a holder joins",
  );
  desc.push("");

  if (event.party.length) {
    for (const p of event.party) {
      const what = p.quest
        ? `${RARITY[p.quest.rarity]?.label || p.quest.rarity}${p.quest.box ? " + card box" : ""}`
        : "filling a seat";
      desc.push(
        `• **${p.charName}** <@${p.userId}> — ${what} · ${p.role || "no role"}` +
          `${p.dpsTier === "high" ? " · high DPS" : ""}`,
      );
    }
  } else {
    desc.push("_Nobody available — no registered character has claims left._");
  }

  const short = event.party.filter((p) => p.claimsLeft < cost);
  if (short.length)
    desc.push(
      "",
      `⚠️ short on claims: ${short.map((p) => `${p.charName} (${p.claimsLeft})`).join(", ")}`,
    );

  const gap = event.bounty.minHighDps - event.party.filter((p) => p.dpsTier === "high").length;
  if (gap > 0) desc.push(`⚠️ needs ${gap} more high DPS`);

  const seats = event.bounty.capacity - event.party.length;
  if (seats > 0) desc.push("", `_${seats} seat(s) empty · ${event.bench.length} on the bench_`);

  return {
    // Ping only on the first render; later edits keep the text but Discord does
    // not re-notify on an edit, so nobody gets pinged twice.
    content: event.party.map((p) => `<@${p.userId}>`).join(" "),
    embeds: [
      new EmbedBuilder()
        .setTitle(`${event.title} (${event.party.length}/${event.bounty.capacity})`)
        .setColor(cost ? 0x2ecc71 : 0x5865f2)
        .setDescription(desc.join("\n").slice(0, 4000)),
    ],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("bounty_leave")
          .setLabel("❌ Can't make it")
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId("bounty_join")
          .setLabel("➕ Join")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("done_run").setLabel("✅ Done").setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId("cancel_run")
          .setLabel("🛑 Cancel")
          .setStyle(ButtonStyle.Danger),
      ),
    ],
  };
}

async function handleBountyRun(interaction) {
  const poolKey = interaction.options.getString("dungeon");
  if (poolKey && !BY_POOL_KEY.has(poolKey))
    return interaction.reply({
      content: `❌ Unknown nest variant \`${poolKey}\`.`,
      flags: MessageFlags.Ephemeral,
    });

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const built = await buildParty(poolKey);
  if (!built)
    return interaction.editReply(
      "Nothing worth running — nobody has an unclaimed unique+ quest this week. " +
        "Pass `dungeon:` to open one anyway.",
    );
  const { party, bench, wk, variant, picked } = built;

  const event = {
    messageId: null,
    createdAt: Date.now(),
    hostId: interaction.user.id,
    title: `Bounty — ${variant.name}`,
    bounty: {
      poolKey,
      weekKey: wk,
      minHighDps: variant.minHighDps,
      capacity: variant.capacity,
    },
    party,
    bench,
  };

  const msg = await interaction.channel.send({ content: "Loading…" });
  event.messageId = msg.id;
  activeEvents[msg.id] = event;
  saveState();

  await msg.edit(buildPartyMessage(event));
  return interaction.editReply(
    `**${event.title}** posted — ${party.length} in the party.` +
      (picked ? " (top of `/bounty-plan`)" : ""),
  );
}

// Look a player up when they weren't on the bench — either they have too few
// claims (allowed to join anyway, they just waste the difference) or they were
// added since the panel was built.
async function pickCharacter(userId, event) {
  const [chars, week] = await Promise.all([
    getChars(userId),
    getBountyWeek(userId, event.bounty.weekKey),
  ]);
  const byName = week?.chars || {};

  let pick = null;
  for (const c of chars) {
    const charWeek = byName[c.name];
    const quest = (charWeek?.board || []).find((q) => q.poolKey === event.bounty.poolKey && !q.runId);
    const entry = {
      userId,
      charName: c.name,
      role: c.role || null,
      dpsTier: c.dpsTier || null,
      claimsLeft: claimsLeft(charWeek),
      quest: quest
        ? { poolKey: quest.poolKey, rarity: quest.rarity, scroll: quest.scroll, box: quest.box }
        : null,
    };
    if (quest) return entry; // a holder always wins — their quest is why the run exists
    if (!pick || entry.claimsLeft > pick.claimsLeft) pick = entry;
  }
  return pick;
}

async function handleBountyLeave(interaction, event) {
  const i = event.party.findIndex((p) => p.userId === interaction.user.id);
  if (i === -1) return;

  event.party.splice(i, 1);
  fillSeats(event.party, event.bench, event.bounty.capacity); // auto-promote the next candidate
  saveState();
  return interaction.message.edit(buildPartyMessage(event));
}

async function handleBountyJoin(interaction, event) {
  const userId = interaction.user.id;
  if (event.party.some((p) => p.userId === userId)) return;
  if (event.party.length >= event.bounty.capacity) {
    return interaction.followUp({ content: "❌ Party is full.", flags: MessageFlags.Ephemeral });
  }

  const benched = event.bench.findIndex((b) => b.userId === userId);
  const entry =
    benched >= 0 ? { ...event.bench.splice(benched, 1)[0], quest: null } : await pickCharacter(userId, event);

  if (!entry)
    return interaction.followUp({
      content: "❌ You have no characters. Add one with `/bounty-char add`.",
      flags: MessageFlags.Ephemeral,
    });

  event.party.push(entry);
  saveState();
  return interaction.message.edit(buildPartyMessage(event));
}

// Every party member completes every quest in the stack and spends one claim per
// quest. A member with fewer claims left than the stack is deep records the
// highest-ranked ones they can afford and wastes the rest.
async function finishBountyRun(interaction, event) {
  const stack = event.party.filter((p) => p.quest).map((p) => p.quest);
  const runId = event.messageId;
  const wk = event.bounty.weekKey;
  const summary = [];

  for (const member of event.party) {
    const doc = (await getBountyWeek(member.userId, wk)) || {
      _id: `${member.userId}:${wk}`,
      owners: [member.userId],
      weekKey: wk,
      chars: {},
    };
    if (!doc.chars) doc.chars = {};
    const charWeek =
      doc.chars[member.charName] || (doc.chars[member.charName] = { board: [], shares: [] });

    const take = [...stack].sort((a, b) => rankOf(b) - rankOf(a)).slice(0, claimsLeft(charWeek));
    for (const q of take) {
      // Their own copy gets marked claimed; everything else in the stack is a
      // share. Both cost one claim and pay exactly the same.
      const own = (charWeek.board || []).find(
        (b) =>
          !b.runId &&
          b.poolKey === q.poolKey &&
          b.rarity === q.rarity &&
          b.scroll === q.scroll &&
          !!b.box === !!q.box,
      );
      if (own) own.runId = runId;
      else charWeek.shares.push({ ...q, runId });
    }

    await saveBountyWeek(doc);
    const wasted = stack.length - take.length;
    summary.push(
      `• ${member.charName} +${take.length}${wasted ? ` (${wasted} wasted — out of claims)` : ""}`,
    );
  }

  const head = stack.length
    ? `✅ **${event.title}** — stack of ${stack.length}, ${summary.length} member(s) paid.`
    : `✅ **${event.title}** — no quests were stacked, so nobody was paid.`;

  return interaction.message.edit({
    content: [head, ...summary].join("\n").slice(0, 2000),
    embeds: [],
    components: [],
  });
}

module.exports = {
  handleBountyRun,
  handleBountyLeave,
  handleBountyJoin,
  finishBountyRun,
  fillSeats,
  buildPartyMessage,
};
