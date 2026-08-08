// Where the bounty panel lives: one permanent private thread per player.
//
// The panel itself is in bountyPanel.js and knows nothing about this file. All
// that happens here is finding or making a thread and keeping the panel message
// inside it up to date — which is why the panel shipped and was usable a step
// before any of this existed.
//
// A thread rather than an ephemeral reply because a thread sits in the sidebar
// with the answer already rendered: no channel to find, no button to press
// first. It is also somewhere the bot can push to later, which an ephemeral
// message can never be.
const { MessageFlags, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const config = require("./config");
const { bountyThreads, bountyEntry, saveState } = require("./state");
const { buildPanel } = require("./bountyPanel");

const NEW = "bounty-thread:new";

const ephemeral = (interaction, content) =>
  interaction.reply({ content, flags: MessageFlags.Ephemeral });

// ── The pinned entry point ───────────────────────────────────────────────────

const entryMessage = () => ({
  content:
    "🎯 **Bounty**\nPencet buat bikin thread pribadimu — isinya karakter, quest minggu ini, " +
    "dan semua tombolnya. Cukup sekali; setelah itu thread-nya nongol di daftar kiri.",
  components: [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(NEW).setLabel("🎯 Buat thread bounty-ku").setStyle(ButtonStyle.Success),
    ),
  ],
});

// Posted once and remembered. Reposted only if it is gone — the id is stored so
// a restart re-uses the same message instead of stacking a new one every boot.
async function syncEntry(client) {
  if (!config.bountyMeChannelId) {
    console.log("🎯 Bounty thread off (BOUNTY_ME_CHANNEL_ID belum diset)");
    return;
  }
  const channel = await client.channels.fetch(config.bountyMeChannelId).catch(() => null);
  if (!channel) return console.error("❌ BOUNTY_ME_CHANNEL_ID tidak ditemukan");

  if (bountyEntry.messageId) {
    const msg = await channel.messages.fetch(bountyEntry.messageId).catch(() => null);
    if (msg) return;
  }

  const msg = await channel.send(entryMessage());
  await msg.pin().catch(() => {}); // pinning is a nicety, not a requirement
  bountyEntry.messageId = msg.id;
  saveState();
  console.log("🎯 Bounty thread entry posted");
}

// ── The thread ───────────────────────────────────────────────────────────────

// Returns the live thread, or null once it is gone — a thread deleted by hand
// is forgotten here rather than retried forever.
async function liveThread(client, userId) {
  const rec = bountyThreads[userId];
  if (!rec?.threadId) return null;
  const thread = await client.channels.fetch(rec.threadId).catch(() => null);
  if (!thread) {
    delete bountyThreads[userId];
    saveState();
    return null;
  }
  return thread;
}

// A button click does NOT wake an archived thread, and editing a message inside
// one fails outright — so the panel would look fine and refuse to change. The
// bot created these threads, so it may open them itself.
async function wake(channel) {
  if (channel?.isThread?.() && channel.archived) await channel.setArchived(false).catch(() => {});
}

async function handleCreateThread(interaction) {
  const userId = interaction.user.id;
  const { isHunter, notHunter } = require("./handlers/commands/bountyChar");
  if (!isHunter(interaction)) return ephemeral(interaction, notHunter);

  const existing = await liveThread(interaction.client, userId);
  if (existing) {
    await wake(existing);
    return ephemeral(interaction, `Thread-mu sudah ada: ${existing.toString()}`);
  }

  const thread = await interaction.channel.threads
    .create({
      name: `🎯 bounty — ${interaction.member?.displayName || interaction.user.username}`.slice(0, 100),
      type: ChannelType.PrivateThread,
      invitable: false,
      autoArchiveDuration: 10080, // 7 days, the longest Discord allows
    })
    .catch((err) => {
      console.error(`❌ create bounty thread (${userId}):`, err.message);
      return null;
    });

  if (!thread)
    return ephemeral(interaction, "⚠️ Gagal bikin thread. Bot butuh izin **Create Private Threads** di channel ini.");

  await thread.members.add(userId).catch(() => {});
  const msg = await thread.send(await buildPanel(userId));
  await msg.pin().catch(() => {});

  bountyThreads[userId] = { threadId: thread.id, messageId: msg.id };
  saveState();
  return ephemeral(interaction, `✅ Thread-mu siap: ${thread.toString()}`);
}

// Redraws the panel in someone's thread. Called after a write that happened
// somewhere else — acting from the ephemeral `/bounty-me` panel would otherwise
// leave the thread showing yesterday's data in the one place they trust.
async function refreshThread(client, userId, skipMessageId = null) {
  const rec = bountyThreads[userId];
  if (!rec?.messageId || rec.messageId === skipMessageId) return;

  const thread = await liveThread(client, userId);
  if (!thread) return;
  await wake(thread);

  const msg = await thread.messages.fetch(rec.messageId).catch(() => null);
  if (!msg) {
    // The panel was deleted but the thread survives — put a new one back.
    const fresh = await thread.send(await buildPanel(userId)).catch(() => null);
    if (!fresh) return;
    await fresh.pin().catch(() => {});
    rec.messageId = fresh.id;
    saveState();
    return;
  }
  await msg.edit(await buildPanel(userId)).catch((err) => console.error(`❌ refresh thread (${userId}):`, err.message));
}

module.exports = { syncEntry, handleCreateThread, refreshThread, wake, liveThread, NEW };
