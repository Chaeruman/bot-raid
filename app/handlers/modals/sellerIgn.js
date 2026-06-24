const { MessageFlags } = require("discord.js");
const { activeLootPanels, saveState } = require("../../state");
const { refreshLootPanel } = require("../../builders/lootPanel");

async function handleSellerIgnModal(interaction) {
  // customId: loot-modal:seller_ign:{lootMsgId}
  const lootMsgId = interaction.customId.split(":")[2];

  const panel = activeLootPanels[lootMsgId];
  if (!panel || panel.closed) {
    return interaction.reply({ content: "❌ Loot panel not found.", flags: MessageFlags.Ephemeral });
  }

  const ign = interaction.fields.getTextInputValue("ign").trim();
  const prevIgn = panel.sellerIgn;
  panel.sellerIgn = ign || null;
  saveState();

  // Replace the seller placeholder (or the previous IGN) in the thread title.
  // First time: match a placeholder word with/without parens (ign, seller, name, xxx, xx).
  // Afterwards: swap the known "(prevIgn)" token.
  if (panel.ownThread && ign) {
    try {
      const thread = await interaction.client.channels.fetch(panel.threadId);
      let name = thread.name;
      if (prevIgn) {
        if (name.includes(`(${prevIgn})`)) name = name.replace(`(${prevIgn})`, `(${ign})`);
      } else {
        name = name.replace(/\(?\b(?:ign|seller|name|xxx|xx)\b\)?/i, `(${ign})`);
      }
      name = name.slice(0, 100);
      if (name !== thread.name) await thread.setName(name);
    } catch (err) {
      console.error("❌ seller IGN title update failed:", err.message);
    }
  }

  await interaction.update({
    content: `✅ Seller set to <@${panel.sellerId}> (${ign}).`,
    components: [],
  });
  await refreshLootPanel(interaction.client, panel);
}

module.exports = { handleSellerIgnModal };
