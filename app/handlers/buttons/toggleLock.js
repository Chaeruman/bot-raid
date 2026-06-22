const { updateMessage } = require("../../builders/content");
const { saveState } = require("../../state");

async function handleToggleLock(interaction, event) {
  event.locked = !event.locked;
  saveState();
  return updateMessage(interaction.message, event);
}

module.exports = { handleToggleLock };
