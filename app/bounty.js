// Group Bounty — pure logic. No Discord objects, no Mongo, so all of it is
// testable with plain `node app/_bountyTest.js`.
//
// Design notes: docs/bounty-arch.md. Covers the week key, the nest/variant
// index, the quest-line parser and claim accounting. Party forming lives on the
// signup panels (bountyJoin.js); the board is bountyBoard.js.

const { NESTS, VARIANTS } = require("./data/dungeons");
const { WEEKLY_CLAIMS, RARITY, SCROLL, BOX_ALIASES, rewardOf } = require("./data/bounty");

const lc = (s) => String(s).toLowerCase().trim().replace(/\s+/g, " ");

// ── Week ─────────────────────────────────────────────────────────────────────
// Reset is Saturday 08:00 WIB (UTC+7). Shifting UTC by −1h puts that instant
// exactly on a Saturday 00:00 boundary, so "which week" collapses to "which
// Saturday did we last pass". No timezone library — WIB has no DST.
//
// There is deliberately no reset job: a new week is a new document key, so
// last week's data is simply never read again and a Render restart across the
// reset window cannot miss or double-fire anything (arch §2.3).
function resetSaturday(now = new Date()) {
  const t = new Date(now.getTime() - 3600e3);
  const back = (t.getUTCDay() + 1) % 7; // Sat→0, Sun→1, … Fri→6
  return new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate() - back));
}

// Saturdays inside one month are always 7 days apart, so this counts them
// exactly whatever date the first one lands on — no calendar walk needed.
// August 2026 resets on the 1st, 8th, 15th, 22nd and 29th → W1…W5.
const weekOrdinal = (sat) => Math.floor((sat.getUTCDate() - 1) / 7) + 1;

const pad2 = (n) => String(n).padStart(2, "0");
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Storage key. Sorts lexicographically, so "recent weeks" is a plain sort.
function weekKey(now = new Date()) {
  const sat = resetSaturday(now);
  return `${sat.getUTCFullYear()}-${pad2(sat.getUTCMonth() + 1)}-W${weekOrdinal(sat)}`;
}

// Display. A week running past the end of its month keeps the label of the
// Saturday it started on — W5 of August ends in September and is still W5 Aug.
function weekLabel(now = new Date()) {
  const sat = resetSaturday(now);
  return `W${weekOrdinal(sat)} — ${sat.getUTCDate()} ${MONTHS[sat.getUTCMonth()]} ${sat.getUTCFullYear()}`;
}

// ── Variants ─────────────────────────────────────────────────────────────────
// Nests are the storage shape only, to avoid retyping a name and its aliases six
// times. The addressable unit is `nest:variant` — a quest names "GDN Classic",
// never "GDN", and holders of different variants cannot stack. One flatten at
// module load produces the list everything downstream uses, so no caller ever
// walks the nested structure (arch §4.1).
function flattenVariants(nests = NESTS) {
  const out = [];
  for (const nest of nests) {
    if (nest.enabled === false) continue;
    for (const [variantKey, v] of Object.entries(nest.variants || {})) {
      const vocab = VARIANTS[variantKey] || [];
      const label = v.label || vocab[0] || variantKey;
      out.push({
        poolKey: `${nest.key}:${variantKey}`,
        nestKey: nest.key,
        variantKey,
        nestName: nest.name,
        label,
        name: `${nest.name} ${label}`,
        // "GDN HC" for anywhere a full "Green Dragon Nest HC" is just a longer
        // way to say the same thing. The first alias IS the short name people
        // already type, so this stays correct without a second list to maintain.
        short: `${(nest.aliases?.[0] || nest.key).toUpperCase()} ${label}`,
        capacity: v.capacity ?? nest.capacity,
        minHighDps: v.minHighDps,
        party: v.party || null, // "memo" = P1-P4 job buttons instead of raid roles
        nestAliases: (nest.aliases || []).map(lc),
        variantAliases: [...vocab.slice(1), ...(v.aliases || [])].map(lc),
      });
    }
  }
  return out;
}

const VARIANT_LIST = flattenVariants();
const BY_POOL_KEY = new Map(VARIANT_LIST.map((v) => [v.poolKey, v]));

// ── Alias indexes ────────────────────────────────────────────────────────────
// Aliases may be phrases ("memo 1", "rare legendary", "dark dragon"), which a
// token matcher cannot see. Both the indexes and the input line therefore store
// phrases with their spaces collapsed to "_", so the two always agree and
// single-word aliases are completely unaffected.
const collapse = (s) => String(s).replace(/\s+/g, "_");

// Pure ordinals identify a variant once the nest is known, and never imply one.
// DDN is the only nest using i-iv, so without this a stray "1" would silently
// resolve to DDN Memoria 1 — a typo becoming a real quest. "memo 1" still
// infers, because the alias is "memo 1", not "1".
const ORDINAL = /^(?:\d+|[ivx]+)$/;

// variantAlias → poolKey, but only where the alias is unambiguous guild-wide.
// This is what lets `memo 1 u wep` and `core u wep` parse with no nest token,
// while `hc u wep` (three nests) still has to ask.
function buildNestInference(list = VARIANT_LIST) {
  const seen = new Map();
  for (const v of list) {
    for (const a of v.variantAliases) {
      if (ORDINAL.test(a)) continue;
      const k = collapse(a);
      seen.set(k, seen.has(k) ? null : v.poolKey); // null marks ambiguous
    }
  }
  return new Map([...seen].filter(([, key]) => key !== null));
}

const NEST_INFERENCE = buildNestInference();

const NEST_ALIAS = new Map(); // collapsed alias → nestKey
const VARIANT_BY_NEST = new Map(); // nestKey → Map(collapsed alias → variantKey)
const VARIANT_WORDS = new Set(); // every collapsed variant alias, any nest
const NEST_NAME = new Map(); // nestKey → display name
for (const v of VARIANT_LIST) {
  NEST_NAME.set(v.nestKey, v.nestName);
  for (const a of v.nestAliases) NEST_ALIAS.set(collapse(a), v.nestKey);
  if (!VARIANT_BY_NEST.has(v.nestKey)) VARIANT_BY_NEST.set(v.nestKey, new Map());
  for (const a of v.variantAliases) {
    VARIANT_BY_NEST.get(v.nestKey).set(collapse(a), v.variantKey);
    VARIANT_WORDS.add(collapse(a));
  }
}

const RARITY_ALIAS = new Map();
for (const [key, r] of Object.entries(RARITY))
  for (const a of r.aliases) RARITY_ALIAS.set(collapse(lc(a)), key);

const SCROLL_ALIAS = new Map();
for (const [key, s] of Object.entries(SCROLL))
  for (const a of s.aliases) SCROLL_ALIAS.set(collapse(lc(a)), key);

const BOX_WORDS = new Set(BOX_ALIASES.map((a) => collapse(lc(a))));

const variantsOfNest = (nestKey) => VARIANT_LIST.filter((v) => v.nestKey === nestKey);

// ── Parsing ──────────────────────────────────────────────────────────────────
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Every multi-word alias, longest first — so "memo 1" is claimed before any
// shorter phrase inside it can be, and "rare legendary" never degrades to "leg".
function buildPhrases(list = VARIANT_LIST) {
  const all = [
    ...list.flatMap((v) => [...v.nestAliases, ...v.variantAliases]),
    ...Object.values(RARITY).flatMap((r) => r.aliases.map(lc)),
    ...Object.values(SCROLL).flatMap((s) => s.aliases.map(lc)),
    ...BOX_ALIASES.map(lc),
  ];
  return [...new Set(all.filter((a) => a.includes(" ")))]
    .sort((a, b) => b.split(" ").length - a.split(" ").length || b.length - a.length)
    .map((p) => ({ re: new RegExp(`(?<=^|\\s)${escapeRe(p)}(?=\\s|$)`, "g"), to: collapse(p) }));
}

const PHRASES = buildPhrases();

function collapsePhrases(line) {
  let out = line;
  for (const { re, to } of PHRASES) out = out.replace(re, to);
  return out;
}

const spell = (t) => String(t).replace(/_/g, " ");

// ponytail: near-duplicate of the levenshtein in utils/parseItems.js. Two copies
// of a 12-line pure function beat coupling this parser to the loot catalogue's
// item shape — extract to utils/ if a third caller ever shows up.
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[m][n];
}

// Closest variants to a token nobody recognised. Scored against aliases rather
// than display names — "ddnn" is near the alias "ddn" and nowhere near the
// string "Desert Dragon Nest HC".
function suggestVariants(token, list = VARIANT_LIST, n = 5) {
  const word = spell(token);
  return list
    .map((v) => ({
      v,
      score: Math.min(
        ...[...v.nestAliases, ...v.variantAliases, ...v.name.toLowerCase().split(/\s+/)].map((p) =>
          levenshtein(word, p),
        ),
      ),
    }))
    .sort((a, b) => a.score - b.score)
    .slice(0, n)
    .map((x) => x.v);
}

// One quest line → { poolKey, rarity, scroll, box } or { error, hint }.
//
// Matching is by token membership, never by position, so `u wep hc ddn` parses
// exactly like `ddn hc u wep`. validateData() guarantees the vocabularies are
// disjoint, so no token can belong to two of them and the check order below is
// arbitrary rather than load-bearing.
function parseQuestLine(raw) {
  const tokens = collapsePhrases(lc(raw)).split(/\s+/).filter(Boolean);

  let nestKey = null, variantWord = null, rarity = null, scroll = null, box = false;
  const unknown = [], extra = [];

  for (const t of tokens) {
    if (NEST_ALIAS.has(t)) nestKey ? extra.push(t) : (nestKey = NEST_ALIAS.get(t));
    else if (RARITY_ALIAS.has(t)) rarity ? extra.push(t) : (rarity = RARITY_ALIAS.get(t));
    else if (SCROLL_ALIAS.has(t)) scroll ? extra.push(t) : (scroll = SCROLL_ALIAS.get(t));
    else if (BOX_WORDS.has(t)) box = true;
    else if (VARIANT_WORDS.has(t)) variantWord ? extra.push(t) : (variantWord = t);
    else unknown.push(t);
  }

  if (unknown.length) {
    const near = suggestVariants(unknown[0]).map((v) => v.name);
    return { raw, error: `don't know "${spell(unknown[0])}"`, hint: `did you mean: ${near.join(", ")}` };
  }
  if (extra.length)
    return { raw, error: `two values for the same thing — "${spell(extra[0])}" is one too many` };

  // Resolve nest + variant into the pool key. Ambiguity is reported with the
  // exact words to add rather than opening a picker: quests are 1-3 lines a
  // week, so retyping one line beats a stateful resolve flow (arch §7).
  let poolKey = null;
  if (nestKey && variantWord) {
    const variantKey = VARIANT_BY_NEST.get(nestKey)?.get(variantWord);
    if (!variantKey)
      return {
        raw,
        error: `"${spell(variantWord)}" is not a variant of ${NEST_NAME.get(nestKey)}`,
        hint: `try: ${variantsOfNest(nestKey).map((v) => v.label).join(", ")}`,
      };
    poolKey = `${nestKey}:${variantKey}`;
  } else if (variantWord) {
    poolKey = NEST_INFERENCE.get(variantWord) || null;
    if (!poolKey) {
      const owners = VARIANT_LIST.filter((v) => v.variantAliases.some((a) => collapse(a) === variantWord));
      return {
        raw,
        error: `"${spell(variantWord)}" belongs to ${owners.length} nests — which one?`,
        hint: `add a nest: ${[...new Set(owners.map((v) => v.nestAliases[0]))].join(", ")}`,
      };
    }
  } else if (nestKey) {
    const vs = variantsOfNest(nestKey);
    if (vs.length === 1) poolKey = vs[0].poolKey;
    else
      return {
        raw,
        error: `which ${NEST_NAME.get(nestKey)}?`,
        hint: `add a variant: ${vs.map((v) => v.label).join(", ")}`,
      };
  } else {
    return { raw, error: "no nest here", hint: "a line looks like `ddn hc u wep`" };
  }

  if (!rarity) return { raw, error: "no rarity", hint: "add `u`, `leg` or `rl`" };
  if (!scroll) return { raw, error: "no scroll type", hint: "add `wep`, `wtd`, `acc` or `arm`" };

  return { raw, poolKey, rarity, scroll, box };
}

// Split on newlines and pipes, same as the loot panel's item input.
// Exact repeats are dropped rather than stored twice — a duplicate line is a
// double paste far more often than it is two real quests.
function parseQuestLines(text) {
  const added = [], errors = [], duplicates = [];
  const seen = new Set();

  for (const line of String(text || "").split(/[\n|]+/).map((s) => s.trim()).filter(Boolean)) {
    const r = parseQuestLine(line);
    if (r.error) {
      errors.push(r);
      continue;
    }
    const sig = `${r.poolKey}|${r.rarity}|${r.scroll}|${r.box ? 1 : 0}`;
    if (seen.has(sig)) duplicates.push(r);
    else {
      seen.add(sig);
      added.push(r);
    }
  }

  return { added, errors, duplicates };
}

// ── Claims ───────────────────────────────────────────────────────────────────
// There is no stored claim counter. The board holds exactly 6 quests and the cap
// is exactly 6 claims, so the count is derivable — and a derivation cannot drift
// out of sync with the thing it counts (arch §4.2).
function claimsUsed(charWeek) {
  if (!charWeek) return 0;
  const claimed = (charWeek.board || []).filter((q) => q.runId).length;
  return claimed + (charWeek.shares || []).length;
}

const claimsLeft = (charWeek) => Math.max(0, WEEKLY_CLAIMS - claimsUsed(charWeek));

// What one quest pays, as text. Single source: the board, /bounty-need and
// /bounty-me all print this, and having three copies meant a wording change
// touched three files.
const rewardText = (quest) =>
  `${RARITY[quest.rarity]?.label || quest.rarity}${quest.box ? " + card box" : ""} · ` +
  `${SCROLL[quest.scroll]?.label || quest.scroll}`;

// The same, prefixed with which nest it's for.
function questLabel(quest) {
  const variant = BY_POOL_KEY.get(quest.poolKey);
  return `${variant ? variant.name : quest.poolKey} — ${rewardText(quest)}`;
}

// What a character has actually banked this week. Claimed board quests and
// received shares pay identically, so they sum into the same tally.
function tally(charWeek) {
  const out = { potion: 0, box: 0, scroll: {} };
  if (!charWeek) return out;
  for (const q of [...(charWeek.board || []).filter((x) => x.runId), ...(charWeek.shares || [])]) {
    const r = rewardOf(q);
    out.potion += r.potion;
    out.box += r.box;
    out.scroll[q.scroll] = (out.scroll[q.scroll] || 0) + r.scroll;
  }
  return out;
}

// ── Data validation ──────────────────────────────────────────────────────────
// Every check here guards a failure that produces a WRONG ANSWER rather than an
// error — a quest routed to the wrong nest, a variant with no label. Run by
// _bountyTest.js and again at boot, so a bad commit is loud instead of silent.
//
// Disabled nests are validated too: a typo in a row you haven't enabled yet
// should fail now, not on the day you switch it on.
function validateData(nests = NESTS, variants = VARIANTS) {
  const problems = [];

  const reserved = new Set(
    [
      ...Object.values(RARITY).flatMap((r) => r.aliases),
      ...Object.values(SCROLL).flatMap((s) => s.aliases),
      ...BOX_ALIASES,
    ].map(lc),
  );

  const variantWords = new Set(Object.values(variants).flatMap((v) => v.slice(1)).map(lc));

  const nestKeys = new Set();
  const aliasOwner = new Map();

  for (const nest of nests) {
    if (nestKeys.has(nest.key)) problems.push(`duplicate nest key "${nest.key}"`);
    nestKeys.add(nest.key);

    if (nest.capacity !== 4 && nest.capacity !== 8)
      problems.push(`nest "${nest.key}" capacity ${nest.capacity} is not 4 or 8`);

    for (const raw of nest.aliases || []) {
      const a = lc(raw);
      if (reserved.has(a))
        problems.push(`nest "${nest.key}" alias "${a}" collides with a rarity/scroll/card-box word`);
      if (variantWords.has(a))
        problems.push(`nest "${nest.key}" alias "${a}" collides with a variant word`);
      if (aliasOwner.has(a))
        problems.push(`alias "${a}" claimed by both nest "${aliasOwner.get(a)}" and "${nest.key}"`);
      else aliasOwner.set(a, nest.key);
    }

    const variantEntries = Object.entries(nest.variants || {});
    if (variantEntries.length === 0) problems.push(`nest "${nest.key}" has no variants`);

    const aliasToVariant = new Map();
    for (const [vKey, v] of variantEntries) {
      if (!variants[vKey])
        problems.push(`nest "${nest.key}" uses variant "${vKey}", which is not in VARIANTS`);
      if (typeof v.minHighDps !== "number")
        problems.push(`"${nest.key}:${vKey}" has no minHighDps`);

      const cap = v.capacity ?? nest.capacity;
      if (cap !== 4 && cap !== 8) problems.push(`"${nest.key}:${vKey}" capacity ${cap} is not 4 or 8`);

      for (const raw of [...(variants[vKey] || []).slice(1), ...(v.aliases || [])]) {
        const a = lc(raw);
        const owner = aliasToVariant.get(a);
        if (owner && owner !== vKey)
          problems.push(`nest "${nest.key}": alias "${a}" claimed by both "${owner}" and "${vKey}"`);
        aliasToVariant.set(a, vKey);
      }
    }
  }

  return problems;
}


// A character is identified by (player, name). ":" separates them unambiguously
// because a Discord user id is always digits — the first colon is always the
// boundary, whatever the character is called.
const ckey = (userId, charName) => `${userId}:${charName}`;

module.exports = {
  resetSaturday,
  weekOrdinal,
  weekKey,
  weekLabel,
  flattenVariants,
  VARIANT_LIST,
  BY_POOL_KEY,
  NEST_INFERENCE,
  buildNestInference,
  claimsUsed,
  claimsLeft,
  questLabel,
  rewardText,
  tally,
  ckey,
  validateData,
  parseQuestLine,
  parseQuestLines,
  suggestVariants,
  collapsePhrases,
  collapse,
  lc,
};
