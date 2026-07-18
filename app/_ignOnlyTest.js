// Run: node app/_ignOnlyTest.js — checks the "IGN - extra" nickname trim
// used in /kirim-gaji's member list (so double-click copies just the IGN).
const assert = require("assert");
const { ignOnly } = require("./handlers/commands/combinedPay");

// "IGN - extra" -> just the IGN, trimmed.
assert.strictEqual(ignOnly("xFerb - Frzzy"), "xFerb");
assert.strictEqual(ignOnly("lSinon - Satella"), "lSinon");
assert.strictEqual(ignOnly("Vahniel  - ONE AND ONLY LORD IMAN"), "Vahniel"); // double space before dash

// No " - " at all (no alias set) -> unchanged, this is a normal case.
assert.strictEqual(ignOnly("ol"), "ol");
assert.strictEqual(ignOnly("pandazq"), "pandazq");

// Dash with nothing before it -> fall back to the full original string
// instead of showing a blank label.
assert.strictEqual(ignOnly(" - Frzzy"), " - Frzzy");

// A real hyphenated name with no surrounding spaces isn't touched (only
// " - " with spaces on both sides counts as the separator).
assert.strictEqual(ignOnly("Anna-Marie"), "Anna-Marie");

console.log("✅ ignOnly nickname trim OK");
