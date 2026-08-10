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

// Every word parseStructural understands, in one flat set. A line dies far more
// often on a misspelt keyword than on a keyword nobody knows, so an unrecognised
// token is repaired against this list BEFORE matching rather than reported after.
const STRUCT_VOCAB = new Set([
  "ddn", "gdn", "sdn",
  "fragment", "frag", "smelted", "rune", "research", "res",
  "accessory", "acc",
  ...Object.keys(ACC_TYPES),
  ...Object.keys(RING_SUBS),
  ...ACC_TIER_L, ...ACC_TIER_U,
  "armor", "arm", "weapon", "wep",
  "upper", "lower",
  ...CLASSES.map((c) => c.toLowerCase()),
  ...ARMOR_PARTS.map((p) => p.toLowerCase()),
  ...WEAPON_TYPES.map((p) => p.toLowerCase()),
  ...Object.values(ACCESSORY_TYPES).flat().flatMap((s) => s.toLowerCase().split(/\s+/)),
  ...FAMILIES.flatMap((f) => f.words),
]);

// A token that already appears inside a named item's name is a NAME keyword, not
// a misspelt structural word. "Repairing" it would hijack the line away from the
// named-equipment search that was about to resolve it correctly — so those are
// left exactly as typed.
const NAMED_BLOB = NAMED_EQUIPMENT.map((e) => e.name.toLowerCase()).join(" ");

// How many edits still count as "the same word, typed badly". Short tokens are
// left alone: `l` and `u` mean opposite tiers and are one edit apart, so a
// repair at that length is a coin flip on somebody's payout.
const maxTypos = (len) => (len <= 2 ? 0 : len <= 5 ? 1 : 2);

// Nearest vocabulary word, or the token unchanged. A TIE is left unrepaired on
// purpose: two equally good answers means we do not know which was meant, and
// guessing writes the wrong item onto a sale.
function repairToken(t) {
  if (STRUCT_VOCAB.has(t)) return t;
  const limit = maxTypos(t.length);
  if (!limit || NAMED_BLOB.includes(t)) return t;

  let best = null, bestD = Infinity, tie = false;
  for (const w of STRUCT_VOCAB) {
    if (Math.abs(w.length - t.length) > limit) continue;
    const d = levenshtein(t, w);
    if (d > limit) continue;
    if (d < bestD) {
      best = w;
      bestD = d;
      tie = false;
    } else if (d === bestD && w !== best) tie = true;
  }
  return best && !tie ? best : t;
}

// One entry of a shortlist, in the shape the resolve flow already speaks.
// `detail` rides along so a chosen accessory keeps its Ring@Attack — dropping it
// would make the picker answer a narrower question than the one that was asked.
const cand = (key, detail = null) => ({
  key,
  name: detail ? `${CATALOG[key].name} (${detail.replace("@", " ")})` : CATALOG[key].name,
  class: null,
  part: null,
  detail,
});

// Every catalog key matching a pattern, as a shortlist. Fewer than two answers
// is not a choice, so it stays null and the line reports why instead.
function shortlist(re, detail = null) {
  const keys = Object.keys(CATALOG).filter((k) => re.test(k));
  return keys.length > 1 ? keys.map((k) => cand(k, detail)) : null;
}

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
// Returns:
//   { itemKey, qty, detail }        certain
//   { qty, candidates, reason }     one token short of certain — offer a shortlist
//   { reason }                      category understood, nothing worth offering
//   null                            not a structural line at all
//
// The near-miss shapes are what stop a line dying over a single missing word.
// "gdn ring atk" used to fall out as an unmatched line; it is one click from
// being a real item, and the only thing missing is which tier it dropped at.
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
  tokens = tokens.map(repairToken);

  const has = (w) => tokens.includes(w);
  const dungeon = ["ddn", "gdn", "sdn"].find((d) => has(d));

  if (has("fragment") || has("frag")) {
    const key = `${dungeon}_fragment`;
    if (CATALOG[key]) return { itemKey: key, qty, detail: null };
    const reason = dungeon
      ? `no ${dungeon.toUpperCase()} fragment in the catalog — which one?`
      : "which dungeon's fragment?";
    const candidates = shortlist(/^(ddn|gdn|sdn)_fragment$/);
    return candidates ? { qty, candidates, reason } : { reason };
  }

  if (has("smelted") || has("rune")) {
    // ponytail: only a DDN variant exists right now, so no dungeon typed = DDN.
    // Add a dungeon-required check here once a GDN/SDN smelted rune shows up.
    const key = `${dungeon || "ddn"}_smelted_rune`;
    if (CATALOG[key]) return { itemKey: key, qty, detail: null };
    return { reason: `no ${(dungeon || "ddn").toUpperCase()} smelted rune in the catalog` };
  }

  if (has("research") || has("res")) {
    // ponytail: only a DDN variant exists right now, so no dungeon typed = DDN.
    const key = `${dungeon || "ddn"}_research_book`;
    if (CATALOG[key]) return { itemKey: key, qty, detail: null };
    return { reason: `no ${(dungeon || "ddn").toUpperCase()} research book in the catalog` };
  }

  // Accessory: triggered by "accessory"/"acc" OR a type word/alias (ring / neck / ear).
  // Tier: legend/l/hunter/hc → L, unique/u/squad → U. Ring subtype via alias (atk/magic/hyb…);
  // Necklace/Earrings via INT VIT / AGI INT / STR AGI words.
  // e.g. "gdn squad ring atk" → gdn_u_accessory Ring@Attack ; "gdn hc neck int vit" → gdn_l Necklace@INT VIT
  const accType = tokens.map((t) => ACC_TYPES[t]).find(Boolean) || null;
  if (has("accessory") || has("acc") || accType) {
    const tier = ACC_TIER_L.some((w) => has(w)) ? "l" : ACC_TIER_U.some((w) => has(w)) ? "u" : null;

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

    const key = dungeon && tier ? `${dungeon}_${tier}_accessory` : null;
    if (key && CATALOG[key]) return { itemKey: key, qty, detail };

    // Offer every accessory that fits what WAS typed, so a missing dungeon or
    // tier costs a click instead of a retype. The type and subtype survive on
    // each option, because those were never in doubt.
    const missing = [
      !dungeon && "dungeon (`ddn`/`gdn`/`sdn`)",
      !tier && "tier (`hc`/`legend` or `squad`/`unique`)",
    ].filter(Boolean).join(" and ");
    const reason = missing ? `accessory needs a ${missing}` : "no such accessory in the catalog";
    const candidates = shortlist(
      new RegExp(`^(${dungeon || "ddn|gdn|sdn"})_(${tier || "l|u"})_accessory$`),
      detail,
    );
    return candidates ? { qty, candidates, reason } : { reason };
  }

  const kind = has("armor") || has("arm") ? "armor" : has("weapon") || has("wep") ? "weapon" : null;
  if (kind) {
    // A line that also names something outside the vocabulary is naming a
    // SPECIFIC piece — "gdn wep voodoo doll" — and belongs to the named-equipment
    // search, not here. Claiming it would swap a named item for a generic one.
    if (tokens.some((t) => !STRUCT_VOCAB.has(t))) return null;

    const cls = CLASSES.find((c) => has(c.toLowerCase()));
    const partList = kind === "armor" ? ARMOR_PARTS : WEAPON_TYPES;
    const part = partList.find((p) => has(p.toLowerCase()));
    let detail = null;
    if (cls && part) detail = `${cls}@${part}`;
    else if (cls) detail = cls;
    else if (part) detail = part;

    const key = `${dungeon}_${kind}`;
    if (CATALOG[key]) return { itemKey: key, qty, detail };

    const reason = dungeon
      ? `no ${dungeon.toUpperCase()} ${kind} in the catalog`
      : `${kind} needs a dungeon (\`ddn\`/\`gdn\`)`;
    const candidates = shortlist(new RegExp(`^(ddn|gdn|sdn)_${kind}$`), detail);
    return candidates ? { qty, candidates, reason } : { reason };
  }

  const fam = FAMILIES.find((f) => f.words.some((w) => has(w)));
  if (fam) {
    const lu = has("u") || has("upper") || has("unique") ? "u"
      : has("l") || has("lower") || has("legend") ? "l" : null;
    const key = lu ? `${fam.key}_${lu}` : null;
    if (key && CATALOG[key]) return { itemKey: key, qty, detail: null };

    const reason = "which one — `l` (legend) or `u` (unique)?";
    const candidates = shortlist(new RegExp(`^${fam.key}_[lu]$`));
    return candidates ? { qty, candidates, reason } : { reason };
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

// One failed line, as text. Kept next to the parser so every caller words it the
// same way, and structured rather than pre-formatted so the failure log can key
// on the raw line without parsing a sentence back apart.
const formatParseError = (e) => `\`${e.raw}\` — ${e.reason}`;

// Split on newlines and pipes; classify each line.
// Returns { added: [{itemKey,qty,detail}], unresolved: [{raw,qty,candidates}],
//           errors: [{raw,reason}] }.
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
      errors.push({ raw: lineRaw, reason: "there's a note here but no item" });
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

    // Structural (fragments, accessories, equipment, thorns/etc.)
    const s = parseStructural(raw);
    if (s && s.itemKey) {
      added.push({ itemKey: s.itemKey, qty: s.qty, detail: s.detail, note, notForSale });
      continue;
    }

    // No-bracket keyword search of named equipment
    const fuzzy = matchNamedFuzzy(raw);
    if (fuzzy && fuzzy.itemKey) {
      added.push({ itemKey: fuzzy.itemKey, qty: fuzzy.qty, detail: null, note, notForSale });
      continue;
    }
    if (fuzzy && fuzzy.candidates) {
      unresolved.push({ raw, qty: fuzzy.qty, candidates: fuzzy.candidates, note, notForSale });
      continue;
    }

    // A structural shortlist comes LAST: it is a guess assembled from a category
    // word, and a named item that actually exists beats any guess. "storm master
    // zuu" is a real fragment, not an under-specified Storm Triangular rune.
    if (s && s.candidates) {
      // The reason rides along — "which tier?" is the whole question the picker
      // is asking, and a bare list of two accessories does not ask it.
      unresolved.push({ raw, qty: s.qty, candidates: s.candidates, reason: s.reason, note, notForSale });
      continue;
    }

    // Nothing matched. Every path above knows something about why, and the most
    // specific one that spoke up gets to say it — a bare echo of the line taught
    // the seller nothing and cost them another round trip.
    const reason =
      (s && s.reason) ||
      (named && named.error) ||
      (fuzzy && fuzzy.error) ||
      "not a known item — try `<dungeon> (<part of the name>)`, e.g. `gdn (chakram)`";
    errors.push({ raw, reason });
  }

  return { added, golds, unresolved, errors };
}

module.exports = { parseItemLines, formatParseError, repairToken };
