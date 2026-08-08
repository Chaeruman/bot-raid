// Makes the existing raid/nest signups bounty-aware.
//
// Clicking a role picks a ROLE, not a character — the panel only ever stored
// `{ slot, subRole }`. So on join the bot asks which character you brought and
// records it on the seat. When the host closes the run, it already knows, and
// marking every participant's bounty needs no further clicks.
//
// Closing the run is the ONLY place a quest gets `runId` set. Without it the
// board would keep showing quests people had already cleared.
const { MessageFlags, ActionRowBuilder, StringSelectMenuBuilder } = require("discord.js");
const { getBountyWeek, saveBountyWeek, getChars, saveState } = require("./state");
const { weekKey, rewardText, BY_POOL_KEY } = require("./bounty");

const PICK = "bounty-fin:pick"; // + :<eventMessageId>

// A player's unclaimed quests for any variant this run clears, one entry per
// character, carrying the character's role so the caller can tell whether it
// matches the slot that was just taken. Matches sort first.
async function myQuestsHere(userId, poolKeys, takenRole = null) {
  const [doc, chars] = await Promise.all([getBountyWeek(userId, weekKey()), getChars(userId)]);
  const roleOf = new Map(chars.map((c) => [c.name, c.role || null]));

  const out = [];
  for (const [charName, charWeek] of Object.entries(doc?.chars || {})) {
    const quests = (charWeek.board || []).filter((q) => !q.runId && poolKeys.includes(q.poolKey));
    if (!quests.length) continue;
    const role = roleOf.get(charName) || null;
    out.push({ charName, quests, role, matches: !!takenRole && role === takenRole });
  }
  return out.sort((a, b) => b.matches - a.matches || a.charName.localeCompare(b.charName));
}

// One line, no header. The role is printed, so "you took FU but this is your
// Healer" reads without a sentence explaining it. The variant is only worth
// naming when the run clears more than one (marathon, memo).
const questLines = (entries, showVariant = false) =>
  entries.map(
    (e) =>
      `🎯 **${e.charName}** · ${e.role || "?"} · ${e.quests.map(rewardText).join(" | ")}` +
      (showVariant ? ` · ${BY_POOL_KEY.get(e.quests[0].poolKey)?.name || e.quests[0].poolKey}` : ""),
  );

// Which role the joiner just took. Memo panels put the job in `subRole`; raid
// panels use the slot's own label.
function takenRole(event, userId) {
  const seat = event.users?.[userId];
  if (!seat) return null;
  return seat.subRole || event.roles?.[seat.slot]?.label || seat.slot || null;
}

// Called from roleSelect / memoJobSelect after the panel is updated. Silent when
// the joiner holds nothing here, which is the common case.
async function onJoin(interaction, event) {
  const poolKeys = event.poolKeys || [];
  if (!poolKeys.length) return;

  const role = takenRole(event, interaction.user.id);
  const entries = await myQuestsHere(interaction.user.id, poolKeys, role);
  if (!entries.length) return;

  const lines = questLines(entries, poolKeys.length > 1);

  // Only one candidate — nothing to ask. Record it and just say so.
  if (entries.length === 1) {
    event.users[interaction.user.id].bountyChar = entries[0].charName;
    saveState();
    return interaction.followUp({
      content: [...lines, "", "_Ditandai selesai otomatis waktu host menutup run._"].join("\n"),
      flags: MessageFlags.Ephemeral,
    });
  }

  // Pre-select only when EXACTLY one matches the slot. Two characters of the
  // same job both holding a quest here is precisely the case where the bot must
  // not choose: it would claim a quest that was never run.
  const soleMatch = entries.filter((e) => e.matches).length === 1;

  return interaction.followUp({
    content: [...lines, "", "_Pilih yang kamu bawa — itu yang ditandai selesai waktu run ditutup._"].join("\n"),
    components: [
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`${PICK}:${event.messageId}`)
          .setPlaceholder("Bawa karakter yang mana?")
          .addOptions(
            entries.map((e) => ({
              label: e.charName.slice(0, 100),
              value: e.charName.slice(0, 100),
              description: `${e.role || "no role"} · ${e.quests.length} quest`.slice(0, 100),
              default: soleMatch && e.matches,
            })),
          ),
      ),
    ],
    flags: MessageFlags.Ephemeral,
  });
}

// The joiner names the character they brought. Stored on the seat, so the panel
// carries the answer until the run closes.
async function handleCharPick(interaction) {
  const { activeEvents } = require("./state");
  const event = activeEvents[interaction.customId.slice(`${PICK}:`.length)];
  const seat = event?.users?.[interaction.user.id];
  if (!seat)
    return interaction.update({ content: "❌ Kamu sudah tidak ada di party ini.", components: [] });

  seat.bountyChar = interaction.values[0];
  saveState();
  return interaction.update({
    content: `🎯 **${seat.bountyChar}** — ditandai selesai otomatis waktu host menutup run.`,
    components: [],
  });
}

// Called when the host closes the run: marks the bounty for everyone in the
// party. Uses the character each person named on join; falls back to a guess
// only when it is unambiguous, and names anyone left over rather than picking
// for them — a wrong guess claims a quest they never ran, and they would have
// no way to notice.
async function markPartyDone(client, event) {
  const poolKeys = event.poolKeys || [];
  if (!poolKeys.length) return null;

  const wk = weekKey();
  let marked = 0;
  const unsure = [];

  for (const [userId, seat] of Object.entries(event.users || {})) {
    const entries = await myQuestsHere(userId, poolKeys, takenRole(event, userId));
    if (!entries.length) continue;

    const named = seat.bountyChar && entries.find((e) => e.charName === seat.bountyChar);
    const matches = entries.filter((e) => e.matches);
    const pick = named || (entries.length === 1 ? entries[0] : matches.length === 1 ? matches[0] : null);
    if (!pick) {
      unsure.push(userId);
      continue;
    }

    const doc = await getBountyWeek(userId, wk);
    let n = 0;
    for (const q of doc?.chars?.[pick.charName]?.board || []) {
      if (!q.runId && poolKeys.includes(q.poolKey)) {
        q.runId = event.messageId;
        n++;
      }
    }
    if (n) {
      await saveBountyWeek(doc);
      marked += n;
    }
  }

  if (marked) require("./bountyBoard").syncBoard(client).catch(() => {});
  if (!marked && !unsure.length) return null;

  return (
    `🎯 ${marked} bounty ditandai selesai.` +
    (unsure.length
      ? ` ${unsure.map((u) => `<@${u}>`).join(" ")} belum pilih karakter — catat ulang lewat \`/bounty\`.`
      : "")
  );
}

module.exports = { onJoin, myQuestsHere, questLines, takenRole, handleCharPick, markPartyDone, PICK };
