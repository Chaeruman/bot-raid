const { ActionRowBuilder, StringSelectMenuBuilder } = require("discord.js");
const { CATALOG, CLASSES } = require("../../../items");

async function handleEquipPart(interaction, panel, itemKey, source) {
  // value = chosen part (e.g. "Head", "Main")
  const part = interaction.values[0];
  const def = CATALOG[itemKey];

  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`loot-sel:equip_class:${panel.lootMsgId}:${itemKey}:${source}:${part}`)
      .setPlaceholder("Select class")
      .addOptions(CLASSES.map((c) => ({ label: c, value: c }))),
  );

  return interaction.update({
    content: `⚔️ **${def.name} — ${part}** — select class:`,
    components: [row],
  });
}

module.exports = { handleEquipPart };
