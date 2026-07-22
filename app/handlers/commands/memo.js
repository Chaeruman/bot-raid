const { MessageFlags } = require("discord.js");
const { createEvent } = require("./_createEvent");

async function handleMemo(interaction) {
  const picked = [1, 2, 3, 4].filter((n) => interaction.options.getBoolean(`memo${n}`));
  if (picked.length === 0) {
    return interaction.reply({ content: "❌ Pilih minimal 1 tipe memo.", flags: MessageFlags.Ephemeral });
  }

  const label = `DDN Memo ${picked.join(" & ")}`;
  return createEvent(interaction, "memo", label);
}

module.exports = { handleMemo };
