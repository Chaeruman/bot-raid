// Self-serve ping roles in #pick-a-role.
//
// One message, two buttons, and the same button both joins and leaves — a role
// menu that cannot be undone is one people refuse to press in the first place.
//
// The roles exist so a run announcement reaches the people who want it and
// nobody else. @everyone would reach everyone once and be muted forever.
const {
  MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits,
} = require("discord.js");
const config = require("./config");
const { rolePickMenu, saveState } = require("./state");

const PICK = "role-pick:"; // + raid | nest

const ROLES = () => [
  { key: "raid", label: "Raid", id: config.raidRoleId, note: "8-player runs" },
  { key: "nest", label: "Nest", id: config.nestRoleId, note: "4-player runs" },
];

const available = () => ROLES().filter((r) => r.id);

function menuMessage() {
  const roles = available();
  return {
    content: [
      "**Pick a role**",
      "These decide what you get pinged for. Press to join, press again to leave.",
      "",
      // Mentions, not bold text: Discord renders a role mention in that role's
      // own colour, so the list looks like the thing it hands out.
      ...roles.map((r) => `- <@&${r.id}> — ${r.note}`),
    ].join("\n"),
    allowedMentions: { parse: [] }, // named to be seen, never to be summoned
    components: [
      new ActionRowBuilder().addComponents(
        roles.map((r) =>
          new ButtonBuilder().setCustomId(`${PICK}${r.key}`).setLabel(r.label).setStyle(ButtonStyle.Secondary),
        ),
      ),
    ],
  };
}

// Edited on every boot, not merely checked to exist. The text lives in this
// file, so this is the only thing that makes the pinned copy match it.
async function syncRoleMenu(client) {
  if (!config.rolePickChannelId) return console.log("🎭 Role menu off (ROLE_PICK_CHANNEL_ID belum diset)");
  if (!available().length) return console.log("🎭 Role menu off (RAID_ROLE_ID / NEST_ROLE_ID belum diset)");

  const channel = await client.channels.fetch(config.rolePickChannelId).catch(() => null);
  if (!channel) return console.error("❌ ROLE_PICK_CHANNEL_ID tidak ditemukan");

  if (rolePickMenu.messageId) {
    const msg = await channel.messages.fetch(rolePickMenu.messageId).catch(() => null);
    if (msg) return msg.edit(menuMessage()).catch(() => {});
  }

  const msg = await channel.send(menuMessage());
  await msg.pin().catch(() => {});
  rolePickMenu.messageId = msg.id;
  saveState();
  console.log("🎭 Role menu posted");
}

async function handleRolePick(interaction) {
  const key = interaction.customId.slice(PICK.length);
  const role = available().find((r) => r.key === key);
  if (!role)
    return interaction.reply({ content: "⚠️ That role is not set up.", flags: MessageFlags.Ephemeral });

  const has = interaction.member.roles.cache.has(role.id);
  const failed = await interaction.member.roles[has ? "remove" : "add"](role.id).catch((err) => err);

  if (failed instanceof Error) {
    console.error(`❌ role-pick ${key} (${interaction.user.id}):`, failed.message);
    return interaction.reply({
      // Same trap as the Bounty Hunter grant: the permission can be on and the
      // bot still refused, because Discord will not manage a role at or above
      // its own highest one.
      content:
        "⚠️ Couldn't change that role. The bot needs **Manage Roles**, and its own role must sit " +
        "**above** this one in Server Settings → Roles.",
      flags: MessageFlags.Ephemeral,
    });
  }

  // Buttons cannot show which ones you already have — a reaction can, and that
  // is the only thing reactions do better here. Saying it outright closes the
  // gap without giving up the feedback a reaction can never give.
  const mine = available()
    .filter((r) => (r.key === key ? !has : interaction.member.roles.cache.has(r.id)))
    .map((r) => `<@&${r.id}>`);

  return interaction.reply({
    content:
      (has ? `You left <@&${role.id}>.` : `You joined <@&${role.id}>.`) +
      `\nYou now have: ${mine.length ? mine.join(" ") : "none"}`,
    flags: MessageFlags.Ephemeral,
    allowedMentions: { parse: [] },
  });
}

module.exports = { syncRoleMenu, handleRolePick, menuMessage, PICK };
