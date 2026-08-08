// Group Bounty — nest master data.
//
// Edited by hand and committed, exactly like luckyZone.js. Every field below is
// filled in by the guild admin; nothing here is computed from the game.
//
// Design notes live in docs/bounty-prd.md §7 and docs/bounty-arch.md §4.1.
//
// ── The unit is a VARIANT, not a nest ────────────────────────────────────────
//
// A bounty quest names a specific variant — "GDN Classic", not "GDN". Two people
// holding GDN quests for different variants CANNOT stack: they're different
// clears. So the thing quests group on is `nest:variant` (e.g. "gdn:hc"), and
// that pair is what the matcher pools by.
//
// Clearing a harder variant does NOT satisfy an easier variant's quest. There is
// no subsumption anywhere in this data, deliberately — every variant stands
// alone.
//
// Nests are written as one row with their variants nested inside, so the name
// and aliases are typed once instead of once per variant.
//
// ── Aliases ──────────────────────────────────────────────────────────────────
//
// MULTI-WORD ALIASES ARE FINE. "memo 1", "dark dragon", "rare legendary" all
// work — the parser collapses known phrases to a single token before matching,
// longest phrase first. Write whatever people actually say.
//
// Everything is matched LOWERCASE; case here is only for display labels.
//
// ── Fields, per nest ─────────────────────────────────────────────────────────
//
//   key         Stable id. Never displayed. Combined with a variant key it forms
//               the storage key, so once a week's quests reference it, DO NOT
//               rename — add a new row instead.
//
//   name        Display name, spelled the way it appears in game.
//
//   aliases     What people TYPE for this nest.
//
//               ⚠️ UNIQUE across all nests, and must not collide with a rarity,
//                  scroll or card-box word (reserved list at the bottom of this
//                  block). _bountyTest.js asserts this — a collision fails the
//                  check rather than quietly routing a week of quests to the
//                  wrong nest.
//
//               2-3 each is plenty. Whatever already gets said in voice chat.
//
//   capacity    Default party size for every variant of this nest: 4 or 8.
//               This also caps stack depth — a 4-player variant can never stack
//               more than 4 quests, because only 4 people can share them.
//               Individual variants may override it (see DDN Memoria below).
//
//   variants    The variants that can actually appear as bounty quests. Keys come
//               from VARIANTS below; add a new one there if something is missing.
//
//   enabled     false hides the whole nest without deleting it. To hide a single
//               variant, just remove it from `variants`.
//
// ── Fields, per variant ──────────────────────────────────────────────────────
//
//   minHighDps  How many characters with dpsTier "high" this variant needs to
//               clear comfortably. Your range was 2-4, and it differs per
//               variant — HC needs more than Classic.
//
//               ⚠️ Counts GEAR TIER, not role. A high-tier off-role out-damages
//                  a weak DPS-role character, so a role census answers the wrong
//                  question.
//
//               Advisory only — the bot prints "needs 2 more high DPS" and never
//               blocks anyone from joining.
//
//   capacity    Optional. Only when this variant differs from the nest default.
//
//   label       Optional. Overrides the generic VARIANTS label for display, for
//               when a nest calls its variants something of its own — DDN "I" is
//               really "Memoria 1".
//
//   aliases     Optional. EXTRA words for this variant, on top of the shared
//               vocabulary. Scoped to this nest, so "memo 1" meaning DDN I does
//               not leak into any other nest.
//
//               A variant alias that is unique guild-wide also implies its nest:
//               typing "memo 1 u wep" is enough, no "ddn" needed.
//
//               ⚠️ Two variants of the SAME nest must not share an alias.
//
// ── Reserved words — never use these as a nest alias ─────────────────────────
// Rarity:    u uniq unique leg legend legendary rl rleg "rare legendary"
// Scroll:    wep weapon wtd acc accessory arm armor
// Card box:  box cardbox card

// Flip this when the data is real. While DRAFT is true, /bounty-plan prints a
// warning that the nest list is incomplete — same idea as the DUMMY flag on the
// activity planner's content.js. Placeholder data should never look
// authoritative.
const DRAFT = false;

// Shared variant vocabulary, available to every nest. TKN, PKN and ABN all get
// "hell" and "challenge" from here rather than each needing aliases of their own.
// First entry in each list is the default display label; a nest can override it
// per variant with `label`.
const VARIANTS = {
  classic:   ["Classic", "classic", "cl"],
  normal:    ["Normal", "normal", "norm", "nm"],
  hc:        ["HC", "hc", "hardcore"],
  hell:      ["Hell", "hell"],
  challenge: ["Challenge", "challenge", "chal"],
  core:      ["Core", "core"],
  i:         ["I", "i", "1"],
  ii:        ["II", "ii", "2"],
  iii:       ["III", "iii", "3"],
  iv:        ["IV", "iv", "4"],

  // Abyssal Mire
  mutant:    ["Mutant", "mutant", "mut"],
  ghost:     ["Ghost", "ghost"],
  abandoned: ["Abandoned", "abandoned", "aband"],
};

const NESTS = [
  {
    key: "ddn",
    name: "Desert Dragon Nest",
    aliases: ["ddn", "desert", "desert dragon"],
    capacity: 8,
    variants: {
      classic: { minHighDps: 4 },
      hc:      { minHighDps: 6 },

      // Memoria: DDN's own name for I-IV, and 4-player rather than 8 — so both
      // `label` and `capacity` are overridden. The capacity override also caps
      // these stacks at 4 quests instead of 6.
      //
      // "memo 1" is unique guild-wide, so typing it alone identifies the nest
      // too — no "ddn" needed on the line.
      i:   { minHighDps: 2, capacity: 4, party: "memo", label: "Memoria 1", aliases: ["memo 1", "memo1", "memoria 1"] },
      ii:  { minHighDps: 2, capacity: 4, party: "memo", label: "Memoria 2", aliases: ["memo 2", "memo2", "memoria 2"] },
      iii: { minHighDps: 2, capacity: 4, party: "memo", label: "Memoria 3", aliases: ["memo 3", "memo3", "memoria 3"] },
      iv:  { minHighDps: 2, capacity: 4, party: "memo", label: "Memoria 4", aliases: ["memo 4", "memo4", "memoria 4"] },
    },
    enabled: true,
  },
  {
    key: "gdn",
    name: "Green Dragon Nest",
    aliases: ["gdn", "green", "green dragon"],
    capacity: 8,
    variants: {
      classic: { minHighDps: 2 },
      normal:  { minHighDps: 1 },
      hc:      { minHighDps: 2 },
    },
    enabled: true,
  },
  {
    key: "sdn",
    name: "Sea Dragon Nest",
    aliases: ["sdn", "sea", "sea dragon"],
    capacity: 8,
    variants: {
      classic: { minHighDps: 2 },
      hc:      { minHighDps: 2 },
      core:    { minHighDps: 1 },
    },
    enabled: true,
  },
  {
    // 4-player nest — capacity 4 caps every stack here at 4 quests, not 6.
    key: "tkn",
    name: "Typhoon Kim Nest",
    aliases: ["tkn", "typhoon", "typhoon kim"],
    capacity: 4,
    variants: {
      hell:      { minHighDps: 2 },
      challenge: { minHighDps: 4 },
    },
    enabled: true,
  },
  {
    key: "pkn",
    name: "Professor K Nest",
    aliases: ["pkn", "professor", "professor k"],
    capacity: 4,
    variants: {
      hell:      { minHighDps: 3 },
      challenge: { minHighDps: 4 },
    },
    enabled: true,
  },
  {
    key: "abn",
    name: "Archbishop Nest",
    aliases: ["abn", "archbishop", "archbishop nest"],
    capacity: 4,
    variants: {
      hell:      { minHighDps: 1 },
      challenge: { minHighDps: 2 },
    },
    enabled: true,
  },
  
  {
    key: "gn",
    name: "Gigantes Nest",
    aliases: ["gn", "gigantes", "gigantes nest"],
    capacity: 4,
    variants: {
      hell:      { minHighDps: 1 },
      challenge: { minHighDps: 2 },
    },
    enabled: true,
  },
  
  {
    // Disabled until it's confirmed that Abyssal Mire actually rolls as a bounty
    // quest. Written out now so enabling it is a one-word change.
    //
    // If it does appear, settle one thing first: does the quest name a FLOOR
    // ("Mutant Floor 7") or just the variant? A floor would join the pool key —
    // two people on different floors can't stack — and since the floor config is
    // the same across all three variants, that wants ONE shared floor table on
    // this row, not 36 variant entries.
    key: "abyssal_mire",
    name: "Abyssal Mire",
    aliases: ["abyssal mire", "abyssal", "mire"],
    capacity: 4,
    variants: {
      mutant:    { minHighDps: 1 },
      ghost:     { minHighDps: 1 },
      abandoned: { minHighDps: 1 },
    },
    enabled: false,
  },

  // ── Add the rest below. A long list is fine — pickers use autocomplete, not
  //    dropdowns, so there is no 25-option ceiling.
  //
  // {
  //   key: "",
  //   name: "",
  //   aliases: [],
  //   capacity: 8,
  //   variants: {
  //     classic: { minHighDps: 3 },
  //   },
  //   enabled: true,
  // },
];

module.exports = { NESTS, VARIANTS, DRAFT };
