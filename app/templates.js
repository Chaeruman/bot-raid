const GDN_ROLES = {
  SM: { max: 1, label: "SM/DA" },
  FU: { max: 2 },
  HEALER: { max: 1, label: "Healer" },
  MC: { max: 1, subRoleAsLabel: true },
  MT: { max: 1, label: "MT", subRoles: ["Destroyer", "Guardian"] },
  ICE: { max: 1, label: "Ice Stacker" },
  ACRO: { max: 2, label: "Acro" },
  SUPPORT: { max: 2, hideIfEmpty: true, label: "Support" },
  DPS: { max: 3, label: "DPS" },
};

const MEMO_JOBS = ["SM/DA", "FU", "Healer", "MC", "MT", "Ice Stacker", "Acro", "Support", "DPS"];

// Four positions, no per-role caps. Spread into the map so one line defines a
// whole nest — the thing that stops a new nest arriving with a hand-copied set
// of roles that quietly differs.
const NEST_PARTY = {
  maxSlot: 4,
  kind: "nest",
  noThread: true,
  roles: {
    P1: { max: 1, label: "P1" },
    P2: { max: 1, label: "P2" },
    P3: { max: 1, label: "P3" },
    P4: { max: 1, label: "P4" },
  },
};
const NEST = (key, poolKey, label) => ({
  [key]: { ...NEST_PARTY, poolKeys: [poolKey], label, jobs: MEMO_JOBS },
});


// `poolKeys` links a signup to the bounty variants clearing it completes.
// Marathon and memo cover several; a template without it is simply not
// bounty-aware.
module.exports = {
  // ── Raid events ───────────────────────────────────────────────
  ddn_cl: {
    kind: "raid",
    poolKeys: ["ddn:classic"],
    label: "DDN Classic",
    maxSlot: 8,
    hcGoldSplit: false,
    forumTagKey: "forumTagDDN",
    roles: { ...GDN_ROLES },
  },
  ddn_hc: {
    kind: "raid",
    poolKeys: ["ddn:hc"],
    label: "DDN HC",
    maxSlot: 8,
    hcGoldSplit: true,
    forumTagKey: "forumTagDDNHC",
    roles: { ...GDN_ROLES },
  },
  gdn_hc: {
    kind: "raid",
    poolKeys: ["gdn:hc"],
    label: "GDN HC",
    maxSlot: 8,
    hcGoldSplit: true,
    forumTagKey: "forumTagHC",
    roles: { ...GDN_ROLES },
  },
  gdn_cl: {
    kind: "raid",
    poolKeys: ["gdn:classic"],
    label: "GDN Classic",
    maxSlot: 8,
    hcGoldSplit: false,
    forumTagKey: "forumTagCL",
    roles: { ...GDN_ROLES },
  },
  sdn_hc: {
    kind: "raid",
    poolKeys: ["sdn:hc"],
    label: "SDN HC",
    maxSlot: 8,
    hcGoldSplit: true,
    forumTagKey: "forumTagSDNHC",
    roles: { ...GDN_ROLES },
  },

  // ── Nests ─────────────────────────────────────────────────────
  // Every 4-player nest is the same party: four positions, and a job button
  // that labels whoever takes the next open one. Named roles with a cap each
  // (Healer x1, DPS x1, …) only ever turned people away from a nest that does
  // not care which four show up.
  ...NEST("tkn_hell", "tkn:hell", "TKN Hell"),
  ...NEST("tkn_challenge", "tkn:challenge", "TKN Challenge"),
  ...NEST("pkn_hell", "pkn:hell", "PKN Hell"),
  ...NEST("pkn_challenge", "pkn:challenge", "PKN Challenge"),
  ...NEST("abn_hell", "abn:hell", "ABN Hell"),
  ...NEST("abn_challenge", "abn:challenge", "ABN Challenge"),
  ...NEST("gn_hell", "gn:hell", "GN Hell"),
  ...NEST("gn_challenge", "gn:challenge", "GN Challenge"),

  // ── Memo party (DDN Memoria) ──────────────────────────────────
  // Fixed 4-slot party (P1-P4); job buttons just label whoever takes the
  // next open slot, unlike raid roles which cap per-role.
  memo: {
    // Its own kind, so it stays out of the generated menus: /memo takes a combo
    // option ("Memo 2 & 4") that the generic event pickers cannot pass, and
    // memo.js reads it as required.
    kind: "memo",
    poolKeys: ["ddn:i", "ddn:ii", "ddn:iii", "ddn:iv"],
    label: "DDN Memo",
    maxSlot: 4,
    noThread: true,
    jobs: MEMO_JOBS,
    roles: {
      P1: { max: 1, label: "P1" },
      P2: { max: 1, label: "P2" },
      P3: { max: 1, label: "P3" },
      P4: { max: 1, label: "P4" },
    },
  },

  // ── Marathon events ───────────────────────────────────────────
  marathon_gdn: {
    kind: "marathon",
    poolKeys: ["gdn:hc", "gdn:classic"],
    label: "Marathon GDN",
    maxSlot: 8,
    hcGoldSplit: "mixed",
    forumTagKey: "forumTagMarathonGDN",
    subruns: ["GDN HC", "GDN CL"],
    roles: { ...GDN_ROLES },
  },
  marathon_ddn: {
    kind: "marathon",
    poolKeys: ["ddn:classic", "gdn:hc", "gdn:classic"],
    label: "Marathon DDN",
    maxSlot: 8,
    hcGoldSplit: "mixed",
    forumTagKey: "forumTagMarathonDDN",
    subruns: ["DDN CL", "GDN HC", "GDN CL"],
    roles: { ...GDN_ROLES },
  },
};
