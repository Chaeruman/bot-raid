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

  // Replace the "(seller)" placeholder (or the previous IGN) in the thread title
  if (panel.ownThread && ign) {
    try {
      const thread = await interaction.client.channels.fetch(panel.threadId);
      const prevToken = prevIgn ? `(${prevIgn})` : "(seller)";
      if (thread.name.includes(prevToken)) {
        const name = thread.name.replace(prevToken, `(${ign})`).slice(0, 100);
        if (name !== thread.name) await thread.setName(name);
      }
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
