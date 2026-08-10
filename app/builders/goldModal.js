const {
  ModalBuilder,
  LabelBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder,
} = require("discord.js");

// The Add Gold modal, in one place.
//
// It was copied verbatim into three call sites — the ÷8 direct path, the
// marathon type picker, and the ÷7 exclude picker — so adding a field meant
// editing all three, and missing one would have left a route where gold could
// not be marked as the bonus source at all. One builder, three callers.
//
// customId: loot-modal:gold:{lootMsgId}:{splitCount}:{excludedUserId|none}
function buildGoldModal(panel, splitCount, excludedUserId = null) {
  return new ModalBuilder()
    .setCustomId(`loot-modal:gold:${panel.lootMsgId}:${splitCount}:${excludedUserId || "none"}`)
    .setTitle(`Add Gold (÷${splitCount})`)
    .setLabelComponents(
      new LabelBuilder()
        .setLabel(`Jumlah gold (dibagi ${splitCount} orang)`)
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId("amount")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("e.g. 100000")
            .setRequired(true),
        ),
      // Optional, because most gold is not the bonus pot and saying "no" should
      // cost nothing. Same meaning as the "!" prefix in Type Items — one concept
      // reachable from either surface, so neither is the "real" way to do it.
      new LabelBuilder()
        .setLabel("Sumber Bonus Gold?")
        .setDescription("Kosongkan kalau bukan. Kalau dipilih, Bonus Gold diambil dari sini sebelum dibagi.")
        .setStringSelectMenuComponent(
          new StringSelectMenuBuilder()
            .setCustomId("bonus_source")
            .setRequired(false)
            .setPlaceholder("Bukan sumber bonus")
            .addOptions([{ label: "🎁 Ya — ambil Bonus Gold dari sini", value: "yes" }]),
        ),
    );
}

module.exports = { buildGoldModal };
