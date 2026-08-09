const { ModalBuilder, LabelBuilder, StringSelectMenuBuilder } = require("discord.js");

const SUBROLE_MODAL = "subrole:"; // + <messageId>:<slotKey>

// A modal rather than an ephemeral message with a select. Both take a pick, but
// the ephemeral left a message behind for every join — one to read, one to
// dismiss — while a modal submit can acknowledge itself and vanish, because the
// panel underneath already shows you seated.
function buildSubRoleModal(messageId, slotKey, role) {
  const label = role.label || slotKey;
  return new ModalBuilder()
    .setCustomId(`${SUBROLE_MODAL}${messageId}:${slotKey}`)
    .setTitle(`Join as ${label}`.slice(0, 45))
    .setLabelComponents(
      new LabelBuilder()
        .setLabel("Your class")
        .setStringSelectMenuComponent(
          new StringSelectMenuBuilder()
            .setCustomId("class")
            .setPlaceholder("Select")
            .addOptions(role.subRoles.slice(0, 25).map((sr) => ({ label: sr, value: sr }))),
        ),
    );
}

const handleSubRoleMenu = (interaction, event, slotKey, role) =>
  interaction.showModal(buildSubRoleModal(interaction.message.id, slotKey, role));

module.exports = { handleSubRoleMenu, buildSubRoleModal, SUBROLE_MODAL };
