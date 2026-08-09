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
// Async checks must be awaited before the summary prints, or they run after it
// and their results are silently dropped — a test that cannot fail.
const pending = [];
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
  "DDN Memoria 1 — Unique · Weapon");
eq("3e. card box shows in the label",
  questLabel({ poolKey: "gdn:hc", rarity: "legendary", scroll: "accessory", box: true }),
  "GDN HC — Legendary + card box · Accessory");

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
const { groupByVariant, weekLabelId, buildBoardEmbeds } = require("./bountyBoard");
// The board is a message of embeds now; these checks read them as one blob.
const boardText = (...a) => buildBoardEmbeds(...a).map((e) => e.data.description).join("\n");

const bq = (poolKey, rarity, scroll, box) => ({ poolKey, rarity, scroll, box: !!box, runId: null });
const boardDocs = [
  { _id: "ol:w", owners: ["ol"], weekKey: "w", chars: {
      Chelssea: { board: [bq("sdn:classic", "rare_legendary", "weapon", true),
                          bq("sdn:classic", "legendary", "weapon")], shares: [] },
      Santeterz: { board: [bq("pkn:hell", "unique", "weapon")], shares: [] } } },
  { _id: "royal:w", owners: ["royal"], weekKey: "w", chars: {
      arcroyal: { board: [bq("sdn:classic", "unique", "weapon"),
                          bq("sdn:classic", "unique", "wtd")], shares: [] } } },
  // Claimed quests and disabled nests never reach the board.
  { _id: "x:w", owners: ["x"], weekKey: "w", chars: {
      Ghost: { board: [{ ...bq("sdn:classic", "unique", "weapon"), runId: "done" },
                       bq("abyssal_mire:mutant", "unique", "weapon")], shares: [] } } },
];

// The account comes from the roster, not the week doc — the board reads both.
const boardChars = [
  { _id: "ol", chars: [{ name: "Chelssea", account: "1" }, { name: "Santeterz", account: "2" }] },
  { _id: "royal", chars: [{ name: "arcroyal", account: "main" }] },
];
const groups = groupByVariant(boardDocs, boardChars);
eq("15. two nests have quests", groups.length, 2);
eq("15. most wanted is first", groups[0].variant.poolKey, "sdn:classic");
eq("15. total counts quests, not people", groups[0].total, 4);
// One block per PLAYER now, each holding that player's characters.
eq("15. one block per player", groups[0].entries.length, 2);
eq("15. the 2-quest character leads its block", groups[0].entries[0].chars[0].charName, "Chelssea");
eq("15. a player with two characters keeps both",
  groups[0].entries.find((e) => e.userId === "royal").chars.length, 1);
eq("15. disabled nests are excluded",
  groups.filter((g) => g.variant.nestKey === "abyssal_mire").length, 0);

const boardDesc = boardText(boardDocs, boardChars, new Date("2026-08-10T05:00:00Z"));
// The nest listing gives a character ONE line however many quests they hold.
// (The Marathon GDN summary above it names GDN holders a second time on
// purpose — it is a summary of the two sections below it.)
check("15. one line per character, not per quest",
  (boardDesc.match(/\*\*Chelssea\*\* \(2 quest\)/g) || []).length === 1);
check("15. multi-quest is marked", boardDesc.includes("(2 quest)"));
check("15. both its quests are listed",
  boardDesc.includes("Rare Legendary + card box") && boardDesc.includes("Legendary · Weapon"));
// One line per character, mention on it — a header line per player doubled the
// board's height for nothing.
check("15. no separate mention line", !/^<@\w+>$/m.test(boardDesc));
check("15. mention sits on the character line", /<@ol> \*\*Chelssea\*\*/.test(boardDesc));
eq("15. Indonesian week label",
  weekLabelId(new Date("2026-08-10T05:00:00Z")), "minggu ke-2 Agustus 2026");
check("15. an empty week says so", boardText([]).includes("Belum ada"));
// The account only earns its place when one player has TWO characters in the
// SAME nest — that is the only time it tells you anything. In boardDocs above,
// ol's two characters are in different nests, so it stays hidden.
check("15. hidden when their characters are in different nests", !boardDesc.includes("akun"));
const twoHere = boardText(
  [{ _id: "ol:w", owners: ["ol"], weekKey: "w", chars: {
      Chelssea: { board: [bq("sdn:hc", "unique", "weapon")], shares: [] },
      Bolabola: { board: [bq("sdn:hc", "unique", "wtd")], shares: [] } } }],
  [{ _id: "ol", chars: [{ name: "Chelssea", account: "1" }, { name: "Bolabola", account: "2" }] }],
);
// A letter, never the account name: the reader only asks whether these two can
// go at once, and that needs nobody publishing what they called their account.
check("15. shown when both are in the same nest",
  twoHere.includes("akun A") && twoHere.includes("akun B"));
check("15. and the real account name never reaches the board", !/akun [12]/.test(twoHere));
check("15. hidden when they have only one",
  !boardText(
    [{ _id: "solo:w", owners: ["solo"], weekKey: "w",
       chars: { Only: { board: [bq("sdn:hc", "unique", "weapon")], shares: [] } } }],
    [{ _id: "solo", chars: [{ name: "Only", account: "1" }] }],
  ).includes("akun"));

// 15c. Marathon GDN gets a one-line summary ABOVE the GDN sections, never
//      instead of them. Merging the two cost what the board is for: "GDN HC — 3"
//      answers "who else has HC" at a glance, and a merged list makes you filter
//      by eye. The duplication merging was meant to fix is gone anyway, because
//      a summary carries no mentions, roles or rewards to repeat.
const gdnWeek = [
  { _id: "ol:w", owners: ["ol"], weekKey: "w", chars: {
      Chelssea: { board: [bq("gdn:hc", "unique", "weapon"), bq("gdn:classic", "legendary", "armor")], shares: [] },
      Bolabola: { board: [bq("gdn:classic", "unique", "wtd")], shares: [] } } },
];
const gdnChars = [{ _id: "ol", chars: [{ name: "Chelssea", role: "FU", account: "1" }] }];
const gdnText = boardText(gdnWeek, gdnChars);

check("15c. the summary appears", gdnText.includes("Marathon GDN"));
check("15c. with the total across both clears", gdnText.includes("3 bounty quest"));
// The split is the whole point: HC 0 means a marathon is not on this week.
check("15c. and the split per clear", gdnText.includes("HC 1") && gdnText.includes("Classic 2"));
// One row per character, the role lined up in a padded code span, and the clear
// each bounty belongs to — a marathon is two runs, and "HC" or "Classic" is what
// says which one someone is being asked to show up for.
const mRows = gdnText.split("\n").slice(1, 3);
eq("15c. one row per character, sorted",
  mRows[0], "`Bolabola` - ? (bounty Classic · Unique · W/T/D)");
eq("15c. two quests on one character stay on one row",
  mRows[1], "`Chelssea` - FU (bounty HC · Unique · Weapon | Classic · Legendary · Armor)");
// Mentions belong to the sections below; this block is about characters.
check("15c. no mention in the block", !mRows.join("").includes("<@"));

// The sections survive, which is what the merge got wrong.
check("15c. GDN HC keeps its own section", /\*\*GDN HC\*\* — 1/.test(gdnText));
check("15c. GDN Classic too", /\*\*GDN Classic\*\* — 2/.test(gdnText));

// Nests are named the way people type them.
check("15. nest headings are short",
  boardDesc.includes("**SDN Classic**") && !boardDesc.includes("Sea Dragon Nest Classic"));

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
// seat.bountyQuests holds the quests themselves, so the panel can name them.
const q1 = (n) => Array.from({ length: n }, () => ({ poolKey: "gdn:classic", rarity: "unique", scroll: "weapon" }));
const stackLine = (ev) => sEmbed(ev).data.description.split("\n").find((l) => l.includes("Stack"));

check("24. counts quests, not people", stackLine(stackPanel(8, [q1(2), q1(1)])).includes("3/6"));
check("24. caps at 6 on an 8-player raid", stackLine(stackPanel(8, [q1(2), q1(2), q1(2), q1(2)])).includes("6/6"));
// A 4-player nest can never stack 6 — only 4 people are there to share.
check("24. a 4-player nest caps at 4", stackLine(stackPanel(4, [q1(2), q1(2), q1(2)])).includes("4/4"));
check("24. empty party shows an empty stack", stackLine(stackPanel(8, [])).includes("0/6"));
// The panel names what is in the stack — "what do I get for joining" should not
// need a second command.
const named = sEmbed({
  ...stackPanel(8, []),
  users: { u1: { slot: "FU", bountyChar: "Chelssea", bountyQuests: q1(2) } },
}).data.description;
check("24. the holder is named", named.includes("Chelssea"));
check("24. and both their quests listed", (named.match(/Unique · Weapon/g) || []).length === 2);
check("24. seats with nothing stacked are not listed",
  !sEmbed({ ...stackPanel(8, []), users: { u1: { slot: "FU", bountyChar: "Kosong", bountyQuests: [] } } })
    .data.description.includes("Kosong"));
// A marathon clears two variants but spends ONE weekly claim budget, so both
// count against the same 6 — showing 6 per variant would read as 12 available.
const mPanel = stackPanel(8, [q1(2), q1(1)], tpls.marathon_gdn.poolKeys);
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
pending.push((async () => {
  const ev = pv({ previewMessageId: "gone", previewChannelId: "c" });
  const msg = { client: { channels: { fetch: async () => { throw new Error("no access"); } } } };
  await updatePreview(msg, ev);
  check("27. a lost preview is forgotten, not thrown", ev.previewMessageId === null);
  const ev2 = pv({ previewMessageId: "gone", previewChannelId: "c" });
  await closePreview(msg, ev2, "done");
  check("27. closing a lost preview is silent too", ev2.previewMessageId === null);
})());


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


// 29. The bounty toggle flips BOTH flags. Flipping only closedToBounty left a
//     panel half-converted: no role buttons, but the per-role caps still on.
const { handleToggleBounty } = require("./bountyJoin");
const togglePanel = () => {
  const roles = {};
  for (const [k, r] of Object.entries(tpls.gdn_cl.roles)) roles[k] = { ...r, users: [] };
  return { messageId: "m", hostId: "h", maxSlot: 8, locked: false, roles, users: {},
           poolKeys: tpls.gdn_cl.poolKeys };
};
const noop = { message: { edit: async () => {} } };

pending.push((async () => {
  const ev = togglePanel();
  await handleToggleBounty(noop, ev);
  check("29. toggling on sets both", ev.closedToBounty === true && ev.stackRoles === true);
  await handleToggleBounty(noop, ev);
  check("29. toggling off clears both", ev.closedToBounty === false && ev.stackRoles === false);
})());


// 30. What fitToStack WRITES is what the panel READS. It once returned a count
//     while the panel expected the quests: `5?.length` is undefined, so the
//     seat was filtered out and a full stack rendered as "Stack 0/6" with the
//     joiner told they were "numpang". Both sides are checked against one
//     value here, because either alone passes while the pair is broken.
const { fitToStack } = require("./bountyJoin");
const { buildSignupEmbed } = require("./builders/content");

const q30 = (poolKey, rarity) => ({ poolKey, rarity, scroll: "wep" });
const marathon = () => {
  const roles = {};
  for (const [k, r] of Object.entries(tpls.gdn_cl.roles)) roles[k] = { ...r, users: [] };
  return { messageId: "m", hostId: "h", maxSlot: 8, locked: false, roles, users: {},
           poolKeys: ["gdn:hc", "gdn:classic"], closedToBounty: true, stackRoles: true };
};

const ev30 = marathon();
const fitted = fitToStack(ev30, [q30("gdn:hc", "unique"), q30("gdn:classic", "legendary")]);
check("30. fitToStack returns the quests, not a count", Array.isArray(fitted));
eq("30. both fit under the cap", fitted.length, 2);

ev30.users.u1 = { slot: "ACRO", bountyChar: "ChelseaQT", bountyQuests: fitted };
const d30 = buildSignupEmbed(ev30).data.description;
check("30. the panel counts them", d30.includes("Stack 2/6"));
check("30. and names the holder", d30.includes("ChelseaQT"));

// The cap is one budget for the whole run, so a second seat fills what is left.
ev30.users.u2 = { slot: "FU", bountyChar: "Bolabola",
                  bountyQuests: fitToStack(ev30, Array.from({ length: 6 }, () => q30("gdn:hc", "unique"))) };
eq("30. the cap is shared, not per variant", ev30.users.u2.bountyQuests.length, 4);
check("30. and the panel stops at 6", buildSignupEmbed(ev30).data.description.includes("Stack 6/6"));


// 31. The writes take their values as an argument, so a modal or a select can
//     drive them. The fake interaction below has NO `options` property at all —
//     if either function still reaches for a slash option it throws rather than
//     quietly reading undefined, which is the whole point of checking it here.
const { saveChar, removeChar } = require("./handlers/commands/bountyChar");
const fakeInt = () => {
  const seen = {};
  return { seen, user: { id: "test-user" }, reply: async (o) => { seen.content = o.content; } };
};

pending.push((async () => {
  const empty = fakeInt();
  await saveChar(empty, false, { name: "  ", role: "Acro", dpsTier: "a", account: "1" });
  check("31. saveChar validates the name it was handed", empty.seen.content.includes("tidak boleh kosong"));

  // Mongo is not connected here, so a valid write lands on the storage guard —
  // reaching it at all proves the supplied values passed every check above it.
  const good = fakeInt();
  await saveChar(good, false, { name: "ChelseaQT", role: "Acro", dpsTier: "a", account: "1" });
  check("31. saveChar reads values, not options", good.seen.content.includes("Database tidak tersambung"));

  const rm = fakeInt();
  await removeChar(rm, "ChelseaQT");
  check("31. removeChar reads the name it was handed", rm.seen.content.includes("ChelseaQT"));
})());


// 32. The quest modal carries its own character picker. That is what lets a
//     button open it — a slash option cannot be reached from a button, which is
//     why the option, its autocomplete and the follow-up select all went away.
const { buildQuestModal, MODAL_PREFIX } = require("./handlers/commands/bountyQuest");
const roster = (n) =>
  Array.from({ length: n }, (_, i) => ({ name: `Char${i}`, role: "FU", dpsTier: "high" }));

const m32 = buildQuestModal(roster(2)).toJSON();
eq("32. the fields",
  m32.components.map((c) => c.component.custom_id).join(","), "char,pool,rarity,scroll,lines");
eq("32. exactly Discord's five", m32.components.length, 5);
// Only the character is compulsory: the dropdowns cover one quest and the box
// covers the rest, and someone fluent uses only the box.
eq("32. only the character is required",
  m32.components.filter((c) => c.component.required !== false).map((c) => c.component.custom_id).join(","),
  "char");
// Card box folded into rarity is what frees the fifth slot for the text field.
eq("32. rarity carries the card box", m32.components[2].component.options.length, 6);
check("32. as its own option",
  m32.components[2].component.options.some((o) => o.label === "Legendary + card box"));
// A select takes 25 options. Enabling a nest that pushes past it would silently
// drop dungeons off the end of the list rather than fail.
check("32. every dungeon fits in one select", VARIANT_LIST.length <= 25, `${VARIANT_LIST.length} variants`);
eq("32. and they are all offered", m32.components[1].component.options.length, VARIANT_LIST.length);

// No name in the customId — that is what ended the "names may contain ':'"
// parsing, so a character called "a:b" can no longer confuse the handler.
eq("32. append mode carries only the mode", m32.custom_id, `${MODAL_PREFIX}a`);
eq("32. replace mode too", buildQuestModal(roster(1), true).toJSON().custom_id, `${MODAL_PREFIX}r`);

// Discord rejects a select with more than 25 options, and MAX_CHARS is 40 — so
// a big roster has to be clamped here or the modal fails to open at all.
eq("32. an oversized roster is clamped", buildQuestModal(roster(40)).toJSON().components[0].component.options.length, 25);
check("32. labels fit Discord's 45 chars", m32.components.every((c) => c.label.length <= 45));


// 33. The panel. Mongo is not connected here, so every roster reads empty —
//     which is exactly the state worth pinning, because it is the one where a
//     button that looks pressable would open a select with zero options and
//     throw.
const { buildPanel, handlePanelButton, PREFIX } = require("./bountyPanel");

const panelInt = (action, ownerId, clickerId = ownerId) => {
  const seen = {};
  return {
    seen,
    customId: `${PREFIX}${action}:${ownerId}`,
    user: { id: clickerId },
    reply: async (o) => { seen.reply = o.content; },
    update: async (o) => { seen.update = o; },
    showModal: async (m) => { seen.modal = m.toJSON(); },
  };
};

pending.push((async () => {
  const empty = await buildPanel("u1");
  const desc = (p) => p.embeds[0].data.description;
  check("33. an empty roster still renders", desc(empty).includes("Belum ada karakter"));
  check("33. and never pings the owner it names", empty.allowedMentions.parse.length === 0);

  const rows = empty.components.map((r) => r.toJSON().components).flat();
  // The link row is only there when something can be decided, so the count is
  // not the invariant — the actions are.
  eq("33. the actions on offer",
    rows.map((b) => b.custom_id.split(":").slice(1, -1).join(":")).join(","),
    "add,edit,remove,quest,replace,refresh,link");
  check("33. every button carries its owner", rows.every((b) => b.custom_id.endsWith(":u1")));
  // Add and refresh are the only two that can do anything without a character.
  eq("33. the rest are disabled while the roster is empty",
    rows.filter((b) => !b.disabled).map((b) => b.custom_id.split(":")[1]).sort().join(","),
    "add,link,refresh");

  // The guard is the whole reason moderators being able to see these threads is
  // harmless: they can read the panel, but a press writes nothing.
  const stranger = panelInt("add", "u1", "moderator");
  await handlePanelButton(stranger);
  check("33. a stranger's press is refused", /panel orang lain/.test(stranger.seen.reply || ""));
  check("33. and opens no modal", !stranger.seen.modal);

  const add = panelInt("add", "u1");
  await handlePanelButton(add);
  eq("33. add opens a modal, no command typed",
    add.seen.modal.components.map((c) => c.component.custom_id).join(","), "name,role,dps,accountNew");

  // Guarding on the click is not enough: a panel drawn before the last
  // character was deleted still has these buttons live.
  const edit = panelInt("edit", "u1");
  await handlePanelButton(edit);
  check("33. edit on an empty roster refuses instead of throwing", !!edit.seen.reply && !edit.seen.modal);

  const refresh = panelInt("refresh", "u1");
  await handlePanelButton(refresh);
  check("33. refresh redraws in place", !!refresh.seen.update?.embeds?.length);

  // 15 characters with quests overflows a 2000-char message, and a silently
  // dropped character is the whole failure this embed exists to prevent.
  check("33. the description has room for a full roster", desc(empty).length < 4096);
})());


// 34. The panel's buttons have to survive the ROUTER, not just the handler.
//     index.js answers "this panel is no longer active" for any button whose
//     message is not an activeEvents entry, and a bounty panel never is — so a
//     missing prefix made every button on it dead while the handler underneath
//     was perfectly correct. Checking the handler alone would have passed.
const { EVENT_FREE } = require("./handlers/buttons");
const routerLetsThrough = (customId) => EVENT_FREE.some((p) => customId.startsWith(p));

pending.push((async () => {
  const ids = (await buildPanel("u1")).components
    .flatMap((r) => r.toJSON().components)
    .map((b) => b.custom_id);

  check("34. the panel has buttons to check", ids.length >= 6, `${ids.length}`);
  check("34. every one of them reaches its handler", ids.every(routerLetsThrough), ids.find((i) => !routerLetsThrough(i)));
  // The event-scoped default is what protects the raid panels, so it has to
  // still say no to everything else.
  check("34. and a raid button is still event-scoped", !routerLetsThrough("role_FU"));
})());


// 35. The account field. Requiring it blocked adding a character over a detail
//     that means nothing yet: an account only tells characters apart once there
//     are two of them. And free text is where the typo lives — "chelssea" and
//     "Chelsea" are two accounts to the bot, which then believes those two
//     characters can run at the same time.
const { addModal, editModal } = require("./bountyPanel");
const fieldIds = (m) => m.toJSON().components.map((c) => c.component.custom_id);
const optional = (m) =>
  m.toJSON().components.filter((c) => c.component.required === false).map((c) => c.component.custom_id);

const noAcc = [{ name: "A", role: "FU", dpsTier: "high" }];
const twoAcc = [
  { name: "A", role: "FU", dpsTier: "high", account: "1" },
  { name: "B", role: "Healer", dpsTier: "low", account: "2" },
  { name: "C", role: "FU", dpsTier: "high", account: "1" },
];

eq("35. with no account yet there is nothing to pick from", fieldIds(addModal("u", noAcc)).join(","), "name,role,dps,accountNew");
eq("35. once accounts exist they become a list", fieldIds(addModal("u", twoAcc)).join(","), "name,role,dps,account,accountNew");
eq("35. and the list is deduped", addModal("u", twoAcc).toJSON().components[3].component.options.length, 2);

// A required select with zero options is unopenable, so "no accounts yet" has
// to mean no select at all rather than an empty one.
check("35. neither account field is ever required",
  ["account", "accountNew"].every((f) => !fieldIds(addModal("u", twoAcc)).includes(f) || optional(addModal("u", twoAcc)).includes(f)));
check("35. same on edit", ["account", "accountNew"].every((f) => optional(editModal("u", twoAcc)).includes(f)));

// Discord caps a modal at 5 fields and the builder does NOT enforce it — it
// would be accepted here and rejected at showModal, where only the user sees it.
check("35. every modal stays within 5 fields",
  [addModal("u", noAcc), addModal("u", twoAcc), editModal("u", twoAcc)].every(
    (m) => m.toJSON().components.length <= 5));


// 36. The thread that hosts the panel. Everything here fails silently in
//     production if it is wrong: a stale panel still renders, an archived
//     thread still opens, and a forgotten router prefix still shows buttons.
const { wake, liveThread, refreshThread, NEW } = require("./bountyThread");
const { bountyThreads } = require("./state");

check("36. the entry button reaches its handler", routerLetsThrough(NEW), NEW);

const fakeThread = (over = {}) => {
  const t = { archived: false, setArchived: async (v) => { t.archived = v; t.woken = true; }, isThread: () => true };
  return Object.assign(t, over);
};

pending.push((async () => {
  // A button click does not wake an archived thread by itself, and the edit
  // that follows would fail — leaving a panel that looks fine and will not
  // change.
  const sleeping = fakeThread({ archived: true });
  await wake(sleeping);
  check("36. an archived thread is opened before writing", sleeping.archived === false);

  const awake = fakeThread();
  await wake(awake);
  check("36. an open one is left alone", !awake.woken);
  await wake(undefined); // the panel also lives in ephemeral replies, which have no thread
  check("36. and a non-thread channel is not an error", true);

  // A thread deleted by hand must be forgotten, not retried forever.
  bountyThreads["gone"] = { threadId: "t1", messageId: "m1" };
  const dead = { channels: { fetch: async () => { throw new Error("Unknown Channel"); } } };
  eq("36. a deleted thread resolves to nothing", await liveThread(dead, "gone"), null);
  check("36. and is dropped from state", !bountyThreads["gone"]);

  // The interaction already redrew this message; doing it again is a wasted
  // edit on the message the user is looking at.
  bountyThreads["skip"] = { threadId: "t2", messageId: "m2" };
  let touched = false;
  const watcher = { channels: { fetch: async () => { touched = true; return null; } } };
  await refreshThread(watcher, "skip", "m2");
  check("36. refreshing skips the message just updated", !touched);
  await refreshThread(watcher, "nobody");
  check("36. and does nothing for someone with no thread", !touched);
  delete bountyThreads["skip"];
})());


// 37. The Thursday reminder. Its whole risk is claiming to know more than it
//     does: the bot only learns a quest is done when a run closes through the
//     signup panel, so anyone who cleared with a party formed in chat is still
//     listed. The wording has to survive that, every single week37.
const { buildReminder, isReminderWindow, nextReset, holders } = require("./bountyReminder");

const rq = (rarity, runId = null) => ({ poolKey: "gdn:hc", rarity, scroll: "weapon", box: false, runId });
const week37 = [
  { _id: "ol:w", owners: ["ol"], chars: { A: { board: [rq("unique"), rq("legendary"), rq("unique", "done")] } } },
  { _id: "azka:w", owners: ["azka"], chars: { B: { board: [rq("rare_legendary")] }, C: { board: [rq("unique")] } } },
  { _id: "quiet:w", owners: ["quiet"], chars: { D: { board: [rq("unique", "done")] } } },
];

const txt = buildReminder(week37, new Date("2026-08-06T13:00:00Z")); // Thursday 20:00 WIB
check("37. the out is always offered", txt.includes("Leave it alone"));
check("37. it never claims they have not cleared", !/(^|[^ ])Not cleared/.test(txt));
check("37. it says what it actually knows", txt.includes("Not recorded as cleared"));
eq("37. claimed quests are not counted", holders(week37).find((h) => h.userId === "ol").n, 2);
check("37. and someone with nothing left is not named", !txt.includes("quiet"));
check("37. the busiest person comes first", txt.indexOf("<@ol>") < txt.indexOf("<@azka>"));
eq("37. it counts down to the reset", txt.includes("2 days left"), true);

// Nothing to nag about means no message at all — a weekly "0 quest" post is how
// a reminder becomes background noise.
eq("37. an empty week37 posts nothing", buildReminder([]), null);
eq("37. so does a week37 where everything is claimed",
  buildReminder([{ _id: "x:w", owners: ["x"], chars: { A: { board: [rq("unique", "done")] } } }]), null);

// The window is a fixed +7 offset, so it must land on Thursday 20:00 WIB and
// nowhere else — an hour either side would fire on the wrong day of the week37.
check("37. fires Thursday 20:00 WIB", isReminderWindow(Date.parse("2026-08-06T13:00:00Z")));
check("37. not an hour early", !isReminderWindow(Date.parse("2026-08-06T12:00:00Z")));
check("37. not on Friday", !isReminderWindow(Date.parse("2026-08-07T13:00:00Z")));

const reset = nextReset(new Date("2026-08-06T13:00:00Z"));
const wib = new Date(reset.getTime() + 7 * 60 * 60 * 1000);
check("37. the reset it counts to is a Saturday", wib.getUTCDay() === 6);
eq("37. at 08:00 WIB", wib.getUTCHours(), 8);
// On reset morning the answer is the NEXT one, not the one happening now.
check("37. reset day rolls to the following Saturday",
  nextReset(new Date("2026-08-08T02:00:00Z")) > new Date("2026-08-08T02:00:00Z"));


// 38. The pinned entry message is EDITED on boot, not merely checked. Its text
//     lives in bountyThread.js, so a wording change that never reaches the
//     message already pinned leaves the file and the channel disagreeing with
//     nobody the wiser — the failure is invisible from the code side.
const { syncEntry } = require("./bountyThread");
const { bountyEntry } = require("./state");
const cfg38 = require("./config");

pending.push((async () => {
  const edits = [];
  const sends = [];
  const client = (existing) => ({
    channels: {
      fetch: async () => ({
        messages: { fetch: async () => existing },
        send: async (p) => {
          sends.push(p);
          return { id: "new", pin: async () => {} };
        },
      }),
    },
  });

  const was = cfg38.bountyMeChannelId;
  cfg38.bountyMeChannelId = "chan";

  bountyEntry.messageId = "m1";
  await syncEntry(client({ edit: async (p) => edits.push(p) }));
  eq("38. an existing message is rewritten", edits.length, 1);
  check("38. with the current text", edits[0].content.includes("stays in your sidebar"));
  check("38. and the current button",
    edits[0].components[0].toJSON().components[0].label.includes("Create My Thread"));
  eq("38. and nothing is posted twice", sends.length, 0);

  // Deleted by hand → post a fresh one rather than editing nothing forever.
  bountyEntry.messageId = "gone";
  await syncEntry(client(null));
  eq("38. a deleted message is replaced", sends.length, 1);

  cfg38.bountyMeChannelId = was;
  delete bountyEntry.messageId;
})());


// 39. The three dropdowns are ONE quest between them. A dungeon with no rarity
//     is not half a quest, it is an unanswerable one — and saving it would put a
//     quest on someone's board that pays nothing and can never be matched.
const { handleBountyQuestModal } = require("./handlers/modals/bountyQuest");

const questModalInt = (picks, lines = "") => {
  const seen = {};
  return {
    seen,
    customId: `${MODAL_PREFIX}a`,
    user: { id: "u39" },
    client: {},
    isFromMessage: () => false,
    fields: {
      getStringSelectValues: (id) => (id === "char" ? ["Chelssea"] : picks[id] ? [picks[id]] : []),
      getTextInputValue: () => lines,
    },
    reply: async (o) => { seen.reply = o.content; },
  };
};

pending.push((async () => {
  const half = questModalInt({ pool: "gdn:hc" });
  await handleBountyQuestModal(half);
  check("39. a dungeon alone is refused", /Kurang/.test(half.seen.reply || ""));
  check("39. naming what is missing",
    half.seen.reply.includes("Rarity") && half.seen.reply.includes("Scroll"));

  const noScroll = questModalInt({ pool: "gdn:hc", rarity: "legendary" });
  await handleBountyQuestModal(noScroll);
  check("39. two of three is still refused", /Kurang/.test(noScroll.seen.reply || ""));
  check("39. and only the missing one is named",
    noScroll.seen.reply.includes("Scroll") && !noScroll.seen.reply.includes("Rarity"));

  // All three, or none at all — typing alone has to keep working untouched.
  // Mongo is not connected here, so an accepted quest lands on the storage
  // guard — and reaching that guard is itself the proof, since only a quest
  // that made it into the save list can get there.
  const stored = /Database tidak tersambung/;

  const full = questModalInt({ pool: "gdn:hc", rarity: "legendary|box", scroll: "weapon" });
  await handleBountyQuestModal(full);
  check("39. all three builds a real quest", stored.test(full.seen.reply || ""), full.seen.reply);

  const typed = questModalInt({}, "gdn cl u wep");
  await handleBountyQuestModal(typed);
  check("39. dropdowns left empty still lets you type", stored.test(typed.seen.reply || ""));

  // Nothing anywhere is not an error, just nothing.
  const blank = questModalInt({});
  await handleBountyQuestModal(blank);
  check("39. an empty submit says so quietly", /Nothing new to add/.test(blank.seen.reply || ""));
})());


// 40. Ambiguity is answered by picking, not by retyping. The option carries the
//     WHOLE quest, so nothing is stored while the menu waits — a menu left
//     unanswered for a week costs nothing and expires on its own.
const { buildPickers, isFixable, FIX } = require("./handlers/modals/bountyQuest");

const errs = (text) => parseQuestLines(text).errors;

// "hc" is in three nests; the rest of the line is already known.
const amb = errs("hc u wep")[0];
check("40. an ambiguous nest is fixable", isFixable(amb));
eq("40. with every candidate", amb.candidates.join(","), "ddn:hc,gdn:hc,sdn:hc");
// A nest with no variant is the same shape of question.
check("40. so is a missing variant", isFixable(errs("gdn u wep")[0]));
// These have no shortlist to offer — a wrong token could mean anything, and a
// missing rarity cannot be guessed from what is there.
check("40. a bad token is not", !isFixable(errs("blah u wep")[0]));
check("40. nor is a missing rarity", !isFixable(errs("gdn hc")[0]));

const rows = buildPickers("Chelssea", errs("hc u wep\ngdn leg acc box\nblah u wep"));
eq("40. one menu per fixable line", rows.length, 2);
const sel0 = rows[0].toJSON().components[0];
check("40. the failed line is the placeholder", sel0.placeholder.startsWith("hc u wep"));
// The value is the answer itself, which is why no state is kept anywhere.
eq("40. the option carries the whole quest", sel0.options[0].value, "ddn:hc|unique|weapon|0");
// Card box is part of the line, and dropping it here would quietly pay less.
// Both ambiguity branches carry it — an unknown nest and an unknown variant are
// different code paths, and only one of them was covered when this was written.
check("40. including the card box",
  rows[1].toJSON().components[0].options.every((o) => o.value.endsWith("|1")));
check("40. on the ambiguous-nest branch too",
  buildPickers("x", errs("hc leg acc box"))[0].toJSON().components[0]
    .options.every((o) => o.value.endsWith("|1")));
// Names may contain ":", so the row index goes first and the name goes last.
eq("40. each menu is addressable", sel0.custom_id, `${FIX}0:Chelssea`);
check("40. and the name survives a colon in it",
  buildPickers("a:b", errs("hc u wep"))[0].toJSON().components[0].custom_id.slice(FIX.length).split(":").slice(1).join(":") === "a:b");
// Discord takes five action rows; a sixth would be rejected at send time.
check("40. never more menus than a message can hold",
  buildPickers("x", errs(Array(8).fill("hc u wep").join("\n"))).length <= 5);


// 41. Linked Discord accounts. Nothing is ever moved between documents: reads
//     return the union and writes go back where each row came from, so leaving
//     a group costs nothing and no two rosters ever have to be reconciled.
const {
  linkedTo, primaryOf, requestLink, approveLink, unlink, cancelLink,
  incomingLinks, bountyLinkRequests: reqs,
} = require("./state");

const g = (id) => linkedTo(id).sort().join(",");

eq("41. an unlinked account is a group of one", g("ol"), "ol");
eq("41. inviting yourself is refused", requestLink("ol", "ol"), "Itu akun yang sama.");

eq("41. an invite is accepted", requestLink("ol", "chae1"), null);
// Delivery is not the mechanism: the invite is state, waiting on their panel.
eq("41. and waits on the target", incomingLinks("chae1").join(","), "ol");
eq("41. the group only forms on approval", g("ol"), "ol");

approveLink("ol", "chae1");
eq("41. both sides see the same group", g("ol"), "chae1,ol");
eq("41. and it is gone from the queue", incomingLinks("chae1").length, 0);
// One person, one mention — the board and the reminder both key off this.
eq("41. one account represents the group", primaryOf("chae1"), "ol");

requestLink("ol", "chae2");
approveLink("ol", "chae2");
eq("41. a third joins the same group", g("chae2"), "chae1,chae2,ol");
eq("41. an account already in a group is refused",
  requestLink("someone", "chae2"), "Akun itu sudah ter-link ke grup lain.");

// Leaving takes nothing from the people who stay.
unlink("chae1");
eq("41. one leaves", g("chae1"), "chae1");
eq("41. the rest stay linked", g("ol"), "chae2,ol");
unlink("chae2");
eq("41. and the last pair dissolves cleanly", g("ol"), "ol");
eq("41. leaving nothing behind", g("chae2"), "chae2");

// The button carries who asked, so the owner is the LAST segment. Reading
// position 2 would have compared the guard against the wrong person.
reqs["asker41"] = "u41";
pending.push((async () => {
  const p = await buildPanel("u41");
  check("41. the invite shows on the invited panel",
    p.embeds[0].data.description.includes("<@asker41> mengajak link"));
  const link = p.components[2].toJSON().components;
  eq("41. with accept and decline", link.map((b) => b.label).join(","), "✅ Accept link,✖️ Decline");
  eq("41. and the owner is still the last segment",
    link[0].custom_id.split(":").pop(), "u41");
  delete reqs["asker41"];
})());


// 42. Reading a group as one roster, and writing it back42 where it came from.
//     Nothing is moved between documents, so this pair is the whole feature —
//     and a mistake here loses or duplicates a character in silence.
const { mergeChars, splitChars, mergeWeek, splitWeek } = require("./state");

const rows42 = mergeChars([
  { _id: "ol", chars: [{ name: "Chelssea" }, { name: "ZouZ" }] },
  { _id: "chae1", chars: [{ name: "Bolabola" }] },
]);
eq("42. a group reads as one roster", rows42.map((c) => c.name).join(","), "Chelssea,ZouZ,Bolabola");
eq("42. each row remembers where it lives", rows42.find((c) => c.name === "Bolabola")._owner, "chae1");

// Add one while acting as ol, drop ZouZ, and every document is rewritten — a
// removal has to disappear from the document it actually lived in.
const back42 = splitChars(["ol", "chae1"], [rows42[0], rows42[2], { name: "New" }], "ol");
eq("42. rows42 go home", back42.get("chae1").map((c) => c.name).join(","), "Bolabola");
eq("42. and a new one belongs to whoever added it", back42.get("ol").map((c) => c.name).join(","), "Chelssea,New");
check("42. the tag is never stored", !JSON.stringify([...back42.values()]).includes("_owner"));
eq("42. every member is written, so removals stick", [...back42.keys()].join(","), "ol,chae1");

// Same trick for the week, plus the case that only exists because links came
// later: one character name registered on BOTH accounts before they linked.
const wq = (p) => ({ poolKey: p, rarity: "unique", scroll: "weapon", box: false, runId: null });
const merged42 = mergeWeek([
  { _id: "ol:w", owners: ["ol"], chars: { Chelssea: { board: [wq("gdn:hc")], shares: [] } } },
  { _id: "chae1:w", owners: ["chae1"], chars: {
      Chelssea: { board: [wq("gdn:hc"), wq("sdn:hc")], shares: [] },
      // A character of chae1's own, so the split below has somewhere to send a
      // row that is NOT the acting account — without it, sending everything to
      // the actor would look identical and the check could not fail.
      Bolabola: { board: [wq("ddn:hc")], shares: [] } } },
]);
eq("42. a shared name merges rather than picking", merged42.Chelssea.board.length, 2);
eq("42. dropping the duplicate", merged42.Chelssea.board.map((q) => q.poolKey).join(","), "gdn:hc,sdn:hc");
// It converges into one document, which is what keeps the six-quest cap honest.
eq("42. and converges to one document",
  [...splitWeek(["ol", "chae1"], merged42, "ol")].map(([id, c]) => `${id}:${Object.keys(c).join("+") || "-"}`).join(" "),
  "ol:Chelssea chae1:Bolabola");

// 42b. The guard reads the owner off the END of the customId. Actions that
//      carry an argument ("approve:<whoever asked>") would otherwise compare it
//      against the asker and refuse the very person invited.
pending.push((async () => {
  const acc = panelInt("approve:asker", "u42");
  acc.customId = `${PREFIX}approve:asker:u42`;
  await handlePanelButton(acc);
  check("42b. the invited account may accept", !acc.seen.reply, acc.seen.reply);
  check("42b. and the panel is redrawn", !!acc.seen.update?.embeds?.length);

  const other = panelInt("approve:asker", "u42", "someone-else");
  other.customId = `${PREFIX}approve:asker:u42`;
  await handlePanelButton(other);
  check("42b. but nobody else can", /panel orang lain/.test(other.seen.reply || ""));
})());


// 43. The bounty toggle is host-only in the HANDLER, not just greyed out in the
//     UI. Disabling a button hides it from the client; it does not stop the
//     interaction, and this one changes who is allowed to join the party.
const { HOST_ONLY_BUTTONS, BOUNTY_TOGGLE } = require("./constants");
const { createButtons } = require("./builders/buttons");

const toggleEvent = {
  messageId: "m", hostId: "host", maxSlot: 8, locked: false, users: {},
  roles: Object.fromEntries(Object.entries(tpls.gdn_cl.roles).map(([k, r]) => [k, { ...r, users: [] }])),
  poolKeys: tpls.gdn_cl.poolKeys,
};
const toggleIds = createButtons(toggleEvent, "host")
  .flatMap((r) => r.toJSON().components)
  .map((b) => b.custom_id);

check("43. the toggle is on a bounty panel", toggleIds.includes(BOUNTY_TOGGLE), toggleIds.join(","));
check("43. and the host gate covers it", HOST_ONLY_BUTTONS.includes(BOUNTY_TOGGLE));
// One constant behind the builder, the router and the gate: a rename that
// missed the gate would unlock it for everyone without breaking anything.
check("43. a plain signup has no toggle",
  !createButtons({ ...toggleEvent, poolKeys: [] }, "host")
    .flatMap((r) => r.toJSON().components)
    .some((b) => b.custom_id === BOUNTY_TOGGLE));


// 44. Asking for the Bounty Hunter role. Fetching a channel needs no
//     permission but sending does, so a bot that can SEE the admin channel and
//     not post in it threw — and the applicant read "Something went wrong",
//     which tells them nothing and tells the admin less.
const { applyHunter } = require("./handlers/commands/bountyChar");
const { bountyApplications: bountyApps } = require("./state");

pending.push((async () => {
  const cfg44 = require("./config");
  const roleWas = cfg44.bountyHunterRoleId;
  const chanWas = cfg44.bountyAdminChannelId;
  cfg44.bountyHunterRoleId = "R";
  cfg44.bountyAdminChannelId = "admin";

  const applicant = (send) => {
    const seen = {};
    return {
      seen,
      user: { id: "u44" },
      member: { roles: { cache: new Map() } }, // not a hunter yet
      client: { channels: { fetch: async () => ({ send }) } },
      reply: async (o) => { seen.reply = o.content; seen.mentions = o.allowedMentions; },
    };
  };

  const blocked = applicant(async () => { throw new Error("Missing Access"); });
  await applyHunter(blocked);
  check("44. a refused send does not crash", !!blocked.seen.reply);
  check("44. and says which permission is missing",
    /Send Messages/.test(blocked.seen.reply || ""), blocked.seen.reply);

  // The role is named as a role pill, so it is the thing they can point at —
  // and the reply must never actually summon it.
  const pill = applicant(async () => ({ id: "m" }));
  await applyHunter(pill);
  check("44. the role is a mention, not bold text", /<@&R>/.test(pill.seen.reply || ""), pill.seen.reply);
  check("44. and nothing is pinged", pill.seen.mentions?.parse?.length === 0);
  delete bountyApps["u44"];

  const ok44 = applicant(async () => ({ id: "m" }));
  await applyHunter(ok44);
  check("44. a delivered one says it is with the admin",
    /reviewed by the admin/.test(ok44.seen.reply || ""), ok44.seen.reply);

  // Pressing again while waiting is the natural thing to do, and the admins must
  // not get a second copy of the same request.
  let sends = 0;
  const again = applicant(async () => { sends++; return { id: "m" }; });
  await applyHunter(again);
  eq("44. a second press sends nothing", sends, 0);
  check("44. and says the same thing", /reviewed by the admin/.test(again.seen.reply || ""));

  // The role arriving is what clears it — the bot is never told, so it checks.
  const hunter = applicant(async () => ({ id: "m" }));
  hunter.member = { roles: { cache: new Map([["R", {}]]) } };
  await applyHunter(hunter);
  check("44. once the role lands, the record is dropped", !bountyApps["u44"]);

  cfg44.bountyHunterRoleId = roleWas;
  cfg44.bountyAdminChannelId = chanWas;
})());


// 45. Approving from the request itself. This is the only place the bot uses
//     Manage Roles, and the two ways it goes wrong are both silent-ish: anyone
//     could press it, or the bot's own role sits too low and Discord refuses.
const { handleHunterDecision, PREFIX: HUNTER } = require("./handlers/buttons/bountyHunter");
const { PermissionFlagsBits } = require("discord.js");

const decision = (verb, canManage, addFn) => {
  const seen = {};
  return {
    seen,
    customId: `${HUNTER}${verb}:applicant`,
    user: { id: "admin" },
    memberPermissions: { has: (p) => canManage && p === PermissionFlagsBits.ManageRoles },
    guild: { members: { fetch: async () => ({ roles: { add: addFn } }) } },
    reply: async (o) => { seen.reply = o.content; },
    update: async (o) => { seen.update = o; },
  };
};

check("45. the approve button reaches its handler", routerLetsThrough(`${HUNTER}approve:x`));

pending.push((async () => {
  // The request message sits in a staff channel, but a channel is not a
  // permission — the button has to check for itself.
  const nosy = decision("approve", false, async () => {});
  await handleHunterDecision(nosy);
  check("45. someone without Manage Roles is refused", /Manage Roles/.test(nosy.seen.reply || ""));
  check("45. and the request stays open", !nosy.seen.update);

  bountyApps["applicant"] = true;
  const ok45 = decision("approve", true, async () => {});
  await handleHunterDecision(ok45);
  check("45. an admin grants the role", /jadi Bounty Hunter/.test(ok45.seen.update?.content || ""));
  eq("45. and the buttons come off", ok45.seen.update.components.length, 0);
  check("45. the application is closed", !bountyApps["applicant"]);

  // The commonest real failure: Manage Roles is on, but the bot's role sits at
  // or below the one it is being asked to hand out.
  bountyApps["applicant"] = true;
  const tooLow = decision("approve", true, async () => { throw new Error("Missing Permissions"); });
  await handleHunterDecision(tooLow);
  check("45. a refusal from Discord names the role order", /di atas/.test(tooLow.seen.reply || ""));
  check("45. and leaves the request open to retry", !!bountyApps["applicant"]);

  const no = decision("decline", true, async () => {});
  await handleHunterDecision(no);
  check("45. declining closes it without granting", /ditolak/.test(no.seen.update?.content || ""));
  check("45. and clears the application", !bountyApps["applicant"]);
})());


// 46. Reading the user picked in a modal. getSelectedUsers hands back a
//     Collection, not an array, so indexing it read as "you picked nobody"
//     however carefully you picked — and the refusal looked like the feature
//     working, not failing.
const { Collection } = require("discord.js");
const { handlePanelModal } = require("./bountyPanel");

const linkModalInt = (picked) => {
  const seen = {};
  return {
    seen,
    customId: `${PREFIX}link:u46`,
    user: { id: "u46" },
    client: {},
    message: { id: "m" },
    fields: {
      getSelectedUsers: () => picked,
      getTextInputValue: () => "",
      getStringSelectValues: () => [],
    },
    update: async (o) => { seen.update = o; },
    followUp: async (o) => { (seen.followUps ||= []).push(o.content); },
  };
};

pending.push((async () => {
  const chosen = new Collection([["chae46", { id: "chae46", send: async () => {} }]]);
  const ok46 = linkModalInt(chosen);
  await handlePanelModal(ok46);
  check("46. a picked account is read", !ok46.seen.followUps?.some((t) => /Belum pilih/.test(t)),
    JSON.stringify(ok46.seen.followUps));
  check("46. and the invite is sent", ok46.seen.followUps?.some((t) => /Undangan menunggu/.test(t)));
  eq("46. it waits on their panel", incomingLinks("chae46").join(","), "u46");
  cancelLink("u46");

  // Picking nothing still has to say so.
  const none = linkModalInt(null);
  await handlePanelModal(none);
  check("46. picking nobody is still refused", none.seen.followUps?.some((t) => /Belum pilih/.test(t)));
})());


// A throw inside an async block would reject Promise.all and take the summary
// with it — no count, no failure list, just a stack trace. Turn it into a
// failure like any other.
Promise.all(pending.map((p) => p.catch((e) => fails.push(`async check threw — ${e.message}`)))).then(() => {
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
    console.log(`   this week37: ${weekLabel()}  (${weekKey()})\n`);
    for (const v of VARIANT_LIST) {
      console.log(
        `   ${v.poolKey.padEnd(18)} ${v.name.padEnd(34)} ` +
          `${v.capacity}p · needs ${v.minHighDps} high DPS`,
      );
    }
    console.log();
  }

});