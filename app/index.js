const { Client, GatewayIntentBits, MessageFlags } = require("discord.js");
const config = require("./config");
const { handleCommand } = require("./handlers/commands");
const { handleButton } = require("./handlers/buttons");
const { handleSelectMenu } = require("./handlers/selectMenus");
const { handleModal } = require("./handlers/modals");
const { activeEvents, activeLootPanels, loadState, saveState } = require("./state");
const { version } = require("./version");
const keepAlive = require("./utils/keepAlive");
const { startWeeklyDigest } = require("./digest");
const { startLzDigest } = require("./lzDigest");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
  ],
});

client.on("clientReady", () => {
  console.log(`✅ Logged in as ${client.user.tag} — raid-gdn v${version}`);
  console.log(
    `📌 Thread channel: ${config.threadChannelId || "NOT SET — will use current channel"}`,
  );
});

client.on("interactionCreate", async (interaction) => {
  try {
    if (interaction.isChatInputCommand())
      return await handleCommand(interaction);
    if (interaction.isStringSelectMenu() || interaction.isUserSelectMenu())
      return await handleSelectMenu(interaction);
    if (interaction.isButton()) {
      if (!interaction.customId.startsWith("loot-btn:") && !activeEvents[interaction.message.id]) {
        return interaction.reply({
          content: "❌ This panel is no longer active.",
          flags: MessageFlags.Ephemeral,
        });
      }
      return await handleButton(interaction);
    }
    if (interaction.isModalSubmit())
      return await handleModal(interaction);
  } catch (err) {
    console.error(err);
    try {
      const reply = {
        content: "❌ Something went wrong.",
        flags: MessageFlags.Ephemeral,
      };
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply(reply);
      } else if (interaction.deferred) {
        await interaction.editReply(reply);
      }
    } catch {
      /* ignore */
    }
  }
});

client.on("threadDelete", (thread) => {
  let changed = false;
  for (const [msgId, panel] of Object.entries(activeLootPanels)) {
    if (panel.threadId === thread.id) {
      delete activeLootPanels[msgId];
      changed = true;
      console.log(`🗑️ Removed loot panel ${msgId} (thread ${thread.id} deleted)`);
    }
  }
  if (changed) saveState();
});

client.on("messageDelete", (message) => {
  if (activeEvents[message.id]) {
    delete activeEvents[message.id];
    saveState();
    console.log(`🗑️ Removed deleted event ${message.id} from state`);
  }
  if (activeLootPanels[message.id]) {
    delete activeLootPanels[message.id];
    saveState();
    console.log(`🗑️ Removed deleted loot panel ${message.id} from state`);
  }
});

client.on("error", console.error);
process.on("unhandledRejection", console.error);

(async () => {
  try {
    await loadState();
  } catch (err) {
    console.error("❌ Could not load state from MongoDB, starting fresh:", err.message);
  }

  // Prune activeEvents older than 24h (no TTL on loot panels — they can last weeks)
  const TTL_MS = 24 * 60 * 60 * 1000;
  const staleIds = Object.keys(activeEvents).filter(
    (id) => activeEvents[id].createdAt && Date.now() - activeEvents[id].createdAt > TTL_MS,
  );
  if (staleIds.length > 0) {
    staleIds.forEach((id) => delete activeEvents[id]);
    saveState();
    console.log(`🧹 Pruned ${staleIds.length} stale event(s) older than 24h`);
  }

  keepAlive.start();
  await client.login(config.token);
  startWeeklyDigest(client);
  startLzDigest(client);
})();
