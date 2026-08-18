const { Client, GatewayIntentBits, MessageFlags } = require("discord.js");
const config = require("./config");
const { handleCommand } = require("./handlers/commands");
const { handleButton, EVENT_FREE } = require("./handlers/buttons");
const { handleSelectMenu } = require("./handlers/selectMenus");
const { handleModal } = require("./handlers/modals");
const { handleAutocomplete } = require("./handlers/autocomplete");
const { validateData } = require("./bounty");
const { activeEvents, activeLootPanels, bountyThreads, loadState, saveState } = require("./state");
const { version } = require("./version");
const keepAlive = require("./utils/keepAlive");
const { startWeeklyDigest } = require("./digest");
const { startLzDigest } = require("./lzDigest");
const { startBoard } = require("./bountyBoard");
const { startMarket } = require("./market");
const { syncEntry } = require("./bountyThread");
const { syncRoleMenu } = require("./roleMenu");
const { syncSalaryMenus } = require("./salaryMenu");
const { startBountyReminder } = require("./bountyReminder");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    // Only so a screenshot dropped in someone's own bounty thread can be read;
    // handleImage returns immediately for every other channel.
    GatewayIntentBits.MessageContent,
  ],
});

client.on("messageCreate", (msg) => {
  if (msg.author.bot) return;
  require("./questImage").handleImage(msg).catch((err) =>
    console.error("❌ handleImage:", err.message),
  );
});

client.on("clientReady", () => {
  console.log(`✅ Logged in as ${client.user.tag} — raid-gdn v${version}`);
  console.log(
    `📌 Thread channel: ${config.threadChannelId || "NOT SET — will use current channel"}`,
  );
});

client.on("interactionCreate", async (interaction) => {
  try {
    if (interaction.isAutocomplete()) return await handleAutocomplete(interaction);
    if (interaction.isChatInputCommand())
      return await handleCommand(interaction);
    if (interaction.isStringSelectMenu() || interaction.isUserSelectMenu())
      return await handleSelectMenu(interaction);
    if (interaction.isButton()) {
      const isEventScoped = !EVENT_FREE.some((p) => interaction.customId.startsWith(p));
      if (isEventScoped && !activeEvents[interaction.message.id]) {
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
  for (const [userId, rec] of Object.entries(bountyThreads)) {
    if (rec.threadId !== thread.id) continue;
    if (require("./bountyThread").forgetThread(userId))
      console.log(`🗑️ Forgot bounty thread of ${userId} (${thread.id} deleted)`);
  }
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

client.on("debug", (info) => {
  console.log("[Discord DEBUG]", info);
});

client.on("warn", (info) => {
  console.warn("[Discord WARN]", info);
});

client.on("error", (err) => {
  console.error("[Discord ERROR]", err);
});

client.on("shardReady", (id) => {
  console.log("🟢 Shard ready:", id);
});

client.on("shardDisconnect", (event, id) => {
  console.log("🔴 Shard disconnected:", id, event);
});

client.on("shardError", (error, id) => {
  console.error("🔴 Shard error:", id, error);
});

client.on("invalidated", () => {
  console.error("🔴 Discord session invalidated");
});

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

  // Group Bounty data check. These are all failures that would produce a wrong
  // answer rather than an error — a quest routed to the wrong nest, a variant
  // with no label — so a bad commit is made loud at boot instead of silently
  // mis-filing someone's week.
  const bountyProblems = validateData();
  if (bountyProblems.length > 0) {
    console.error(`❌ app/data/dungeons.js has ${bountyProblems.length} problem(s):`);
    bountyProblems.forEach((p) => console.error(`   • ${p}`));
  }

  keepAlive.start();
  console.log("🧪 Testing Discord Gateway WebSocket...");

try {
  const WebSocket = require("ws");

  await new Promise((resolve, reject) => {
    const ws = new WebSocket(
      "wss://gateway.discord.gg/?v=10&encoding=json"
    );

    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error("WebSocket connection timed out after 15 seconds"));
    }, 15000);

    ws.on("open", () => {
      console.log("🟢 Discord WebSocket OPEN");
    });

    ws.on("message", (data) => {
      clearTimeout(timeout);

      console.log(
        "🟢 Discord Gateway response:",
        data.toString().slice(0, 300)
      );

      ws.close();
      resolve();
    });

    ws.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });

    ws.on("close", (code, reason) => {
      console.log(
        "🔌 Discord WebSocket CLOSED:",
        code,
        reason.toString()
      );
    });
  });
} catch (err) {
  console.error("🔴 Discord WebSocket test FAILED:");
  console.error(err);
}

console.log("🧪 WebSocket test finished");
  await client.login(config.token);
  startWeeklyDigest(client);
  startLzDigest(client);
  startBoard(client);
  startMarket(client);
  syncEntry(client).catch((err) => console.error("❌ syncEntry:", err.message));
  syncRoleMenu(client).catch((err) => console.error("❌ syncRoleMenu:", err.message));
  syncSalaryMenus(client).catch((err) => console.error("❌ syncSalaryMenus:", err.message));
  startBountyReminder(client);
})();
