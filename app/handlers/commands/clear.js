const { MessageFlags } = require("discord.js");
const { activeEvents, activeLootPanels, saveState } = require("../../state");
const { isCoLeader } = require("../../utils/coleader");

async function handleClear(interaction) {
  if (!isCoLeader(interaction)) {
    return interaction.reply({ content: "⛔ Only Co-Leaders can use this.", flags: MessageFlags.Ephemeral });
  }

  const id = interaction.options.getString("id").trim();

  let cleared = null;
  if (activeEvents[id]) {
    delete activeEvents[id];
    cleared = "event";
  } else if (activeLootPanels[id]) {
    delete activeLootPanels[id];
    cleared = "loot panel";
  }

  if (!cleared) {
    return interaction.reply({
      content: `❌ No active event or loot panel with ID \`${id}\`. Run /state to see valid IDs.`,
      flags: MessageFlags.Ephemeral,
    });
  }

  saveState();
  return interaction.reply({ content: `🗑️ Cleared ${cleared} \`${id}\` from state.`, flags: MessageFlags.Ephemeral });
}

module.exports = { handleClear };
