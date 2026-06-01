const { ActionRowBuilder, StringSelectMenuBuilder } = require("discord.js");
const { CATALOG, ACCESSORY_TYPES } = require("../../../items");

async function handleAccType(interaction, panel, itemKey, source) {
  // value = chosen type (e.g. "Ring")
  const type = interaction.values[0];
  const def = CATALOG[itemKey];
  const subtypes = ACCESSORY_TYPES[type];

  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`loot-sel:acc_subtype:${panel.lootMsgId}:${itemKey}:${source}:${type}`)
      .setPlaceholder(`Select ${type} subtype`)
      .addOptions(subtypes.map((s) => ({ label: s, value: s }))),
  );

  return interaction.update({
    content: `💍 **${def.name} — ${type}** — select subtype:`,
    components: [row],
  });
}

module.exports = { handleAccType };
