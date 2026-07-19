const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require("discord.js");

// customId shows a modal — must be the interaction's first response, so this
// is called before the generic deferUpdate() in buttons/index.js.
async function handlePartyPingButton(interaction, event) {
  const modal = new ModalBuilder()
    .setCustomId(`party_ping_modal:${event.messageId}`)
    .setTitle("Ping Party");

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("text")
        .setLabel("Pesan buat party")
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder("e.g. Gas mulai ya!")
        .setRequired(true)
        .setMaxLength(500),
    ),
  );

  return interaction.showModal(modal);
}

// One-click fixed ping, no modal needed.
async function handlePartyUp(interaction, event) {
  const mentions = Object.keys(event.users).map((uid) => `<@${uid}>`).join(" ");
  return interaction.channel.send(`${mentions}\nPT UP bala WOY jembod`);
}

module.exports = { handlePartyPingButton, handlePartyUp };
