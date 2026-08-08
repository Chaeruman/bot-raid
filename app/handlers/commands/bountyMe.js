const { MessageFlags } = require("discord.js");
const { getChars, getBountyWeek } = require("../../state");
const { weekKey, weekLabel, questLabel, claimsLeft, claimsUsed, tally } = require("../../bounty");
const { WEEKLY_CLAIMS, SCROLL } = require("../../data/bounty");

function renderTally(t) {
  const parts = [];
  if (t.potion) parts.push(`${t.potion}× Potion Engrave`);
  for (const [key, n] of Object.entries(t.scroll)) {
    if (n) parts.push(`${n}× ${SCROLL[key]?.label || key} scroll`);
  }
  if (t.box) parts.push(`${t.box}× card box`);
  return parts.join(" · ");
}

async function handleBountyMe(interaction) {
  const chars = await getChars(interaction.user.id);
  if (!chars.length)
    return interaction.reply({
      content: "You have no characters yet. Add one with `/bounty-char add`.",
      flags: MessageFlags.Ephemeral,
    });

  const doc = await getBountyWeek(interaction.user.id, weekKey());
  const byChar = doc?.chars || {};

  const lines = [`**Your bounty week** · ${weekLabel()}`];
  const total = { potion: 0, box: 0, scroll: {} };
  let anyQuests = false;

  for (const c of chars) {
    const charWeek = byChar[c.name];
    const board = charWeek?.board || [];
    const shares = charWeek?.shares || [];
    // Characters with nothing recorded are skipped entirely — a roster of 15
    // would otherwise bury the 3 that actually matter this week.
    if (!board.length && !shares.length) continue;

    anyQuests = true;
    lines.push("", `**${c.name}** — ${claimsLeft(charWeek)}/${WEEKLY_CLAIMS} claims left`);
    board.forEach((q) => lines.push(`${q.runId ? "✓" : "○"} ${questLabel(q)}`));
    if (shares.length) lines.push(`  ↳ +${shares.length} received from other people's stacks`);

    const t = tally(charWeek);
    total.potion += t.potion;
    total.box += t.box;
    for (const [k, n] of Object.entries(t.scroll)) total.scroll[k] = (total.scroll[k] || 0) + n;
    if (claimsUsed(charWeek)) lines.push(`  earned: ${renderTally(t)}`);
  }

  if (!anyQuests) {
    lines.push(
      "",
      "No quests recorded this week. Add them with `/bounty`.",
      `You have ${chars.length} character(s), each with ${WEEKLY_CLAIMS} claims to spend.`,
    );
  } else {
    const summary = renderTally(total);
    if (summary) lines.push("", `**Total earned this week:** ${summary}`);
  }

  return interaction.reply({
    content: lines.join("\n").slice(0, 2000),
    flags: MessageFlags.Ephemeral,
  });
}

module.exports = { handleBountyMe };
