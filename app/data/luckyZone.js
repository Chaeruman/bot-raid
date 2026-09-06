// Lucky Zone daily bonus maps — 3 fixed patterns (indexed by day-of-month),
// the game applies one pattern per calendar month, cycling on a 3-month loop.
//
// Cap 60 reward table (fixed regardless of pattern):
// Lv1 = Card Fragment x4 (16%) + Monster Card Box x2
// Lv2 = Card Fragment x5 (20%) + Monster Card Box "2 + 50%"
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

// Cap 70 Lucky Zone maps — same 3-pattern, 1-per-month structure, new zone names.
const PATTERNS_70 = {
  1: [
    ["Disappearing Half Moon Desert", "Swamp of Dead Night"],
    ["Valley of Eclipse", "Forest of Waiting Noon"],
    ["Sea of Sand Dust", "Silver Crescent Training Ground"],
    ["Bronze Crescent Forest", "Swamp of Dead Night"],
    ["Disappearing Half Moon Desert", "Forest of Waiting Noon"],
    ["Valley of Eclipse", "Silver Crescent Training Ground"],
    ["Golden Meadow", "Swamp of Dead Night"],
    ["Sea of Sand Dust", "Forest of Waiting Noon"],
    ["Valley of Eclipse", "Swamp of Dead Night"],
    ["Disappearing Half Moon Desert", "Silver Crescent Training Ground"],
    ["Bronze Crescent Forest", "Forest of Waiting Noon"],
    ["Sea of Sand Dust", "Silver Crescent Training Ground"],
    ["Golden Meadow", "Swamp of Dead Night"],
    ["Valley of Eclipse", "Silver Crescent Training Ground"],
    ["Disappearing Half Moon Desert", "Forest of Waiting Noon"],
    ["Bronze Crescent Forest", "Swamp of Dead Night"],
    ["Sea of Sand Dust", "Forest of Waiting Noon"],
    ["Golden Meadow", "Silver Crescent Training Ground"],
    ["Valley of Eclipse", "Swamp of Dead Night"],
    ["Bronze Crescent Forest", "Forest of Waiting Noon"],
    ["Disappearing Half Moon Desert", "Silver Crescent Training Ground"],
    ["Sea of Sand Dust", "Forest of Waiting Noon"],
    ["Golden Meadow", "Swamp of Dead Night"],
    ["Valley of Eclipse", "Silver Crescent Training Ground"],
    ["Disappearing Half Moon Desert", "Swamp of Dead Night"],
    ["Bronze Crescent Forest", "Forest of Waiting Noon"],
    ["Sea of Sand Dust", "Silver Crescent Training Ground"],
    ["Golden Meadow", "Forest of Waiting Noon"],
    ["Disappearing Half Moon Desert", "Swamp of Dead Night"],
    ["Valley of Eclipse", "Silver Crescent Training Ground"],
    ["Sea of Sand Dust", "Swamp of Dead Night"],
  ],
  2: [
    ["Disappearing Half Moon Desert", "Forest of Waiting Noon"],
    ["Golden Meadow", "Silver Crescent Training Ground"],
    ["Bronze Crescent Forest", "Swamp of Dead Night"],
    ["Disappearing Half Moon Desert", "Forest of Waiting Noon"],
    ["Valley of Eclipse", "Silver Crescent Training Ground"],
    ["Golden Meadow", "Swamp of Dead Night"],
    ["Sea of Sand Dust", "Forest of Waiting Noon"],
    ["Bronze Crescent Forest", "Silver Crescent Training Ground"],
    ["Valley of Eclipse", "Forest of Waiting Noon"],
    ["Disappearing Half Moon Desert", "Swamp of Dead Night"],
    ["Golden Meadow", "Silver Crescent Training Ground"],
    ["Valley of Eclipse", "Forest of Waiting Noon"],
    ["Sea of Sand Dust", "Swamp of Dead Night"],
    ["Bronze Crescent Forest", "Silver Crescent Training Ground"],
    ["Golden Meadow", "Forest of Waiting Noon"],
    ["Disappearing Half Moon Desert", "Swamp of Dead Night"],
    ["Valley of Eclipse", "Silver Crescent Training Ground"],
    ["Sea of Sand Dust", "Forest of Waiting Noon"],
    ["Golden Meadow", "Silver Crescent Training Ground"],
    ["Bronze Crescent Forest", "Swamp of Dead Night"],
    ["Disappearing Half Moon Desert", "Forest of Waiting Noon"],
    ["Sea of Sand Dust", "Swamp of Dead Night"],
    ["Valley of Eclipse", "Silver Crescent Training Ground"],
    ["Golden Meadow", "Swamp of Dead Night"],
    ["Disappearing Half Moon Desert", "Forest of Waiting Noon"],
    ["Bronze Crescent Forest", "Silver Crescent Training Ground"],
    ["Sea of Sand Dust", "Forest of Waiting Noon"],
    ["Valley of Eclipse", "Swamp of Dead Night"],
    ["Disappearing Half Moon Desert", "Forest of Waiting Noon"],
    ["Golden Meadow", "Silver Crescent Training Ground"],
    ["Bronze Crescent Forest", "Swamp of Dead Night"],
  ],
  3: [
    ["Sea of Sand Dust", "Silver Crescent Training Ground"],
    ["Bronze Crescent Forest", "Forest of Waiting Noon"],
    ["Disappearing Half Moon Desert", "Swamp of Dead Night"],
    ["Valley of Eclipse", "Forest of Waiting Noon"],
    ["Golden Meadow", "Silver Crescent Training Ground"],
    ["Sea of Sand Dust", "Swamp of Dead Night"],
    ["Disappearing Half Moon Desert", "Silver Crescent Training Ground"],
    ["Bronze Crescent Forest", "Forest of Waiting Noon"],
    ["Sea of Sand Dust", "Swamp of Dead Night"],
    ["Valley of Eclipse", "Silver Crescent Training Ground"],
    ["Disappearing Half Moon Desert", "Forest of Waiting Noon"],
    ["Golden Meadow", "Silver Crescent Training Ground"],
    ["Sea of Sand Dust", "Swamp of Dead Night"],
    ["Bronze Crescent Forest", "Forest of Waiting Noon"],
    ["Disappearing Half Moon Desert", "Swamp of Dead Night"],
    ["Valley of Eclipse", "Silver Crescent Training Ground"],
    ["Golden Meadow", "Forest of Waiting Noon"],
    ["Sea of Sand Dust", "Silver Crescent Training Ground"],
    ["Disappearing Half Moon Desert", "Swamp of Dead Night"],
    ["Bronze Crescent Forest", "Forest of Waiting Noon"],
    ["Valley of Eclipse", "Swamp of Dead Night"],
    ["Disappearing Half Moon Desert", "Forest of Waiting Noon"],
    ["Golden Meadow", "Silver Crescent Training Ground"],
    ["Valley of Eclipse", "Forest of Waiting Noon"],
    ["Sea of Sand Dust", "Swamp of Dead Night"],
    ["Bronze Crescent Forest", "Silver Crescent Training Ground"],
    ["Golden Meadow", "Swamp of Dead Night"],
    ["Valley of Eclipse", "Forest of Waiting Noon"],
    ["Disappearing Half Moon Desert", "Silver Crescent Training Ground"],
    ["Bronze Crescent Forest", "Swamp of Dead Night"],
    ["Valley of Eclipse", "Silver Crescent Training Ground"],
  ],
};

// --- Pattern cycle math -----------------------------------------------
// Generic: given a month, an anchor month, and the pattern (1/2/3) that is
// live during that anchor month, returns which pattern is live for `month`.
// The cycle repeats every 3 months, so this is the same every year.
function patternForMonthGeneric(month, anchorMonth, anchorPattern) {
  const offset = (((month - anchorMonth) % 3) + 3) % 3;
  return ((offset + (anchorPattern - 1)) % 3) + 1;
}

// Cap 60 anchor: July 2026 = pattern 3 (confirmed in-game).
function patternForMonth(month) {
  return patternForMonthGeneric(month, 7, 3);
}

// Cap 70 anchor — TODO: this is a placeholder. Once the patch is live,
// check which pattern (1/2/3) is actually showing in-game on launch day
// and put it here (with the launch month as the anchor month).
const CAP70_ANCHOR_MONTH = 9; // September 2026 (assumed launch month)
const CAP70_ANCHOR_PATTERN = 1; // PLACEHOLDER — confirm on launch day
function patternForMonth70(month) {
  return patternForMonthGeneric(month, CAP70_ANCHOR_MONTH, CAP70_ANCHOR_PATTERN);
}

// Cap 60 Lucky Zone rewards, fixed across all patterns.
const REWARDS = {
  1: { chance: 0.16, cardFragment: 4, monsterCardBox: 2 },
  2: { chance: 0.2, cardFragment: 5, monsterCardBox: "2 + 50%" },
};
// Cap 70 reward table isn't known yet — fill in once confirmed in-game.
const REWARDS_70 = null;

// --- Lookup ------------------------------------------------------------
// date defaults to now; pass a WIB-adjusted Date if calling from elsewhere.
function makeLuckyZoneGetter(patterns, patternFn) {
  return function (date = new Date()) {
    const wib = new Date(date.getTime() + 7 * 60 * 60 * 1000);
    const month = wib.getUTCMonth() + 1;
    const day = wib.getUTCDate();
    const pattern = patternFn(month);
    const row = patterns[pattern][day - 1];
    if (!row) return null; // e.g. day 31 on a pattern with fewer rows
    const [map1, map2] = row;
    return { pattern, day, map1, map2 };
  };
}

const getLuckyZoneToday = makeLuckyZoneGetter(PATTERNS, patternForMonth);
const getLuckyZoneToday70 = makeLuckyZoneGetter(PATTERNS_70, patternForMonth70);

// --- Cap 60 -> Cap 70 transition window ---------------------------------
// TODO: confirm the real patch date/time — currently a guess (Wed Sep 9, 2026 WIB).
const CAP70_LAUNCH_DATE = new Date("2026-09-09T00:00:00+07:00");
// How many days after launch the cap 60 digest keeps appearing alongside cap 70.
const CAP60_TRANSITION_DAYS = 7;

function getPhase(date = new Date()) {
  const transitionEnd = new Date(
    CAP70_LAUNCH_DATE.getTime() + CAP60_TRANSITION_DAYS * 24 * 60 * 60 * 1000
  );
  if (date < CAP70_LAUNCH_DATE) return "cap60-only";
  if (date < transitionEnd) return "transition";
  return "cap70-only";
}

// Shared by /lz command and the daily digest — one format, one place to change it.
function formatLzMessage(date = new Date()) {
  const phase = getPhase(date);
  const lines = [];

  if (phase !== "cap70-only") {
    const zone60 = getLuckyZoneToday(date);
    if (zone60) {
      lines.push(
        `🍀 **Lucky Zone Cap 60** (pattern ${zone60.pattern}, hari ke-${zone60.day})`,
        `• ${zone60.map1}`,
        `• ${zone60.map2}`
      );
    }
  }

  if (phase !== "cap60-only") {
    const zone70 = getLuckyZoneToday70(date);
    if (zone70) {
      if (lines.length) lines.push("");
      lines.push(
        `🍀 **Lucky Zone Cap 70** (pattern ${zone70.pattern}, hari ke-${zone70.day})`,
        `• ${zone70.map1}`,
        `• ${zone70.map2}`
      );
    }
  }

  return lines.join("\n");
}

module.exports = {
  PATTERNS,
  PATTERNS_70,
  patternForMonth,
  patternForMonth70,
  REWARDS,
  REWARDS_70,
  getLuckyZoneToday,
  getLuckyZoneToday70,
  getPhase,
  formatLzMessage,
};