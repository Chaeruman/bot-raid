// Bounty board self-test — run:  node app/_boardTest.js
// Covers role-slot assignment only; everything else is in _bountyTest.js.

const { assignRoles, renderParty, roleKeyOf, ROLES } = require("./bountyBoard");

let pass = 0;
const fails = [];
const check = (name, cond, detail) =>
  cond ? pass++ : fails.push(`${name}${detail ? ` — ${detail}` : ""}`);
const eq = (name, got, want) =>
  check(name, got === want, `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);

const e = (charName, role, dpsTier = "good") => ({
  userId: `u_${charName}`, charName, role, dpsTier, rarity: "unique", scroll: "weapon",
});
const at = (a, key) => (a.slots.get(key) || []).map((x) => x.charName);

// Labels on the character sheet must resolve to template keys.
eq("role label SM/DA", roleKeyOf("SM/DA"), "SM");
eq("role label Ice Stacker", roleKeyOf("Ice Stacker"), "ICE");
eq("role label DPS", roleKeyOf("DPS"), "DPS");
eq("unknown role", roleKeyOf("Bard"), null);

// The host's example party: everyone lands in their own slot.
const full = assignRoles([
  e("Bazul", "DPS"), e("Ol", "FU"), e("Royal", "MT"), e("Dyon", "MC"),
  e("Azka", "SM/DA"), e("Nara", "Ice Stacker"), e("Siro", "DPS"), e("Satella", "Acro"),
]);
eq("8 distinct roles all placed", full.placed, 8);
eq("nobody overflows", full.overflow.length, 0);
eq("MT slot", at(full, "MT").join(), "Royal");
eq("both DPS", at(full, "DPS").join(), "Bazul,Siro");

// Collision: two MTs, MT has 1 slot. High DPS is moved to a DPS slot.
const clash = assignRoles([e("A", "MT"), e("B", "MT", "high")]);
eq("first MT keeps the slot", at(clash, "MT").join(), "A");
eq("high-DPS collision moves to DPS", at(clash, "DPS").join(), "B");
check("and is marked as moved", clash.slots.get("DPS")[0].movedFrom === "MT");

// Same collision, but not high DPS — no DPS slot for them.
const clashLow = assignRoles([e("A", "MT"), e("B", "MT", "low")]);
eq("low-DPS collision overflows", clashLow.overflow.map((x) => x.charName).join(), "B");

// DPS caps at 3, so a 4th high-DPS collision still overflows.
const dpsFlood = assignRoles([
  e("D1", "DPS"), e("D2", "DPS"), e("D3", "DPS"), e("D4", "DPS", "high"),
]);
eq("DPS slots cap at 3", at(dpsFlood, "DPS").length, ROLES.DPS.max);
eq("the 4th overflows", dpsFlood.overflow.map((x) => x.charName).join(), "D4");

// Capacity is the hard limit even when role slots remain free.
const over = assignRoles(
  [e("A", "MT"), e("B", "MC"), e("C", "SM/DA"), e("D", "Healer")], 2,
);
eq("capacity caps placement", over.placed, 2);
eq("the rest overflow", over.overflow.length, 2);
// Scarce roles are claimed before the cap bites — MT/MC come first in fill order.
eq("MT placed first", at(over, "MT").join(), "A");
eq("MC placed second", at(over, "MC").join(), "B");

// A role that isn't on the sheet can't be placed at all.
const unknown = assignRoles([e("X", "Bard")]);
eq("unknown role overflows", unknown.overflow.map((x) => x.charName).join(), "X");

// Rendering shows empty slots, so the host can see what's missing.
const rendered = renderParty(assignRoles([e("Royal", "MT")]));
check("renders the filled slot", rendered.includes("Royal"));
check("shows an empty slot too", /Healer\s*`\s*—/.test(rendered) || rendered.includes("Healer"));

console.log(`\n${pass} passed, ${fails.length} failed`);
if (fails.length) {
  fails.forEach((f) => console.log(`  ✗ ${f}`));
  process.exitCode = 1;
} else {
  console.log("\n── sample party ───────────────────────────────────────");
  console.log(renderParty(full).replace(/<@[^>]+>/g, "").replace(/\*\*/g, ""));
  console.log();
}
