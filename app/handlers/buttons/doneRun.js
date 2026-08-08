const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { activeEvents, activeLootPanels, saveState } = require("../../state");
const {
  buildSignupEmbed,
  buildThreadTitle,
  buildThreadContent,
  closePreview,
} = require("../../builders/content");
const {
  buildLootEmbed,
  buildLootComponents,
  STAMP_RATE_GOLD,
} = require("../../builders/lootPanel");
const config = require("../../config");

async function handleDoneRun(interaction, event) {
  delete activeEvents[event.messageId];
  saveState();

  // Close out any bounty the party was carrying, and record what this run
  // cleared so the per-person "sudah beres" button still works now that the
  // event is gone — clear → Done → "oh, I forgot to tick" is the normal order.
  const bountyNote = await require("../../bountyJoin")
    .markPartyDone(interaction.client, event)
    .catch(() => null);

  const done = `✅ **${event.title}** completed!${bountyNote ? `\n${bountyNote}` : ""}`;

  if (event.noThread) {
    return interaction.message.edit({ content: done, components: [] });
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
    stampRate: STAMP_RATE_GOLD,
  };

  const lootMsg = await thread.send({ embeds: [buildLootEmbed(panel)] });
  panel.lootMsgId = lootMsg.id;
  activeLootPanels[lootMsg.id] = panel;
  saveState();

  await lootMsg.edit({
    embeds: [buildLootEmbed(panel)],
    components: buildLootComponents(panel),
  });

  // Rebuild the signup embed with the loot thread linked at the bottom, and let
  // the host set the seller from here.
  const completedEmbed = buildSignupEmbed(event);
  completedEmbed.setDescription(`${completedEmbed.data.description}\n\nThread: <#${thread.id}>`);

  await interaction.message.edit({
    content: done,
    embeds: [completedEmbed],
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
