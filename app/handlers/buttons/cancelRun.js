const { activeEvents, saveState } = require("../../state");
const { closePreview } = require("../../builders/content");

async function handleCancelRun(interaction, event) {
  delete activeEvents[event.messageId];
  saveState();
  await closePreview(interaction.message, event, "🛑 **Run cancelled by host.**");
  return interaction.message.edit({
    content: "🛑 **Run cancelled by host.**",
    components: [],
  });
}

module.exports = { handleCancelRun };
