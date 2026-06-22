const { activeEvents, activeLootPanels, saveState } = require("../../state");
const {
  buildThreadTitle,
  buildThreadContent,
} = require("../../builders/content");
const {
  buildLootContent,
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

  await interaction.message.edit({ components: [] });

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

  const lootMsg = await thread.send({ content: buildLootContent(panel) });
  panel.lootMsgId = lootMsg.id;
  activeLootPanels[lootMsg.id] = panel;
  saveState();

  await lootMsg.edit({
    content: buildLootContent(panel),
    components: buildLootComponents(panel),
  });
}

module.exports = { handleDoneRun };
