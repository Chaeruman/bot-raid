const { createEvent } = require("./_createEvent");

async function handleMemo(interaction) {
  const picked = interaction.options.getString("tipe", true).split(",");
  const label = `DDN Memo ${picked.join(" & ")}`;
  return createEvent(interaction, "memo", label);
}

module.exports = { handleMemo };
