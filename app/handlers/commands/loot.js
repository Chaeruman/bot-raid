const { MessageFlags } = require("discord.js");
const { activeLootPanels } = require("../../state");
const { buildLootContent, buildLootComponents } = require("../../builders/lootPanel");

async function handleLoot(interaction) {
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  } catch (err) {
    if (err.code === 40060) return;
    throw err;
  }

  const title = interaction.options.getString("title") || "Manual Loot";
  const hc    = interaction.options.getBoolean("hc") ?? false;

  const panel = {
    lootMsgId: null,
    threadId: interaction.channelId,
    eventTitle: title,
    hostId: interaction.user.id,
    hcGoldSplit: hc ? true : "mixed",
    members: [],
    sellerId: null,
    source: "raid",
    raidItems: [],
    mailItems: [],
    goldEntries: [],
    payments: {},
    closed: false,
  };

  const msg = await interaction.channel.send({ content: buildLootContent(panel) });
  panel.lootMsgId = msg.id;
  activeLootPanels[msg.id] = panel;

  await msg.edit({
    content: buildLootContent(panel),
    components: buildLootComponents(panel),
  });

  return interaction.editReply(`📦 Loot panel created for **${title}**.`);
}

module.exports = { handleLoot };
