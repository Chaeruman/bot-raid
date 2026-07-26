const {
  CATALOG,
  CLASSES,
  ARMOR_PARTS,
  WEAPON_TYPES,
  ACCESSORY_TYPES,
  NAMED_EQUIPMENT,
} = require("../items");

// Distinct words from each rune's full name (thorns destroy the slab, forest
// guardian the slab, storm triangular rune, hot sand circular rune). "slab" and
// "rune" are shared across two families, so they're intentionally excluded.
const FAMILIES = [
  { key: "thorns", words: ["thorns", "thorn", "destroy"] },
  { key: "storm", words: ["storm", "triangular"] },
  { key: "forest", words: ["forest", "guardian"] },
  { key: "hot_sand", words: ["hot", "sand", "circular"] },
];

// Accessory type words/aliases → canonical type.
const ACC_TYPES = {
  ring: "Ring",
  necklace: "Necklace", neck: "Necklace",
  earrings: "Earrings", earring: "Earrings", ear: "Earrings",
};
// Ring subtype aliases → canonical. (Necklace/Earrings use INT VIT / AGI INT / STR AGI words.)
const RING_SUBS = {
  attack: "Attack", atk: "Attack", atp: "Attack",
  magic: "Magic", matk: "Magic", mtp: "Magic",
  hybrid: "Hybrid", hyb: "Hybrid",
};
// Accessory rarity tier aliases. Legend drops from HC dungeons (hc/hunter); unique = squad.
const ACC_TIER_L = ["legend", "l", "hunter", "hc"];
const ACC_TIER_U = ["unique", "u", "squad"];

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

  if (has("smelted") || has("rune")) {
    // ponytail: only a DDN variant exists right now, so no dungeon typed = DDN.
    // Add a dungeon-required check here once a GDN/SDN smelted rune shows up.
    const key = `${dungeon || "ddn"}_smelted_rune`;
    return CATALOG[key] ? { itemKey: key, qty, detail: null } : null;
  }

  // Accessory: triggered by "accessory"/"acc" OR a type word/alias (ring / neck / ear).
  // Tier: legend/l/hunter/hc → L, unique/u/squad → U. Ring subtype via alias (atk/magic/hyb…);
  // Necklace/Earrings via INT VIT / AGI INT / STR AGI words.
  // e.g. "gdn squad ring atk" → gdn_u_accessory Ring@Attack ; "gdn hc neck int vit" → gdn_l Necklace@INT VIT
  const accType = tokens.map((t) => ACC_TYPES[t]).find(Boolean) || null;
  if (has("accessory") || has("acc") || accType) {
    const tier = ACC_TIER_L.some((w) => has(w)) ? "l" : ACC_TIER_U.some((w) => has(w)) ? "u" : null;
    if (!dungeon || !tier) return null;
    const key = `${dungeon}_${tier}_accessory`;
    if (!CATALOG[key]) return null;

    let detail = null;
    if (accType) {
      let sub = null;
      if (accType === "Ring") {
        sub = tokens.map((t) => RING_SUBS[t]).find(Boolean) || null;
      } else {
        sub = ACCESSORY_TYPES[accType].find((s) =>
          s.toLowerCase().split(/\s+/).every((w) => tokens.includes(w)),
        );
      }
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
    const lu = has("u") || has("upper") || has("unique") ? "u"
      : has("l") || has("lower") || has("legend") ? "l" : null;
    if (!lu) return null;
    const key = `${fam.key}_${lu}`;
    return CATALOG[key] ? { itemKey: key, qty, detail: null } : null;
  }

  return null;
}

// Gold line: "gold 294/7 @ol", "258/8", "gold 1,000,000/8".
// split must be 7 or 8 (HC ÷7 / normal ÷8). For ÷7, an optional trailing "@name"
// marks the excluded member (resolved to a uid later, where member names are known).
// Returns { amount, splitCount, excludeName }.
function parseGoldLine(raw) {
  const cleaned = raw.replace(/,/g, "");
  const m = cleaned.match(/^(?:gold\s+)?(\d+)\s*\/\s*(7|8)\b(.*)$/i);
  if (!m) return null;
  const amount = parseInt(m[1], 10);
  if (amount <= 0) return null;
  const tag = (m[3] || "").match(/@\s*([^\s,@]+)/);
  return {
    amount,
    splitCount: parseInt(m[2], 10),
    excludeName: tag ? tag[1].toLowerCase() : null,
  };
}

// Split on newlines and pipes; classify each line.
// Returns { added: [{itemKey,qty,detail}], unresolved: [{raw,qty,candidates}], errors: [string] }.
function parseItemLines(text) {
  const added = [];
  const golds = [];
  const unresolved = [];
  const errors = [];

  for (const lineRaw of text.split(/[\n|]+/).map((s) => s.trim()).filter(Boolean)) {
    // Inline note: everything after the first '#' on the line.
    const hashIdx = lineRaw.indexOf("#");
    const note = hashIdx >= 0 ? lineRaw.slice(hashIdx + 1).trim() || null : null;
    let raw = (hashIdx >= 0 ? lineRaw.slice(0, hashIdx) : lineRaw).trim();
    if (!raw) {
      errors.push(lineRaw);
      continue;
    }

    // "gacha" keyword: item exists (dropped) but is given away via a gacha/
    // duck-race, not sold — strip it before matching so it doesn't interfere
    // with name lookup, and mark the resulting item not-for-sale.
    const notForSale = /\bgacha\b/i.test(raw);
    if (notForSale) raw = raw.replace(/\bgacha\b/i, " ").replace(/\s+/g, " ").trim();

    const gold = parseGoldLine(raw);
    if (gold) {
      golds.push(gold); // notes don't apply to gold
      continue;
    }
    const named = matchNamed(raw);
    if (named && named.itemKey) {
      added.push({ itemKey: named.itemKey, qty: named.qty, detail: null, note, notForSale });
      continue;
    }
    if (named && named.candidates) {
      unresolved.push({ raw, qty: named.qty, candidates: named.candidates, note, notForSale });
      continue;
    }
    if (named && named.error) {
      errors.push(`${raw} — ${named.error}`);
      continue;
    }
    // Structural (fragments, accessories, equipment, thorns/etc.)
    const s = parseStructural(raw);
    if (s && s.itemKey) {
      added.push({ itemKey: s.itemKey, qty: s.qty, detail: s.detail, note, notForSale });
      continue;
    }
    if (s && s.candidates) {
      unresolved.push({ raw, qty: s.qty, candidates: s.candidates, note, notForSale });
      continue;
    }

    // Last resort: no-bracket keyword search of named equipment
    const fuzzy = matchNamedFuzzy(raw);
    if (fuzzy && fuzzy.itemKey) {
      added.push({ itemKey: fuzzy.itemKey, qty: fuzzy.qty, detail: null, note, notForSale });
      continue;
    }
    if (fuzzy && fuzzy.candidates) {
      unresolved.push({ raw, qty: fuzzy.qty, candidates: fuzzy.candidates, note, notForSale });
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
