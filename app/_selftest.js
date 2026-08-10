// Standalone parser self-test — run:  node app/_selftest.js
// No Discord/network needed; just exercises items.js + utils/parseItems.js.

const { NAMED_EQUIPMENT, CATALOG, CLASSES } = require("./items");
const { parseItemLines, formatParseError, repairToken } = require("./utils/parseItems");

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
  ["ddn research book", "ddn_research_book"],
  ["ddn res x3", "ddn_research_book", 3],
  ["research book", "ddn_research_book"],
  ["res", "ddn_research_book"],
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
  // A newly added class has to reach the STRUCTURAL vocabulary too, not just the
  // named list — otherwise "gdn armor assassin head" dies while "gdn mask" works.
  ["gdn armor assassin head", "gdn_armor", 1, "Assassin@Head"],
  ["ddn weapon assassin main", "ddn_weapon", 1, "Assassin@Main"],
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
// Named fragments (Spitflower Ignis etc.) have no dungeon — the line is just
// the name itself, not prefixed with the literal string "null".
for (const e of NAMED_EQUIPMENT) {
  const kw = e.name.replace(/^(ddn|gdn|sdn)\s+/i, "");
  const line = e.dungeon ? `${e.dungeon} ${kw}` : kw; // same as bracket form, but without ()
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

// 4e) Typo repair. A misspelt keyword was the commonest way a line died, and
//     every case below has exactly one word it could have been.
for (const [line, key] of [
  ["gdn fragmen x2", "gdn_fragment"],
  ["ddn smelte rune", "ddn_smelted_rune"],
  ["gdn acessory hc ring atk", "gdn_l_accessory"],
  ["gdn armour warrior head", "gdn_armor"],
  ["thorns uniqu", "thorns_u"],
]) {
  const { added } = parseItemLines(line);
  check(`typo: ${line}`, added[0] && added[0].itemKey === key, JSON.stringify(added));
}

// The repair rules themselves, where the dangerous cases live.
check("typo: a clear miss is repaired", repairToken("fragmen") === "fragment", repairToken("fragmen"));
check("typo: a real word is left exactly alone", repairToken("storm") === "storm");
// A tie is not an answer. "atx" is one edit from atk AND atp, and picking one
// writes the wrong accessory onto a sale.
check("typo: an equidistant token is not guessed at", repairToken("atx") === "atx", repairToken("atx"));
// Two characters is where every word is one edit from another — `l` and `u` are
// opposite tiers — so nothing that short is ever touched.
check("typo: short tokens are left alone", repairToken("lu") === "lu" && repairToken("uu") === "uu");
// A token that appears inside a real item's name is a NAME keyword, not a typo.
// Defensive: it costs nothing today and stops a future named item from being
// dragged into the structural vocabulary by a one-letter coincidence.
check("typo: name keywords are never 'repaired'", repairToken("chakram") === "chakram");

// 4f) One token short of certain → a shortlist to pick from, not a dead line.
//     Each of these used to fall out as "couldn't match" over a single word.
for (const [line, keys, detail] of [
  ["gdn ring atk", ["gdn_l_accessory", "gdn_u_accessory"], "Ring@Attack"],
  ["squad neck int vit", ["ddn_u_accessory", "gdn_u_accessory", "sdn_u_accessory"], "Necklace@INT VIT"],
  ["thorns", ["thorns_l", "thorns_u"], null],
  ["fragment", ["ddn_fragment", "gdn_fragment"], null],
  ["armor warrior head", ["ddn_armor", "gdn_armor"], "Warrior@Head"],
  // A dungeon that has no such item is the same question, not a dead end.
  ["sdn armor", ["ddn_armor", "gdn_armor"], null],
]) {
  const { unresolved } = parseItemLines(line);
  const got = unresolved[0]?.candidates || [];
  check(
    `shortlist: ${line}`,
    got.length === keys.length &&
      keys.every((k) => got.some((c) => c.key === k)) &&
      got.every((c) => (c.detail || null) === detail),
    JSON.stringify(unresolved),
  );
}

// The picker has to ASK something. A bare pair of accessories does not say that
// the tier is what is missing.
{
  const { unresolved } = parseItemLines("gdn ring atk");
  check("shortlist: carries the question it is asking",
    (unresolved[0]?.reason || "").includes("tier"), JSON.stringify(unresolved));
}
// The chosen option keeps the detail, or the picker answered a narrower question
// than the one it asked.
{
  const { unresolved } = parseItemLines("gdn ring atk");
  check("shortlist: options are named in full",
    unresolved[0].candidates.every((c) => c.name.includes("Ring Attack")),
    JSON.stringify(unresolved[0].candidates.map((c) => c.name)));
}

// A named item that actually exists beats any shortlist assembled from a
// category word — "storm master zuu" is a fragment, not an under-specified rune.
{
  const { added, unresolved } = parseItemLines("storm master zuu");
  check("shortlist never outranks a real named item",
    added.length === 1 && CATALOG[added[0].itemKey].name === "Storm Master Zuu" && !unresolved.length,
    JSON.stringify({ added, unresolved }));
}

// 4g) A line that fails says WHY. A bare echo of the input taught the seller
//     nothing and cost them another round trip through the modal.
for (const [line, needle] of [
  ["sdn rune", "SDN smelted rune"],
  ["sdn research book", "SDN research book"],
  ["completelybogus", "not a known item"],
  ["#just a note", "no item"],
]) {
  const { errors } = parseItemLines(line);
  check(`reason: ${line}`, errors.some((e) => e.reason.includes(needle)), JSON.stringify(errors));
}
// The raw line is kept as its own field, not baked into a sentence: the failure
// log keys on it, and digging it back out of formatted text would be a parser
// for the parser's own error messages.
{
  const { errors } = parseItemLines("completelybogus");
  check("reason: the failing line is kept verbatim", errors[0].raw === "completelybogus", JSON.stringify(errors[0]));
  check("reason: and formats to one sentence",
    formatParseError(errors[0]).startsWith("`completelybogus` — "), formatParseError(errors[0]));
}

// 5) Duplicate-name safety: no two named items share a name.
const seen = new Map();
for (const e of NAMED_EQUIPMENT) {
  const n = e.name.toLowerCase();
  if (seen.has(n)) fails.push(`DUPLICATE NAME: "${e.name}" (${seen.get(n)} & ${e.key})`);
  else seen.set(n, e.key);
}

// 5b) Every named item's class has to be a class the bot knows. A typo in that
//     field is silent: the item still resolves, but its class shows in a
//     suggestion list that the equipment picker can never produce, and adding a
//     class to namedEquipment.js without adding it to CLASSES is the same bug.
const classless = NAMED_EQUIPMENT.filter((e) => e.class && !CLASSES.includes(e.class));
check("every named item's class is in CLASSES", classless.length === 0,
  classless.map((e) => `${e.name}: "${e.class}"`).join(", "));

// Same for the part, against whichever list its kind uses.
const NAMED_PARTS = { armor: ["Helmet", "Armor", "Pants", "Gloves", "Boots"], weapon: ["Main", "Second"] };
const partless = NAMED_EQUIPMENT.filter((e) => e.part && !NAMED_PARTS[e.kind]?.includes(e.part));
check("every named item's part fits its kind", partless.length === 0,
  partless.map((e) => `${e.name}: "${e.part}" (${e.kind})`).join(", "));

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
