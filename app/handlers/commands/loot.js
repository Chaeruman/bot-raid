const { MessageFlags } = require("discord.js");
const { activeEvents, activeLootPanels } = require("../../state");
const { buildLootContent, buildLootComponents } = require("../../builders/lootPanel");

async function handleLoot(interaction) {
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  } catch (err) {
    if (err.code === 40060) return;
    throw err;
  }

  const messageId = interaction.options.getString("message_id");
  const title     = interaction.options.getString("title");
  const hc        = interaction.options.getBoolean("hc") ?? false;

  let panel;

  if (messageId) {
    // Link to an active party signup panel
    const event = activeEvents[messageId];
    if (!event) {
      return interaction.editReply("❌ No active party signup found with that message ID. Make sure the event is still running.");
    }

    const members = Object.keys(event.users);
    panel = {
      lootMsgId: null,
      threadId: interaction.channelId,
      eventTitle: event.title,
      hostId: interaction.user.id,
      hcGoldSplit: event.hcGoldSplit,
      subruns: event.subruns || null,
      members,
      sellerId: null,
      source: "raid",
      raidItems: [],
      mailItems: [],
      goldEntries: [],
      payments: Object.fromEntries(members.map((uid) => [uid, false])),
      closed: false,
    };
  } else {
    // Standalone panel
    panel = {
      lootMsgId: null,
      threadId: interaction.channelId,
      eventTitle: title || "Manual Loot",
      hostId: interaction.user.id,
      hcGoldSplit: hc ? true : "mixed",
      subruns: null,
      members: [],
      sellerId: null,
      source: "raid",
      raidItems: [],
      mailItems: [],
      goldEntries: [],
      payments: {},
      closed: false,
    };
  }

  const msg = await interaction.channel.send({ content: buildLootContent(panel) });
  panel.lootMsgId = msg.id;
  activeLootPanels[msg.id] = panel;

  await msg.edit({
    content: buildLootContent(panel),
    components: buildLootComponents(panel),
  });

  const linked = messageId ? ` (linked to party \`${messageId}\`)` : "";
  return interaction.editReply(`📦 Loot panel created for **${panel.eventTitle}**${linked}.`);
}

module.exports = { handleLoot };
