const { MessageFlags } = require("discord.js");
const { buildPanel } = require("../../bountyPanel");

// `/bounty-me` is now just a way to summon the panel. The roster listing and the
// week summary it used to print by hand both live there, alongside the buttons
// that change them — one surface instead of "read here, then go type there".
const handleBountyMe = async (interaction) =>
  interaction.reply({ ...(await buildPanel(interaction.user.id)), flags: MessageFlags.Ephemeral });

module.exports = { handleBountyMe };
