const { MessageFlags } = require("discord.js");
const { activeEvents } = require("../../state");

// customId: party_ping_modal:{messageId}
async function handlePartyPingModal(interaction) {
  const messageId = interaction.customId.slice("party_ping_modal:".length);
  const event = activeEvents[messageId];
  if (!event) {
    return interaction.reply({ content: "❌ This panel is no longer active.", flags: MessageFlags.Ephemeral });
  }

  const text = interaction.fields.getTextInputValue("text");
  const mentions = Object.keys(event.users).map((uid) => `<@${uid}>`).join(" ");
  return interaction.reply(`${mentions}\n${text}`);
}

module.exports = { handlePartyPingModal };
