const { CATALOG } = require("../../../items");
const { addUniqueItem } = require("./itemSelect");

async function handleEquipClass(interaction, panel, itemKey, part) {
  const cls = interaction.values[0];
  const def = CATALOG[itemKey];
  const detail = `${cls}@${part}`;
  return addUniqueItem(interaction, panel, itemKey, def, detail);
}

module.exports = { handleEquipClass };
