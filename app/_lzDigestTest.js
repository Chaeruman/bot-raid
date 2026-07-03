// Run: node app/_lzDigestTest.js — checks the daily 08:00 WIB window detection.
const assert = require("assert");
const { isLzWindow } = require("./lzDigest");

// 08:00 WIB = 01:00 UTC, any day.
assert.strictEqual(isLzWindow(Date.UTC(2026, 6, 6, 1, 0)), true);
assert.strictEqual(isLzWindow(Date.UTC(2026, 6, 7, 1, 0)), true); // works every day, not just Saturday
assert.strictEqual(isLzWindow(Date.UTC(2026, 6, 6, 2, 0)), false); // wrong hour

console.log("✅ lzDigest window detection OK");
