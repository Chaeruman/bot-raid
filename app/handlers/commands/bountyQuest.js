const {
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  StringSelectMenuBuilder,
} = require("discord.js");
const { getChars } = require("../../state");
const { DPS_TIERS } = require("../../data/bounty");

const MODAL_PREFIX = "bounty-modal:quest:";
const CHAR_SELECT_ID = "bounty-sel:quest-char";

// The character is chosen before anything is typed, so quest lines never carry a
// name — the picker already answered that, from a real roster rather than from
// something the user typed and could misspell.
//
// Mode rides in the customId because a modal cannot see the slash options that
// opened it: "a" appends, "r" replaces.
function buildQuestModal(charName, replace = false) {
  return new ModalBuilder()
    .setCustomId(`${MODAL_PREFIX}${replace ? "r" : "a"}:${charName}`)
    .setTitle(`${replace ? "Ganti" : "Catat"} bounty — ${charName}`.slice(0, 45))
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("lines")
          .setLabel("nest varian rarity scroll — 1 baris 1 quest")
          // Label and placeholder are the only instructions anyone sees at the
          // moment they type, so between them they carry the whole format.
          .setPlaceholder(
            ["ddn hc u wep", "gdn cl leg acc box", "memo 1 rl wtd", "", "u / leg / rl · wep wtd acc arm · box"].join("\n"),
          )
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(600),
      ),
    );
}

// Shown on every confirmation so the second and third character are one click
// rather than a retyped command. It stays on the ephemeral message, so it can be
// used again for each remaining character without re-running anything.
function buildCharSelect(chars) {
  if (!chars.length) return null;
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(CHAR_SELECT_ID)
      .setPlaceholder("➕ Add quests for another character")
      .addOptions(
        chars.slice(0, 25).map((c) => ({
          label: c.name.slice(0, 100),
          value: c.name.slice(0, 100),
          description: `${c.job || "?"} · ${DPS_TIERS[c.dpsTier] || "?"}`.slice(0, 100),
        })),
      ),
  );
}

async function handleBountyQuest(interaction) {
  const { isHunter, notHunter } = require("./bountyChar");
  if (!isHunter(interaction))
    return interaction.reply({ content: notHunter, flags: MessageFlags.Ephemeral });

  const chars = await getChars(interaction.user.id);
  if (!chars.length)
    return interaction.reply({
      content: "You have no characters yet. Add one with `/bounty-char add` first.",
      flags: MessageFlags.Ephemeral,
    });

  const typed = (interaction.options.getString("character") || "").trim();
  const char = chars.find((c) => c.name.toLowerCase() === typed.toLowerCase());
  if (!char)
    return interaction.reply({
      content: `No character named **${typed}**. Pick one from the list, or add it with \`/bounty-char add\`.`,
      flags: MessageFlags.Ephemeral,
    });

  return interaction.showModal(
    buildQuestModal(char.name, interaction.options.getBoolean("replace") || false),
  );
}

async function autocompleteBountyQuest(interaction) {
  const focused = interaction.options.getFocused().toLowerCase();
  const chars = await getChars(interaction.user.id);
  return interaction.respond(
    chars
      .filter((c) => c.name.toLowerCase().includes(focused))
      .slice(0, 25)
      .map((c) => ({ name: c.name, value: c.name })),
  );
}

// Picking from the select always appends — replacing is a deliberate act and
// stays on the slash command where the flag is visible before you commit.
async function handleBountyCharSelect(interaction) {
  const name = interaction.values[0];
  const chars = await getChars(interaction.user.id);
  const char = chars.find((c) => c.name === name);
  if (!char)
    return interaction.reply({
      content: `**${name}** is no longer on your roster.`,
      flags: MessageFlags.Ephemeral,
    });
  return interaction.showModal(buildQuestModal(char.name));
}

module.exports = {
  handleBountyQuest,
  autocompleteBountyQuest,
  handleBountyCharSelect,
  buildQuestModal,
  buildCharSelect,
  MODAL_PREFIX,
  CHAR_SELECT_ID,
};
