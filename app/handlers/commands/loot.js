const { MessageFlags } = require("discord.js");
const { activeLootPanels, saveState } = require("../../state");
const { buildLootContent, buildLootComponents } = require("../../builders/lootPanel");

async function handleLoot(interaction) {
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  } catch (err) {
    if (err.code === 40060) return;
    throw err;
  }

  const title  = interaction.options.getString("title");
  const hostId = interaction.user.id;

  const panel = {
    lootMsgId: null,
    threadId: interaction.channelId,
    eventTitle: title,
    hostId,
    hcGoldSplit: "mixed",
    subruns: null,
    members: [],
    sellerId: null,
    items: [],
    goldEntries: [],
    payments: {},
    closed: false,
  };

  const msg = await interaction.channel.send({ content: buildLootContent(panel) });
  panel.lootMsgId = msg.id;
  activeLootPanels[msg.id] = panel;
  saveState();

  await msg.edit({
    content: buildLootContent(panel),
    components: buildLootComponents(panel),
  });

  return interaction.editReply(`📦 Loot panel created for **${title}**.`);
}

module.exports = { handleLoot };
