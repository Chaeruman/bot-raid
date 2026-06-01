const CATALOG = {
  thorns_l_50_junk: { name: "Thorns L Lv.50 (Junk)", type: "unique", stampsPerUnit: 8 },
  thorns_l_50_good: { name: "Thorns L Lv.50 (Good/Perfect)", type: "unique", stampsPerUnit: 8 },
  thorns_u_50_junk: { name: "Thorns U Lv.50 (Junk)", type: "unique", stampsPerUnit: 4 },
  thorns_u_50_good: { name: "Thorns U Lv.50 (Good/Perfect)", type: "unique", stampsPerUnit: 4 },
  thorns_l_60_junk: { name: "Thorns L Lv.60 (Junk)", type: "unique", stampsPerUnit: 10 },
  thorns_l_60_good: { name: "Thorns L Lv.60 (Good/Perfect)", type: "unique", stampsPerUnit: 10 },
  thorns_u_60_junk: { name: "Thorns U Lv.60 (Junk)", type: "unique", stampsPerUnit: 5 },
  thorns_u_60_good: { name: "Thorns U Lv.60 (Good/Perfect)", type: "unique", stampsPerUnit: 5 },
  forest_l_50_good: { name: "Forest L Lv.50 (Good/Perfect)", type: "unique", stampsPerUnit: 8 },
  forest_u_50_good: { name: "Forest U Lv.50 (Good/Perfect)", type: "unique", stampsPerUnit: 4 },
  forest_l_60_junk: { name: "Forest L Lv.60 (Junk)", type: "unique", stampsPerUnit: 10 },
  forest_l_60_good: { name: "Forest L Lv.60 (Good/Perfect)", type: "unique", stampsPerUnit: 10 },
  forest_u_60_junk: { name: "Forest U Lv.60 (Junk)", type: "unique", stampsPerUnit: 5 },
  forest_u_60_good: { name: "Forest U Lv.60 (Good/Perfect)", type: "unique", stampsPerUnit: 5 },
  ddn_armor:        { name: "DDN Armor", type: "unique", stampsPerUnit: 2 },
  ddn_weapon:       { name: "DDN Weapon", type: "unique", stampsPerUnit: 5 },
  gdn_armor:        { name: "GDN Armor", type: "unique", stampsPerUnit: 1 },
  gdn_weapon:       { name: "GDN Weapon", type: "unique", stampsPerUnit: 3 },
  ddn_l_accessory:  { name: "DDN Legend Accessory", type: "unique", stampsPerUnit: 37 },
  gdn_l_accessory:  { name: "GDN Legend Accessory", type: "unique", stampsPerUnit: 34 },
  sdn_l_accessory:  { name: "SDN Legend Accessory", type: "unique", stampsPerUnit: 31 },
  ddn_u_accessory:  { name: "DDN Unique Accessory", type: "unique", stampsPerUnit: 21 },
  gdn_u_accessory:  { name: "GDN Unique Accessory", type: "unique", stampsPerUnit: 20 },
  sdn_u_accessory:  { name: "SDN Unique Accessory", type: "unique", stampsPerUnit: 19 },
  ddn_fragment:     { name: "DDN Fragment", type: "quantity", stampsPerUnit: 2 },
  gdn_fragment:     { name: "GDN Fragment", type: "quantity", stampsPerUnit: 1 },
};

const CATEGORIES = [
  {
    key: "thorns",
    label: "🗡️ Thorns",
    items: [
      "thorns_l_50_junk", "thorns_l_50_good",
      "thorns_u_50_junk", "thorns_u_50_good",
      "thorns_l_60_junk", "thorns_l_60_good",
      "thorns_u_60_junk", "thorns_u_60_good",
    ],
  },
  {
    key: "forest",
    label: "🌿 Forest",
    items: [
      "forest_l_50_good", "forest_u_50_good",
      "forest_l_60_junk", "forest_l_60_good",
      "forest_u_60_junk", "forest_u_60_good",
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

module.exports = { CATALOG, CATEGORIES };
