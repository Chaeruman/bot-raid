// Run: node app/_luckyZoneTest.js — checks Lucky Zone pattern lookup by date.
const assert = require("assert");
const { getLuckyZoneToday } = require("./data/luckyZone");

// July 1, 2026, WIB (UTC+7) -> pattern 3, day 1.
const july1 = new Date(Date.UTC(2026, 6, 1, 1, 0)); // 08:00 WIB
const r1 = getLuckyZoneToday(july1);
assert.deepStrictEqual(r1, { pattern: 3, day: 1, map1: "Meteor Crash Site Boundaries", map2: "Tel Rosa City" });

// July 31, 2026, WIB -> pattern 3, day 31 (last entry).
const july31 = new Date(Date.UTC(2026, 6, 31, 1, 0));
const r31 = getLuckyZoneToday(july31);
assert.deepStrictEqual(r31, { pattern: 3, day: 31, map1: "Mutant's Habitat", map2: "Miracle Altar Conservation Area" });

// Pattern rolls over month to month: July=3 -> August=1 -> September=2 -> October=3.
const aug1 = new Date(Date.UTC(2026, 7, 1, 1, 0));
assert.strictEqual(getLuckyZoneToday(aug1).pattern, 1);
const sep1 = new Date(Date.UTC(2026, 8, 1, 1, 0));
assert.strictEqual(getLuckyZoneToday(sep1).pattern, 2);
const oct1 = new Date(Date.UTC(2026, 9, 1, 1, 0));
assert.strictEqual(getLuckyZoneToday(oct1).pattern, 3);
// Same month next year -> same pattern (cycle length 3 divides 12 evenly).
const nextJuly1 = new Date(Date.UTC(2027, 6, 1, 1, 0));
assert.strictEqual(getLuckyZoneToday(nextJuly1).pattern, 3);

console.log("✅ luckyZone pattern lookup OK");
