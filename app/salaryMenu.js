// Pinned buttons for the two salary channels, so neither needs a command typed.
//
// Same shape as the bounty entry message: posted once, edited on every boot so
// the text here is the only place it comes from, and the button just calls the
// command's own handler.
const { MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const config = require("./config");
const { salaryMenus, saveState } = require("./state");
const { RANGES } = require("./salaryRange");

const PREFIX = "salary-btn:"; // + kirim | saya:<range>

const MENUS = () => [
  {
    key: "kirim",
    channelId: config.kirimGajiChannelId,
    label: "💸 Send Salary",
    content: [
      "**Send Salary**",
      "See who you still owe across your open panels, then mark them paid.",
    ].join("\n"),
  },
  {
    key: "saya",
    channelId: config.gajiSayaChannelId,
    // One button per range rather than a picker behind a button: three presets
    // fit on a single row, and a menu that costs an extra interaction to reach a
    // three-item list is a menu about itself.
    buttons: Object.keys(RANGES).map((key) => ({
      id: `saya:${key}`,
      label: { week: "🧾 Last Saturday", month: "📅 This Month", all: "📚 All" }[key],
    })),
    content: [
      "**My Salary**",
      "Salary you have received since the last Saturday reset, this month, or all of it.",
    ].join("\n"),
  },
];

const messageFor = (menu) => ({
  content: menu.content,
  components: [
    new ActionRowBuilder().addComponents(
      (menu.buttons || [{ id: menu.key, label: menu.label }]).map((b) =>
        new ButtonBuilder()
          .setCustomId(`${PREFIX}${b.id}`)
          .setLabel(b.label)
          .setStyle(ButtonStyle.Success),
      ),
    ),
  ],
});

// Edited on every boot rather than merely checked to exist — the wording lives
// in this file, so this is the only thing that makes the pinned copy match it.
async function syncSalaryMenus(client) {
  for (const menu of MENUS()) {
    if (!menu.channelId) {
      console.log(`💸 Salary menu "${menu.key}" off (channel id belum diset)`);
      continue;
    }
    const channel = await client.channels.fetch(menu.channelId).catch(() => null);
    if (!channel) {
      console.error(`❌ Salary menu "${menu.key}": channel ${menu.channelId} tidak ditemukan`);
      continue;
    }

    const known = salaryMenus[menu.key];
    if (known) {
      const msg = await channel.messages.fetch(known).catch(() => null);
      if (msg) {
        await msg.edit(messageFor(menu)).catch(() => {});
        continue;
      }
    }

    const msg = await channel.send(messageFor(menu));
    await msg.pin().catch(() => {});
    salaryMenus[menu.key] = msg.id;
    saveState();
    console.log(`💸 Salary menu "${menu.key}" posted`);
  }
}

// The button runs exactly what the command runs. Both handlers take their one
// option as an argument now, so neither has to know which surface called it.
async function handleSalaryButton(interaction) {
  const [key, arg] = interaction.customId.slice(PREFIX.length).split(":");
  if (key === "kirim")
    return require("./handlers/commands/combinedPay").handleCombinedPay(interaction, null);
  if (key === "saya")
    return require("./handlers/commands/mySalary").handleMySalary(interaction, arg || "week");
  return interaction.reply({ content: "⚠️ Tombol ini sudah tidak dikenal.", flags: MessageFlags.Ephemeral });
}

module.exports = { syncSalaryMenus, handleSalaryButton, messageFor, MENUS, PREFIX };
