const { MessageFlags } = require("discord.js");
const { getChars, getBountyWeek, saveBountyWeek } = require("../../state");
const { parseQuestLines, weekKey, weekLabel, questLabel, claimsLeft } = require("../../bounty");
const { WEEKLY_CLAIMS } = require("../../data/bounty");
const { MODAL_PREFIX } = require("../commands/bountyQuest");

const sig = (q) => `${q.poolKey}|${q.rarity}|${q.scroll}|${q.box ? 1 : 0}`;

async function handleBountyQuestModal(interaction) {
  const replace = interaction.customId.slice(MODAL_PREFIX.length) === "r";
  // The character comes from the modal's own select, so no name is ever carried
  // in the customId — which also ends the "names may contain ':'" problem.
  const charName = interaction.fields.getStringSelectValues("char")[0];

  const { added, errors, duplicates } = parseQuestLines(
    interaction.fields.getTextInputValue("lines"),
  );

  const userId = interaction.user.id;
  const key = weekKey();
  const doc = (await getBountyWeek(userId, key)) || {
    _id: `${userId}:${key}`,
    owners: [userId], // array from day one, so /bounty-link migrates nothing later
    weekKey: key,
    chars: {},
  };
  if (!doc.chars) doc.chars = {};
  const charWeek = doc.chars[charName] || (doc.chars[charName] = { board: [], shares: [] });

  // Replace drops only the UNCLAIMED quests — anything already run is real
  // history and a typo fix must not delete it. It is also skipped entirely when
  // nothing parsed, so a paste of pure typos reports the typos instead of
  // silently emptying the board.
  const replacing = replace && added.length > 0;
  if (replacing) charWeek.board = charWeek.board.filter((q) => q.runId);

  const seen = new Set(charWeek.board.map(sig));
  const saved = [];
  const repeats = [...duplicates];
  const overflow = [];

  for (const q of added) {
    if (seen.has(sig(q))) {
      repeats.push(q);
      continue;
    }
    // The board holds exactly 6 quests, so it can never hold a 7th.
    if (charWeek.board.length >= WEEKLY_CLAIMS) {
      overflow.push(q);
      continue;
    }
    seen.add(sig(q));
    charWeek.board.push({
      poolKey: q.poolKey,
      rarity: q.rarity,
      scroll: q.scroll,
      box: !!q.box,
      runId: null,
    });
    saved.push(q);
  }

  if (saved.length && !(await saveBountyWeek(doc)))
    return interaction.reply({
      content: "⚠️ MongoDB is not configured — nothing was saved.",
      flags: MessageFlags.Ephemeral,
    });

  const lines = [`**${charName}** · ${weekLabel()}`];

  if (saved.length) {
    lines.push("", `${replacing ? "🔁 Replaced with" : "✅ Added"} ${saved.length}:`);
    saved.forEach((q) => lines.push(`• ${questLabel(q)}`));
  } else if (!errors.length) {
    lines.push("", "Nothing new to add.");
  }

  lines.push(
    "",
    `Board: **${charWeek.board.length}/${WEEKLY_CLAIMS}** quests · **${claimsLeft(charWeek)}** claims left`,
  );

  if (repeats.length) lines.push("", `↩️ Skipped ${repeats.length} already on the board.`);

  if (overflow.length)
    lines.push(
      "",
      `⚠️ Board is full at ${WEEKLY_CLAIMS} — ${overflow.length} line(s) dropped. ` +
        "Use `/bounty replace:true` to redo them.",
    );

  if (errors.length) {
    lines.push("", `❌ ${errors.length} line(s) not understood:`);
    errors.slice(0, 6).forEach((e) => {
      lines.push(`• \`${e.raw}\` — ${e.error}${e.hint ? `\n  ↳ ${e.hint}` : ""}`);
    });
  }

  if (saved.length) require("../../bountyBoard").syncBoard(interaction.client).catch(() => {});

  const payload = { content: lines.join("\n").slice(0, 2000), flags: MessageFlags.Ephemeral };

  // Opened from the panel: redraw it so the new quests show, and put the parse
  // result underneath. From the slash command there is no panel to redraw.
  if (interaction.isFromMessage()) {
    await interaction.update(await require("../../bountyPanel").buildPanel(userId));
    return interaction.followUp(payload);
  }
  return interaction.reply(payload);
}

module.exports = { handleBountyQuestModal };
