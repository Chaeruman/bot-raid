const {
  CATALOG,
  CLASSES,
  ARMOR_PARTS,
  WEAPON_TYPES,
  ACCESSORY_TYPES,
  NAMED_EQUIPMENT,
} = require("../items");

const FAMILIES = [
  { key: "thorns", words: ["thorns"] },
  { key: "storm", words: ["storm", "triangular"] },
  { key: "forest", words: ["forest"] },
  { key: "hot_sand", words: ["hot", "sand", "circular"] },
];

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
    }
  }
  return d[m][n];
}

// Up to 5 closest items in pool to the keyword (by min edit distance vs name/words).
function closest(pool, kw) {
  return pool
    .map((e) => {
      const name = e.name.toLowerCase();
      const score = Math.min(levenshtein(kw, name), ...name.split(/\s+/).map((w) => levenshtein(kw, w)));
      return { e, score };
    })
    .sort((a, b) => a.score - b.score)
    .slice(0, 5)
    .map((x) => x.e);
}

// Named-equipment match. dungeon/kind narrow the pool, a (keyword) finds by substring.
// Returns:
//   { itemKey, qty }                  single clear match
//   { qty, candidates: [...] }        ambiguous OR fuzzy suggestions (needs a choice)
//   { error }                         bracket keyword with nothing close
//   null                              no named intent → fall through to structural
function matchNamed(raw) {
  const bracket = raw.match(/\(([^)]+)\)/);

  let tokens = raw.replace(/\([^)]*\)/g, " ").toLowerCase().split(/\s+/).filter(Boolean);
  let qty = 1;
  tokens = tokens.filter((t) => {
    const m = t.match(/^x?(\d+)x?$/);
    if (m) { qty = parseInt(m[1], 10); return false; }
    return true;
  });
  if (qty <= 0) qty = 1;

  const has = (w) => tokens.includes(w);
  const dungeon = ["ddn", "gdn", "sdn"].find((d) => has(d));
  const kind = has("weapon") || has("wep") ? "weapon" : has("armor") || has("arm") ? "armor" : null;

  let pool = NAMED_EQUIPMENT;
  if (dungeon) pool = pool.filter((e) => e.dungeon === dungeon);
  if (kind) pool = pool.filter((e) => e.kind === kind);

  if (bracket) {
    const kw = bracket[1].toLowerCase().trim().replace(/\s+/g, " ");
    const hits = pool.filter((e) => e.name.toLowerCase().includes(kw));
    if (hits.length === 1) return { itemKey: hits[0].key, qty };
    if (hits.length > 1) return { qty, candidates: hits };

    const suggestPool = pool.length ? pool : NAMED_EQUIPMENT;
    const sugg = closest(suggestPool, kw);
    return sugg.length ? { qty, candidates: sugg } : { error: `no named item found for "(${kw})"` };
  }

  // No bracket → exact full-name match only (else fall through to structural).
  const nameGuess = tokens.join(" ");
  const exact = pool.find((e) => e.name.toLowerCase() === nameGuess);
  return exact ? { itemKey: exact.key, qty } : null;
}

// Structural catalog match (fragments, accessories, equipment, thorns/etc.).
// Returns { itemKey, qty, detail } or null.
function parseStructural(raw) {
  let tokens = raw.toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return null;

  let qty = 1;
  tokens = tokens.filter((t) => {
    const m = t.match(/^x?(\d+)x?$/);
    if (m) { qty = parseInt(m[1], 10); return false; }
    return true;
  });
  if (qty <= 0) qty = 1;

  const has = (w) => tokens.includes(w);
  const dungeon = ["ddn", "gdn", "sdn"].find((d) => has(d));

  if (has("fragment") || has("frag")) {
    const key = `${dungeon}_fragment`;
    return CATALOG[key] ? { itemKey: key, qty, detail: null } : null;
  }

  if (has("accessory") || has("acc")) {
    const tier = has("legend") ? "l" : has("unique") ? "u" : null;
    if (!dungeon || !tier) return null;
    const key = `${dungeon}_${tier}_accessory`;
    if (!CATALOG[key]) return null;

    const type = Object.keys(ACCESSORY_TYPES).find((t) => has(t.toLowerCase()));
    let detail = null;
    if (type) {
      const sub = ACCESSORY_TYPES[type].find((s) =>
        s.toLowerCase().split(/\s+/).every((w) => tokens.includes(w)),
      );
      detail = sub ? `${type}@${sub}` : type;
    }
    return { itemKey: key, qty, detail };
  }

  if (has("armor") || has("weapon")) {
    const kind = has("armor") ? "armor" : "weapon";
    const key = `${dungeon}_${kind}`;
    if (!CATALOG[key]) return null;

    const cls = CLASSES.find((c) => has(c.toLowerCase()));
    const partList = kind === "armor" ? ARMOR_PARTS : WEAPON_TYPES;
    const part = partList.find((p) => has(p.toLowerCase()));
    let detail = null;
    if (cls && part) detail = `${cls}@${part}`;
    else if (cls) detail = cls;
    else if (part) detail = part;
    return { itemKey: key, qty, detail };
  }

  const fam = FAMILIES.find((f) => f.words.some((w) => has(w)));
  if (fam) {
    const lu = has("u") || has("upper") ? "u" : has("l") || has("lower") ? "l" : null;
    const jg = has("junk") ? "junk" : has("good") || has("perfect") ? "good" : null;
    if (!lu || !jg) return null;
    const key = `${fam.key}_${lu}_${jg}`;
    return CATALOG[key] ? { itemKey: key, qty, detail: null } : null;
  }

  return null;
}

// A bare "ddn armor" / "gdn armor" (just dungeon + kind, nothing else) is ambiguous:
// it collides with the Cleric "Armor" named piece and the generic item. Ask to clarify.
function bareArmorClarify(raw) {
  if (/\([^)]*\)/.test(raw)) return null;
  const tokens = raw.toLowerCase().split(/\s+/).filter(Boolean).filter((t) => !/^x?\d+x?$/.test(t));
  if (tokens.length !== 2) return null;
  const dungeon = tokens.find((t) => t === "ddn" || t === "gdn");
  const isArmor = tokens.includes("armor") || tokens.includes("arm");
  if (!dungeon || !isArmor) return null;
  return {
    error: `ambiguous — use a keyword: \`${dungeon} (armor)\` for the Cleric chest, or \`${dungeon} (keyword)\` for another piece (e.g. \`${dungeon} (helmet)\`, \`${dungeon} (one piece)\`)`,
  };
}

// Split on newlines and pipes; classify each line.
// Returns { added: [{itemKey,qty,detail}], unresolved: [{raw,qty,candidates}], errors: [string] }.
function parseItemLines(text) {
  const added = [];
  const unresolved = [];
  const errors = [];

  for (const raw of text.split(/[\n|]+/).map((s) => s.trim()).filter(Boolean)) {
    const bare = bareArmorClarify(raw);
    if (bare) {
      errors.push(`${raw} — ${bare.error}`);
      continue;
    }
    const named = matchNamed(raw);
    if (named && named.itemKey) {
      added.push({ itemKey: named.itemKey, qty: named.qty, detail: null });
      continue;
    }
    if (named && named.candidates) {
      unresolved.push({ raw, qty: named.qty, candidates: named.candidates });
      continue;
    }
    if (named && named.error) {
      errors.push(`${raw} — ${named.error}`);
      continue;
    }
    // No named intent → structural
    const s = parseStructural(raw);
    if (s) added.push(s);
    else errors.push(raw);
  }

  return { added, unresolved, errors };
}

module.exports = { parseItemLines };
