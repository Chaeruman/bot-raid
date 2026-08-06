// Group Bounty — constants, reward table, and the input vocabulary.
// The nest/variant dataset lives in app/data/dungeons.js.
// Design notes: docs/bounty-arch.md §2.1 and §2.9.

const WEEKLY_CLAIMS = 6;

// The stack caps at the weekly claim limit for a *reason*, not a coincidence: a
// 7th stacked quest could not be claimed by anyone in the party, because nobody
// can claim more than 6 in a week — it would simply be wasted. Written as a
// derivation so the causal link survives and raising one raises both.
const MAX_SHARE_STACK = WEEKLY_CLAIMS;

// Unique and above. Nothing below this is ever stacked by the matcher, even when
// someone deliberately types it in.
const MIN_WORTH_RANK = 3;

// `rank` drives every ordering in the feature; `potion`/`scroll` are the payout
// per claim. Legendary WITHOUT the lvl 60 card box pays exactly what unique pays,
// so it ranks the same — the +1 comes from `box` in rankOf(), written generically
// rather than special-cased to legendary.
const RARITY = {
  unique:         { label: "Unique",         rank: 3, potion: 1, scroll: 1, aliases: ["unique", "uniq", "u"] },
  legendary:      { label: "Legendary",      rank: 3, potion: 1, scroll: 1, aliases: ["legendary", "legend", "leg"] },
  rare_legendary: { label: "Rare Legendary", rank: 5, potion: 2, scroll: 2, aliases: ["rare legendary", "rare leg", "rleg", "rl"] },
};

const SCROLL = {
  weapon:    { label: "Weapon",    aliases: ["weapon", "wep"] },
  wtd:       { label: "W/T/D",     aliases: ["wtd", "w/t/d"] },
  accessory: { label: "Accessory", aliases: ["accessory", "acc"] },
  armor:     { label: "Armor",     aliases: ["armor", "arm"] },
};

const BOX_ALIASES = ["card box", "cardbox", "box", "card"];

const DPS_TIERS = { high: "High DPS", good: "Good DPS", low: "Low DPS" };

// The raid signup's own role list, reused rather than retyped — a new raid role
// appears in /bounty-char automatically. Stored as its own field, never as
// `job`: `job` holds an in-game class and the activity planner reads it.
const ROLES = require("../templates").memo.jobs;

function rankOf(quest) {
  const r = RARITY[quest.rarity];
  if (!r) return 0;
  return r.rank + (quest.box ? 1 : 0);
}

// What one claim on this quest pays. A party member's payout is the sum of this
// over every quest in the stack (arch §2.9).
function rewardOf(quest) {
  const r = RARITY[quest.rarity];
  if (!r) return { potion: 0, scroll: 0, box: 0 };
  return { potion: r.potion, scroll: r.scroll, box: quest.box ? 1 : 0 };
}

module.exports = {
  WEEKLY_CLAIMS,
  MAX_SHARE_STACK,
  MIN_WORTH_RANK,
  RARITY,
  SCROLL,
  BOX_ALIASES,
  DPS_TIERS,
  ROLES,
  rankOf,
  rewardOf,
};
