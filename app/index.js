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
const COOLDOWN = 3000; // ms between button presses per user

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
 * Calculate max party size from a roles object.
 */
function getMaxSlot(roles) {
  return Object.values(roles).reduce((sum, r) => sum + r.max, 0);
}

/**
 * Build Discord button rows from the event state.
 * Discord limit: max 5 rows, 5 buttons each = 25 buttons.
 * We reserve 2 rows for control buttons (Cancel Role + Lock/Cancel Run),
 * so role buttons can fill at most 3 rows (15 buttons).
 */
function createButtons(event) {
  const rows = [];
  let row = new ActionRowBuilder();
  let count = 0;

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

  // Row 4: Cancel my role + Lock toggle (host only handled in interaction)
  rows.push(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("cancel_my_role")
        .setLabel("❌ Cancel My Role")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("toggle_lock")
        .setLabel(event.locked ? "🔓 Unlock Party" : "🔒 Lock Party")
        .setStyle(event.locked ? ButtonStyle.Success : ButtonStyle.Secondary),
    ),
  );

  // Row 5: Cancel run (host only)
  rows.push(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("cancel_run")
        .setLabel("🛑 Cancel Run")
        .setStyle(ButtonStyle.Danger),
    ),
  );

  return rows;
}

/**
 * Rebuild the message content and buttons.
 */
async function updateMessage(message, event) {
  const totalUsers = Object.keys(event.users).length;
  const maxSlot = getMaxSlot(event.roles);

  let content = `📋 **${event.title}** (${totalUsers}/${maxSlot})\n`;
  content += `Host: <@${event.hostId}>\n`;

  if (event.locked) {
    content += `🔒 **Party is LOCKED**\n`;
  } else if (totalUsers >= maxSlot) {
    content += `✅ **Party FULL**\n`;
  }

  content += `\n`;

  for (const roleName in event.roles) {
    const role = event.roles[roleName];
    const count = role.users.length;
    const slotText = role.max > 1 ? ` (${count}/${role.max})` : "";

    if (count > 0) {
      const mentions = role.users.map((id) => `<@${id}>`).join(", ");
      content += `**${roleName}**${slotText} — ${mentions}\n`;
    } else {
      content += `**${roleName}** — *(empty)*\n`;
    }
  }

  await message.edit({
    content,
    components: createButtons(event),
  });
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
      const event = activeEvents[interaction.message.id];
      if (!event) return interaction.deferUpdate();

      const userId = interaction.user.id;

      // Cooldown check (silent reject)
      const now = Date.now();
      const last = cooldowns.get(userId) || 0;
      if (now - last < COOLDOWN) {
        return interaction.deferUpdate();
      }
      cooldowns.set(userId, now);

      // ── Cancel My Role ──
      if (interaction.customId === "cancel_my_role") {
        await interaction.deferUpdate();
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
        if (userId !== event.hostId) {
          return interaction.reply({
            content: "⛔ Only the host can lock/unlock the party.",
            ephemeral: true,
          });
        }
        await interaction.deferUpdate();
        event.locked = !event.locked;
        return updateMessage(interaction.message, event);
      }

      // ── Cancel Run (host only) ──
      if (interaction.customId === "cancel_run") {
        if (userId !== event.hostId) {
          return interaction.reply({
            content: "⛔ Only the host can cancel the run.",
            ephemeral: true,
          });
        }
        await interaction.deferUpdate();
        delete activeEvents[event.messageId];
        return interaction.message.edit({
          content: "🛑 **Run cancelled by host.**",
          components: [],
        });
      }

      // ── Role Select ──
      const roleName = interaction.customId.replace("role_", "");
      const role = event.roles[roleName];
      if (!role) return interaction.deferUpdate();

      // Reject if party is locked
      if (event.locked) {
        return interaction.reply({
          content: "🔒 The party is currently locked.",
          ephemeral: true,
        });
      }

      // Reject if role is full
      if (role.users.length >= role.max) {
        return interaction.reply({
          content: `❌ **${roleName}** is already full!`,
          ephemeral: true,
        });
      }

      // Reject if party is full and user has no existing slot
      const totalUsers = Object.keys(event.users).length;
      const maxSlot = getMaxSlot(event.roles);
      const currentRole = event.users[userId];
      if (!currentRole && totalUsers >= maxSlot) {
        return interaction.reply({
          content: "❌ Party is full!",
          ephemeral: true,
        });
      }

      await interaction.deferUpdate();

      // Remove from old role if switching
      if (currentRole) {
        event.roles[currentRole].users = event.roles[currentRole].users.filter(
          (id) => id !== userId,
        );
      }

      // Add to new role
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
