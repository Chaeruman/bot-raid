const { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require("discord.js");
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

// followUp, not reply: the button was already acknowledged upstream.
const refuse = (interaction, content) =>
  interaction.followUp({ content, flags: MessageFlags.Ephemeral });

async function handleDoneRun(interaction, event) {
  // Close out any bounty the party was carrying, and record what this run
  // cleared so the per-person "sudah beres" button still works now that the
  // event is gone — clear → Done → "oh, I forgot to tick" is the normal order.
  //
  // Safe to reach twice: it only ever touches quests with no runId yet.
  const bountyNote = await require("../../bountyJoin")
    .markPartyDone(interaction.client, event)
    .catch(() => null);

  const done = `✅ **${event.title}** completed!${bountyNote ? `\n${bountyNote}` : ""}`;
  const finish = () => {
    delete activeEvents[event.messageId];
    saveState();
  };

  // The preview in the chat channel stops being a live thing the moment the run
  // closes. It was imported for this and never called, so every completed run
  // left a party that still looked open sitting where people talk.
  const retirePreview = () => closePreview(interaction.message, event, done).catch(() => {});

  if (event.noThread) {
    finish();
    await retirePreview();
    return interaction.message.edit({ content: done, components: [] });
  }

  const threadTitle = buildThreadTitle(event);
  const threadContent = buildThreadContent(event);

  const threadChannel = config.threadChannelId
    ? await interaction.client.channels.fetch(config.threadChannelId).catch(() => null)
    : interaction.channel;

  if (!threadChannel)
    return refuse(interaction, "⚠️ Channel forum tidak ditemukan — cek `THREAD_CHANNEL_ID`.");

  const createOptions = {
    name: threadTitle,
    autoArchiveDuration: 10080,
    reason: `Run completed: ${event.title}`,
    message: { content: threadContent },
  };

  // Only a tag this forum actually has. An id left over from another forum, or
  // renamed away, makes Discord reject the WHOLE create call — losing the loot
  // thread over a label nobody would have missed.
  const tagId = event.forumTagKey ? config[event.forumTagKey] : null;
  if (tagId && threadChannel.availableTags?.some((t) => t.id === tagId))
    createOptions.appliedTags = [tagId];
  else if (tagId)
    console.error(`❌ forum tag ${event.forumTagKey}=${tagId} tidak ada di ${threadChannel.id}`);

  // Until this succeeds the event stays alive. Deleting it first meant a failed
  // create left the host with a dead panel, no thread, and no way to press Done
  // again — the run simply gone, and "Something went wrong" as the only clue.
  const thread = await threadChannel.threads.create(createOptions).catch((err) => {
    console.error(`❌ done thread (${event.title}):`, err.message);
    return null;
  });

  if (!thread)
    return refuse(
      interaction,
      "⚠️ Gagal bikin thread loot. Bounty sudah ditandai selesai, dan panelnya masih hidup — " +
        "Done bisa ditekan lagi setelah dibetulkan.",
    );

  finish();
  await retirePreview();

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
    bonuses: {}, // uid → flat gold added to that member's salary only
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
