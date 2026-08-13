// Run: node app/_lzDigestTest.js — the daily Lucky Zone post fires at 00:00 WIB.
//
// The arithmetic lives in utils/schedule and is checked by _scheduleTest. What
// this guards is the target itself: this file once asserted 08:00 while the
// post went out at 00:00, so the suite was red for months and stopped being
// read — worse than no test, because a red suite hides the next real break.
const assert = require("assert");
const { TARGET_HOUR } = require("./lzDigest");
const { msUntilWib } = require("./utils/schedule");

assert.strictEqual(TARGET_HOUR, 0, "the Lucky Zone post is a midnight post");

// Every day, not just one — 2026-07-05 is a Sunday, 07-06 a Monday.
const MIN = 60 * 1000;
for (const day of [5, 6, 7]) {
  // 16:59 UTC is 23:59 WIB; one minute later is the target.
  assert.strictEqual(msUntilWib(TARGET_HOUR, null, Date.UTC(2026, 6, day, 16, 59)), MIN);
}

console.log("✅ lzDigest targets 00:00 WIB, every day");
