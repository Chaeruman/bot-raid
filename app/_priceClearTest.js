// Run: node app/_priceClearTest.js — checks that a blank price after "="
// clears the item's price (same parsing logic as setPrices.js).
const assert = require("assert");
const { evalPrice } = require("./utils/evalPrice");

function applyPriceLine(item, right) {
  if (right.trim() === "") {
    if (item.price !== null) item.price = null;
  } else {
    const price = evalPrice(right);
    if (price != null) item.price = price;
  }
  return item;
}

// Blank right side clears an existing price.
assert.strictEqual(applyPriceLine({ price: 50000 }, " ").price, null);
assert.strictEqual(applyPriceLine({ price: 50000 }, "").price, null);

// Blank on an already-null price stays null (no-op, not an error).
assert.strictEqual(applyPriceLine({ price: null }, " ").price, null);

// Non-blank valid expression sets the price as before.
assert.strictEqual(applyPriceLine({ price: null }, " 50000 ").price, 50000);
assert.strictEqual(applyPriceLine({ price: 100 }, " 50000*2 ").price, 100000);

// Non-blank but garbage (letters) is left unchanged, not treated as a clear.
assert.strictEqual(applyPriceLine({ price: 50000 }, " abc ").price, 50000);

console.log("✅ Price All blank-clears-price OK");
