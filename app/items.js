const CATALOG = {
  thorns_l:   { name: "Thorns L", type: "unique", stampsPerUnit: 8 },
  thorns_u:   { name: "Thorns U", type: "unique", stampsPerUnit: 4 },
  storm_l:    { name: "Storm Triangular L", type: "unique", stampsPerUnit: 8 },
  storm_u:    { name: "Storm Triangular U", type: "unique", stampsPerUnit: 4 },
  forest_l:   { name: "Forest L", type: "unique", stampsPerUnit: 8 },
  forest_u:   { name: "Forest U", type: "unique", stampsPerUnit: 4 },
  hot_sand_l: { name: "Hot Sand Circular L", type: "unique", stampsPerUnit: 8 },
  hot_sand_u: { name: "Hot Sand Circular U", type: "unique", stampsPerUnit: 4 },
  ddn_armor:        { name: "DDN Armor", type: "unique", stampsPerUnit: 2 },
  ddn_weapon:       { name: "DDN Weapon", type: "unique", stampsPerUnit: 4 },
  gdn_armor:        { name: "GDN Armor", type: "unique", stampsPerUnit: 1 },
  gdn_weapon:       { name: "GDN Weapon", type: "unique", stampsPerUnit: 3 },
  ddn_l_accessory:  { name: "DDN Legend Accessory", type: "unique", stampsPerUnit: 37 },
  gdn_l_accessory:  { name: "GDN Legend Accessory", type: "unique", stampsPerUnit: 34 },
  sdn_l_accessory:  { name: "SDN Legend Accessory", type: "unique", stampsPerUnit: 31 },
  ddn_u_accessory:  { name: "DDN Unique Accessory", type: "unique", stampsPerUnit: 22 },
  gdn_u_accessory:  { name: "GDN Unique Accessory", type: "unique", stampsPerUnit: 20 },
  sdn_u_accessory:  { name: "SDN Unique Accessory", type: "unique", stampsPerUnit: 19 },
  ddn_fragment:     { name: "DDN Fragment", type: "quantity", stampsPerUnit: 1 },
  gdn_fragment:     { name: "GDN Fragment", type: "quantity", stampsPerUnit: 1 },
  ddn_smelted_rune:          { name: "DDN Smelted Rune", type: "unique", stampsPerUnit: 4 },
  ddn_research_book:         { name: "Desert Dragon Research Book", type: "unique", stampsPerUnit: 3 },
};

// Aliases for the old junk/good rune keys (removed — junk/good was cosmetic
// only, same stamp fee) so loot panels created before this change still
// resolve their existing items instead of crashing on a missing CATALOG entry.
for (const fam of ["thorns", "storm", "forest", "hot_sand"]) {
  for (const lu of ["l", "u"]) {
    CATALOG[`${fam}_${lu}_junk`] = CATALOG[`${fam}_${lu}`];
    CATALOG[`${fam}_${lu}_good`] = CATALOG[`${fam}_${lu}`];
  }
}

const CATEGORIES = [
  {
    key: "thorns",
    label: "🗡️ Thorns",
    items: ["thorns_l", "thorns_u"],
  },
  {
    key: "storm",
    label: "⛈️ Storm Triangular",
    items: ["storm_l", "storm_u"],
  },
  {
    key: "forest",
    label: "🌿 Forest",
    items: ["forest_l", "forest_u"],
  },
  {
    key: "hot_sand",
    label: "🏜️ Hot Sand Circular",
    items: ["hot_sand_l", "hot_sand_u"],
  },
  {
    key: "equipment",
    label: "⚔️ Equipment",
    items: ["ddn_armor", "ddn_weapon", "gdn_armor", "gdn_weapon"],
  },
  {
    key: "accessory",
    label: "💍 Accessory",
    items: [
      "ddn_l_accessory", "gdn_l_accessory", "sdn_l_accessory",
      "ddn_u_accessory", "gdn_u_accessory", "sdn_u_accessory",
    ],
  },
  {
    key: "fragment",
    label: "🔮 Fragment",
    items: ["ddn_fragment", "gdn_fragment"],
  },
  {
    key: "rune",
    label: "🔥 Rune",
    items: ["ddn_smelted_rune"],
  },
  {
    key: "research",
    label: "📖 Research",
    items: ["ddn_research_book"],
  },
];

const ARMOR_ITEMS = new Set(["ddn_armor", "gdn_armor"]);
const WEAPON_ITEMS = new Set(["ddn_weapon", "gdn_weapon"]);
const ACCESSORY_ITEMS = new Set([
  "ddn_l_accessory", "gdn_l_accessory", "sdn_l_accessory",
  "ddn_u_accessory", "gdn_u_accessory", "sdn_u_accessory",
]);

const ARMOR_PARTS = ["Head", "Top", "Lower", "Gloves", "Shoes"];
const WEAPON_TYPES = ["Main", "Second"];
const CLASSES = ["Kali", "Academic", "Sorceress", "Warrior", "Cleric", "Archer", "Assassin"];

const ACCESSORY_TYPES = {
  Ring:     ["Hybrid", "Magic", "Attack"],
  Necklace: ["INT VIT", "AGI INT", "STR AGI"],
  Earrings: ["INT VIT", "AGI INT", "STR AGI"],
};

function isArmor(itemKey)     { return ARMOR_ITEMS.has(itemKey); }
function isWeapon(itemKey)    { return WEAPON_ITEMS.has(itemKey); }
function isEquipment(itemKey) { return ARMOR_ITEMS.has(itemKey) || WEAPON_ITEMS.has(itemKey); }
function isAccessory(itemKey) { return ACCESSORY_ITEMS.has(itemKey); }

// --- Named equipment (modal-only; not added to CATEGORIES/selects) ---
// Each bucket's items inherit a fixed stamp value. Merged into CATALOG so
// display + salary work, and indexed in NAMED_EQUIPMENT for the text parser.
const namedEquipmentBuckets = require("./namedEquipment");
const NAMED_STAMPS = { ddn_armor: 2, gdn_armor: 1, ddn_weapon: 4, gdn_weapon: 3 };
const NAMED_EQUIPMENT = [];
for (const [bucket, list] of Object.entries(namedEquipmentBuckets)) {
  const stampsPerUnit = NAMED_STAMPS[bucket];
  if (!stampsPerUnit) continue;
  const [dungeon, kind] = bucket.split("_");
  for (const entry of list) {
    const name = typeof entry === "string" ? entry : entry.name;
    const cls = typeof entry === "string" ? null : entry.class || null;
    const part = typeof entry === "string" ? null : entry.part || null;
    if (!name) continue;
    let key = "eq_" + name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
    while (CATALOG[key]) key += "_x";
    CATALOG[key] = { name, type: "unique", stampsPerUnit };
    NAMED_EQUIPMENT.push({ key, name, class: cls, part, dungeon, kind });
  }
}

// --- Named fragments (modal-only, like NAMED_EQUIPMENT, but zero stamp fee —
// these aren't sealed so there's no market-fee stamp count per unit). ---
const NAMED_FRAGMENT_NAMES = [
  "Spitflower Ignis", "Storm Master Zuu", "Canyon Guardian Abubbah",
  "Sandworm Hazal", "Loyal Follower Kajif",
];
for (const name of NAMED_FRAGMENT_NAMES) {
  let key = "eq_" + name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  while (CATALOG[key]) key += "_x";
  CATALOG[key] = { name, type: "quantity", stampsPerUnit: 0 };
  NAMED_EQUIPMENT.push({ key, name, class: null, part: null, dungeon: null, kind: null });
}

module.exports = {
  CATALOG,
  CATEGORIES,
  NAMED_EQUIPMENT,
  ARMOR_PARTS,
  WEAPON_TYPES,
  CLASSES,
  ACCESSORY_TYPES,
  isArmor,
  isWeapon,
  isEquipment,
  isAccessory,
};
