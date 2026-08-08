// Makes the existing raid/nest signups bounty-aware. Clicking a role tells you
// whether this run clears a bounty you're holding — and gives you the one button
// that marks it done.
//
// This is the ONLY place a quest ever gets `runId` set, so without it the board
// would still show quests people cleared on Saturday.
const {
  MessageFlags,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
} = require("discord.js");
const { getBountyWeek, saveBountyWeek, getChars } = require("./state");
const { weekKey, rewardText, BY_POOL_KEY } = require("./bounty");

const DONE = "bounty-fin:one"; // + :<eventMessageId>:<charName>
const PICK = "bounty-fin:pick"; // + :<eventMessageId>

// A player's unclaimed quests for any variant this run clears, one entry per
// character, carrying the character's role so the caller can tell whether it
// matches the slot that was just taken.
//
// `takenRole` sorts matches first — you clicked FU, so your FU character is
// almost certainly the one you brought.
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

// One line, no header, no footer. The role is printed, so "you took FU but this
// is your Healer" is readable without a sentence explaining it. The variant is
// only worth naming when the run clears more than one (marathon, memo).
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

// Called from roleSelect / memoJobSelect after the panel is updated. Stays
// silent when the joiner has nothing here, which is the common case.
async function onJoin(interaction, event) {
  const poolKeys = event.poolKeys || [];
  if (!poolKeys.length) return;

  const role = takenRole(event, interaction.user.id);
  const entries = await myQuestsHere(interaction.user.id, poolKeys, role);
  if (!entries.length) return;

  const rows = [];
  if (entries.length === 1) {
    rows.push(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`${DONE}:${event.messageId}:${entries[0].charName}`)
          .setLabel("✅ Sudah beres")
          .setStyle(ButtonStyle.Success),
      ),
    );
  } else {
    // More than one character holds a quest this run clears, so the bot cannot
    // know which one you brought — same reason the request flow asks. The
    // role-matching one is listed first.
    rows.push(
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`${PICK}:${event.messageId}`)
          .setPlaceholder("✅ Tandai selesai — pilih karakter")
          .setMinValues(1)
          .setMaxValues(entries.length)
          .addOptions(
            entries.map((e) => ({
              label: e.charName.slice(0, 100),
              value: e.charName.slice(0, 100),
              description: `${e.role || "no role"} · ${e.quests.length} quest`.slice(0, 100),
              default: e.matches,
            })),
          ),
      ),
    );
  }

  // The button is the only thing in the feature that writes "done", so it says
  // what it does — otherwise "Sudah beres" reads like an acknowledgement.
  const hint =
    entries.length === 1
      ? "_Tekan kalau quest ini sudah selesai — quest-nya hilang dari bounty board._"
      : "_Pilih karakter yang quest-nya sudah selesai — yang dipilih hilang dari bounty board._";

  return interaction.followUp({
    content: [...questLines(entries, poolKeys.length > 1), "", hint].join("\n").slice(0, 2000),
    components: rows,
    flags: MessageFlags.Ephemeral,
  });
}

// Marks every quest of `charNames` that this run clears. runId is the panel's
// message id, so an undo could find them again later if that is ever wanted.
async function markDone(interaction, eventMessageId, charNames) {
  const { activeEvents } = require("./state");
  const event = activeEvents[eventMessageId];
  const poolKeys = event?.poolKeys || [];
  if (!poolKeys.length)
    return interaction.reply({ content: "❌ Panel ini sudah tidak aktif.", flags: MessageFlags.Ephemeral });

  const wk = weekKey();
  const doc = await getBountyWeek(interaction.user.id, wk);
  if (!doc) return interaction.reply({ content: "❌ Tidak ada data bounty.", flags: MessageFlags.Ephemeral });

  let marked = 0;
  for (const charName of charNames) {
    for (const q of doc.chars?.[charName]?.board || []) {
      if (!q.runId && poolKeys.includes(q.poolKey)) {
        q.runId = eventMessageId;
        marked++;
      }
    }
  }
  if (!marked)
    return interaction.reply({ content: "Sudah ditandai sebelumnya.", flags: MessageFlags.Ephemeral });

  await saveBountyWeek(doc);
  require("./bountyBoard").syncBoard(interaction.client).catch(() => {});

  return interaction.reply({
    content: `✅ ${marked} quest ditandai selesai untuk **${charNames.join(", ")}**.`,
    flags: MessageFlags.Ephemeral,
  });
}

const handleDoneButton = (interaction) => {
  const rest = interaction.customId.slice(`${DONE}:`.length);
  const at = rest.indexOf(":");
  return markDone(interaction, rest.slice(0, at), [rest.slice(at + 1)]);
};

const handleDoneSelect = (interaction) =>
  markDone(interaction, interaction.customId.slice(`${PICK}:`.length), interaction.values);

module.exports = { onJoin, myQuestsHere, questLines, takenRole, handleDoneButton, handleDoneSelect, DONE, PICK };
