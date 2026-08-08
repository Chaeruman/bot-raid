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
const { MAX_SHARE_STACK, rankOf } = require("./data/bounty");

// How many quests this party can stack: 6 at most, and never more than the
// party holds — a 4-player nest cannot stack 6 because only 4 people can share.
const stackCap = (event) => Math.min(event.maxSlot, MAX_SHARE_STACK);

// Stacks are PER VARIANT. A marathon is two clears, so GDN HC and GDN CL each
// get their own 6 — counting them against one shared cap would refuse quests
// that fit fine.
const stackedNow = (event, poolKey) =>
  Object.values(event.users || {}).reduce((n, u) => n + ((u.bountyQuests || {})[poolKey] || 0), 0);

// What of a character's quests actually fits, per variant. `seat.bountyQuests`
// is this map — quests past a cap were shared with nobody, so they must not be
// marked done later.
function fitToStack(event, quests) {
  const cap = stackCap(event);
  const want = {};
  for (const q of quests) want[q.poolKey] = (want[q.poolKey] || 0) + 1;

  const fit = {};
  for (const [pool, n] of Object.entries(want)) {
    const room = Math.max(0, cap - stackedNow(event, pool));
    if (room) fit[pool] = Math.min(n, room);
  }
  return fit;
}

const totalOf = (map) => Object.values(map || {}).reduce((a, b) => a + b, 0);

const PICK = "bounty-fin:pick"; // + :<eventMessageId>:<slotKey>
const JOIN = "bounty-join"; // closed-to-bounty panels: one button instead of roles
const TOGGLE = "bounty-open"; // flips a panel between bounty-only and open

// Which slot a character's role maps to on this panel. Caps are off on a
// bounty-only party, so the only way to miss is a role the template has no slot
// for at all.
function slotForRole(event, role) {
  return Object.keys(event.roles).find((k) => (event.roles[k].label || k) === role) || null;
}

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
    quests.sort((a, b) => rankOf(b) - rankOf(a));
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

// The role a seat represents. Memo panels put the job in `subRole`; raid panels
// use the slot's own label. `slotKey` lets callers ask before anyone is seated.
function takenRole(event, userId, slotKey = null) {
  const seat = event.users?.[userId];
  const slot = slotKey || seat?.slot;
  if (!slot) return null;
  return (!slotKey && seat?.subRole) || event.roles?.[slot]?.label || slot || null;
}

// Called from roleSelect BEFORE seating. Returns true when it took over — the
// joiner holds quests on more than one character, so the picker will seat them
// once they say which. Returns false to let the caller seat normally.
async function askBeforeSeat(interaction, event, slotKey) {
  const poolKeys = event.poolKeys || [];
  if (!poolKeys.length) return false;

  const entries = await myQuestsHere(
    interaction.user.id,
    poolKeys,
    takenRole(event, interaction.user.id, slotKey),
  );
  if (!entries.length) return false; // no bounty here — seat normally, say nothing

  const lines = questLines(entries, poolKeys.length > 1);

  // Only one candidate — nothing to ask. Seat now and just say so.
  if (entries.length === 1) {
    const { seatUser } = require("./handlers/buttons/roleSelect");
    const seat = seatUser(event, interaction.user.id, slotKey);
    seat.bountyChar = entries[0].charName;
    seat.bountyQuests = fitToStack(event, entries[0].quests);
    saveState();
    await require("./builders/content").updateMessage(interaction.message, event);
    await interaction.followUp({
      content: [...lines, "", "_Ditandai selesai otomatis waktu host menutup run._"].join("\n"),
      flags: MessageFlags.Ephemeral,
    });
    return true;
  }

  // Pre-select only when EXACTLY one matches the slot. Two characters of the
  // same job both holding a quest here is precisely the case where the bot must
  // not choose: it would claim a quest that was never run.
  const soleMatch = entries.filter((e) => e.matches).length === 1;

  await interaction.followUp({
    content: [...lines, "", "_Pilih dulu yang kamu bawa — baru kamu masuk party._"].join("\n"),
    components: [
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`${PICK}:${event.messageId}:${slotKey}`)
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
  return true;
}

// The joiner names the character they brought — and only now do they take the
// seat. Dismissing the menu means not joining, which is the point: the panel
// never holds a seat the bot cannot attribute.
async function handleCharPick(interaction) {
  const { activeEvents, getChars: readChars } = require("./state");
  const [, , messageId, slotFromId] = interaction.customId.split(":");
  const event = activeEvents[messageId];
  if (!event)
    return interaction.update({ content: "❌ Panel ini sudah tidak aktif.", components: [] });

  const charName = interaction.values[0];

  // On a bounty-only panel the slot comes from the character's role, because
  // there were no role buttons to click in the first place.
  let slotKey = slotFromId;
  if (!slotKey) {
    const role = (await readChars(interaction.user.id)).find((c) => c.name === charName)?.role;
    slotKey = role && slotForRole(event, role);
    if (!slotKey)
      return interaction.update({
        content: `❌ Role **${role || "?"}** tidak ada slot-nya di party ini.`,
        components: [],
      });
  }
  if (!event.roles[slotKey])
    return interaction.update({ content: "❌ Slot itu sudah tidak ada.", components: [] });

  if (!event.users[interaction.user.id] && Object.keys(event.users).length >= event.maxSlot)
    return interaction.update({ content: "❌ Party sudah penuh.", components: [] });

  const mine = (await myQuestsHere(interaction.user.id, event.poolKeys || [])).find(
    (e) => e.charName === charName,
  );

  const { seatUser } = require("./handlers/buttons/roleSelect");
  const seat = seatUser(event, interaction.user.id, slotKey);
  seat.bountyChar = charName;
  seat.bountyQuests = fitToStack(event, mine?.quests || []);
  saveState();

  const msg = await interaction.channel.messages.fetch(messageId).catch(() => null);
  if (msg) await require("./builders/content").updateMessage(msg, event);

  const fitted = totalOf(seat.bountyQuests);
  const wasted = (mine?.quests.length || 0) - fitted;
  return interaction.update({
    content:
      `🎯 **${charName}** masuk party` +
      (fitted ? ` — ${fitted} quest masuk stack.` : " sebagai numpang.") +
      (wasted ? ` ⚠️ ${wasted} quest-mu tidak muat (stack maks ${stackCap(event)} per varian) — tetap di board.` : ""),
    components: [],
  });
}

// ── Bounty-only party ────────────────────────────────────────────────────────
// `closedToBounty` swaps every role button for one Join, and only people who
// recorded a bounty this week may take it. The character you pick decides the
// slot — role caps are off here, so your role always has room.
//
// "Any bounty this week", not "a bounty for this nest": under the share
// mechanic a party member without the quest still gets paid, so the two filler
// seats have to be reachable.
async function handleBountyJoin(interaction, event) {
  const chars = await getChars(interaction.user.id);
  const doc = await getBountyWeek(interaction.user.id, weekKey());
  const recorded = Object.entries(doc?.chars || {}).filter(([, cw]) => (cw.board || []).length);

  if (!recorded.length)
    return interaction.reply({
      content: "🎯 Party ini khusus bounty. Catat bounty-mu minggu ini dulu dengan `/bounty`.",
      flags: MessageFlags.Ephemeral,
    });

  const roleOf = new Map(chars.map((c) => [c.name, c.role || null]));
  const poolKeys = event.poolKeys || [];

  // Quest holders for THIS nest first — they are why the run exists.
  const options = recorded
    .map(([charName, cw]) => {
      const here = (cw.board || []).filter((q) => !q.runId && poolKeys.includes(q.poolKey));
      return { charName, role: roleOf.get(charName) || null, here };
    })
    .filter((o) => o.role) // no role on the sheet means no slot to sit in
    .sort((a, b) => b.here.length - a.here.length || a.charName.localeCompare(b.charName))
    .slice(0, 25);

  if (!options.length)
    return interaction.reply({
      content: "Karaktermu belum punya role. Set dulu: `/bounty-char add`.",
      flags: MessageFlags.Ephemeral,
    });

  return interaction.reply({
    content: "_Pilih karakter yang kamu bawa — role-nya menentukan slot._",
    components: [
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`${PICK}:${event.messageId}:`)
          .setPlaceholder("Bawa karakter yang mana?")
          .addOptions(
            options.map((o) => ({
              label: o.charName.slice(0, 100),
              value: o.charName.slice(0, 100),
              description: `${o.role}${o.here.length ? ` · ${o.here.length} quest di sini` : " · numpang"}`.slice(0, 100),
            })),
          ),
      ),
    ],
    flags: MessageFlags.Ephemeral,
  });
}

// Flip a panel between bounty-only and open to everyone. Host-only, same as
// lock — it changes who may join.
async function handleToggleBounty(interaction, event) {
  event.closedToBounty = !event.closedToBounty;
  saveState();
  return require("./builders/content").updateMessage(interaction.message, event);
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
  const cap = stackCap(event);
  const stacked = {}; // poolKey → how many are already in that variant's stack
  let marked = 0;
  const unsure = [];
  const overflow = [];

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

    // Only what fit, per variant. A quest past its variant's cap was shared
    // with nobody, so it stays on the board — marking it would hand out a
    // reward that was never received.
    const take = {};
    for (const q of pick.quests) {
      const used = stacked[q.poolKey] || 0;
      if (used >= cap) continue;
      stacked[q.poolKey] = used + 1;
      take[q.poolKey] = (take[q.poolKey] || 0) + 1;
    }
    if (totalOf(take) < pick.quests.length) overflow.push(userId);
    if (!totalOf(take)) continue;

    const doc = await getBountyWeek(userId, wk);
    // Best first, so a partial stack takes the valuable quests.
    const board = (doc?.chars?.[pick.charName]?.board || [])
      .filter((q) => !q.runId && poolKeys.includes(q.poolKey))
      .sort((a, b) => rankOf(b) - rankOf(a));

    let n = 0;
    for (const q of board) {
      if (!take[q.poolKey]) continue;
      take[q.poolKey]--;
      q.runId = event.messageId;
      n++;
    }
    if (n) {
      await saveBountyWeek(doc);
      marked += n;
    }
  }

  if (marked) require("./bountyBoard").syncBoard(client).catch(() => {});
  if (!marked && !unsure.length && !overflow.length) return null;

  return (
    `🎯 ${marked} quest masuk stack dan ditandai selesai.` +
    (overflow.length
      ? ` ⚠️ Quest ${overflow.map((u) => `<@${u}>`).join(" ")} lewat batas stack — masih di board.`
      : "") +
    (unsure.length
      ? ` ${unsure.map((u) => `<@${u}>`).join(" ")} belum pilih karakter — catat ulang lewat \`/bounty\`.`
      : "")
  );
}

module.exports = {
  askBeforeSeat, myQuestsHere, questLines, takenRole, slotForRole,
  handleCharPick, handleBountyJoin, handleToggleBounty, markPartyDone,
  PICK, JOIN, TOGGLE,
};
