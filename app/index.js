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

// ======================
// CONFIG
// ======================
const COOLDOWN = 3000;
const MAX_SLOT = 8;
const cooldowns = new Map();

// ======================
// EVENT TEMPLATE
// ======================
const eventTemplates = {
  gdn_hc: {
    roles: {
      FU: { max: 2, users: [] },
      PR: { max: 1, users: [] },
      MC: { max: 1, users: [] },
      SM: { max: 1, users: [] },
      MT: { max: 1, users: [] },
      EL: { max: 1, users: [] },
      KALI: { max: 1, users: [] },
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
      EL: { max: 1, users: [] },
      KALI: { max: 1, users: [] },
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
    const isFull = role.users.length >= role.max;

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

  // ROW: CANCEL ROLE (SEMUA USER)
  rows.push(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("cancel_my_role")
        .setLabel("❌ Cancel")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(event.isDone),
    ),
  );

  // ROW: CANCEL RUN (HOST ONLY)
  rows.push(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("cancel_run")
        .setLabel("🛑 Cancel Run (Host only)")
        .setStyle(ButtonStyle.Danger),
    ),
  );

  return rows;
}

// ======================
// UPDATE MESSAGE
// ======================
async function updateMessage(message, event, locked = false) {
  const totalUsers = Object.keys(event.users).length;

  let content = `📋 **${event.title} (${totalUsers}/${MAX_SLOT})**\n`;
  content += `Started by: <@${event.hostId}>\n\n`;

  for (let roleName in event.roles) {
    const role = event.roles[roleName];
    const count = role.users.length;

    const slotText = role.max > 1 && count > 0 ? ` (${count}/${role.max})` : "";

    if (count > 0) {
      const mentions = role.users.map((id) => `<@${id}>`).join(", ");
      content += `${roleName}${slotText} - ${mentions}\n`;
    } else {
      content += `${roleName} - (kosong)\n`;
    }
  }

  if (event.isDone) {
    content += "\n✅ **SELESAI**";
  } else if (totalUsers >= MAX_SLOT) {
    content += "\n🔒 **FULL**";
  }

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

        // clone roles
        const roles = {};
        for (let r in template.roles) {
          roles[r] = { max: template.roles[r].max, users: [] };
        }

        const totalSlot = Object.values(roles).reduce(
          (sum, r) => sum + r.max,
          0,
        );

        if (totalSlot < MAX_SLOT) {
          return interaction.editReply(
            `❌ Total slot ${totalSlot}, minimal ${MAX_SLOT}!`,
          );
        }

        const now = new Date();

        const time = now.toLocaleTimeString("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "Asia/Jakarta",
        });

        const date = now.toLocaleDateString("id-ID", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          timeZone: "Asia/Jakarta",
        });

        const formattedName = eventName.toUpperCase().replace("_", " ");

        const event = {
          messageId: null,
          hostId: interaction.user.id,
          title: `${formattedName} - ${date} ${time} WIB`,
          roles,
          users: {},
          isDone: false,
        };

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
    // BUTTON
    // ======================
    if (interaction.isButton()) {
      const event = activeEvents[interaction.message.id];
      if (!event) return;

      const userId = interaction.user.id;

      // ❌ kalau sudah selesai
      if (event.isDone) {
        return interaction.reply({
          content: "❌ Event sudah selesai!",
          ephemeral: true,
        });
      }

      // ⏱️ cooldown
      const now = Date.now();
      const last = cooldowns.get(userId) || 0;

      if (now - last < COOLDOWN) {
        return interaction.reply({
          content: "⏳ Tunggu sebentar!",
          ephemeral: true,
        });
      }

      cooldowns.set(userId, now);

      if (interaction.customId === "cancel_my_role") {
        const currentRole = event.users[userId];

        if (!currentRole) {
          return interaction.reply({
            content: "❌ Kamu belum ambil role!",
            ephemeral: true,
          });
        }

        const role = event.roles[currentRole];
        role.users = role.users.filter((id) => id !== userId);

        delete event.users[userId];

        await updateMessage(interaction.message, event);

        return interaction.reply({
          content: "✅ Role dibatalkan",
          ephemeral: true,
        });
      }

      if (interaction.customId === "cancel_run") {
        if (userId !== event.hostId) {
          return interaction.reply({
            content: "❌ Hanya host!",
            ephemeral: true,
          });
        }

        // hapus event dari memory
        delete activeEvents[event.messageId];

        await interaction.message.edit({
          content: "🛑 **RUN DIBATALKAN OLEH HOST**",
          components: [],
        });

        return interaction.reply({
          content: "Run berhasil dibatalkan",
          ephemeral: true,
        });
      }

      // ======================
      // ROLE SELECT
      // ======================
      const roleName = interaction.customId.replace("role_", "");
      const role = event.roles[roleName];

      const currentRole = event.users[userId];
      const totalUsers = Object.keys(event.users).length;

      // 🔒 hard limit 8
      if (!currentRole && totalUsers >= MAX_SLOT) {
        return interaction.reply({
          content: "❌ Slot sudah penuh (8/8)!",
          ephemeral: true,
        });
      }

      // ❌ role penuh
      if (role.users.length >= role.max) {
        return interaction.reply({
          content: "❌ Role penuh!",
          ephemeral: true,
        });
      }

      // 🔁 pindah role
      if (currentRole) {
        const oldRole = event.roles[currentRole];
        oldRole.users = oldRole.users.filter((id) => id !== userId);
      }

      role.users.push(userId);
      event.users[userId] = roleName;

      const isFull = Object.keys(event.users).length >= MAX_SLOT;

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
// RENDER PORT FIX (FREE)
// ======================
require("http")
  .createServer((req, res) => res.end("OK"))
  .listen(process.env.PORT || 3000);

// ======================
client.login(token);
