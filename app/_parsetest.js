// Quick single-item (or multi-line) parser check.
// Run:
//   node app/_parsetest.js "gdn (chakram)"
//   node app/_parsetest.js "thorns l junk | gdn fragment x5"
//   node app/_parsetest.js "gdn (armor)"   "ddn unique accessory ring hybrid"

const { parseItemLines } = require("./utils/parseItems");
const { CATALOG } = require("./items");

const input = process.argv.slice(2).join("\n");
if (!input.trim()) {
  console.log('Usage: node app/_parsetest.js "<item line>" ["<another line>" ...]');
  process.exit(1);
}

const { added, golds, unresolved, errors } = parseItemLines(input);

console.log(`\nInput:\n${input}\n`);

if (added.length) {
  console.log("✅ Added:");
  for (const a of added) {
    const def = CATALOG[a.itemKey];
    const d = a.detail ? ` (${a.detail})` : "";
    console.log(`   • ${def.name}${d} ×${a.qty} — ${def.stampsPerUnit} stamp/unit  [${a.itemKey}]`);
  }
}

if (golds.length) {
  console.log("💰 Gold:");
  for (const g of golds) {
    console.log(`   • ${g.amount.toLocaleString()} ÷${g.splitCount} = ${Math.floor(g.amount / g.splitCount).toLocaleString()}/person`);
  }
}

if (unresolved.length) {
  console.log("❓ Needs a choice:");
  for (const u of unresolved) {
    console.log(`   "${u.raw}" (qty ${u.qty}):`);
    u.candidates.forEach((c, i) => {
      const meta = [c.class, c.part].filter(Boolean).join(", ");
      console.log(`      ${i + 1}) ${c.name}${meta ? ` (${meta})` : ""}  [${c.key}]`);
    });
  }
}

if (errors.length) {
  console.log("⚠️  Not matched:");
  for (const e of errors) console.log(`   • ${e}`);
}

if (!added.length && !golds.length && !unresolved.length && !errors.length) console.log("(nothing parsed)");
