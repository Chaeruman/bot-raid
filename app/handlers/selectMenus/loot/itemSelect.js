const { ActionRowBuilder, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, MessageFlags } = require("discord.js");
const { CATALOG, ARMOR_PARTS, WEAPON_TYPES, ACCESSORY_TYPES, isArmor, isWeapon, isEquipment, isAccessory } = require("../../../items");

async function handleItemSelect(interaction, panel) {
  // customId: loot-sel:item:{lootMsgId}
  const itemKey = interaction.values[0];
  const def = CATALOG[itemKey];
  if (!def) {
    return interaction.reply({ content: "❌ Unknown item.", flags: MessageFlags.Ephemeral });
  }

  const source = panel.source;

  // Equipment → pick part first
  if (isEquipment(itemKey)) {
    const parts = isArmor(itemKey) ? ARMOR_PARTS : WEAPON_TYPES;
    const label = isArmor(itemKey) ? "armor part" : "weapon type";
    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`loot-sel:equip_part:${panel.lootMsgId}:${itemKey}:${source}`)
        .setPlaceholder(`Select ${label}`)
        .addOptions(parts.map((p) => ({ label: p, value: p }))),
    );
    return interaction.update({
      content: `⚔️ **${def.name}** — select ${label}:`,
      components: [row],
    });
  }

  // Accessory → pick type (Ring / Necklace / Earrings) first
  if (isAccessory(itemKey)) {
    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`loot-sel:acc_type:${panel.lootMsgId}:${itemKey}:${source}`)
        .setPlaceholder("Select accessory type")
        .addOptions(
          Object.keys(ACCESSORY_TYPES).map((t) => ({ label: t, value: t })),
        ),
    );
    return interaction.update({
      content: `💍 **${def.name}** — select type:`,
      components: [row],
    });
  }

  // All other items → qty modal directly
  return showQtyModal(interaction, panel.lootMsgId, itemKey, source, def, null);
}

async function showQtyModal(interaction, lootMsgId, itemKey, source, def, detail) {
  const detailSuffix = detail ? `:${detail}` : "";
  const modal = new ModalBuilder()
    .setCustomId(`loot-modal:item_qty:${lootMsgId}:${itemKey}:${source}${detailSuffix}`)
    .setTitle(`Add: ${(detail ? `${def.name} (${detail.replace("@", " — ")})` : def.name).slice(0, 45)}`);

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("qty")
        .setLabel(`Quantity (${def.stampsPerUnit} stamps each)`)
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("e.g. 1")
        .setRequired(true),
    ),
  );

  return interaction.showModal(modal);
}

module.exports = { handleItemSelect, showQtyModal };
