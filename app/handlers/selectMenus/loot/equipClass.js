const { CATALOG } = require("../../../items");
const { showQtyModal } = require("./itemSelect");

async function handleEquipClass(interaction, panel, itemKey, source, part) {
  // value = chosen class (e.g. "Warrior")
  const cls = interaction.values[0];
  const def = CATALOG[itemKey];
  // detail encoded as "Warrior@Head" — "@" joins class and part
  const detail = `${cls}@${part}`;
  return showQtyModal(interaction, panel.lootMsgId, itemKey, source, def, detail);
}

module.exports = { handleEquipClass };
