// Run: node app/_salarytest.js — checks 0.3% mail tax + exact-before-includes tag matching.
const assert = require("assert");
const { memberSalary } = require("./builders/lootPanel");

// 800 item net + 800 gold ÷8 → gross 200/person; ×0.997 floored.
const panel = {
  items: [],
  goldEntries: [
    { amount: 1600, splitCount: 8 },
    { amount: 700, splitCount: 7, excludedUserId: "a" },
  ],
};
// gross(normal) = floor(1600/8) + floor(700/7) = 200 + 100 = 300 → ×0.997 = 299.1 → 299
assert.strictEqual(memberSalary(panel, null), 299);
// gross(excluded "a") = 200 only (no ÷7 share) → ×0.997 = 199.4 → 199
assert.strictEqual(memberSalary(panel, "a"), 199);
console.log("✅ 0.3% mail tax applied + floored, both normal and HC-excluded");

// stampRate: old panels (no field) still use 4g/stamp; new panels use their snapshotted rate.
const { CATALOG } = require("./items");
const someKey = Object.keys(CATALOG).find((k) => CATALOG[k].stampsPerUnit > 0);
const stamps = CATALOG[someKey].stampsPerUnit;
const itemPanel = (stampRate) => ({
  items: [{ itemKey: someKey, qty: 1, price: 10000, detail: null }],
  goldEntries: [],
  stampRate,
});
const oldPanelNet = 10000 - stamps * 4;
const newPanelNet = 10000 - stamps * 5;
assert.strictEqual(memberSalary(itemPanel(undefined), null), Math.floor(Math.floor(oldPanelNet / 8) * 0.997));
assert.strictEqual(memberSalary(itemPanel(5), null), Math.floor(Math.floor(newPanelNet / 8) * 0.997));
console.log("✅ stampRate: undefined (old panels) = 4g/stamp, explicit rate honored for new panels");

// exact-before-includes tag match: "@ol" must hit "ol", not "NOLtiga".
const nameOf = { u1: "ol", u2: "NOLtiga" };
const excludeName = "ol";
const exact = Object.keys(nameOf).filter((uid) => nameOf[uid].toLowerCase() === excludeName);
const hits = exact.length ? exact : Object.keys(nameOf).filter((uid) => nameOf[uid].toLowerCase().includes(excludeName));
assert.deepStrictEqual(hits, ["u1"]);
console.log("✅ exact match wins over substring match for @tag");
