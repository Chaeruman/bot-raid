// Run: node app/_priceRightTest.js — checks the "#note before =, price after"
// line format used by Price All (buildPricePrefill + the modal's line parser).
const assert = require("assert");
const { evalPrice } = require("./utils/evalPrice");

function parseLine(line) {
  const eqIdx = line.lastIndexOf("=");
  if (eqIdx < 0) return null;
  const left = line.slice(0, eqIdx);
  const right = line.slice(eqIdx + 1);
  const hashIdx = left.indexOf("#");
  const note = hashIdx >= 0 ? left.slice(hashIdx + 1).trim() || null : undefined; // undefined = untouched
  return { note, price: evalPrice(right) };
}

// note only, no price.
assert.deepStrictEqual(parseLine(" #ol ="), { note: "ol", price: null });

// note (multi-word) before "=", price after (rightmost).
assert.deepStrictEqual(parseLine(" #matk matk fd int = 139"), { note: "matk matk fd int", price: 139 });

// note only, all-letters — price stays unchanged (null).
assert.deepStrictEqual(parseLine(" #atk agi fd fd crit ="), { note: "atk agi fd fd crit", price: null });

// price only, no note, math expression ok.
assert.deepStrictEqual(parseLine(" = 50000*2"), { note: undefined, price: 100000 });

// nothing at all.
assert.deepStrictEqual(parseLine(" ="), { note: undefined, price: null });

// note present but empty → clears note (hash with nothing after, no price).
assert.deepStrictEqual(parseLine(" # ="), { note: null, price: null });

console.log("✅ #note-before-=-price-after line format OK");
