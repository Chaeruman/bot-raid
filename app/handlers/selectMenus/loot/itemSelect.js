const { ActionRowBuilder, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, MessageFlags } = require("discord.js");
const { CATALOG, ARMOR_PARTS, WEAPON_TYPES, ACCESSORY_TYPES, isArmor, isEquipment, isAccessory } = require("../../../items");
const { refreshLootPanel } = require("../../../builders/lootPanel");
const { saveState, clearPendingEphemeral } = require("../../../state");

async function handleItemSelect(interaction, panel) {
  // customId: loot-sel:item:{lootMsgId}
  const itemKey = interaction.values[0];
  const def = CATALOG[itemKey];
  if (!def) {
    return interaction.reply({ content: "❌ Unknown item.", flags: MessageFlags.Ephemeral });
  }

  // Equipment → pick part first (always unique, no qty modal at the end)
  if (isEquipment(itemKey)) {
    const parts = isArmor(itemKey) ? ARMOR_PARTS : WEAPON_TYPES;
    const label = isArmor(itemKey) ? "armor part" : "weapon type";
    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`loot-sel:equip_part:${panel.lootMsgId}:${itemKey}`)
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
        .setCustomId(`loot-sel:acc_type:${panel.lootMsgId}:${itemKey}`)
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
    return showQtyModal(interaction, panel.lootMsgId, itemKey, def, null);
  }

  // unique type with no sub-selection → add 1 directly
  return addUniqueItem(interaction, panel, itemKey, def, null, false);
}

// Called after all sub-selections are done for unique items (equipment/accessory).
async function addUniqueItem(interaction, panel, itemKey, def, detail, clearEphemeral = true) {
  const existing = panel.items.find((i) => i.itemKey === itemKey && i.detail === detail);
  if (existing) {
    existing.qty += 1;
  } else {
    panel.items.push({ itemKey, qty: 1, price: null, detail });
  }
  saveState();

  const detailStr = detail ? ` (${detail.replace("@", " — ")})` : "";
  await interaction.update({
    content: `✅ Added **${def.name}${detailStr}**.`,
    components: [],
  });
  await refreshLootPanel(interaction.client, panel);
  if (clearEphemeral) {
    clearPendingEphemeral(panel.lootMsgId, interaction.user.id);
  }
}

// Only for quantity-type items (fragments etc.)
async function showQtyModal(interaction, lootMsgId, itemKey, def, detail) {
  const detailSuffix = detail ? `:${detail}` : "";
  const modal = new ModalBuilder()
    .setCustomId(`loot-modal:item_qty:${lootMsgId}:${itemKey}${detailSuffix}`)
    .setTitle(`Add: ${(detail ? `${def.name} (${detail.replace("@", " — ")})` : def.name).slice(0, 40)}`);

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
