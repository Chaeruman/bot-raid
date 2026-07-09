// Standalone parser self-test — run:  node app/_selftest.js
// No Discord/network needed; just exercises items.js + utils/parseItems.js.

const { NAMED_EQUIPMENT, CATALOG } = require("./items");
const { parseItemLines } = require("./utils/parseItems");

let pass = 0;
const fails = [];
function check(name, cond, detail) {
  if (cond) pass++;
  else fails.push(`${name}${detail ? ` — ${detail}` : ""}`);
}

// 1) Every named item is reachable+unique via `<dungeon> (<name minus prefix>)`.
for (const e of NAMED_EQUIPMENT) {
  const kw = e.name.replace(/^(ddn|gdn|sdn)\s+/i, "");
  const line = `${e.dungeon} (${kw})`;
  const { added, unresolved, errors } = parseItemLines(line);
  if (added.length === 1 && added[0].itemKey === e.key) check(line, true);
  else if (unresolved.length === 1 && unresolved[0].candidates.some((c) => c.key === e.key))
    check(line, true);
  else check(line, false, `added=${JSON.stringify(added.map((a) => a.itemKey))} err=${JSON.stringify(errors)}`);
}

// 2) Structural categories.
const structural = [
  ["thorns l", "thorns_l"],
  ["thorns u", "thorns_u"],
  ["thorns legend", "thorns_l"],
  ["thorn destroy legend", "thorns_l"],
  ["thorns unique", "thorns_u"],
  ["storm u", "storm_u"],
  ["storm triangular l", "storm_l"],
  ["forest l", "forest_l"],
  ["forest guardian u", "forest_u"],
  ["hot sand l", "hot_sand_l"],
  ["hot sand circular u", "hot_sand_u"],
  ["gdn fragment x5", "gdn_fragment", 5],
  ["ddn fragment", "ddn_fragment"],
  ["ddn smelted rune", "ddn_smelted_rune"],
  ["ddn smelted x3", "ddn_smelted_rune", 3],
  ["smelted rune", "ddn_smelted_rune"],
  ["rune x2", "ddn_smelted_rune", 2],
  ["ddn unique accessory ring hybrid", "ddn_u_accessory", 1, "Ring@Hybrid"],
  ["gdn legend accessory necklace str agi", "gdn_l_accessory", 1, "Necklace@STR AGI"],
  ["gdn u ring magic", "gdn_u_accessory", 1, "Ring@Magic"],
  ["ddn l necklace str agi", "ddn_l_accessory", 1, "Necklace@STR AGI"],
  ["gdn ring u atk", "gdn_u_accessory", 1, "Ring@Attack"],
  ["gdn ring u atp", "gdn_u_accessory", 1, "Ring@Attack"],
  ["gdn ring l mtp", "gdn_l_accessory", 1, "Ring@Magic"],
  ["gdn ring u hyb", "gdn_u_accessory", 1, "Ring@Hybrid"],
  ["gdn neck u int vit", "gdn_u_accessory", 1, "Necklace@INT VIT"],
  ["ddn ear l agi int", "ddn_l_accessory", 1, "Earrings@AGI INT"],
  ["gdn squad ring atk", "gdn_u_accessory", 1, "Ring@Attack"],
  ["gdn hunter ring atk", "gdn_l_accessory", 1, "Ring@Attack"],
  ["gdn hc neck int vit", "gdn_l_accessory", 1, "Necklace@INT VIT"],
  ["ddn squad ear agi int", "ddn_u_accessory", 1, "Earrings@AGI INT"],
  ["gdn armor warrior head", "gdn_armor"],
  ["ddn weapon kali main", "ddn_weapon"],
];
for (const [line, key, qty, detail] of structural) {
  const { added } = parseItemLines(line);
  const a = added[0];
  check(
    `structural: ${line}`,
    a && a.itemKey === key && (qty === undefined || a.qty === qty) && (detail === undefined || a.detail === detail),
    a ? JSON.stringify(a) : "no add",
  );
}

// 3) Bare "gdn armor" / "ddn armor" → adds the Cleric "Armor" named piece directly.
for (const [line, key] of [["gdn armor", "eq_gdn_armor"], ["ddn armor", "eq_ddn_armor"]]) {
  const { added } = parseItemLines(line);
  check(`bare armor: ${line}`, added.length === 1 && added[0].itemKey === key, JSON.stringify(added));
}

// 4) Quantity parsing.
for (const [line, q] of [["gdn fragment x3", 3], ["gdn fragment 7", 7]]) {
  const { added } = parseItemLines(line);
  check(`qty: ${line}`, added[0] && added[0].qty === q, added[0] ? added[0].qty : "no add");
}

// 4b) No-bracket keyword fallback reaches the named item (mobile-friendly).
for (const e of NAMED_EQUIPMENT) {
  const kw = e.name.replace(/^(ddn|gdn|sdn)\s+/i, "");
  const line = `${e.dungeon} ${kw}`; // same as bracket form, but without ()
  const { added, unresolved } = parseItemLines(line);
  const ok =
    (added.length === 1 && added[0].itemKey === e.key) ||
    (unresolved.length === 1 && unresolved[0].candidates.some((c) => c.key === e.key)) ||
    /^(ddn|gdn) armor$/i.test(line); // bare-armor is intentionally guarded
  check(`no-bracket: ${line}`, ok);
}

// 4c) Rune resolves directly now that junk/good is gone (no numbered choice).
{
  const { added, unresolved } = parseItemLines("thorn destroy legend");
  check(
    "rune direct: thorn destroy legend",
    added.length === 1 && added[0].itemKey === "thorns_l" && unresolved.length === 0,
    JSON.stringify({ added, unresolved }),
  );
}

// 4d) Inline #note attaches to the item.
{
  const { added } = parseItemLines("gdn fragment x2 #for budi");
  check(
    "note: gdn fragment x2 #for budi",
    added[0] && added[0].note === "for budi" && added[0].qty === 2 && added[0].itemKey === "gdn_fragment",
    JSON.stringify(added),
  );
}

// 5) Duplicate-name safety: no two named items share a name.
const seen = new Map();
for (const e of NAMED_EQUIPMENT) {
  const n = e.name.toLowerCase();
  if (seen.has(n)) fails.push(`DUPLICATE NAME: "${e.name}" (${seen.get(n)} & ${e.key})`);
  else seen.set(n, e.key);
}

console.log(`\nNamed items loaded: ${NAMED_EQUIPMENT.length}`);
console.log(`Catalog size: ${Object.keys(CATALOG).length}`);
console.log(`\n✅ PASS: ${pass}`);
if (fails.length) {
  console.log(`❌ FAIL: ${fails.length}`);
  for (const f of fails) console.log(`   • ${f}`);
  process.exit(1);
} else {
  console.log("🎉 All checks passed.");
}
