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

module.exports = {
  // ── Raid events ───────────────────────────────────────────────
  ddn_cl: {
    label: "DDN Classic",
    maxSlot: 8,
    hcGoldSplit: false,
    forumTagKey: "forumTagDDN",
    roles: { ...GDN_ROLES },
  },
  ddn_hc: {
    label: "DDN HC",
    maxSlot: 8,
    hcGoldSplit: true,
    forumTagKey: "forumTagDDNHC",
    roles: { ...GDN_ROLES },
  },
  gdn_hc: {
    label: "GDN HC",
    maxSlot: 8,
    hcGoldSplit: true,
    forumTagKey: "forumTagHC",
    roles: { ...GDN_ROLES },
  },
  gdn_cl: {
    label: "GDN Classic",
    maxSlot: 8,
    hcGoldSplit: false,
    forumTagKey: "forumTagCL",
    roles: { ...GDN_ROLES },
  },

  // ── Other events ──────────────────────────────────────────────
  tkn_hell: {
    label: "TKN Hell",
    maxSlot: 4,
    hcGoldSplit: false,
    noThread: true,
    roles: {
      HEALER: { max: 1, label: "Healer" },
      DPS: { max: 1, label: "DPS" },
      SUPPORT: { max: 1, label: "Support" },
      SUP_DPS: { max: 1, label: "Sup-DPS" },
    },
  },

  // ── Memo party (DDN Memoria) ──────────────────────────────────
  // Fixed 4-slot party (P1-P4); job buttons just label whoever takes the
  // next open slot, unlike raid roles which cap per-role.
  memo: {
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
    label: "Marathon GDN",
    maxSlot: 8,
    hcGoldSplit: "mixed",
    forumTagKey: "forumTagMarathonGDN",
    subruns: ["GDN HC", "GDN CL"],
    roles: { ...GDN_ROLES },
  },
  marathon_ddn: {
    label: "Marathon DDN",
    maxSlot: 8,
    hcGoldSplit: "mixed",
    forumTagKey: "forumTagMarathonDDN",
    subruns: ["DDN CL", "GDN HC", "GDN CL"],
    roles: { ...GDN_ROLES },
  },
};
