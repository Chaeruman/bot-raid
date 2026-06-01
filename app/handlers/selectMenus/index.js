const { handleRemoveMemberSelect } = require("./removeMember");
const { handleSubRoleSelect } = require("./subRoleSelect");
const { handleLootSelect } = require("./loot");

async function handleSelectMenu(interaction) {
  if (interaction.customId.startsWith("loot-sel:")) {
    return handleLootSelect(interaction);
  }
  if (interaction.customId.startsWith("select_remove_")) {
    return handleRemoveMemberSelect(interaction);
  }
  if (interaction.customId.startsWith("select_subrole_")) {
    return handleSubRoleSelect(interaction);
  }
}

module.exports = { handleSelectMenu };
