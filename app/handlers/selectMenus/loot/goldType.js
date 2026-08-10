const { showGoldExcludeSelect } = require("./goldExclude");
const { buildGoldModal } = require("../../../builders/goldModal");

async function handleGoldType(interaction, panel) {
  // customId: loot-sel:gold_type:{lootMsgId}
  const splitCount = parseInt(interaction.values[0], 10); // 7 or 8

  if (splitCount === 7) {
    // HC: pilih siapa yang tidak dapat dulu
    return showGoldExcludeSelect(interaction, panel, 7, true);
  }

  // Normal (÷8): langsung modal
  return interaction.showModal(buildGoldModal(panel, 8));
}

module.exports = { handleGoldType };
