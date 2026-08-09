// Run: node app/_lzDigestTest.js — checks the daily 00:00 WIB window detection.
//
// This asserted 08:00 for as long as the digest fired at 00:00. Whoever moved
// the hour updated the constant, its comment and the boot log and missed here,
// so the suite failed on every run and stopped being read — which is worse than
// having no test, because a red suite hides the next real break.
const assert = require("assert");
const { isLzWindow } = require("./lzDigest");

// 00:00 WIB is 17:00 UTC the day before. Written as explicit UTC rather than
// derived from TARGET_HOUR: a test that computes the offset the same way the
// code does would agree with it however wrong both were.
assert.strictEqual(isLzWindow(Date.UTC(2026, 6, 5, 17, 0)), true);
assert.strictEqual(isLzWindow(Date.UTC(2026, 6, 6, 17, 0)), true); // every day, not just Saturday
assert.strictEqual(isLzWindow(Date.UTC(2026, 6, 5, 18, 0)), false); // wrong hour
assert.strictEqual(isLzWindow(Date.UTC(2026, 6, 5, 16, 59)), false); // 23:59 WIB, one minute early

console.log("✅ lzDigest window detection OK");
