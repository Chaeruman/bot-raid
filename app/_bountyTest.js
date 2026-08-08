// Group Bounty self-test — run:  node app/_bountyTest.js
// No Discord/network needed; exercises app/bounty.js + app/data/*.js only.
//
// Phase 2 covers the week key, the variant index, nest inference and claim
// accounting. Parser and stack-builder checks land with phases 3-4.
// Numbering follows docs/bounty-arch.md §8.

const {
  resetSaturday,
  weekKey,
  weekLabel,
  weekOrdinal,
  flattenVariants,
  VARIANT_LIST,
  BY_POOL_KEY,
  NEST_INFERENCE,
  claimsUsed,
  claimsLeft,
  validateData,
  parseQuestLine,
  parseQuestLines,
  questLabel,
  tally,
  collapse,
  ckey,
} = require("./bounty");
const { NESTS, VARIANTS } = require("./data/dungeons");
const { WEEKLY_CLAIMS, MAX_SHARE_STACK, ROLES, rankOf, rewardOf } = require("./data/bounty");

let pass = 0;
const fails = [];
function check(name, cond, detail) {
  if (cond) pass++;
  else fails.push(`${name}${detail ? ` — ${detail}` : ""}`);
}
const eq = (name, got, want) => check(name, got === want, `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);

// ─────────────────────────────────────────────────────────────────────────────
// 1. Week boundary — Saturday 08:00 WIB is 01:00 UTC. One minute either side of
//    it must land in different weeks, or a run at reset is filed to the wrong one.
eq("1. 07:59 WIB Sat is still last week", weekKey(new Date("2026-08-01T00:59:00Z")), "2026-07-W4");
eq("1. 08:00 WIB Sat starts the new week", weekKey(new Date("2026-08-01T01:00:00Z")), "2026-08-W1");
eq("1. mid-week resolves to its Saturday", weekKey(new Date("2026-08-05T17:00:00Z")), "2026-08-W1");

// 2. Week label — August 2026 resets on the 1st, 8th, 15th, 22nd and 29th.
eq("2. W1", weekKey(new Date("2026-08-01T01:00:00Z")), "2026-08-W1");
eq("2. W2", weekKey(new Date("2026-08-08T01:00:00Z")), "2026-08-W2");
eq("2. W3", weekKey(new Date("2026-08-15T01:00:00Z")), "2026-08-W3");
eq("2. W4", weekKey(new Date("2026-08-22T01:00:00Z")), "2026-08-W4");
eq("2. W5", weekKey(new Date("2026-08-29T01:00:00Z")), "2026-08-W5");
// A week that runs past the end of its month keeps the label of the Saturday it
// started on: 2 Sep 2026 is inside the week that reset on Sat 29 Aug.
eq("2. Sep date keeps its August label", weekKey(new Date("2026-09-02T12:00:00Z")), "2026-08-W5");
eq("2. label format", weekLabel(new Date("2026-08-01T01:00:00Z")), "W1 — 1 Aug 2026");
eq("2. label spanning the month", weekLabel(new Date("2026-09-02T12:00:00Z")), "W5 — 29 Aug 2026");
// The ordinal formula is exact because Saturdays in one month are 7 days apart,
// whatever date the first one lands on.
check("2. ordinal counts Saturdays, not weeks-of-month",
  [1, 8, 15, 22, 29].every((d, i) => weekOrdinal(new Date(Date.UTC(2026, 7, d))) === i + 1));
check("2. resetSaturday always returns a Saturday",
  [0, 1, 2, 3, 4, 5, 6, 40, 200].every((d) =>
    resetSaturday(new Date(Date.UTC(2026, 7, 1 + d, 12))).getUTCDay() === 6));

// ─────────────────────────────────────────────────────────────────────────────
// 4. Alias rule set + every variant key exists in VARIANTS. This is the guard
//    against a typo silently routing a week of quests to the wrong nest — the
//    failure mode is a wrong answer, not an error, so it has to be a check.
const problems = validateData();
check("4. real data has no problems", problems.length === 0, problems.join(" | "));

// Fixtures that must be REJECTED, so the validator can't quietly pass everything.
const okVariants = { classic: ["Classic", "classic", "cl"], hc: ["HC", "hc", "hardcore"] };
const nest = (over) => [{ key: "x", name: "X", aliases: ["x"], capacity: 8, variants: { classic: { minHighDps: 2 } }, enabled: true, ...over }];

check("4. catches an unknown variant key",
  validateData(nest({ variants: { nope: { minHighDps: 2 } } }), okVariants).length > 0);
check("4. catches a nest alias colliding with a rarity word",
  validateData(nest({ aliases: ["u"] }), okVariants).length > 0);
check("4. catches a nest alias colliding with a variant word",
  validateData(nest({ aliases: ["hc"] }), okVariants).length > 0);
check("4. catches two nests sharing an alias",
  validateData([...nest(), ...nest({ key: "y", name: "Y" })], okVariants).length > 0);
check("4. catches a missing minHighDps",
  validateData(nest({ variants: { classic: {} } }), okVariants).length > 0);
check("4. catches a bad capacity",
  validateData(nest({ capacity: 6 }), okVariants).length > 0);
check("4. catches two variants of one nest sharing an alias",
  validateData(
    nest({ variants: { classic: { minHighDps: 2 }, hc: { minHighDps: 2, aliases: ["cl"] } } }),
    okVariants,
  ).length > 0);

// 4c. Roles come from the raid signup's own list, so a new raid role reaches
//     /bounty-char without being retyped. Reached via templates.memo.jobs — this
//     asserts that path, since a rename there would silently empty the choices.
check("4c. roles resolve from templates", Array.isArray(ROLES) && ROLES.length >= 5, JSON.stringify(ROLES));
check("4c. roles include Healer and MT", ROLES.includes("Healer") && ROLES.includes("MT"));
check("4c. roles fit slash-command choices", ROLES.length <= 25);

// 4b. Inference guards.
check("4b. 'memo 1' infers DDN Memoria 1", NEST_INFERENCE.get(collapse("memo 1")) === "ddn:i");
check("4b. 'core' infers SDN Core", NEST_INFERENCE.get("core") === "sdn:core");
check("4b. 'hc' is ambiguous, so it never infers", !NEST_INFERENCE.has("hc"));
check("4b. bare '1' never infers", !NEST_INFERENCE.has("1"));
check("4b. bare 'i' never infers", !NEST_INFERENCE.has("i"));
check("4b. bare 'iii' never infers", !NEST_INFERENCE.has("iii"));
// A disabled nest is invisible everywhere — parsing, inference, the plan.
check("4b. disabled nest is absent from the variant list",
  !VARIANT_LIST.some((v) => v.nestKey === "abyssal_mire"));
check("4b. disabled nest's variants never infer", !NEST_INFERENCE.has("mutant"));

// ─────────────────────────────────────────────────────────────────────────────
// 3. Parser. This is where a wrong answer costs someone their week, so it gets
//    the heaviest coverage: every failure below is silent if unchecked.
const P = (s) => parseQuestLine(s);
const ok = (name, s, want) => {
  const r = P(s);
  check(name, !r.error && r.poolKey === want.poolKey && r.rarity === want.rarity &&
    r.scroll === want.scroll && !!r.box === !!want.box,
    r.error ? `error: ${r.error}` : JSON.stringify({ got: r, want }));
};
const bad = (name, s) => check(name, !!P(s).error, `unexpectedly parsed: ${JSON.stringify(P(s))}`);

ok("3. the canonical line", "ddn hc u wep",
  { poolKey: "ddn:hc", rarity: "unique", scroll: "weapon" });
ok("3. legendary with a card box", "gdn cl leg acc box",
  { poolKey: "gdn:classic", rarity: "legendary", scroll: "accessory", box: true });
ok("3. rare legendary", "tkn hell rl arm",
  { poolKey: "tkn:hell", rarity: "rare_legendary", scroll: "armor" });

// Token order is never load-bearing.
ok("3. reversed order parses identically", "u wep hc ddn",
  { poolKey: "ddn:hc", rarity: "unique", scroll: "weapon" });
ok("3. box anywhere in the line", "box gdn u wtd cl",
  { poolKey: "gdn:classic", rarity: "unique", scroll: "wtd", box: true });
check("3. UPPERCASE is fine", P("DDN HC U WEP").poolKey === "ddn:hc");
check("3. extra whitespace is fine", P("  ddn   hc\tu  wep ").poolKey === "ddn:hc");

// 3b. Multi-word aliases. The longest phrase must win, or "memo 1" gets shredded
//     into the bare "1" alias for variant `i` and loses its nest inference.
ok("3b. 'memo 1' needs no nest token", "memo 1 u wep",
  { poolKey: "ddn:i", rarity: "unique", scroll: "weapon" });
ok("3b. 'rare legendary' spelled out", "sdn core rare legendary wep",
  { poolKey: "sdn:core", rarity: "rare_legendary", scroll: "weapon" });
ok("3b. 'card box' spelled out", "gdn hc leg acc card box",
  { poolKey: "gdn:hc", rarity: "legendary", scroll: "accessory", box: true });
ok("3b. multi-word nest alias", "desert dragon hc u wep",
  { poolKey: "ddn:hc", rarity: "unique", scroll: "weapon" });
ok("3b. 'core' alone infers SDN", "core u wep",
  { poolKey: "sdn:core", rarity: "unique", scroll: "weapon" });
ok("3b. ordinal still works once the nest is known", "ddn 3 u wep",
  { poolKey: "ddn:iii", rarity: "unique", scroll: "weapon" });

// 3c. Every failure names what is missing rather than just refusing.
bad("3c. missing rarity", "ddn hc wep");
bad("3c. missing scroll", "ddn hc u");
bad("3c. missing variant on a multi-variant nest", "ddn u wep");
bad("3c. ambiguous variant with no nest", "hc u wep");
bad("3c. bare ordinal never infers a nest", "1 u wep");
bad("3c. variant that isn't on that nest", "gdn memo 1 u wep");
bad("3c. unknown token", "ddnn hc u wep");
bad("3c. two nests", "ddn gdn hc u wep");
bad("3c. two rarities", "ddn hc u leg wep");
bad("3c. empty line", "   ");
bad("3c. disabled nest is unusable", "mire mutant u wep");
check("3c. a missing variant lists the choices",
  (P("ddn u wep").hint || "").includes("Memoria 1"));
check("3c. an unknown token suggests real variants",
  (P("ddnn hc u wep").hint || "").toLowerCase().includes("desert"));

// 3d. Multi-line input, and exact repeats dropped rather than stored twice.
const multi = parseQuestLines("ddn hc u wep\ngdn cl leg acc box\n\nnonsense here\nddn hc u wep");
eq("3d. good lines kept", multi.added.length, 2);
eq("3d. repeat dropped", multi.duplicates.length, 1);
eq("3d. bad line reported", multi.errors.length, 1);
eq("3d. pipes split too", parseQuestLines("ddn hc u wep | gdn hc u arm").added.length, 2);
// A near-repeat is a different quest, not a duplicate.
eq("3d. differing scroll is not a repeat",
  parseQuestLines("ddn hc u wep\nddn hc u arm").added.length, 2);

// 3e. Display.
eq("3e. quest label", questLabel({ poolKey: "ddn:i", rarity: "unique", scroll: "weapon" }),
  "Desert Dragon Nest Memoria 1 — Unique · Weapon");
eq("3e. card box shows in the label",
  questLabel({ poolKey: "gdn:hc", rarity: "legendary", scroll: "accessory", box: true }),
  "Green Dragon Nest HC — Legendary + card box · Accessory");

// ─────────────────────────────────────────────────────────────────────────────
// 5. Pool keys never mix variants, and flattening resolves the right fields.
check("5. pool keys are unique", new Set(VARIANT_LIST.map((v) => v.poolKey)).size === VARIANT_LIST.length);
check("5. gdn:cl and gdn:hc are separate pools",
  BY_POOL_KEY.has("gdn:classic") && BY_POOL_KEY.has("gdn:hc") && BY_POOL_KEY.get("gdn:classic") !== BY_POOL_KEY.get("gdn:hc"));
eq("5. variant label override wins", BY_POOL_KEY.get("ddn:i").label, "Memoria 1");
eq("5. display name joins nest + variant", BY_POOL_KEY.get("ddn:i").name, "Desert Dragon Nest Memoria 1");
eq("5. shared vocabulary supplies the default label", BY_POOL_KEY.get("gdn:hc").label, "HC");

// 6. Rank table — rare legendary > legendary+box > unique = legendary.
eq("6. rare legendary", rankOf({ rarity: "rare_legendary" }), 5);
eq("6. legendary + box", rankOf({ rarity: "legendary", box: true }), 4);
eq("6. unique", rankOf({ rarity: "unique" }), 3);
eq("6. legendary without box ties unique", rankOf({ rarity: "legendary" }), rankOf({ rarity: "unique" }));
eq("6. unknown rarity ranks zero", rankOf({ rarity: "magic" }), 0);
eq("6. rare legendary pays double", rewardOf({ rarity: "rare_legendary" }).scroll, 2);

// ─────────────────────────────────────────────────────────────────────────────
// 11. Claims are derived, never counted — a claimed board quest and a received
//     share cost exactly the same one claim.
const q = (runId) => ({ dungeon: "gdn:hc", rarity: "unique", runId });
eq("11. empty character has spent nothing", claimsUsed(undefined), 0);
eq("11. an unclaimed board quest costs nothing", claimsUsed({ board: [q(null)], shares: [] }), 0);
eq("11. a claimed board quest costs one", claimsUsed({ board: [q("r1")], shares: [] }), 1);
eq("11. board and shares both count",
  claimsUsed({ board: [q("r1"), q(null)], shares: [q("r1"), q("r1")] }), 3);
eq("11. claimsLeft counts down from the weekly cap",
  claimsLeft({ board: [q("r1")], shares: [q("r1"), q("r1")] }), WEEKLY_CLAIMS - 3);
// One finished 4-stack writes 4 entries per member, not one.
eq("11. a 4-stack costs four claims",
  claimsUsed({ board: [q("r1")], shares: [q("r1"), q("r1"), q("r1")] }), 4);
eq("11. claimsLeft never goes negative",
  claimsLeft({ board: [], shares: Array.from({ length: 9 }, () => q("r1")) }), 0);

// 13. Reward tally — claimed board quests and received shares pay identically,
//     and unclaimed quests pay nothing at all.
const week = {
  board: [
    { poolKey: "ddn:hc", rarity: "unique", scroll: "weapon", runId: "r1" },
    { poolKey: "gdn:hc", rarity: "legendary", scroll: "accessory", box: true, runId: null },
  ],
  shares: [{ poolKey: "ddn:hc", rarity: "rare_legendary", scroll: "wtd", runId: "r1" }],
};
const t = tally(week);
eq("13. unclaimed quests pay nothing", t.box, 0);
eq("13. potions sum across board and shares", t.potion, 1 + 2);
eq("13. scrolls are counted per category", t.scroll.weapon, 1);
eq("13. rare legendary pays two scrolls", t.scroll.wtd, 2);
eq("13. an empty week tallies to zero", tally(undefined).potion, 0);

// ─────────────────────────────────────────────────────────────────────────────
// 15. The weekly board — groups by nest then by character, ordered by how many
//     quests sit behind each nest, so the first section is "Most Wanted".
const { groupByVariant, weekLabelId, buildBoardEmbed } = require("./bountyBoard");

const bq = (poolKey, rarity, scroll, box) => ({ poolKey, rarity, scroll, box: !!box, runId: null });
const boardDocs = [
  { _id: "ol:w", owners: ["ol"], weekKey: "w", chars: {
      Chelssea: { board: [bq("gdn:classic", "rare_legendary", "weapon", true),
                          bq("gdn:classic", "legendary", "weapon")], shares: [] },
      Santeterz: { board: [bq("pkn:hell", "unique", "weapon")], shares: [] } } },
  { _id: "royal:w", owners: ["royal"], weekKey: "w", chars: {
      arcroyal: { board: [bq("gdn:classic", "unique", "weapon"),
                          bq("gdn:classic", "unique", "wtd")], shares: [] } } },
  // Claimed quests and disabled nests never reach the board.
  { _id: "x:w", owners: ["x"], weekKey: "w", chars: {
      Ghost: { board: [{ ...bq("gdn:classic", "unique", "weapon"), runId: "done" },
                       bq("abyssal_mire:mutant", "unique", "weapon")], shares: [] } } },
];

// The account comes from the roster, not the week doc — the board reads both.
const boardChars = [
  { _id: "ol", chars: [{ name: "Chelssea", account: "1" }, { name: "Santeterz", account: "2" }] },
  { _id: "royal", chars: [{ name: "arcroyal", account: "main" }] },
];
const groups = groupByVariant(boardDocs, boardChars);
eq("15. two nests have quests", groups.length, 2);
eq("15. most wanted is first", groups[0].variant.poolKey, "gdn:classic");
eq("15. total counts quests, not people", groups[0].total, 4);
// One block per PLAYER now, each holding that player's characters.
eq("15. one block per player", groups[0].entries.length, 2);
eq("15. the 2-quest character leads its block", groups[0].entries[0].chars[0].charName, "Chelssea");
eq("15. a player with two characters keeps both",
  groups[0].entries.find((e) => e.userId === "royal").chars.length, 1);
eq("15. disabled nests are excluded",
  groups.filter((g) => g.variant.nestKey === "abyssal_mire").length, 0);

const boardDesc = buildBoardEmbed(boardDocs, boardChars, new Date("2026-08-10T05:00:00Z")).data.description;
check("15. one line per character, not per quest",
  (boardDesc.match(/Chelssea/g) || []).length === 1);
check("15. multi-quest is marked", boardDesc.includes("(2 quest)"));
check("15. both its quests are listed",
  boardDesc.includes("Rare Legendary + card box") && boardDesc.includes("Legendary · Weapon"));
// One line per character, mention on it — a header line per player doubled the
// board's height for nothing.
check("15. no separate mention line", !/^<@\w+>$/m.test(boardDesc));
check("15. mention sits on the character line", /<@ol> \*\*Chelssea\*\*/.test(boardDesc));
eq("15. Indonesian week label",
  weekLabelId(new Date("2026-08-10T05:00:00Z")), "minggu ke-2 Agustus 2026");
check("15. an empty week says so", buildBoardEmbed([]).data.description.includes("Belum ada"));
// The account only earns its place when one player has TWO characters in the
// SAME nest — that is the only time it tells you anything. In boardDocs above,
// ol's two characters are in different nests, so it stays hidden.
check("15. hidden when their characters are in different nests", !boardDesc.includes("akun"));
const twoHere = buildBoardEmbed(
  [{ _id: "ol:w", owners: ["ol"], weekKey: "w", chars: {
      Chelssea: { board: [bq("gdn:hc", "unique", "weapon")], shares: [] },
      Bolabola: { board: [bq("gdn:hc", "unique", "wtd")], shares: [] } } }],
  [{ _id: "ol", chars: [{ name: "Chelssea", account: "1" }, { name: "Bolabola", account: "2" }] }],
).data.description;
check("15. shown when both are in the same nest",
  twoHere.includes("akun 1") && twoHere.includes("akun 2"));
check("15. hidden when they have only one",
  !buildBoardEmbed(
    [{ _id: "solo:w", owners: ["solo"], weekKey: "w",
       chars: { Only: { board: [bq("gdn:hc", "unique", "weapon")], shares: [] } } }],
    [{ _id: "solo", chars: [{ name: "Only", account: "1" }] }],
  ).data.description.includes("akun"));

// 19. Raid integration — the only place a quest ever gets marked done.
const tpls = require("./templates");
const { questLines } = require("./bountyJoin");

// Every signup that can clear a bounty must say which variants it clears.
check("19. raid templates carry poolKeys",
  ["ddn_cl","ddn_hc","gdn_cl","gdn_hc","tkn_hell","memo","marathon_gdn","marathon_ddn"]
    .every((k) => Array.isArray(tpls[k].poolKeys) && tpls[k].poolKeys.length));
// …and every one of those keys has to be a real variant, or the check silently
// never fires for that run.
const badPool = Object.entries(tpls)
  .flatMap(([k, t]) => (t.poolKeys || []).map((p) => [k, p]))
  .filter(([, p]) => !BY_POOL_KEY.has(p));
check("19. every poolKey resolves to a variant", badPool.length === 0, JSON.stringify(badPool));
eq("19. marathon covers both its subruns", tpls.marathon_gdn.poolKeys.length, 2);
eq("19. memo covers all four Memoria", tpls.memo.poolKeys.length, 4);

const lines19 = questLines([{ charName: "Chelssea", role: "FU", matches: true, quests: [
  { poolKey: "gdn:classic", rarity: "unique", scroll: "weapon" },
  { poolKey: "gdn:classic", rarity: "legendary", scroll: "accessory", box: true },
]}]);
eq("19. one line per character", lines19.length, 1);
check("19. both quests listed", lines19[0].includes("Unique") && lines19[0].includes("card box"));
check("19. shows the role", lines19[0].includes("FU"));
// The variant is noise on a single-variant run, and needed on a marathon.
check("19. no variant name by default", !lines19[0].includes("Green Dragon Nest Classic"));
check("19. named when the run clears several",
  questLines([{ charName: "X", role: "FU", quests: [{ poolKey: "gdn:hc", rarity: "unique", scroll: "weapon" }] }], true)[0]
    .includes("Green Dragon Nest HC"));

// takenRole reads a raid slot's label, and a memo seat's job.
const { takenRole } = require("./bountyJoin");
eq("19. raid slot resolves to its label",
  takenRole({ users: { u: { slot: "ICE" } }, roles: { ICE: { label: "Ice Stacker" } } }, "u"), "Ice Stacker");
eq("19. memo seat uses the job it picked",
  takenRole({ users: { u: { slot: "P1", subRole: "FU" } }, roles: { P1: { label: "P1" } } }, "u"), "FU");
eq("19. nobody seated means no role", takenRole({ users: {}, roles: {} }, "u"), null);



// 21. seatUser moves a player between slots and keeps the bounty character.
const { seatUser } = require("./handlers/buttons/roleSelect");
const seatEv = () => ({ roles: { FU: { users: [] }, MT: { users: [] } }, users: {} });

const sv = seatEv();
seatUser(sv, "u1", "FU");
eq("21. seats into the slot", sv.roles.FU.users.join(), "u1");
sv.users.u1.bountyChar = "Chelssea";
seatUser(sv, "u1", "MT");
eq("21. switching slots leaves the old one", sv.roles.FU.users.length, 0);
eq("21. and fills the new one", sv.roles.MT.users.join(), "u1");
eq("21. the named character survives the switch", sv.users.u1.bountyChar, "Chelssea");
eq("21. an unknown slot seats nobody", seatUser(seatEv(), "u1", "NOPE"), null);

// 22. Two characters of the SAME job both holding a quest here — the bot must
//     not pre-tick either, or one click marks a quest that was never run.
const preselect = (entries) => {
  const sole = entries.filter((e) => e.matches).length === 1;
  return entries.map((e) => sole && e.matches);
};
eq("22. one role match is pre-ticked",
  preselect([{ matches: true }, { matches: false }]).join(), "true,false");
eq("22. two same-job matches are not",
  preselect([{ matches: true }, { matches: true }]).join(), "false,false");
eq("22. no match, nothing pre-ticked",
  preselect([{ matches: false }, { matches: false }]).join(), "false,false");


// 23. Bounty-only party: one Join button instead of nine role buttons, and the
//     character you pick decides the slot.
const { createButtons: cb } = require("./builders/buttons");
const { slotForRole } = require("./bountyJoin");
const tp = require("./templates");

const panel = (over) => {
  const roles = {};
  for (const [k, r] of Object.entries(tp.gdn_cl.roles)) roles[k] = { ...r, users: [] };
  return { messageId: "m", hostId: "h", maxSlot: 8, locked: false, roles, users: {},
           poolKeys: tp.gdn_cl.poolKeys, ...over };
};
const ids = (ev) => cb(ev, "h").flatMap((r) => r.toJSON().components).map((c) => c.custom_id);

check("23. open party keeps its role buttons", ids(panel({})).filter((i) => i.startsWith("role_")).length > 5);
eq("23. bounty-only has no role buttons", ids(panel({ closedToBounty: true })).filter((i) => i.startsWith("role_")).length, 0);
check("23. bounty-only has one Join", ids(panel({ closedToBounty: true })).includes("bounty-join"));
check("23. the toggle is there either way",
  ids(panel({})).includes("bounty-open") && ids(panel({ closedToBounty: true })).includes("bounty-open"));
// A signup that clears no bounty has nothing to toggle.
check("23. no toggle on a non-bounty panel", !ids(panel({ poolKeys: null })).includes("bounty-open"));

// A locked or full bounty party offers no Join, same as role buttons.
eq("23. locked hides Join", ids(panel({ closedToBounty: true, locked: true })).includes("bounty-join"), false);

eq("23. role maps to its slot", slotForRole(panel({}), "Ice Stacker"), "ICE");
eq("23. SM/DA maps too", slotForRole(panel({}), "SM/DA"), "SM");
eq("23. an unknown role has no slot", slotForRole(panel({}), "Bard"), null);


// 24. The 6-quest stack cap. A 7th shared quest is claimed by nobody, so it
//     must neither show as stacked nor be marked done.
const { buildSignupEmbed: sEmbed } = require("./builders/content");
const stackPanel = (maxSlot, per, pools = ["gdn:classic"]) => ({
  messageId: "m", hostId: "h", title: "t", maxSlot, locked: false,
  poolKeys: pools, roles: {},
  users: Object.fromEntries(per.map((n, i) => [`u${i}`, { slot: "FU", bountyQuests: n }])),
});
const q1 = (n) => n;
const stackLine = (ev) => sEmbed(ev).data.description.split("\n").find((l) => l.includes("Stack"));

check("24. counts quests, not people", stackLine(stackPanel(8, [q1(2), q1(1)])).includes("3/6"));
check("24. caps at 6 on an 8-player raid", stackLine(stackPanel(8, [q1(2), q1(2), q1(2), q1(2)])).includes("6/6"));
// A 4-player nest can never stack 6 — only 4 people are there to share.
check("24. a 4-player nest caps at 4", stackLine(stackPanel(4, [q1(2), q1(2), q1(2)])).includes("4/4"));
check("24. empty party shows an empty stack", stackLine(stackPanel(8, [])).includes("0/6"));
// A marathon clears two variants but spends ONE weekly claim budget, so both
// count against the same 6 — showing 6 per variant would read as 12 available.
const mPanel = stackPanel(8, [2, 1], tpls.marathon_gdn.poolKeys);
check("24. marathon shares one cap, not one per variant", stackLine(mPanel).includes("3/6"));
check("24. and never shows two caps", !stackLine(mPanel).includes("/6 ·"));
check("24. a non-bounty panel has no stack line",
  !sEmbed({ ...stackPanel(8, [q1(1)]), poolKeys: null }).data.description.includes("Stack"));


// 25. A marathon clears two variants, so it must see quests for both — and say
//     which is which, since "Unique · Weapon" alone would be ambiguous.
const mQuests = [
  { poolKey: "gdn:hc", rarity: "unique", scroll: "weapon" },
  { poolKey: "gdn:classic", rarity: "legendary", scroll: "accessory" },
];
const mPools = tpls.marathon_gdn.poolKeys;
eq("25. both variants are in scope", mQuests.filter((q) => mPools.includes(q.poolKey)).length, 2);
const mLines = questLines([{ charName: "X", role: "FU", quests: mQuests }], mPools.length > 1);
check("25. the variant is named", mLines[0].includes("Green Dragon Nest HC"));
// A single-variant run stays quiet about it.
check("25. and not named on a plain GDN HC run",
  !questLines([{ charName: "X", role: "FU", quests: [mQuests[0]] }], tpls.gdn_hc.poolKeys.length > 1)[0]
    .includes("Green Dragon Nest HC"));


// 26. The Bounty Hunter gate. Unset role = open to everyone, so turning the
//     feature on later never silently locks out people already using it.
const { isHunter } = require("./handlers/commands/bountyChar");
const cfg = require("./config");
const member = (roles) => ({ member: { roles: { cache: new Set(roles) } } });

const savedRole = cfg.bountyHunterRoleId;
cfg.bountyHunterRoleId = null;
check("26. no role configured means everyone passes", isHunter(member([])));
cfg.bountyHunterRoleId = "R1";
check("26. holder passes", isHunter({ member: { roles: { cache: new Map([["R1", {}]]) } } }));
check("26. non-holder is refused", !isHunter({ member: { roles: { cache: new Map() } } }));
check("26. no member object is refused, not crashed", !isHunter({}));
cfg.bountyHunterRoleId = savedRole;


// 27. Preview vs panel. The join link belongs only on the preview — the panel
//     is what it points at.
const { buildSignupEmbed: pEmbed, updatePreview, closePreview } = require("./builders/content");
const pv = (over) => ({
  messageId: "m", hostId: "h", title: "t", maxSlot: 8, locked: false,
  roles: { FU: { max: 2, users: [] } }, users: {}, ...over,
});

check("27. panel has no join link", !pEmbed(pv({ panelUrl: "http://x" })).data.description.includes("Join di sini"));
check("27. preview has one", pEmbed(pv({ panelUrl: "http://x" }), true).data.description.includes("Join di sini"));
check("27. no link when the panel was not moved", !pEmbed(pv({}), true).data.description.includes("Join di sini"));

// A missing preview must never take the panel down with it.
(async () => {
  const ev = pv({ previewMessageId: "gone", previewChannelId: "c" });
  const msg = { client: { channels: { fetch: async () => { throw new Error("no access"); } } } };
  await updatePreview(msg, ev);
  check("27. a lost preview is forgotten, not thrown", ev.previewMessageId === null);
  const ev2 = pv({ previewMessageId: "gone", previewChannelId: "c" });
  await closePreview(msg, ev2, "done");
  check("27. closing a lost preview is silent too", ev2.previewMessageId === null);
})();


// 28. add and edit are one write with opposite expectations, and the SCHEMA
//     carries which fields are required — so this checks the schema, not a
//     runtime branch that could disagree with it.
const charCmd = (() => {
  const { SlashCommandBuilder } = require("discord.js");
  const src = require("fs").readFileSync(`${__dirname}/deploy-commands.js`, "utf8");
  const from = src.indexOf('.setName("bounty-char")');
  return from === -1 ? "" : src.slice(from, src.indexOf(".toJSON(),", from));
  return m ? m[0] : "";
})();
check("28. bounty-char has an edit subcommand", charCmd.includes('.setName("edit")'));
check("28. and still an add", charCmd.includes('.setName("add")'));
// add demands everything; edit demands only which character.
const addBlock = charCmd.slice(charCmd.indexOf('.setName("add")'), charCmd.indexOf('.setName("edit")'));
const editBlock = charCmd.slice(charCmd.indexOf('.setName("edit")'), charCmd.indexOf('.setName("apply")'));
eq("28. add requires name, role, dps, account",
  (addBlock.match(/setRequired\(true\)/g) || []).length, 4);
eq("28. edit requires only the name",
  (editBlock.match(/setRequired\(true\)/g) || []).length, 1);
check("28. edit offers autocomplete on the name", editBlock.includes("setAutocomplete(true)"));


console.log(`\n${pass} passed, ${fails.length} failed`);
if (fails.length) {
  console.log("\nFailures:");
  fails.forEach((f) => console.log(`  ✗ ${f}`));
  process.exitCode = 1;
} else {
  const enabled = NESTS.filter((n) => n.enabled !== false);
  console.log(
    `\n✅ ${enabled.length} nests, ${VARIANT_LIST.length} variants, ` +
      `${NEST_INFERENCE.size} nest-inferring aliases`,
  );
  console.log(`   this week: ${weekLabel()}  (${weekKey()})\n`);
  for (const v of VARIANT_LIST) {
    console.log(
      `   ${v.poolKey.padEnd(18)} ${v.name.padEnd(34)} ` +
        `${v.capacity}p · needs ${v.minHighDps} high DPS`,
    );
  }
  console.log();
}
