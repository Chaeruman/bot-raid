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

// No-bracket keyword fallback (mobile-friendly — no () needed). Tried AFTER structural.
// Every keyword token must appear in the item name. Returns same shape as matchNamed.
function matchNamedFuzzy(raw) {
  if (/\([^)]*\)/.test(raw)) return null;

  let tokens = raw.toLowerCase().split(/\s+/).filter(Boolean);
  let qty = 1;
  tokens = tokens.filter((t) => {
    const m = t.match(/^x?(\d+)x?$/);
    if (m) { qty = parseInt(m[1], 10); return false; }
    return true;
  });
  if (qty <= 0) qty = 1;

  const dungeon = ["ddn", "gdn", "sdn"].find((d) => tokens.includes(d));
  const kindWords = ["weapon", "wep", "armor", "arm"];
  const kind = tokens.includes("weapon") || tokens.includes("wep") ? "weapon"
    : tokens.includes("armor") || tokens.includes("arm") ? "armor" : null;

  let pool = NAMED_EQUIPMENT;
  if (dungeon) pool = pool.filter((e) => e.dungeon === dungeon);
  if (kind) pool = pool.filter((e) => e.kind === kind);

  const kwTokens = tokens.filter((t) => t !== dungeon && !kindWords.includes(t));
  if (!kwTokens.length) return null;

  const hits = pool.filter((e) => {
    const n = e.name.toLowerCase();
    return kwTokens.every((t) => n.includes(t));
  });
  if (hits.length === 1) return { itemKey: hits[0].key, qty };
  if (hits.length > 10) return { error: `"${kwTokens.join(" ")}" matches too many — be more specific` };
  if (hits.length > 1) return { qty, candidates: hits };
  return null;
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

  // Accessory: triggered by "accessory"/"acc" OR a type word (ring/necklace/earrings).
  // Tier from legend/unique or short l/u. e.g. "gdn u ring magic" → gdn_u_accessory Ring@Magic
  const accType = Object.keys(ACCESSORY_TYPES).find((t) => has(t.toLowerCase()));
  if (has("accessory") || has("acc") || accType) {
    const tier = has("legend") || has("l") ? "l" : has("unique") || has("u") ? "u" : null;
    if (!dungeon || !tier) return null;
    const key = `${dungeon}_${tier}_accessory`;
    if (!CATALOG[key]) return null;

    let detail = null;
    if (accType) {
      const sub = ACCESSORY_TYPES[accType].find((s) =>
        s.toLowerCase().split(/\s+/).every((w) => tokens.includes(w)),
      );
      detail = sub ? `${accType}@${sub}` : accType;
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

// Gold line: "gold 294/7", "258/8", "gold 1,000,000/8" → { amount, splitCount }.
// split must be 7 or 8 (HC ÷7 / normal ÷8). No exclusion via text (use the button for that).
function parseGoldLine(raw) {
  const m = raw.toLowerCase().replace(/,/g, "").match(/^(?:gold\s+)?(\d+)\s*\/\s*(7|8)$/);
  if (!m) return null;
  const amount = parseInt(m[1], 10);
  if (amount <= 0) return null;
  return { amount, splitCount: parseInt(m[2], 10), excludedUserId: null };
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
  const golds = [];
  const unresolved = [];
  const errors = [];

  for (const raw of text.split(/[\n|]+/).map((s) => s.trim()).filter(Boolean)) {
    const gold = parseGoldLine(raw);
    if (gold) {
      golds.push(gold);
      continue;
    }
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
    // Structural (fragments, accessories, equipment, thorns/etc.)
    const s = parseStructural(raw);
    if (s) {
      added.push(s);
      continue;
    }

    // Last resort: no-bracket keyword search of named equipment
    const fuzzy = matchNamedFuzzy(raw);
    if (fuzzy && fuzzy.itemKey) {
      added.push({ itemKey: fuzzy.itemKey, qty: fuzzy.qty, detail: null });
      continue;
    }
    if (fuzzy && fuzzy.candidates) {
      unresolved.push({ raw, qty: fuzzy.qty, candidates: fuzzy.candidates });
      continue;
    }
    if (fuzzy && fuzzy.error) {
      errors.push(`${raw} — ${fuzzy.error}`);
      continue;
    }

    errors.push(raw);
  }

  return { added, golds, unresolved, errors };
}

module.exports = { parseItemLines };
