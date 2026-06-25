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
    { name: "", class: "Kali", part: "Helmet" },
    { name: "", class: "Kali", part: "Armor" },
    { name: "", class: "Kali", part: "Pants" },
    { name: "", class: "Kali", part: "Gloves" },
    { name: "", class: "Kali", part: "Boots" },
    { name: "", class: "Academic", part: "Helmet" },
    { name: "", class: "Academic", part: "Armor" },
    { name: "", class: "Academic", part: "Pants" },
    { name: "", class: "Academic", part: "Gloves" },
    { name: "", class: "Academic", part: "Boots" },
    { name: "", class: "Sorceress", part: "Helmet" },
    { name: "", class: "Sorceress", part: "Armor" },
    { name: "", class: "Sorceress", part: "Pants" },
    { name: "", class: "Sorceress", part: "Gloves" },
    { name: "", class: "Sorceress", part: "Boots" },
    { name: "", class: "Warrior", part: "Helmet" },
    { name: "", class: "Warrior", part: "Armor" },
    { name: "", class: "Warrior", part: "Pants" },
    { name: "", class: "Warrior", part: "Gloves" },
    { name: "", class: "Warrior", part: "Boots" },
    { name: "", class: "Cleric", part: "Helmet" },
    { name: "", class: "Cleric", part: "Armor" },
    { name: "", class: "Cleric", part: "Pants" },
    { name: "", class: "Cleric", part: "Gloves" },
    { name: "", class: "Cleric", part: "Boots" },
    { name: "", class: "Archer", part: "Helmet" },
    { name: "", class: "Archer", part: "Armor" },
    { name: "", class: "Archer", part: "Pants" },
    { name: "", class: "Archer", part: "Gloves" },
    { name: "", class: "Archer", part: "Boots" },
  ],

  // ─── GDN Armor (1 stamp) ───
  gdn_armor: [
    { name: "", class: "Kali", part: "Helmet" },
    { name: "", class: "Kali", part: "Armor" },
    { name: "", class: "Kali", part: "Pants" },
    { name: "", class: "Kali", part: "Gloves" },
    { name: "", class: "Kali", part: "Boots" },
    { name: "", class: "Academic", part: "Helmet" },
    { name: "", class: "Academic", part: "Armor" },
    { name: "", class: "Academic", part: "Pants" },
    { name: "", class: "Academic", part: "Gloves" },
    { name: "", class: "Academic", part: "Boots" },
    { name: "", class: "Sorceress", part: "Helmet" },
    { name: "", class: "Sorceress", part: "Armor" },
    { name: "", class: "Sorceress", part: "Pants" },
    { name: "", class: "Sorceress", part: "Gloves" },
    { name: "", class: "Sorceress", part: "Boots" },
    { name: "", class: "Warrior", part: "Helmet" },
    { name: "", class: "Warrior", part: "Armor" },
    { name: "", class: "Warrior", part: "Pants" },
    { name: "", class: "Warrior", part: "Gloves" },
    { name: "", class: "Warrior", part: "Boots" },
    { name: "", class: "Cleric", part: "Helmet" },
    { name: "", class: "Cleric", part: "Armor" },
    { name: "", class: "Cleric", part: "Pants" },
    { name: "", class: "Cleric", part: "Gloves" },
    { name: "", class: "Cleric", part: "Boots" },
    { name: "", class: "Archer", part: "Helmet" },
    { name: "", class: "Archer", part: "Armor" },
    { name: "", class: "Archer", part: "Pants" },
    { name: "", class: "Archer", part: "Gloves" },
    { name: "", class: "Archer", part: "Boots" },
  ],

  // ─── DDN Weapon (4 stamps) ───
  ddn_weapon: [
    { name: "", class: "Kali", part: "Main" },
    { name: "", class: "Kali", part: "Second" },
    { name: "", class: "Academic", part: "Main" },
    { name: "", class: "Academic", part: "Second" },
    { name: "", class: "Sorceress", part: "Main" },
    { name: "", class: "Sorceress", part: "Second" },
    { name: "", class: "Warrior", part: "Main" },
    { name: "", class: "Warrior", part: "Second" },
    { name: "", class: "Cleric", part: "Main" },
    { name: "", class: "Cleric", part: "Second" },
    { name: "", class: "Archer", part: "Main" },
    { name: "", class: "Archer", part: "Second" },
  ],

  // ─── GDN Weapon (3 stamps) ───
  gdn_weapon: [
    { name: "", class: "Kali", part: "Main" },
    { name: "", class: "Kali", part: "Second" },
    { name: "", class: "Academic", part: "Main" },
    { name: "", class: "Academic", part: "Second" },
    { name: "", class: "Sorceress", part: "Main" },
    { name: "", class: "Sorceress", part: "Second" },
    { name: "", class: "Warrior", part: "Main" },
    { name: "", class: "Warrior", part: "Second" },
    { name: "", class: "Cleric", part: "Main" },
    { name: "", class: "Cleric", part: "Second" },
    { name: "", class: "Archer", part: "Main" },
    { name: "", class: "Archer", part: "Second" },
  ],
};
