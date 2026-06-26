const { MessageFlags } = require("discord.js");
const { activeLootPanels, saveState } = require("../../state");
const { buildLootEmbed, buildLootComponents } = require("../../builders/lootPanel");
const config = require("../../config");

async function handleLoot(interaction) {
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  } catch (err) {
    if (err.code === 40060) return;
    throw err;
  }

  const inSalaryThread =
    interaction.channel?.isThread() &&
    (!config.threadChannelId || interaction.channel.parentId === config.threadChannelId);
  if (!inSalaryThread) {
    return interaction.editReply("❌ /loot can only be used inside a salary thread.");
  }

  const title  = interaction.options.getString("title");
  const hostId = interaction.user.id;

  // Optional team scope: guard by role, then auto-fill members from that role.
  let members = [];
  const tim = interaction.options.getString("tim"); // "1" | "2" | null
  if (tim) {
    const roleId = tim === "1" ? config.tim1RoleId : config.tim2RoleId;
    if (!roleId) {
      return interaction.editReply(`❌ Tim ${tim} role is not configured (set TIM${tim}_ROLE_ID).`);
    }
    if (!interaction.member.roles.cache.has(roleId)) {
      return interaction.editReply(`⛔ Only members of Tim ${tim} can create a Tim ${tim} panel.`);
    }
    const all = await interaction.guild.members.fetch();
    members = all.filter((m) => !m.user.bot && m.roles.cache.has(roleId)).map((m) => m.id);
  }

  const panel = {
    lootMsgId: null,
    threadId: interaction.channelId,
    ownThread: true,
    threadBaseTitle: interaction.channel.name,
    eventTitle: tim ? `${title} (Tim ${tim})` : title,
    hostId,
    hcGoldSplit: "mixed",
    subruns: null,
    members,
    sellerId: null,
    items: [],
    goldEntries: [],
    payments: Object.fromEntries(members.map((uid) => [uid, false])),
    closed: false,
  };

  const msg = await interaction.channel.send({ embeds: [buildLootEmbed(panel)] });
  panel.lootMsgId = msg.id;
  activeLootPanels[msg.id] = panel;
  saveState();

  await msg.edit({
    embeds: [buildLootEmbed(panel)],
    components: buildLootComponents(panel),
  });

  const memberNote = tim ? ` with ${members.length} Tim ${tim} member(s)` : "";
  return interaction.editReply(`📦 Loot panel created for **${title}**${memberNote}.`);
}

module.exports = { handleLoot };
