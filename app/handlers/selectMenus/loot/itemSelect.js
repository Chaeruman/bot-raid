const { ActionRowBuilder, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, MessageFlags } = require("discord.js");
const { CATALOG, ARMOR_PARTS, WEAPON_TYPES, ACCESSORY_TYPES, isArmor, isEquipment, isAccessory } = require("../../../items");
const { refreshLootPanel } = require("../../../builders/lootPanel");

async function handleItemSelect(interaction, panel) {
  // customId: loot-sel:item:{lootMsgId}
  const itemKey = interaction.values[0];
  const def = CATALOG[itemKey];
  if (!def) {
    return interaction.reply({ content: "❌ Unknown item.", flags: MessageFlags.Ephemeral });
  }

  const source = panel.source;

  // Equipment → pick part first (always unique, no qty modal at the end)
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

  // Accessory → pick type first (always unique, no qty modal at the end)
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

  // quantity type (fragments etc.) → show qty modal
  if (def.type === "quantity") {
    return showQtyModal(interaction, panel.lootMsgId, itemKey, source, def, null);
  }

  // unique type with no sub-selection → add 1 directly
  return addUniqueItem(interaction, panel, itemKey, source, def, null);
}

// Called after all sub-selections are done for unique items (equipment/accessory).
async function addUniqueItem(interaction, panel, itemKey, source, def, detail) {
  const list = source === "mail" ? panel.mailItems : panel.raidItems;
  const existing = list.find((i) => i.itemKey === itemKey && i.detail === detail);
  if (existing) {
    existing.qty += 1;
  } else {
    list.push({ itemKey, qty: 1, price: null, detail });
  }

  const detailStr = detail ? ` (${detail.replace("@", " — ")})` : "";
  await interaction.update({
    content: `✅ Added **${def.name}${detailStr}** to ${source === "mail" ? "✉️ Mail" : "📥 Raid Drops"}.`,
    components: [],
  });
  await refreshLootPanel(interaction.client, panel);
}

// Only for quantity-type items (fragments etc.)
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

module.exports = { handleItemSelect, addUniqueItem, showQtyModal };
