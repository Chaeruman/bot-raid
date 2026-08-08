const { MessageFlags, ActionRowBuilder, StringSelectMenuBuilder } = require("discord.js");
const { getChars, getBountyWeek, saveBountyWeek } = require("../../state");
const { parseQuestLines, weekKey, weekLabel, questLabel, claimsLeft } = require("../../bounty");
const { WEEKLY_CLAIMS } = require("../../data/bounty");
const { MODAL_PREFIX } = require("../commands/bountyQuest");

const sig = (q) => `${q.poolKey}|${q.rarity}|${q.scroll}|${q.box ? 1 : 0}`;

// Field ids are terse; the message someone reads should not be.
const LABEL = { poolKey: "Dungeon", rarity: "Rarity", scroll: "Scroll" };

// The one place quests reach a character's board. Extracted because the
// ambiguity picker writes through here too, and two copies of "dedupe, cap at
// six, then save" is two places for the cap to drift.
async function addQuests(userId, charName, quests, { replace = false } = {}) {
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
  const replacing = replace && quests.length > 0;
  if (replacing) charWeek.board = charWeek.board.filter((q) => q.runId);

  const seen = new Set(charWeek.board.map(sig));
  const saved = [];
  const repeats = [];
  const overflow = [];

  for (const q of quests) {
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

  const stored = saved.length ? await saveBountyWeek(doc) : true;
  return { saved, repeats, overflow, replacing, charWeek, stored };
}

const FIX = "bounty-fix:"; // + <row>:<charName>

// Resolvable means: we know the shortlist AND the rest of the quest. Rarity and
// scroll are parsed before the nest is resolved, so every candidate below is a
// complete quest — which is what lets the answer ride in the option value and
// leaves nothing to store while someone decides.
const isFixable = (e) => e.candidates?.length > 1 && e.rarity && e.scroll;

// Five action rows to a message, so five ambiguous lines at once. More than
// that in one paste is not a case worth carrying code for.
function buildPickers(charName, errors) {
  return errors
    .filter(isFixable)
    .slice(0, 5)
    .map((e, i) =>
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`${FIX}${i}:${charName}`)
          .setPlaceholder(`${e.raw} — ${e.error}`.slice(0, 150))
          .addOptions(
            e.candidates.slice(0, 25).map((poolKey) => {
              const q = { poolKey, rarity: e.rarity, scroll: e.scroll, box: !!e.box };
              return {
                label: questLabel(q).slice(0, 100),
                // The whole quest, so the handler needs no memory of this menu.
                value: `${poolKey}|${e.rarity}|${e.scroll}|${e.box ? 1 : 0}`.slice(0, 100),
              };
            }),
          ),
      ),
    );
}

async function handleBountyQuestModal(interaction) {
  const replace = interaction.customId.slice(MODAL_PREFIX.length) === "r";
  // The character comes from the modal's own select, so no name is ever carried
  // in the customId — which also ends the "names may contain ':'" problem.
  const charName = interaction.fields.getStringSelectValues("char")[0];

  const { added, errors, duplicates } = parseQuestLines(
    interaction.fields.getTextInputValue("lines"),
  );

  // The three dropdowns are one quest between them, so they are all-or-nothing:
  // a dungeon with no rarity is not half a quest, it is an unanswerable one.
  const one = (id) => interaction.fields.getStringSelectValues(id)[0] || null;
  const picked = { poolKey: one("pool"), rarity: one("rarity"), scroll: one("scroll") };
  const chosen = Object.entries(picked).filter(([, v]) => v);

  if (chosen.length && chosen.length < 3) {
    const missing = Object.entries(picked).filter(([, v]) => !v).map(([k]) => k);
    return interaction.reply({
      content:
        `❌ Kurang ${missing.map((m) => `**${LABEL[m]}**`).join(" dan ")}. ` +
        "Isi ketiganya, atau kosongkan semua dan ketik quest-nya di kotak bawah.",
      flags: MessageFlags.Ephemeral,
    });
  }

  if (chosen.length === 3) {
    // "legendary|box" — the card box rides on the rarity so it needs no field.
    const [rarity, box] = picked.rarity.split("|");
    added.unshift({ poolKey: picked.poolKey, rarity, scroll: picked.scroll, box: box === "box" });
  }

  const userId = interaction.user.id;
  const res = await addQuests(userId, charName, added, { replace });
  const { saved, overflow, replacing, charWeek } = res;
  const repeats = [...duplicates, ...res.repeats];

  if (!res.stored)
    return interaction.reply({
      content: "⚠️ Database tidak tersambung — tidak ada yang tersimpan.",
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

  // Errors whose answer is one of a known few become a dropdown; the rest stay
  // a sentence, because there is nothing to offer when a token is simply wrong.
  const pickers = buildPickers(charName, errors);
  const unfixable = errors.filter((e) => !isFixable(e));

  if (unfixable.length) {
    lines.push("", `❌ ${unfixable.length} line(s) not understood:`);
    unfixable.slice(0, 6).forEach((e) => {
      lines.push(`• \`${e.raw}\` — ${e.error}${e.hint ? `\n  ↳ ${e.hint}` : ""}`);
    });
  }
  if (pickers.length) lines.push("", `❓ Pilih yang kamu maksud:`);

  if (saved.length) require("../../bountyBoard").syncBoard(interaction.client).catch(() => {});

  const payload = {
    content: lines.join("\n").slice(0, 2000),
    components: pickers,
    flags: MessageFlags.Ephemeral,
  };

  // Opened from the panel: redraw it so the new quests show, and put the parse
  // result underneath. From the slash command there is no panel to redraw.
  if (interaction.isFromMessage()) {
    await interaction.update(await require("../../bountyPanel").buildPanel(userId));
    await require("../../bountyThread")
      .refreshThread(interaction.client, userId, interaction.message?.id)
      .catch(() => {});
    return interaction.followUp(payload);
  }
  // From the slash command there is no panel here, but the one in their thread
  // still has to stop showing quests they just replaced.
  await require("../../bountyThread").refreshThread(interaction.client, userId).catch(() => {});
  return interaction.reply(payload);
}

module.exports = { handleBountyQuestModal, addQuests, isFixable, buildPickers, FIX };
