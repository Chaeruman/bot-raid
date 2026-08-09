// Marking your own quests done, and taking it back.
//
// The bot only ever learned a quest was finished when a host pressed Done on a
// signup panel, so a party formed in chat left it "○" forever — and the board,
// whose whole job is "who still has GDN Classic?", kept sending people after
// someone who was already finished. That costs other people's evenings, not
// just an inaccurate number.
//
// It adds no new trust: the quest was self-reported in the first place. The bot
// believed you about HOLDING it and refused to believe you about finishing it.
const { MessageFlags, ActionRowBuilder, StringSelectMenuBuilder } = require("discord.js");
const { getBountyWeek, saveBountyWeek } = require("../../state");
const { weekKey, questLabel } = require("../../bounty");

const MARK = "bounty-mark:"; // + <done|undo>

// Not a message id. Keeping the two apart is the only way to tell later whether
// a quest was closed by a tracked run or reported by the person who ran it, and
// writing the same value for both would lose that for good.
const MANUAL = "manual";

const MAX_OPTS = 25;

// value = poolKey|rarity|scroll|box|charName — the name goes LAST because it is
// the only part that may contain anything.
const encode = (charName, q) =>
  `${q.poolKey}|${q.rarity}|${q.scroll}|${q.box ? 1 : 0}|${charName}`.slice(0, 100);

const decode = (value) => {
  const [poolKey, rarity, scroll, box, ...rest] = value.split("|");
  return { poolKey, rarity, scroll, box: box === "1", charName: rest.join("|") };
};

const matches = (q, want) =>
  q.poolKey === want.poolKey && q.rarity === want.rarity && q.scroll === want.scroll && !!q.box === want.box;

// Every quest in the state the caller is asking about, across the whole roster.
// One flat list rather than "pick a character, then pick a quest": people hold a
// handful of quests, not a screenful, so a second step would buy nothing.
function questsIn(doc, undo) {
  const out = [];
  for (const [charName, charWeek] of Object.entries(doc?.chars || {}))
    for (const q of charWeek.board || []) if (undo ? q.runId : !q.runId) out.push({ charName, q });
  return out;
}

async function buildMarkRows(userId, undo) {
  const doc = await getBountyWeek(userId, weekKey());
  const list = questsIn(doc, undo);
  if (!list.length) return { rows: [], count: 0 };

  const menu = new StringSelectMenuBuilder()
    .setCustomId(`${MARK}${undo ? "undo" : "done"}`)
    .setPlaceholder(undo ? "Batalkan tanda selesai" : "Pilih yang sudah kelar")
    .setMinValues(1)
    .setMaxValues(Math.min(list.length, MAX_OPTS))
    .addOptions(
      list.slice(0, MAX_OPTS).map(({ charName, q }) => ({
        label: `${charName} · ${questLabel(q)}`.slice(0, 100),
        value: encode(charName, q),
      })),
    );

  return { rows: [new ActionRowBuilder().addComponents(menu)], count: list.length };
}

async function handleMark(interaction) {
  const undo = interaction.customId.slice(MARK.length) === "undo";
  const userId = interaction.user.id;

  const doc = await getBountyWeek(userId, weekKey());
  if (!doc) return interaction.update({ content: "❌ Tidak ada data minggu ini.", components: [] });

  const wanted = interaction.values.map(decode);
  const changed = [];

  for (const want of wanted) {
    const board = doc.chars?.[want.charName]?.board || [];
    // The first one that matches and is in the state being changed. Two
    // identical quests on one character cannot happen — the board dedupes on
    // exactly these fields when they go in.
    const q = board.find((x) => matches(x, want) && (undo ? x.runId : !x.runId));
    if (!q) continue;
    q.runId = undo ? null : MANUAL;
    changed.push({ charName: want.charName, q });
  }

  if (!changed.length)
    return interaction.update({ content: "Tidak ada yang berubah.", components: [] });

  if (!(await saveBountyWeek(doc)))
    return interaction.update({
      content: "⚠️ Database tidak tersambung — tidak ada yang tersimpan.",
      components: [],
    });

  require("../../bountyBoard").syncBoard(interaction.client).catch(() => {});
  require("../../bountyThread").refreshThread(interaction.client, userId).catch(() => {});

  return interaction.update({
    content: [
      undo ? `↩️ ${changed.length} quest dikembalikan ke belum selesai:` : `✅ ${changed.length} quest ditandai selesai:`,
      ...changed.map(({ charName, q }) => `• **${charName}** — ${questLabel(q)}`),
    ]
      .join("\n")
      .slice(0, 2000),
    components: [],
  });
}

module.exports = { handleMark, buildMarkRows, questsIn, MARK, MANUAL };
