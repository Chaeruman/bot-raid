const { showGoldExcludeSelect } = require("./goldExclude");
const { buildGoldModal } = require("../../../builders/goldModal");
const { partySize } = require("../../../builders/lootPanel");

async function handleGoldType(interaction, panel) {
  // customId: loot-sel:gold_type:{lootMsgId}
  const splitCount = parseInt(interaction.values[0], 10);

  // Fewer ways than there are people means somebody is left out, and which
  // somebody has to be asked. Comparing against the party rather than against
  // 7, so a seven-man run's ÷6 takes the same path an eight-man run's ÷7 does.
  if (splitCount < partySize(panel)) {
    return showGoldExcludeSelect(interaction, panel, splitCount, true);
  }

  return interaction.showModal(buildGoldModal(panel, splitCount));
}

module.exports = { handleGoldType };
