require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
} = require("discord.js");

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

const token = process.env.TOKEN;
const THREAD_CHANNEL_ID = process.env.THREAD_CHANNEL_ID;

// ====================== CONFIG ======================
const COOLDOWN = 3000;

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
      ACADEMIC: { max: 1 },
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
      ACADEMIC: { max: 1 },
      ARCHER: { max: 2 },
      DPS: { max: 3 },
    },
  },
};

// ====================== STATE ======================
const activeEvents = {};
const cooldowns = new Map();

// ====================== HELPERS ======================

// Safe acknowledge — guarantees exactly one response per interaction,
// swallowing 40060 (already ack'd) and 10062 (expired) silently.
async function ack(interaction, fn) {
  if (interaction.replied || interaction.deferred) return;
  try {
    await fn();
  } catch {
    /* ignore */
  }
}

function createButtons(event, viewerId = null) {
  const rows = [];
  let row = new ActionRowBuilder();
  let count = 0;
  const isHost = viewerId === event.hostId;

  for (const roleName in event.roles) {
    const role = event.roles[roleName];
    const isFull = role.users.length >= role.max;

    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`role_${roleName}`)
        .setLabel(
          role.max > 1
            ? `${roleName} (${role.users.length}/${role.max})`
            : roleName,
        )
        .setStyle(isFull ? ButtonStyle.Success : ButtonStyle.Primary)
        .setDisabled(event.locked || isFull),
    );

    count++;
    if (count % 5 === 0) {
      rows.push(row);
      row = new ActionRowBuilder();
      if (rows.length >= 3) break;
    }
  }

  if (row.components.length > 0 && rows.length < 3) {
    rows.push(row);
  }

  // Row 4: Cancel my role + Lock toggle + Remove Member
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
      new ButtonBuilder()
        .setCustomId("remove_member")
        .setLabel("🗑️ Remove Member")
        .setStyle(ButtonStyle.Danger)
        .setDisabled(!isHost || Object.keys(event.users).length === 0),
    ),
  );

  // Row 5: Cancel run + Done
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

  const HIDE_IF_EMPTY = new Set(["KALI", "ACADEMIC"]);
  const PER_SLOT_DISPLAY = new Set(["ARCHER", "DPS"]);

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

  await message.edit({
    content,
    components: createButtons(event, event.hostId),
  });
}

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

function buildThreadContent(event) {
  const HIDE_IF_EMPTY = new Set(["KALI", "ACADEMIC"]);
  const PER_SLOT_DISPLAY = new Set(["ARCHER", "DPS"]);

  let content = `**${event.title}**\n\n`;

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
  console.log(
    `📌 Thread channel: ${THREAD_CHANNEL_ID || "NOT SET — will use current channel"}`,
  );
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
          users: {},
          locked: false,
        };

        const msg = await interaction.channel.send({ content: "Loading…" });
        event.messageId = msg.id;
        activeEvents[msg.id] = event;

        await updateMessage(msg, event);
        return interaction.editReply(`✅ **${event.title}** started!`);
      }
    }

    // ── SELECT MENU — remove member ──
    if (interaction.isStringSelectMenu()) {
      if (!interaction.customId.startsWith("select_remove_")) return;

      const messageId = interaction.customId.replace("select_remove_", "");
      const event = activeEvents[messageId];

      if (!event) {
        return ack(interaction, () =>
          interaction.reply({
            content: "❌ Event not found.",
            ephemeral: true,
          }),
        );
      }
      if (interaction.user.id !== event.hostId) {
        return ack(interaction, () =>
          interaction.reply({
            content: "⛔ Only the host can remove members.",
            ephemeral: true,
          }),
        );
      }

      // Acknowledge the select menu first
      await ack(interaction, () => interaction.deferUpdate());

      const targetId = interaction.values[0];
      const targetRole = event.users[targetId];
      if (!targetRole) return;

      event.roles[targetRole].users = event.roles[targetRole].users.filter(
        (id) => id !== targetId,
      );
      delete event.users[targetId];

      // Update the signup message
      const signupMessage = await interaction.channel.messages.fetch(messageId);
      await updateMessage(signupMessage, event);

      // Confirm removal in the ephemeral message
      return interaction.editReply({
        content: `✅ <@${targetId}> has been removed from the party.`,
        components: [],
      });
    }

    // ── BUTTON ──
    if (interaction.isButton()) {
      const userId = interaction.user.id;
      const event = activeEvents[interaction.message.id];

      // 1. Cooldown — synchronous check
      const now = Date.now();
      const last = cooldowns.get(userId) || 0;
      const onCooldown = now - last < COOLDOWN;
      if (!onCooldown) cooldowns.set(userId, now);

      // 2. Determine the correct response type synchronously before any await.
      //    Three possible outcomes:
      //      a) silently ignore (cooldown / unknown event)
      //      b) ephemeral error message
      //      c) special ephemeral reply (remove_member dropdown)
      //      d) deferUpdate and proceed with mutation

      const HOST_ONLY = [
        "toggle_lock",
        "cancel_run",
        "done_run",
        "remove_member",
      ];
      const isHostOnly = HOST_ONLY.includes(interaction.customId);
      const notHost = isHostOnly && event && userId !== event.hostId;

      let ephemeralError = null;

      if (!onCooldown && event && !notHost) {
        if (interaction.customId.startsWith("role_")) {
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

      // 3. Acknowledge — exactly one response, fired immediately
      if (onCooldown || !event) {
        return ack(interaction, () => interaction.deferUpdate());
      }
      if (notHost) {
        return ack(interaction, () =>
          interaction.reply({
            content: "⛔ Only the host can do that.",
            ephemeral: true,
          }),
        );
      }
      if (ephemeralError) {
        return ack(interaction, () =>
          interaction.reply({ content: ephemeralError, ephemeral: true }),
        );
      }

      // ── Remove Member — needs its own ephemeral reply with a dropdown ──
      // Must be handled BEFORE deferUpdate since we need to reply, not defer.
      if (interaction.customId === "remove_member") {
        const joinedUsers = Object.entries(event.users);
        if (joinedUsers.length === 0) {
          return ack(interaction, () =>
            interaction.reply({
              content: "❌ No members to remove.",
              ephemeral: true,
            }),
          );
        }

        const options = joinedUsers.map(([uid, roleName]) => ({
          label: roleName,
          description: `ID: ${uid}`,
          value: uid,
        }));

        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId(`select_remove_${interaction.message.id}`)
          .setPlaceholder("Select a member to remove…")
          .addOptions(options);

        return ack(interaction, () =>
          interaction.reply({
            content: "👤 Select the member to remove:",
            components: [new ActionRowBuilder().addComponents(selectMenu)],
            ephemeral: true,
          }),
        );
      }

      // All other buttons: defer first, then mutate state
      await ack(interaction, () => interaction.deferUpdate());

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

      // ── Toggle Lock ──
      if (interaction.customId === "toggle_lock") {
        event.locked = !event.locked;
        return updateMessage(interaction.message, event);
      }

      // ── Cancel Run ──
      if (interaction.customId === "cancel_run") {
        delete activeEvents[event.messageId];
        return interaction.message.edit({
          content: "🛑 **Run cancelled by host.**",
          components: [],
        });
      }

      // ── Done — create forum thread ──
      if (interaction.customId === "done_run") {
        delete activeEvents[event.messageId];

        const threadTitle = buildThreadTitle(event);
        const threadContent = buildThreadContent(event);

        await interaction.message.edit({ components: [] });

        const threadChannel = THREAD_CHANNEL_ID
          ? await interaction.client.channels.fetch(THREAD_CHANNEL_ID)
          : interaction.channel;

        const isHC = event.label.toUpperCase().includes("HC");
        const tagId = isHC
          ? process.env.FORUM_TAG_HC
          : process.env.FORUM_TAG_CL;

        const createOptions = {
          name: threadTitle,
          autoArchiveDuration: 10080,
          reason: `Run completed: ${event.title}`,
          message: { content: threadContent },
        };

        if (tagId) createOptions.appliedTags = [tagId];

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
const axios = require("axios");
const RENDER_URL = process.env.RENDER_URL;

require("http")
  .createServer((_, res) => res.end("OK"))
  .listen(process.env.PORT || 3000);

if (RENDER_URL) {
  setInterval(() => {
    axios
      .get(RENDER_URL)
      .then((r) => console.log(`🔄 Kept alive: ${r.status}`))
      .catch((e) => console.error(`❌ Keep-alive failed: ${e.message}`));
  }, 30000);
}

client.login(token);
