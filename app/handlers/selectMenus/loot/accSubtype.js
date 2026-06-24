const { CATALOG } = require("../../../items");
const { addUniqueItem } = require("./itemSelect");

async function handleAccSubtype(interaction, panel, itemKey, type) {
  const subtype = interaction.values[0];
  const def = CATALOG[itemKey];
  const detail = `${type}@${subtype}`;
  return addUniqueItem(interaction, panel, itemKey, def, detail, false);
}

module.exports = { handleAccSubtype };
