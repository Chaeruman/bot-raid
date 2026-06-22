const { activeEvents, saveState } = require("../../state");

async function handleCancelRun(interaction, event) {
  delete activeEvents[event.messageId];
  saveState();
  return interaction.message.edit({
    content: "🛑 **Run cancelled by host.**",
    components: [],
  });
}

module.exports = { handleCancelRun };
