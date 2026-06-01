const { updateMessage } = require("../../builders/content");

async function handleToggleLock(interaction, event) {
  event.locked = !event.locked;
  return updateMessage(interaction.message, event);
}

module.exports = { handleToggleLock };
