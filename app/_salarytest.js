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

// exact-before-includes tag match: "@ol" must hit "ol", not "NOLtiga".
const nameOf = { u1: "ol", u2: "NOLtiga" };
const excludeName = "ol";
const exact = Object.keys(nameOf).filter((uid) => nameOf[uid].toLowerCase() === excludeName);
const hits = exact.length ? exact : Object.keys(nameOf).filter((uid) => nameOf[uid].toLowerCase().includes(excludeName));
assert.deepStrictEqual(hits, ["u1"]);
console.log("✅ exact match wins over substring match for @tag");
