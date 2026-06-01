const { CATALOG } = require("../../../items");
const { showQtyModal } = require("./itemSelect");

async function handleAccSubtype(interaction, panel, itemKey, source, type) {
  // value = chosen subtype (e.g. "Hybrid", "VIT")
  const subtype = interaction.values[0];
  const def = CATALOG[itemKey];
  // detail encoded as "Ring@Hybrid"
  const detail = `${type}@${subtype}`;
  return showQtyModal(interaction, panel.lootMsgId, itemKey, source, def, detail);
}

module.exports = { handleAccSubtype };
