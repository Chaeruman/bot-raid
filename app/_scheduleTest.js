// Run: node app/_scheduleTest.js — the wall-clock arithmetic both digests use.
//
// This exists because an hourly setInterval put the daily Lucky Zone post at
// 00:47: an interval starts ticking when the PROCESS does, so the minute was
// whatever minute Render last restarted the bot. Sleeping to the real time is
// the fix, and this is the sum that decides how long to sleep.
const assert = require("assert");
const { msUntilWib } = require("./utils/schedule");

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

// 00:00 WIB is 17:00 UTC the day before. Written as explicit UTC rather than
// derived from the offset the code uses: a test that computes it the same way
// would agree with the code however wrong both were.
const at = (...utc) => Date.UTC(...utc);

// ── Daily ───────────────────────────────────────────────────────────────────
// Exactly on target returns a whole period, never 0 — a 0 would fire again
// immediately, and again, for as long as the clock stayed on the second.
assert.strictEqual(msUntilWib(0, null, at(2026, 6, 5, 17, 0)), DAY);
assert.strictEqual(msUntilWib(0, null, at(2026, 6, 5, 17, 1)), DAY - MIN);
// The case that started this: booted at 00:47 WIB.
assert.strictEqual(msUntilWib(0, null, at(2026, 6, 5, 17, 47)), DAY - 47 * MIN);
assert.strictEqual(msUntilWib(0, null, at(2026, 6, 5, 16, 59)), MIN);
assert.strictEqual(msUntilWib(0, null, at(2026, 6, 5, 5, 0)), 12 * HOUR);

// ── Weekly ──────────────────────────────────────────────────────────────────
// 2026-07-03 is a Friday; 16:00 UTC is 23:00 WIB that day.
assert.strictEqual(msUntilWib(23, 5, at(2026, 6, 3, 16, 0)), WEEK, "on it, wait a week");
assert.strictEqual(msUntilWib(23, 5, at(2026, 6, 3, 15, 0)), HOUR, "an hour before");
// Saturday morning: six and a bit days to the next Friday night.
const fromSat = msUntilWib(23, 5, at(2026, 6, 4, 1, 0));
assert.ok(fromSat > 5 * DAY && fromSat < WEEK, `from Saturday: ${fromSat / HOUR}h`);

// ── Both, from anywhere ─────────────────────────────────────────────────────
// Never 0, never negative, and never past its own period.
for (let m = 0; m < 7 * 24 * 60; m += 37) {
  const t = at(2026, 6, 1, 0, 0) + m * MIN;
  const d = msUntilWib(0, null, t);
  const w = msUntilWib(23, 5, t);
  assert.ok(d > 0 && d <= DAY, `daily at +${m}m gave ${d}`);
  assert.ok(w > 0 && w <= WEEK, `weekly at +${m}m gave ${w}`);
}

// And landing on it puts you exactly on the hour, on the right day, from any
// starting point — including across a month and a year boundary.
for (const start of [at(2026, 6, 5, 3, 21), at(2026, 11, 31, 22, 5), at(2027, 0, 1, 0, 0)]) {
  const daily = new Date(start + msUntilWib(0, null, start) + 7 * HOUR);
  assert.strictEqual(daily.getUTCHours(), 0, `daily from ${new Date(start).toISOString()}`);
  assert.strictEqual(daily.getUTCMinutes(), 0);
  assert.strictEqual(daily.getUTCSeconds(), 0);

  const weekly = new Date(start + msUntilWib(23, 5, start) + 7 * HOUR);
  assert.strictEqual(weekly.getUTCHours(), 23, `weekly from ${new Date(start).toISOString()}`);
  assert.strictEqual(weekly.getUTCMinutes(), 0);
  assert.strictEqual(weekly.getUTCDay(), 5, "and on a Friday");
}

console.log("✅ schedule sleeps to the exact WIB hour, daily and weekly, from any start");
