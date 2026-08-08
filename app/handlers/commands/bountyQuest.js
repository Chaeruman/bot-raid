const {
  MessageFlags,
  ModalBuilder,
  LabelBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder,
} = require("discord.js");
const { getChars } = require("../../state");
const { DPS_TIERS } = require("../../data/bounty");

const MODAL_PREFIX = "bounty-modal:quest:";

// The character is a select INSIDE the modal, so picking it and typing the
// quests is one step. It used to be a slash option with autocomplete, plus a
// second select on the confirmation to reach the next character — three
// surfaces for one question, none of which a button could open.
//
// Mode rides in the customId because a modal cannot see what opened it: "a"
// appends, "r" replaces.
function buildQuestModal(chars, replace = false) {
  return new ModalBuilder()
    .setCustomId(`${MODAL_PREFIX}${replace ? "r" : "a"}`)
    .setTitle(replace ? "Edit quest" : "Add quest")
    .setLabelComponents(
      new LabelBuilder().setLabel("Character").setStringSelectMenuComponent(
        new StringSelectMenuBuilder().setCustomId("char").addOptions(
          // A roster over 25 loses its tail here. MAX_CHARS is 40, but the
          // biggest real roster is ~15, and Discord allows no more.
          chars.slice(0, 25).map((c) => ({
            label: c.name.slice(0, 100),
            value: c.name.slice(0, 100),
            description: `${c.role || "?"} · ${DPS_TIERS[c.dpsTier] || "?"}`.slice(0, 100),
          })),
        ),
      ),
      new LabelBuilder()
        .setLabel("Quest — one per line")
        // The only instructions anyone sees at the moment they type, so between
        // them the label and placeholder carry the whole format.
        .setDescription("u / leg / rl · wep wtd acc arm · box")
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId("lines")
            .setPlaceholder(["ddn hc u wep", "gdn cl leg acc box", "memo 1 rl wtd"].join("\n"))
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setMaxLength(600),
        ),
    );
}

// Shared by the slash command and, later, the panel button: both need the same
// roster check before there is anything to put in the select.
async function openQuestModal(interaction, replace = false) {
  const { isHunter, notHunter } = require("./bountyChar");
  if (!isHunter(interaction))
    return interaction.reply({ content: notHunter, flags: MessageFlags.Ephemeral });

  const chars = await getChars(interaction.user.id);
  if (!chars.length)
    return interaction.reply({
      content: "Belum ada karakter. Bikin dulu lewat **➕ Add Character** di panel-mu (`/bounty-me`).",
      flags: MessageFlags.Ephemeral,
    });

  return interaction.showModal(buildQuestModal(chars, replace));
}

const handleBountyQuest = (interaction) =>
  openQuestModal(interaction, interaction.options.getBoolean("replace") || false);

module.exports = { handleBountyQuest, openQuestModal, buildQuestModal, MODAL_PREFIX };
