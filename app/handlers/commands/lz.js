const { getLuckyZoneToday, REWARDS } = require("../../data/luckyZone");

async function handleLz(interaction) {
  const zone = getLuckyZoneToday();
  const lines = [
    `🍀 **Lucky Zone hari ini** (pattern ${zone.pattern}, hari ke-${zone.day})`,
    `• ${zone.map1}`,
    `• ${zone.map2}`,
    ``,
    `Reward (Cap 60): Lv1 = Card Fragment x${REWARDS[1].cardFragment} (${REWARDS[1].chance * 100}%) + Monster Card Box x${REWARDS[1].monsterCardBox}`,
    `Lv2 = Card Fragment x${REWARDS[2].cardFragment} (${REWARDS[2].chance * 100}%) + Monster Card Box ${REWARDS[2].monsterCardBox}`,
  ];
  return interaction.reply(lines.join("\n"));
}

module.exports = { handleLz };
