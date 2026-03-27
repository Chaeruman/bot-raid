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

// ⏱️ COOLDOWN
const COOLDOWN = 3000;
const cooldowns = new Map();

// ======================
// EVENT CONFIG
// ======================
const eventTemplates = {
  gdn_hc: {
    roles: {
      FU: { max: 2, users: [] },
      PR: { max: 1, users: [] },
      MC: { max: 1, users: [] },
      SM: { max: 1, users: [] },
      MT: { max: 1, users: [] },
      ARCHER: { max: 2, users: [] },
      DPS: { max: 3, users: [] },
    },
  },

  gdn_cl: {
    roles: {
      FU: { max: 2, users: [] },
      PR: { max: 1, users: [] },
      MC: { max: 1, users: [] },
      SM: { max: 1, users: [] },
      MT: { max: 1, users: [] },
      ARCHER: { max: 2, users: [] },
      DPS: { max: 3, users: [] },
    },
  },
};

// ======================
// ACTIVE EVENTS
// ======================
const activeEvents = {};

// ======================
// BUTTON UI
// ======================
function createButtons(event, locked = false, userId = null) {
  const rows = [];
  let row = new ActionRowBuilder();
  let count = 0;

  for (let roleName in event.roles) {
    const role = event.roles[roleName];
    const totalUsers = Object.keys(event.users).length;
    const isFull = totalUsers >= 8;

    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`role_${roleName}`)
        .setLabel(
          role.max > 1
            ? `${roleName} (${role.users.length}/${role.max})`
            : roleName,
        )
        .setStyle(ButtonStyle.Primary)
        .setDisabled(locked || isFull),
    );

    count++;
    if (count % 5 === 0) {
      rows.push(row);
      row = new ActionRowBuilder();
    }
  }

  if (row.components.length > 0) rows.push(row);

  // CANCEL BUTTON (host only)
  rows.push(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("cancel_role")
        .setLabel("❌ Cancel")
        .setStyle(ButtonStyle.Danger)
        .setDisabled(locked || event.hostId !== userId),
    ),
  );

  return rows;
}

// ======================
// UPDATE MESSAGE
// ======================
async function updateMessage(message, event, locked = false) {
  let content = `📋 **${event.title}**\n\n`;

  for (let roleName in event.roles) {
    const role = event.roles[roleName];
    const count = role.users.length;
    const isMulti = role.max > 1;

    const slotText = isMulti && count > 0 ? ` (${count}/${role.max})` : "";

    if (count > 0) {
      const mentions = role.users.map((id) => `<@${id}>`).join(", ");
      content += `${roleName}${slotText} - ${mentions}\n`;
    } else {
      content += `${roleName} - (kosong)\n`;
    }
  }

  if (locked) content += "\n🔒 **FULL / LOCKED**";

  await message.edit({
    content,
    components: createButtons(event, locked),
  });
}

// ======================
// READY
// ======================
client.on("ready", () => {
  console.log(`✅ Login sebagai ${client.user.tag}`);
});

// ======================
// INTERACTION
// ======================
client.on("interactionCreate", async (interaction) => {
  try {
    // ======================
    // START COMMAND
    // ======================
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === "start") {
        await interaction.deferReply({ ephemeral: true });

        const eventName = interaction.options.getString("event");
        const template = eventTemplates[eventName];

        if (!template) {
          return interaction.editReply("❌ Event tidak ditemukan");
        }

        // clone template
        const roles = {};
        for (let r in template.roles) {
          roles[r] = { max: template.roles[r].max, users: [] };
        }

        // cek total slot
        const totalSlot = Object.values(roles).reduce(
          (sum, r) => sum + r.max,
          0,
        );

        if (totalSlot < 8) {
          return interaction.editReply(
            `❌ Total slot ${totalSlot}, minimal 8!`,
          );
        }

        const now = new Date();
        const time = now.toLocaleTimeString("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "Asia/Jakarta",
        });
        const date = now.toLocaleDateString("id-ID", {
          timeZone: "Asia/Jakarta",
        });

        const formattedName = eventName.toUpperCase().replace("_", " ");

        const event = {
          messageId: null,
          hostId: interaction.user.id,
          title: `${eventName.toUpperCase()} - ${date} ${time}`,
          roles,
          users: {},
        };

        event.title = `${formattedName} - ${date} ${time} WIB`;

        const msg = await interaction.channel.send({
          content: "Loading...",
        });

        event.messageId = msg.id;
        activeEvents[msg.id] = event;

        await updateMessage(msg, event);

        await interaction.editReply(`✅ Event ${event.title} dimulai!`);
      }
    }

    // ======================
    // BUTTON HANDLER
    // ======================
    if (interaction.isButton()) {
      const event = activeEvents[interaction.message.id];
      if (!event) return;

      const userId = interaction.user.id;

      // cooldown
      const now = Date.now();
      const last = cooldowns.get(userId) || 0;

      if (now - last < COOLDOWN) {
        return interaction.reply({
          content: "⏳ Tunggu sebentar!",
          ephemeral: true,
        });
      }

      cooldowns.set(userId, now);

      // ======================
      // CANCEL (HOST ONLY)
      // ======================
      if (interaction.customId === "cancel_role") {
        if (userId !== event.hostId) {
          return interaction.reply({
            content: "❌ Hanya host yang bisa cancel!",
            ephemeral: true,
          });
        }

        event.users = {};
        for (let role in event.roles) {
          event.roles[role].users = [];
        }

        await updateMessage(interaction.message, event, false);

        return interaction.reply({
          content: "🛑 Event di-reset oleh host",
          ephemeral: true,
        });
      }

      // ======================
      // ROLE SELECT
      // ======================
      const roleName = interaction.customId.replace("role_", "");
      const role = event.roles[roleName];

      const currentRole = event.users[userId];

      // 🔒 HARD LIMIT 8
      const totalUsers = Object.keys(event.users).length;

      if (!currentRole && totalUsers >= 8) {
        return interaction.reply({
          content: "❌ Slot sudah penuh (8/8)!",
          ephemeral: true,
        });
      }

      if (role.users.length >= role.max) {
        return interaction.reply({
          content: "❌ Role sudah penuh!",
          ephemeral: true,
        });
      }

      // pindah role
      if (currentRole) {
        const oldRole = event.roles[currentRole];
        oldRole.users = oldRole.users.filter((id) => id !== userId);
      }

      role.users.push(userId);
      event.users[userId] = roleName;

      const isFull = Object.values(event.roles).every(
        (r) => r.users.length >= r.max,
      );

      await updateMessage(interaction.message, event, isFull);

      await interaction.reply({
        content: currentRole
          ? `🔁 Pindah ke ${roleName}`
          : `✅ Ambil ${roleName}`,
        ephemeral: true,
      });
    }
  } catch (err) {
    console.error(err);

    if (interaction.deferred) {
      await interaction.editReply("❌ Error");
    } else {
      await interaction.reply({
        content: "❌ Terjadi error",
        ephemeral: true,
      });
    }
  }
});

// ======================
client.login(token);
