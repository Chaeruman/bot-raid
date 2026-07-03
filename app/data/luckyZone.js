// Lucky Zone daily bonus maps — 3 fixed 31-day patterns (indexed by day-of-month,
// 1-31), the game applies one pattern per calendar month. Reward table stays
// fixed regardless of pattern (Cap 60): Lv1 = Card Fragment x4 (16%) + Monster
// Card Box x2, Lv2 = Card Fragment x5 (20%) + Monster Card Box "2 + 50%".
const PATTERNS = {
  1: [
    ["Meteor Crash Site Core", "Miracle Altar Conservation Area"],
    ["Shadow of Evil Spirits", "Occupied Ancient Temple"],
    ["Mutant's Habitat", "Tel Rosa City"],
    ["Encroached Temple Ruins", "Miracle Altar Conservation Area"],
    ["Meteor Crash Site Boundaries", "Tel Noir Temple"],
    ["Meteor Crash Site Core", "Occupied Ancient Temple"],
    ["Shadow of Evil Spirits", "Tel Rosa City"],
    ["Encroached Temple Ruins", "Tel Noir Temple"],
    ["Mutant's Habitat", "Tel Rosa City"],
    ["Meteor Crash Site Boundaries", "Occupied Ancient Temple"],
    ["Shadow of Evil Spirits", "Tel Rosa City"],
    ["Meteor Crash Site Core", "Miracle Altar Conservation Area"],
    ["Encroached Temple Ruins", "Occupied Ancient Temple"],
    ["Meteor Crash Site Boundaries", "Tel Noir Temple"],
    ["Mutant's Habitat", "Miracle Altar Conservation Area"],
    ["Shadow of Evil Spirits", "Tel Rosa City"],
    ["Meteor Crash Site Boundaries", "Tel Noir Temple"],
    ["Encroached Temple Ruins", "Occupied Ancient Temple"],
    ["Meteor Crash Site Core", "Tel Rosa City"],
    ["Mutant's Habitat", "Tel Noir Temple"],
    ["Shadow of Evil Spirits", "Miracle Altar Conservation Area"],
    ["Meteor Crash Site Boundaries", "Occupied Ancient Temple"],
    ["Meteor Crash Site Core", "Tel Noir Temple"],
    ["Encroached Temple Ruins", "Occupied Ancient Temple"],
    ["Shadow of Evil Spirits", "Miracle Altar Conservation Area"],
    ["Mutant's Habitat", "Tel Rosa City"],
    ["Meteor Crash Site Boundaries", "Miracle Altar Conservation Area"],
    ["Encroached Temple Ruins", "Tel Noir Temple"],
    ["Meteor Crash Site Core", "Tel Rosa City"],
    ["Mutant's Habitat", "Occupied Ancient Temple"],
    ["Shadow of Evil Spirits", "Tel Noir Temple"],
  ],
  2: [
    ["Meteor Crash Site Core", "Tel Rosa City"],
    ["Meteor Crash Site Boundaries", "Miracle Altar Conservation Area"],
    ["Encroached Temple Ruins", "Occupied Ancient Temple"],
    ["Mutant's Habitat", "Tel Noir Temple"],
    ["Shadow of Evil Spirits", "Miracle Altar Conservation Area"],
    ["Meteor Crash Site Core", "Tel Rosa City"],
    ["Mutant's Habitat", "Tel Noir Temple"],
    ["Encroached Temple Ruins", "Occupied Ancient Temple"],
    ["Meteor Crash Site Boundaries", "Tel Rosa City"],
    ["Meteor Crash Site Core", "Tel Noir Temple"],
    ["Shadow of Evil Spirits", "Miracle Altar Conservation Area"],
    ["Mutant's Habitat", "Occupied Ancient Temple"],
    ["Meteor Crash Site Core", "Tel Noir Temple"],
    ["Meteor Crash Site Boundaries", "Occupied Ancient Temple"],
    ["Shadow of Evil Spirits", "Miracle Altar Conservation Area"],
    ["Encroached Temple Ruins", "Tel Rosa City"],
    ["Mutant's Habitat", "Miracle Altar Conservation Area"],
    ["Meteor Crash Site Boundaries", "Tel Noir Temple"],
    ["Meteor Crash Site Core", "Tel Rosa City"],
    ["Encroached Temple Ruins", "Occupied Ancient Temple"],
    ["Shadow of Evil Spirits", "Tel Noir Temple"],
    ["Meteor Crash Site Boundaries", "Miracle Altar Conservation Area"],
    ["Mutant's Habitat", "Occupied Ancient Temple"],
    ["Meteor Crash Site Core", "Tel Rosa City"],
    ["Shadow of Evil Spirits", "Miracle Altar Conservation Area"],
    ["Encroached Temple Ruins", "Tel Noir Temple"],
    ["Meteor Crash Site Boundaries", "Occupied Ancient Temple"],
    ["Mutant's Habitat", "Tel Rosa City"],
    ["Shadow of Evil Spirits", "Tel Noir Temple"],
    ["Meteor Crash Site Core", "Tel Rosa City"],
    ["Encroached Temple Ruins", "Occupied Ancient Temple"],
  ],
  3: [
    ["Meteor Crash Site Boundaries", "Tel Rosa City"],
    ["Encroached Temple Ruins", "Tel Rosa City"],
    ["Mutant's Habitat", "Tel Noir Temple"],
    ["Shadow of Evil Spirits", "Tel Rosa City"],
    ["Meteor Crash Site Core", "Occupied Ancient Temple"],
    ["Mutant's Habitat", "Tel Noir Temple"],
    ["Meteor Crash Site Boundaries", "Miracle Altar Conservation Area"],
    ["Encroached Temple Ruins", "Occupied Ancient Temple"],
    ["Meteor Crash Site Core", "Tel Rosa City"],
    ["Shadow of Evil Spirits", "Miracle Altar Conservation Area"],
    ["Meteor Crash Site Boundaries", "Tel Noir Temple"],
    ["Meteor Crash Site Core", "Occupied Ancient Temple"],
    ["Mutant's Habitat", "Tel Rosa City"],
    ["Shadow of Evil Spirits", "Tel Noir Temple"],
    ["Encroached Temple Ruins", "Tel Rosa City"],
    ["Mutant's Habitat", "Occupied Ancient Temple"],
    ["Shadow of Evil Spirits", "Tel Rosa City"],
    ["Meteor Crash Site Core", "Miracle Altar Conservation Area"],
    ["Meteor Crash Site Boundaries", "Occupied Ancient Temple"],
    ["Encroached Temple Ruins", "Tel Noir Temple"],
    ["Meteor Crash Site Core", "Miracle Altar Conservation Area"],
    ["Mutant's Habitat", "Tel Rosa City"],
    ["Encroached Temple Ruins", "Tel Noir Temple"],
    ["Meteor Crash Site Boundaries", "Occupied Ancient Temple"],
    ["Shadow of Evil Spirits", "Tel Rosa City"],
    ["Encroached Temple Ruins", "Tel Noir Temple"],
    ["Mutant's Habitat", "Miracle Altar Conservation Area"],
    ["Meteor Crash Site Core", "Occupied Ancient Temple"],
    ["Shadow of Evil Spirits", "Tel Noir Temple"],
    ["Meteor Crash Site Boundaries", "Occupied Ancient Temple"],
    ["Mutant's Habitat", "Miracle Altar Conservation Area"],
  ],
};

// Pattern cycles 1 -> 2 -> 3 -> 1 every month, anchored on July 2026 = pattern 3
// (confirmed in-game). Repeats every 3 months, so it's the same every year.
function patternForMonth(month) {
  return (((month - 8) % 3) + 3) % 3 + 1;
}

// Cap 60 Lucky Zone rewards, fixed across all patterns.
const REWARDS = {
  1: { chance: 0.16, cardFragment: 4, monsterCardBox: 2 },
  2: { chance: 0.2, cardFragment: 5, monsterCardBox: "2 + 50%" },
};

// date defaults to now; pass a WIB-adjusted Date if calling from elsewhere.
function getLuckyZoneToday(date = new Date()) {
  const wib = new Date(date.getTime() + 7 * 60 * 60 * 1000);
  const month = wib.getUTCMonth() + 1;
  const day = wib.getUTCDate();
  const pattern = patternForMonth(month);
  const [map1, map2] = PATTERNS[pattern][day - 1];
  return { pattern, day, map1, map2 };
}

// Shared by /lz command and the daily digest — one format, one place to change it.
function formatLzMessage(zone = getLuckyZoneToday()) {
  return [
    `🍀 **Lucky Zone hari ini** (pattern ${zone.pattern}, hari ke-${zone.day})`,
    `• ${zone.map1}`,
    `• ${zone.map2}`,
    ``,
    `Reward (Cap 60): Lv1 = Card Fragment x${REWARDS[1].cardFragment} (${REWARDS[1].chance * 100}%) + Monster Card Box x${REWARDS[1].monsterCardBox}`,
    `Lv2 = Card Fragment x${REWARDS[2].cardFragment} (${REWARDS[2].chance * 100}%) + Monster Card Box ${REWARDS[2].monsterCardBox}`,
  ].join("\n");
}

module.exports = { PATTERNS, patternForMonth, REWARDS, getLuckyZoneToday, formatLzMessage };
