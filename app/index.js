require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

const token = process.env.TOKEN;

// ====================== CONFIG ======================
const COOLDOWN = 1500; // ms between button presses per user

// ====================== TEMPLATES ======================
const eventTemplates = {
  gdn_hc: {
    label: "GDN HC",
    roles: {
      FU: { max: 2 },
      PR: { max: 1 },
      MC: { max: 1 },
      SM: { max: 1 },
      MT: { max: 1 },
      EL: { max: 1 },
      KALI: { max: 1 },
      ARCHER: { max: 2 },
      DPS: { max: 3 },
    },
  },
  gdn_cl: {
    label: "GDN CL",
    roles: {
      FU: { max: 2 },
      PR: { max: 1 },
      MC: { max: 1 },
      SM: { max: 1 },
      MT: { max: 1 },
      EL: { max: 1 },
      KALI: { max: 1 },
      ARCHER: { max: 2 },
      DPS: { max: 3 },
    },
  },
};

// ====================== STATE ======================
// activeEvents[messageId] = event object
const activeEvents = {};
const cooldowns = new Map();

// ====================== HELPERS ======================

/**
 * Build Discord button rows from the event state.
 * Discord limit: max 5 rows, 5 buttons each = 25 buttons.
 * We reserve 2 rows for control buttons (Cancel Role + Lock/Cancel Run),
 * so role buttons can fill at most 3 rows (15 buttons).
 */
function createButtons(event, viewerId = null) {
  const rows = [];
  let row = new ActionRowBuilder();
  let count = 0;
  const isHost = viewerId === event.hostId;

  for (const roleName in event.roles) {
    const role = event.roles[roleName];
    const isFull = role.users.length >= role.max;
    const isLocked = event.locked;

    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`role_${roleName}`)
        .setLabel(
          role.max > 1
            ? `${roleName} (${role.users.length}/${role.max})`
            : roleName,
        )
        .setStyle(isFull ? ButtonStyle.Success : ButtonStyle.Primary)
        .setDisabled(isLocked || isFull),
    );

    count++;
    if (count % 5 === 0) {
      rows.push(row);
      row = new ActionRowBuilder();
      // Safety: Discord only allows 5 rows total; reserve 2 for controls
      if (rows.length >= 3) break;
    }
  }

  if (row.components.length > 0 && rows.length < 3) {
    rows.push(row);
  }

  // Row 4: Cancel my role + Lock toggle (lock disabled for non-hosts)
  rows.push(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("cancel_my_role")
        .setLabel("❌ Cancel My Role")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("toggle_lock")
        .setLabel(event.locked ? "🔓 Unlock Party" : "🔒 Lock Party")
        .setStyle(event.locked ? ButtonStyle.Success : ButtonStyle.Secondary)
        .setDisabled(!isHost),
    ),
  );

  // Row 5: Cancel run + Done (both disabled for non-hosts)
  rows.push(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("cancel_run")
        .setLabel("🛑 Cancel Run")
        .setStyle(ButtonStyle.Danger)
        .setDisabled(!isHost),
      new ButtonBuilder()
        .setCustomId("done_run")
        .setLabel("✅ Done")
        .setStyle(ButtonStyle.Success)
        .setDisabled(!isHost),
    ),
  );

  return rows;
}

/**
 * Rebuild the message content and buttons.
 */
async function updateMessage(message, event) {
  const totalUsers = Object.keys(event.users).length;
  const maxSlot = 8;

  let content = `**${event.title}** (${totalUsers}/${maxSlot})\n`;
  content += `Host: <@${event.hostId}>\n`;

  if (event.locked) {
    content += `🔒 **Party is LOCKED**\n`;
  } else if (totalUsers >= maxSlot) {
    content += `✅ **Party FULL**\n`;
  }

  content += `\n`;

  // Roles hidden from the display when nobody has picked them
  const HIDE_IF_EMPTY = new Set(["KALI"]);

  // Multi-slot roles that show a filled/max count badge
  const PER_SLOT_DISPLAY = new Set(["ARCHER", "DPS"]);

  for (const roleName in event.roles) {
    const role = event.roles[roleName];
    const count = role.users.length;

    // Hide optional roles when empty
    if (count === 0 && HIDE_IF_EMPTY.has(roleName)) continue;

    if (count === 0) {
      content += `**${roleName}** — *(empty)*\n`;
    } else if (PER_SLOT_DISPLAY.has(roleName) && role.max > 1) {
      // e.g. DPS (2/3) — @user1, @user2
      const mentions = role.users.map((id) => `<@${id}>`).join(", ");
      content += `**${roleName}** (${count}/${role.max}) — ${mentions}\n`;
    } else {
      const slotText = role.max > 1 ? ` (${count}/${role.max})` : "";
      const mentions = role.users.map((id) => `<@${id}>`).join(", ");
      content += `**${roleName}**${slotText} — ${mentions}\n`;
    }
  }

  await message.edit({
    content,
    components: createButtons(event, event.hostId),
  });
}

/**
 * Build the thread title: "{event label} ({seller}) - {DD MMM}"
 * e.g. "GDN HC (Budi) - 29 Mar"
 */
function buildThreadTitle(event) {
  const now = new Date();
  const day = now.toLocaleDateString("id-ID", {
    day: "2-digit",
    timeZone: "Asia/Jakarta",
  });
  const month = now.toLocaleDateString("en-US", {
    month: "short",
    timeZone: "Asia/Jakarta",
  });
  return `${event.label} (seller) - ${day} ${month}`;
}

/**
 * Build the thread's opening message: all joined users tagged per role.
 */
function buildThreadContent(event) {
  const HIDE_IF_EMPTY = new Set(["KALI"]);
  const PER_SLOT_DISPLAY = new Set(["ARCHER", "DPS"]);

  let content = `📋 **${event.title}**\n\n`;

  for (const roleName in event.roles) {
    const role = event.roles[roleName];
    const count = role.users.length;

    if (count === 0 && HIDE_IF_EMPTY.has(roleName)) continue;

    if (count === 0) {
      content += `**${roleName}** — *(empty)*\n`;
    } else if (PER_SLOT_DISPLAY.has(roleName) && role.max > 1) {
      const mentions = role.users.map((id) => `<@${id}>`).join(", ");
      content += `**${roleName}** (${count}/${role.max}) — ${mentions}\n`;
    } else {
      const slotText = role.max > 1 ? ` (${count}/${role.max})` : "";
      const mentions = role.users.map((id) => `<@${id}>`).join(", ");
      content += `**${roleName}**${slotText} — ${mentions}\n`;
    }
  }

  return content;
}

// ====================== BOT READY ======================
client.on("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

// ====================== INTERACTIONS ======================
client.on("interactionCreate", async (interaction) => {
  try {
    // ── SLASH COMMAND ──
    if (interaction.isChatInputCommand()) {
      await interaction.deferReply({ ephemeral: true });

      if (interaction.commandName === "start") {
        const eventName = interaction.options.getString("event");
        const template = eventTemplates[eventName];

        if (!template) {
          return interaction.editReply("❌ Event not found.");
        }

        // Deep-copy roles from template
        const roles = {};
        for (const r in template.roles) {
          roles[r] = { max: template.roles[r].max, users: [] };
        }

        const now = new Date();
        const timeStr = now.toLocaleTimeString("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "Asia/Jakarta",
        });
        const dateStr = now.toLocaleDateString("id-ID", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          timeZone: "Asia/Jakarta",
        });

        const event = {
          messageId: null,
          hostId: interaction.user.id,
          label: template.label,
          title: `${template.label} — ${dateStr} ${timeStr} WIB`,
          roles,
          users: {}, // userId -> roleName
          locked: false,
        };

        // Post placeholder then edit with full content
        const msg = await interaction.channel.send({ content: "Loading…" });
        event.messageId = msg.id;
        activeEvents[msg.id] = event;

        await updateMessage(msg, event);
        return interaction.editReply(`✅ **${event.title}** started!`);
      }
    }

    // ── BUTTON ──
    if (interaction.isButton()) {
      const userId = interaction.user.id;
      const event = activeEvents[interaction.message.id];

      // 1. Cooldown — check synchronously
      const now = Date.now();
      const last = cooldowns.get(userId) || 0;
      const onCooldown = now - last < COOLDOWN;
      if (!onCooldown) cooldowns.set(userId, now);

      // 2. Permission/validation checks — resolved synchronously before any await
      let ephemeralError = null;

      if (!onCooldown && event) {
        const hostOnlyButtons = ["toggle_lock", "cancel_run", "done_run"];
        if (
          hostOnlyButtons.includes(interaction.customId) &&
          userId !== event.hostId
        ) {
          if (interaction.customId === "toggle_lock") {
            ephemeralError = "⛔ Only the host can lock/unlock the party.";
          } else if (interaction.customId === "cancel_run") {
            ephemeralError = "⛔ Only the host can cancel the run.";
          } else if (interaction.customId === "done_run") {
            ephemeralError = "⛔ Only the host can mark the run as done.";
          }
        }

        if (!ephemeralError && interaction.customId.startsWith("role_")) {
          const roleName = interaction.customId.replace("role_", "");
          const role = event.roles[roleName];
          if (role) {
            if (event.locked) {
              ephemeralError = "🔒 The party is currently locked.";
            } else if (role.users.length >= role.max) {
              ephemeralError = `❌ **${roleName}** is already full!`;
            } else {
              const totalUsers = Object.keys(event.users).length;
              const currentRole = event.users[userId];
              if (!currentRole && totalUsers >= 8) {
                ephemeralError = "❌ Party is full!";
              }
            }
          }
        }
      }

      // 3. Acknowledge FIRST — exactly one response per interaction
      // Guard against already-acknowledged interactions (error 40060)
      if (interaction.replied || interaction.deferred) return;

      if (onCooldown || !event) {
        return interaction.deferUpdate();
      }
      if (ephemeralError) {
        return interaction.reply({ content: ephemeralError, ephemeral: true });
      }
      await interaction.deferUpdate();

      // 4. State mutations — safe to do now that interaction is acknowledged

      // ── Cancel My Role ──
      if (interaction.customId === "cancel_my_role") {
        const currentRole = event.users[userId];
        if (!currentRole) return;
        event.roles[currentRole].users = event.roles[currentRole].users.filter(
          (id) => id !== userId,
        );
        delete event.users[userId];
        return updateMessage(interaction.message, event);
      }

      // ── Toggle Lock (host only) ──
      if (interaction.customId === "toggle_lock") {
        event.locked = !event.locked;
        return updateMessage(interaction.message, event);
      }

      // ── Cancel Run (host only) ──
      if (interaction.customId === "cancel_run") {
        delete activeEvents[event.messageId];
        return interaction.message.edit({
          content: "🛑 **Run cancelled by host.**",
          components: [],
        });
      }

      // ── Done (host only) — create thread ──
      if (interaction.customId === "done_run") {
        delete activeEvents[event.messageId];

        const threadTitle = buildThreadTitle(event);
        const threadContent = buildThreadContent(event);

        // Disable all buttons on the signup message
        await interaction.message.edit({ components: [] });

        // Create thread in the configured fixed channel
        const threadChannelId = process.env.THREAD_CHANNEL_ID;
        const threadChannel = threadChannelId
          ? await interaction.client.channels.fetch(threadChannelId)
          : interaction.channel;

        // Forum channels require the message to be passed inside .create()
        // and optionally accept applied tag IDs.
        const isHC = event.label.toUpperCase().includes("HC");
        const tagId = isHC
          ? process.env.FORUM_TAG_HC
          : process.env.FORUM_TAG_CL;

        const createOptions = {
          name: threadTitle,
          autoArchiveDuration: 10060, // auto-archive after 24 hours
          reason: `Run completed: ${event.title}`,
          message: { content: threadContent }, // required for forum channels
        };

        if (tagId) {
          createOptions.appliedTags = [tagId];
        }

        await threadChannel.threads.create(createOptions);

        return;
      }

      // ── Role Select ──
      const roleName = interaction.customId.replace("role_", "");
      const role = event.roles[roleName];
      if (!role) return;

      const currentRole = event.users[userId];
      if (currentRole) {
        event.roles[currentRole].users = event.roles[currentRole].users.filter(
          (id) => id !== userId,
        );
      }
      role.users.push(userId);
      event.users[userId] = roleName;

      return updateMessage(interaction.message, event);
    }
  } catch (err) {
    console.error(err);
  }
});

// ====================== ANTI-CRASH ======================
client.on("error", console.error);
process.on("unhandledRejection", console.error);

// ====================== RENDER KEEP-ALIVE ======================
require("http")
  .createServer((_, res) => res.end("OK"))
  .listen(process.env.PORT || 3000);

client.login(token);

const url = `https://bot-raid-vgi4.onrender.com`; // Replace with your Render URL
const interval = 30000; // Interval in milliseconds (30 seconds)
const axios = require("axios");
//Reloader Function
function reloadWebsite() {
  axios
    .get(url)
    .then((response) => {
      console.log(
        `Reloaded at ${new Date().toISOString()}: Status Code ${response.status}`,
      );
    })
    .catch((error) => {
      console.error(
        `Error reloading at ${new Date().toISOString()}:`,
        error.message,
      );
    });
}

setInterval(reloadWebsite, interval);
