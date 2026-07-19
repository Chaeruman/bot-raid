// Run: node app/_buttonsTest.js — checks role buttons hide (not just disable)
// while a raid party is locked, and reappear once unlocked.
const assert = require("assert");
const { createButtons } = require("./builders/buttons");

const event = {
  hostId: "host1",
  locked: false,
  maxSlot: 8,
  roles: {
    MT: { max: 1, users: [], label: "MT" },
    DPS: { max: 4, users: [], label: "DPS" },
  },
  users: {},
};

function labels(rows) {
  return rows.flatMap((r) => r.components.map((c) => c.data.label));
}

// Unlocked: role buttons present.
let l = labels(createButtons(event, "host1"));
assert.ok(l.includes("MT") && l.some((x) => x.startsWith("DPS")));

// Locked: role buttons gone entirely, control rows still there.
event.locked = true;
l = labels(createButtons(event, "host1"));
assert.ok(!l.includes("MT") && !l.some((x) => x.startsWith("DPS")));
assert.ok(l.some((x) => x.includes("Unlock Party")));

// Unlocked again: role buttons come back.
event.locked = false;
l = labels(createButtons(event, "host1"));
assert.ok(l.includes("MT"));

// Party full (8/8) even though unlocked: role buttons hide too.
event.users = Object.fromEntries(Array.from({ length: 8 }, (_, i) => [`u${i}`, {}]));
l = labels(createButtons(event, "host1"));
assert.ok(!l.includes("MT") && !l.some((x) => x.startsWith("DPS")));
assert.ok(l.some((x) => x.includes("Lock Party"))); // control rows unaffected

// Drops below full again: role buttons come back.
delete event.users.u0;
l = labels(createButtons(event, "host1"));
assert.ok(l.includes("MT"));

console.log("✅ raid role buttons hide-while-locked-or-full OK");
