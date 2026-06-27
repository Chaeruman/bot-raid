const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { activeEvents, activeLootPanels, saveState } = require("../../state");
const {
  buildThreadTitle,
  buildThreadContent,
} = require("../../builders/content");
const {
  buildLootEmbed,
  buildLootComponents,
} = require("../../builders/lootPanel");
const config = require("../../config");

async function handleDoneRun(interaction, event) {
  delete activeEvents[event.messageId];
  saveState();

  if (event.noThread) {
    return interaction.message.edit({
      content: `✅ **${event.title}** completed!`,
      components: [],
    });
  }

  const threadTitle = buildThreadTitle(event);
  const threadContent = buildThreadContent(event);

  const threadChannel = config.threadChannelId
    ? await interaction.client.channels.fetch(config.threadChannelId)
    : interaction.channel;

  const tagId = event.forumTagKey ? config[event.forumTagKey] : null;

  const createOptions = {
    name: threadTitle,
    autoArchiveDuration: 10080,
    reason: `Run completed: ${event.title}`,
    message: { content: threadContent },
  };

  if (tagId) createOptions.appliedTags = [tagId];

  const thread = await threadChannel.threads.create(createOptions);

  const members = Object.keys(event.users);
  const panel = {
    lootMsgId: null,
    threadId: thread.id,
    ownThread: true,
    threadBaseTitle: threadTitle,
    eventTitle: event.title,
    hostId: event.hostId,
    hcGoldSplit: event.hcGoldSplit,
    subruns: event.subruns || null,
    members,
    sellerId: null,
    items: [],
    goldEntries: [],
    payments: Object.fromEntries(members.map((uid) => [uid, false])),
    closed: false,
  };

  const lootMsg = await thread.send({ embeds: [buildLootEmbed(panel)] });
  panel.lootMsgId = lootMsg.id;
  activeLootPanels[lootMsg.id] = panel;
  saveState();

  await lootMsg.edit({
    embeds: [buildLootEmbed(panel)],
    components: buildLootComponents(panel),
  });

  // Point the original signup message at the new loot post + let the host set the seller.
  await interaction.message.edit({
    content: `✅ **${event.title}** completed! Loot panel → <#${thread.id}>`,
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`loot-btn:select_seller:${lootMsg.id}`)
          .setLabel("👤 Set Seller")
          .setStyle(ButtonStyle.Secondary),
      ),
    ],
  });
}

module.exports = { handleDoneRun };
