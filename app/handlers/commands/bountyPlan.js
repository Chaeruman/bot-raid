const { MessageFlags } = require("discord.js");
const { getAllChars, getBountyWeekAll } = require("../../state");
const {
  weekKey,
  weekLabel,
  buildPlan,
  fillerCandidates,
  stackSummary,
  renderPlanRow,
  rewardText,
  VARIANT_LIST,
  BY_POOL_KEY,
} = require("../../bounty");
const { DPS_TIERS } = require("../../data/bounty");

// The plan is 2 lines per row and variants outnumber nests several-fold, so the
// list is capped rather than trusted to fit a 4096-char embed. /bounty-need is
// the drill-down for everything below the cut.
const MAX_ROWS = 15;
const MAX_NAMES = 12;

async function loadPlan() {
  const key = weekKey();
  const [weekDocs, charDocs] = await Promise.all([getBountyWeekAll(key), getAllChars()]);
  return { key, charDocs, ...buildPlan(weekDocs, charDocs) };
}

async function handleBountyPlan(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const { rows, spareClaims, charsWithClaims } = await loadPlan();

  const lines = [`**Bounty plan** · ${weekLabel()}`];

  if (!rows.length) {
    lines.push(
      "",
      "Nobody has recorded a unique+ quest yet this week.",
      "Add yours with `/bounty`.",
    );
  } else {
    lines.push("");
    rows.slice(0, MAX_ROWS).forEach((row, i) => lines.push(renderPlanRow(row, i)));
    if (rows.length > MAX_ROWS) lines.push("", `…and ${rows.length - MAX_ROWS} more.`);
    lines.push(
      "",
      `**${charsWithClaims}** characters are free to come along.`,
      "`/bounty-need` to see who.",
    );
  }

  return interaction.editReply(lines.join("\n").slice(0, 2000));
}

async function handleBountyNeed(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const poolKey = interaction.options.getString("dungeon");
  const variant = BY_POOL_KEY.get(poolKey);
  if (!variant) return interaction.editReply(`❌ Unknown nest variant \`${poolKey}\`.`);

  const { rows, committed, charDocs } = await loadPlan();
  const mine = rows.filter((r) => r.variant.poolKey === poolKey);

  const lines = [`**${variant.name}** · ${weekLabel()}`];

  if (!mine.length) {
    // No quests here, but the seats are still worth naming: someone holding this
    // quest needs to know a party is fillable before they bother sharing it.
    const free = fillerCandidates({ stack: [], cost: 1 }, charDocs, committed);
    lines.push(
      "",
      "Nobody has a quest here this week.",
      "",
      `**${free.length}** characters are free to come along if someone finds one.`,
    );
    return interaction.editReply(lines.join("\n").slice(0, 2000));
  }

  for (const row of mine) {
    const heading =
      row.totalRuns > 1 ? `Run ${row.runIndex} of ${row.totalRuns}` : "Stack";
    lines.push(
      "",
      `**${heading}** — ${row.cost} quest${row.cost === 1 ? "" : "s"} from ` +
        `${row.members} character${row.members === 1 ? "" : "s"} · ` +
        `${row.members} of ${row.variant.capacity} in the party` +
        (row.highDpsGap > 0 ? ` · needs ${row.highDpsGap} more high DPS` : ""),
    );
    // One line per CHARACTER, not per quest — two quests on one character read
    // as two people otherwise, which is the same confusion the stack fix removed.
    const byChar = new Map();
    for (const q of row.stack) {
      const k = `${q.userId}:${q.charName}`;
      if (!byChar.has(k)) byChar.set(k, []);
      byChar.get(k).push(q);
    }
    for (const quests of byChar.values()) {
      const q = quests[0];
      const what = quests.map(rewardText).join(" | ");
      lines.push(
        `• **${q.charName}** <@${q.userId}>${quests.length > 1 ? ` (${quests.length} quest)` : ""} — ` +
          `${what}${q.role ? ` · ${q.role}` : ""}${q.dpsTier === "high" ? " · high DPS" : ""}`,
      );
    }

    const fillers = fillerCandidates(row, charDocs, committed);
    if (fillers.length) {
      lines.push("", "**Free to come along:**");
      fillers.slice(0, MAX_NAMES).forEach((f) =>
        lines.push(
          `• **${f.charName}** <@${f.userId}> — ${f.role || "no role"} · ` +
            `${DPS_TIERS[f.dpsTier] || "no tier"}`,
        ),
      );
      if (fillers.length > MAX_NAMES) lines.push(`…and ${fillers.length - MAX_NAMES} more.`);
    }
  }

  return interaction.editReply({
    content: lines.join("\n").slice(0, 2000),
    allowedMentions: { parse: [] }, // names are for reading, not for pinging 12 people
  });
}

// Shared by /bounty-need and (next phase) /bounty-run. Matches the display name
// and both alias sets, so "memo" and "ddn" both find the Memoria rows.
async function autocompleteVariant(interaction) {
  const typed = interaction.options.getFocused().toLowerCase().trim();
  const hits = VARIANT_LIST.filter(
    (v) =>
      !typed ||
      v.name.toLowerCase().includes(typed) ||
      v.nestAliases.some((a) => a.startsWith(typed)) ||
      v.variantAliases.some((a) => a.startsWith(typed)),
  );
  return interaction.respond(
    hits.slice(0, 25).map((v) => ({ name: v.name.slice(0, 100), value: v.poolKey })),
  );
}

module.exports = { handleBountyPlan, handleBountyNeed, autocompleteVariant };
