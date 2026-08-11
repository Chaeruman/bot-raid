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

const MARK = "bounty-mark:"; // + <done|undo|drop>

// Dropping only ever offers quests that are still open. A finished quest is
// history, and the way to remove one is to press Undo first — which makes the
// destructive step visible instead of hiding it behind a second meaning.
const LIST = {
  done: { undo: false, placeholder: "Pilih yang sudah kelar", prompt: "Pilih yang sudah kelar:", empty: "Tidak ada quest yang belum kelar." },
  undo: { undo: true, placeholder: "Batalkan tanda selesai", prompt: "Pilih yang mau dikembalikan:", empty: "Belum ada yang ditandai selesai." },
  drop: { undo: false, placeholder: "Pilih yang mau dihapus", prompt: "Pilih yang mau dihapus — ini tidak bisa dibatalkan:", empty: "Tidak ada quest yang bisa dihapus. Yang sudah kelar: tekan ↩️ Undo dulu." },
};

// Not a message id. Keeping the two apart is the only way to tell later whether
// a quest was closed by a tracked run or reported by the person who ran it, and
// writing the same value for both would lose that for good.
const MANUAL = "manual";

const MAX_OPTS = 25;

// value = nth|poolKey|rarity|scroll|box|charName — the name goes LAST because
// it is the only part that may contain anything.
//
// `nth` exists only to keep the values distinct. A board can hold the same
// quest twice, and two options with one value cannot both be chosen — so the
// second copy would have been unselectable. It is never used to find the quest:
// the handler still takes the first row that matches and is in the state being
// changed, which walks through the copies one selection at a time.
const encode = (charName, q, nth = 0) =>
  `${nth}|${q.poolKey}|${q.rarity}|${q.scroll}|${q.box ? 1 : 0}|${charName}`.slice(0, 100);

const decode = (value) => {
  const [, poolKey, rarity, scroll, box, ...rest] = value.split("|");
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

async function buildMarkRows(userId, mode = "done") {
  const cfg = LIST[mode] || LIST.done;
  const doc = await getBountyWeek(userId, weekKey());
  const list = questsIn(doc, cfg.undo);
  if (!list.length) return { rows: [], count: 0 };

  const menu = new StringSelectMenuBuilder()
    .setCustomId(`${MARK}${LIST[mode] ? mode : "done"}`)
    .setPlaceholder(cfg.placeholder)
    .setMinValues(1)
    .setMaxValues(Math.min(list.length, MAX_OPTS))
    .addOptions(
      list.slice(0, MAX_OPTS).map(({ charName, q }, i) => ({
        label: `${charName} · ${questLabel(q)}`.slice(0, 100),
        value: encode(charName, q, i),
      })),
    );

  return { rows: [new ActionRowBuilder().addComponents(menu)], count: list.length };
}

// Extracted so the destructive path can be tested without a database: the
// caller owns loading and saving, this owns what changes.
function applyMark(doc, mode, wanted) {
  const undo = mode === "undo";
  const drop = mode === "drop";
  const changed = [];

  for (const want of wanted) {
    const board = doc.chars?.[want.charName]?.board || [];
    // The first one that matches and is in the state being changed. A board CAN
    // hold the same quest twice, so this deliberately takes one of them: two
    // identical rows are interchangeable, and the menu offered one line each.
    const at = board.findIndex((x) => matches(x, want) && (undo ? x.runId : !x.runId));
    if (at < 0) continue;
    const q = board[at];
    // Re-checked here, not only when the menu was built: a run can close
    // between opening the list and choosing from it, and a quest that finished
    // in that gap must not be deleted by a click aimed at an open one.
    if (drop) {
      if (q.runId) continue;
      board.splice(at, 1);
    } else {
      q.runId = undo ? null : MANUAL;
    }
    changed.push({ charName: want.charName, q });
  }
  return changed;
}

async function handleMark(interaction) {
  const mode = interaction.customId.slice(MARK.length);
  const undo = mode === "undo";
  const drop = mode === "drop";
  const userId = interaction.user.id;

  const doc = await getBountyWeek(userId, weekKey());
  if (!doc) return interaction.update({ content: "❌ Tidak ada data minggu ini.", components: [] });

  const changed = applyMark(doc, mode, interaction.values.map(decode));

  if (!changed.length)
    return interaction.update({ content: "Tidak ada yang berubah.", components: [] });

  if (!(await saveBountyWeek(doc)))
    return interaction.update({
      content: "⚠️ Database tidak tersambung — tidak ada yang tersimpan.",
      components: [],
    });

  require("../../bountyBoard").syncBoard(interaction.client).catch(() => {});
  require("../../bountyThread").refreshThread(interaction.client, userId).catch(() => {});

  const headline = drop
    ? `🗑️ ${changed.length} quest dihapus:`
    : undo
      ? `↩️ ${changed.length} quest dikembalikan ke belum selesai:`
      : `✅ ${changed.length} quest ditandai selesai:`;

  return interaction.update({
    content: [
      headline,
      ...changed.map(({ charName, q }) => `• **${charName}** — ${questLabel(q)}`),
    ]
      .join("\n")
      .slice(0, 2000),
    components: [],
  });
}

module.exports = {
  handleMark, applyMark, buildMarkRows, questsIn, encode, decode, LIST, MARK, MANUAL,
};
