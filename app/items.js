const CATALOG = {
  thorns_l_junk:   { name: "Thorns L (Junk)", type: "unique", stampsPerUnit: 8 },
  thorns_l_good:   { name: "Thorns L (Good/Perfect)", type: "unique", stampsPerUnit: 8 },
  thorns_u_junk:   { name: "Thorns U (Junk)", type: "unique", stampsPerUnit: 4 },
  thorns_u_good:   { name: "Thorns U (Good/Perfect)", type: "unique", stampsPerUnit: 4 },
  storm_l_junk:    { name: "Storm Triangular L (Junk)", type: "unique", stampsPerUnit: 8 },
  storm_l_good:    { name: "Storm Triangular L (Good/Perfect)", type: "unique", stampsPerUnit: 8 },
  storm_u_junk:    { name: "Storm Triangular U (Junk)", type: "unique", stampsPerUnit: 4 },
  storm_u_good:    { name: "Storm Triangular U (Good/Perfect)", type: "unique", stampsPerUnit: 4 },
  forest_l_junk:   { name: "Forest L (Junk)", type: "unique", stampsPerUnit: 8 },
  forest_l_good:   { name: "Forest L (Good/Perfect)", type: "unique", stampsPerUnit: 8 },
  forest_u_junk:   { name: "Forest U (Junk)", type: "unique", stampsPerUnit: 4 },
  forest_u_good:   { name: "Forest U (Good/Perfect)", type: "unique", stampsPerUnit: 4 },
  hot_sand_l_junk: { name: "Hot Sand Circular L (Junk)", type: "unique", stampsPerUnit: 8 },
  hot_sand_l_good: { name: "Hot Sand Circular L (Good/Perfect)", type: "unique", stampsPerUnit: 8 },
  hot_sand_u_junk: { name: "Hot Sand Circular U (Junk)", type: "unique", stampsPerUnit: 4 },
  hot_sand_u_good: { name: "Hot Sand Circular U (Good/Perfect)", type: "unique", stampsPerUnit: 4 },
  ddn_armor:        { name: "DDN Armor", type: "unique", stampsPerUnit: 1 },
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
};

const CATEGORIES = [
  {
    key: "thorns",
    label: "🗡️ Thorns",
    items: [
      "thorns_l_junk", "thorns_l_good",
      "thorns_u_junk", "thorns_u_good",
    ],
  },
  {
    key: "storm",
    label: "⛈️ Storm Triangular",
    items: [
      "storm_l_junk", "storm_l_good",
      "storm_u_junk", "storm_u_good",
    ],
  },
  {
    key: "forest",
    label: "🌿 Forest",
    items: [
      "forest_l_junk", "forest_l_good",
      "forest_u_junk", "forest_u_good",
    ],
  },
  {
    key: "hot_sand",
    label: "🏜️ Hot Sand Circular",
    items: [
      "hot_sand_l_junk", "hot_sand_l_good",
      "hot_sand_u_junk", "hot_sand_u_good",
    ],
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
];

const ARMOR_ITEMS = new Set(["ddn_armor", "gdn_armor"]);
const WEAPON_ITEMS = new Set(["ddn_weapon", "gdn_weapon"]);
const ACCESSORY_ITEMS = new Set([
  "ddn_l_accessory", "gdn_l_accessory", "sdn_l_accessory",
  "ddn_u_accessory", "gdn_u_accessory", "sdn_u_accessory",
]);

const ARMOR_PARTS = ["Head", "Top", "Lower", "Gloves", "Shoes"];
const WEAPON_TYPES = ["Main", "Second"];
const CLASSES = ["Kali", "Academic", "Sorceress", "Warrior", "Cleric", "Archer"];

const ACCESSORY_TYPES = {
  Ring:     ["Hybrid", "Magic", "Attack"],
  Necklace: ["INT VIT", "AGI INT", "STR AGI"],
  Earrings: ["INT VIT", "AGI INT", "STR AGI"],
};

function isArmor(itemKey)     { return ARMOR_ITEMS.has(itemKey); }
function isWeapon(itemKey)    { return WEAPON_ITEMS.has(itemKey); }
function isEquipment(itemKey) { return ARMOR_ITEMS.has(itemKey) || WEAPON_ITEMS.has(itemKey); }
function isAccessory(itemKey) { return ACCESSORY_ITEMS.has(itemKey); }

module.exports = {
  CATALOG,
  CATEGORIES,
  ARMOR_PARTS,
  WEAPON_TYPES,
  CLASSES,
  ACCESSORY_TYPES,
  isArmor,
  isWeapon,
  isEquipment,
  isAccessory,
};
