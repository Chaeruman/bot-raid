// Named equipment — addable ONLY via the "Add Items" modal (never shown in selects).
//
// Stamps are applied automatically per bucket (NOT affected by class/part):
//   ddn_armor → 2   gdn_armor → 1   ddn_weapon → 4   gdn_weapon → 3
//
// Fill the `name` for the items you have; leave the rest "" (blank names are
// skipped at load). `class` and `part` are info shown in the suggestion/resolve
// lists. Names must be unique.
//   weapon parts: Main, Second
//   armor parts:  Helmet, Armor, Pants, Gloves, Boots
//
// Sellers add them in the modal by dungeon/kind + a (keyword), e.g.
//   gdn (thread)   gdn armor (one pi)   gdn wep (voodoo)
// or by exact full name. Quantity with x5.

module.exports = {
  // ─── DDN Armor (2 stamps) ───
  ddn_armor: [
    { name: "DDN Orni", class: "Kali", part: "Helmet" },
    { name: "DDN Chori", class: "Kali", part: "Armor" },
    { name: "DDN Salwar", class: "Kali", part: "Pants" },
    { name: "DDN Rakki", class: "Kali", part: "Gloves" },
    { name: "DDN Jutti", class: "Kali", part: "Boots" },
    { name: "DDN Beret", class: "Academic", part: "Helmet" },
    { name: "DDN Tunic", class: "Academic", part: "Armor" },
    { name: "DDN Slacks", class: "Academic", part: "Pants" },
    { name: "DDN Cloak", class: "Academic", part: "Gloves" },
    { name: "DDN Round-toed Shoes", class: "Academic", part: "Boots" },
    { name: "DDN Tiara", class: "Sorceress", part: "Helmet" },
    { name: "DDN Robe", class: "Sorceress", part: "Armor" },
    { name: "DDN Tights", class: "Sorceress", part: "Pants" },
    { name: "DDN Muffs", class: "Sorceress", part: "Gloves" },
    { name: "DDN Heels", class: "Sorceress", part: "Boots" },
    { name: "DDN Helmet", class: "Warrior", part: "Helmet" },
    { name: "DDN Shirt", class: "Warrior", part: "Armor" },
    { name: "DDN Pants", class: "Warrior", part: "Pants" },
    { name: "DDN Gloves", class: "Warrior", part: "Gloves" },
    { name: "DDN Boots", class: "Warrior", part: "Boots" },
    { name: "DDN Galero", class: "Cleric", part: "Helmet" },
    { name: "DDN Armor", class: "Cleric", part: "Armor" },
    { name: "DDN Trousers", class: "Cleric", part: "Pants" },
    { name: "DDN Cuffs", class: "Cleric", part: "Gloves" },
    { name: "DDN Shoes", class: "Cleric", part: "Boots" },
    { name: "DDN Headband", class: "Archer", part: "Helmet" },
    { name: "DDN One Piece", class: "Archer", part: "Armor" },
    { name: "DDN Leggings", class: "Archer", part: "Pants" },
    { name: "DDN Mittens", class: "Archer", part: "Gloves" },
    { name: "DDN Booties", class: "Archer", part: "Boots" },
  ],

  // ─── GDN Armor (1 stamp) ───
  gdn_armor: [
    { name: "GDN Orni", class: "Kali", part: "Helmet" },
    { name: "GDN Chori", class: "Kali", part: "Armor" },
    { name: "GDN Salwar", class: "Kali", part: "Pants" },
    { name: "GDN Rakki", class: "Kali", part: "Gloves" },
    { name: "GDN Jutti", class: "Kali", part: "Boots" },
    { name: "GDN Beret", class: "Academic", part: "Helmet" },
    { name: "GDN Tunic", class: "Academic", part: "Armor" },
    { name: "GDN Slacks", class: "Academic", part: "Pants" },
    { name: "GDN Cloak", class: "Academic", part: "Gloves" },
    { name: "GDN Round-toed Shoes", class: "Academic", part: "Boots" },
    { name: "GDN Tiara", class: "Sorceress", part: "Helmet" },
    { name: "GDN Robe", class: "Sorceress", part: "Armor" },
    { name: "GDN Tights", class: "Sorceress", part: "Pants" },
    { name: "GDN Muffs", class: "Sorceress", part: "Gloves" },
    { name: "GDN Heels", class: "Sorceress", part: "Boots" },
    { name: "GDN Helmet", class: "Warrior", part: "Helmet" },
    { name: "GDN Shirt", class: "Warrior", part: "Armor" },
    { name: "GDN Pants", class: "Warrior", part: "Pants" },
    { name: "GDN Gloves", class: "Warrior", part: "Gloves" },
    { name: "GDN Boots", class: "Warrior", part: "Boots" },
    { name: "GDN Galero", class: "Cleric", part: "Helmet" },
    { name: "GDN Armor", class: "Cleric", part: "Armor" },
    { name: "GDN Trousers", class: "Cleric", part: "Pants" },
    { name: "GDN Cuffs", class: "Cleric", part: "Gloves" },
    { name: "GDN Shoes", class: "Cleric", part: "Boots" },
    { name: "GDN Headband", class: "Archer", part: "Helmet" },
    { name: "GDN One Piece", class: "Archer", part: "Armor" },
    { name: "GDN Leggings", class: "Archer", part: "Pants" },
    { name: "GDN Mittens", class: "Archer", part: "Gloves" },
    { name: "GDN Booties", class: "Archer", part: "Boots" },
  ],

  // ─── DDN Weapon (4 stamps) ───
  ddn_weapon: [
    { name: "DDN Chakram", class: "Kali", part: "Main" },
    { name: "DDN Fan", class: "Kali", part: "Main" },
    { name: "DDN Charm", class: "Kali", part: "Second" },
    { name: "DDN Cannon", class: "Academic", part: "Main" },
    { name: "DDN Kabala", class: "Academic", part: "Main" },
    { name: "DDN Threaded Loop", class: "Academic", part: "Second" },
    { name: "DDN Staff", class: "Sorceress", part: "Main" },
    { name: "DDN Crystal Ball", class: "Sorceress", part: "Second" },
    { name: "DDN Voodoo Doll", class: "Sorceress", part: "Second" },
    { name: "DDN Spellbook", class: "Sorceress", part: "Second" },
    { name: "DDN Sword", class: "Warrior", part: "Main" },
    { name: "DDN Axe", class: "Warrior", part: "Main" },
    { name: "DDN Hammer", class: "Warrior", part: "Main" },
    { name: "DDN Gauntlet", class: "Warrior", part: "Second" },
    { name: "DDN Wand", class: "Cleric", part: "Main" },
    { name: "DDN Mace", class: "Cleric", part: "Main" },
    { name: "DDN Flail", class: "Cleric", part: "Main" },
    { name: "DDN Shield", class: "Cleric", part: "Second" },
    { name: "DDN Shortbow", class: "Archer", part: "Main" },
    { name: "DDN Longbow", class: "Archer", part: "Main" },
    { name: "DDN Crossbow", class: "Archer", part: "Main" },
    { name: "DDN Quiver", class: "Archer", part: "Second" },
  ],

  // ─── GDN Weapon (3 stamps) ───
  gdn_weapon: [
    { name: "GDN Chakram", class: "Kali", part: "Main" },
    { name: "GDN Fan", class: "Kali", part: "Main" },
    { name: "GDN Charm", class: "Kali", part: "Second" },
    { name: "GDN Cannon", class: "Academic", part: "Main" },
    { name: "GDN Kabala", class: "Academic", part: "Main" },
    { name: "GDN Threaded Loop", class: "Academic", part: "Second" },
    { name: "GDN Staff", class: "Sorceress", part: "Main" },
    { name: "GDN Crystal Ball", class: "Sorceress", part: "Second" },
    { name: "GDN Voodoo Doll", class: "Sorceress", part: "Second" },
    { name: "GDN Spellbook", class: "Sorceress", part: "Second" },
    { name: "GDN Sword", class: "Warrior", part: "Main" },
    { name: "GDN Axe", class: "Warrior", part: "Main" },
    { name: "GDN Hammer", class: "Warrior", part: "Main" },
    { name: "GDN Gauntlet", class: "Warrior", part: "Second" },
    { name: "GDN Wand", class: "Cleric", part: "Main" },
    { name: "GDN Mace", class: "Cleric", part: "Main" },
    { name: "GDN Flail", class: "Cleric", part: "Main" },
    { name: "GDN Shield", class: "Cleric", part: "Second" },
    { name: "GDN Shortbow", class: "Archer", part: "Main" },
    { name: "GDN Longbow", class: "Archer", part: "Main" },
    { name: "GDN Crossbow", class: "Archer", part: "Main" },
    { name: "GDN Quiver", class: "Archer", part: "Second" },
  ],
};
