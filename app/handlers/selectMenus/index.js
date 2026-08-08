const { handleRemoveMemberSelect } = require("./removeMember");
const { handleSubRoleSelect } = require("./subRoleSelect");
const { handleLootSelect } = require("./loot");
const { handleCombinedPaySelect } = require("../commands/combinedPay");
const { handleBountyCharSelect } = require("../commands/bountyQuest");

async function handleSelectMenu(interaction) {
  if (interaction.customId === "bounty-req:pick") {
    return require("../../bountyBoard").handleRequestSelect(interaction);
  }
  if (interaction.customId === "bounty-req:new") {
    return require("../../bountyBoard").handleCreateSelect(interaction);
  }
  if (interaction.customId.startsWith("bounty-req:char:")) {
    return require("../../bountyBoard").handleRequestPick(interaction);
  }
  if (interaction.customId.startsWith("bounty-sel:quest-char")) {
    return handleBountyCharSelect(interaction);
  }
  if (interaction.customId.startsWith("gab:")) {
    return handleCombinedPaySelect(interaction);
  }
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
