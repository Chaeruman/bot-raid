// Run: node app/_questImageTest.js — no network, no key needed.
const assert = require("assert");
const {
  PROMPT, MERGE_NOTE, isBoard, readBoard, pickText, splitId, PREFIX, REFS, HAS_REFS, magnify, BAND,
} = require("./questImage");
const { buildQuestModal } = require("./handlers/commands/bountyQuest");
const { parseQuestLines, VARIANT_LIST } = require("./bounty");

// The whole design rests on one claim: the format the model is told to emit is
// the format the parser already eats. If that drifts, every read silently
// becomes a parse error, so it is checked against every nest there is.
// The scroll type is optional in the output: it only exists as a reward icon,
// so a read may be one word short of a storable quest. Both shapes have to
// behave — the short one resolving nest and rarity, the full one storing.
const sample = VARIANT_LIST
  .map((v) => `${v.nestAliases[0]} ${v.variantAliases[0]} u`)
  .join("\n");
const { added, errors } = parseQuestLines(sample);
assert.strictEqual(added.length, 0, "nothing is storable without a scroll type");
assert.strictEqual(errors.length, VARIANT_LIST.length);
for (const e of errors) {
  assert.strictEqual(e.error, "no scroll type", `${e.raw}: ${e.error}`);
  assert.ok(e.poolKey, `${e.raw} still resolved its nest`);
  assert.strictEqual(e.rarity, "unique", `${e.raw} still resolved its rarity`);
}
assert.deepStrictEqual(
  errors.map((e) => e.poolKey),
  VARIANT_LIST.map((v) => v.poolKey),
  "every nest resolves to the right pool",
);
// And one word turns the whole paste into real quests.
const complete = parseQuestLines(sample.split("\n").map((l) => `${l} wep`).join("\n"));
assert.deepStrictEqual(complete.errors, [], "adding the scroll type completes every line");
assert.strictEqual(complete.added.length, VARIANT_LIST.length);
console.log(`✅ all ${VARIANT_LIST.length} nests resolve, with or without the scroll type`);

// Rarity is PRINTED on the card. Inferring it from the card colour is what put
// an Epic Archbishop into the box as Unique — the colours wash out, the label
// does not. This asserts the instruction, not the model.
assert.ok(/PRINTS its rarity/.test(PROMPT), "the prompt reads the printed label");
assert.ok(/Never infer rarity from/i.test(PROMPT), "and forbids guessing from colour");

// Only three rarities exist in the data; the board shows five. The two extra
// have to be dropped by name, or a nest card wearing one becomes a bad line.
for (const skip of ["[Epic]", "[Rare]", "[Magic]"])
  assert.ok(PROMPT.includes(skip), `the prompt drops ${skip}`);
assert.ok(!/\b(epic|magic)\s*=/i.test(PROMPT), "and never offers one as a rarity to emit");

// A finished quest imported as open is the exact harm Mark done was built to
// undo: the board's job is "who still needs GDN Classic?", and an answer that
// names someone already done costs them an evening. Both screens mark it
// differently, so both markers have to be named.
assert.ok(/SKIP quests already finished/.test(PROMPT), "finished quests are skipped");
assert.ok(/1\/1/.test(PROMPT) && /0\/1/.test(PROMPT), "the list's marker is described");
assert.ok(/red tick/.test(PROMPT), "and the pinboard's");

// Two screens show the same quests. The Weekly Events list is one clean row per
// quest — no wrapped words, no columns, rarity inline — so it must be accepted,
// not just the pinboard the reader was first written against.
assert.ok(/Weekly Events list/.test(PROMPT), "the list layout is described");
assert.ok(/pinboard/.test(PROMPT), "and so is the pinboard");
for (const s of ["wep", "arm", "acc", "wtd"])
  assert.ok(new RegExp(`\\b${s} =`).test(PROMPT), `${s} is spelled out for the model`);

// ── The four scroll reference icons ─────────────────────────────────────────
// They ship with the repo, so all four must load. Losing one silently would
// leave the model matching against an incomplete set and quietly mislabelling
// the missing type as its nearest neighbour.
assert.strictEqual(HAS_REFS, true, "all four scroll icons loaded");
assert.deepStrictEqual(REFS.map((r) => r.alias), ["wep", "arm", "acc", "wtd"]);
for (const r of REFS) {
  assert.ok(r.data.length > 1000, `${r.alias} icon is real data`);
  // base64 PNG magic — a text file renamed .png would silently teach nothing.
  assert.ok(r.data.startsWith("iVBORw0KGgo"), `${r.alias} is a PNG`);
}
// With references present the model is told to compare them; guessing is still
// forbidden, because a wrong reward is stored as fact and never questioned.
assert.ok(/reference\n?\s*icons are attached BEFORE/.test(PROMPT), "the references are announced");
assert.ok(/top-left corner/.test(PROMPT), "and where they differ is named");
assert.ok(/leave the scroll off/.test(PROMPT), "no match still means omit");
console.log("✅ four scroll references load and the prompt points at them");
// Non-nest cards are the majority of a real board — 30 of ~40 in the samples.
for (const junk of ["Abyss Stage", "FTG Stage"])
  assert.ok(PROMPT.includes(junk), `the prompt names ${junk} as skippable`);
// Every nest has to be reachable, or a quest can be read and then dropped.
for (const v of VARIANT_LIST)
  assert.ok(PROMPT.includes(v.name), `${v.poolKey} is in the menu`);
console.log("✅ prompt covers every nest, drops Epic and the non-nest cards");

// The bot's own reply is the only place the suggestion is stored, so the fence
// it writes must be the fence the button reads back.
const FENCE = /```\n([\s\S]*?)```/;
const lines = "gdn hc leg\nsdn core u";
const reply = `Kebaca dari gambar:\n\`\`\`\n${lines}\`\`\`Cek dulu, betulkan yang salah.`;
assert.strictEqual((reply.match(FENCE) || [, ""])[1].trim(), lines, "round-trips through the reply");
console.log("✅ the reply round-trips the suggestion back to the modal");

// Every model Google now offers has thinking on, and a thought arrives as just
// another text part. Joined blindly, the model's reasoning lands in the quest
// box — which parses as garbage and reads as the bot talking to itself.
assert.strictEqual(
  pickText({ candidates: [{ content: { parts: [
    { text: "The purple card is Archbishop...", thought: true },
    { text: "abn challenge u\ngn hell leg" },
  ] } }] }),
  "abn challenge u\ngn hell leg",
);
// Fences, blank lines and stray indentation all come off.
assert.strictEqual(
  pickText({ candidates: [{ content: { parts: [{ text: "```\n  gdn hc leg  \n\n```" }] } }] }),
  "gdn hc leg",
);
// An empty board is a valid answer, not a crash.
assert.strictEqual(pickText({}), "");
assert.strictEqual(pickText({ candidates: [{ content: { parts: [] } }] }), "");
console.log("✅ the model's thinking never reaches the quest box");

// ── The name typed beside the picture ───────────────────────────────────────
// It rides in the customId, and the owner check has to keep working now that
// the id is no longer the whole string — otherwise anyone could press it.
assert.deepStrictEqual(splitId(`${PREFIX}123:DarkJokowi`), ["123", "DarkJokowi"]);
assert.deepStrictEqual(splitId(`${PREFIX}123`), ["123", ""], "an old button still identifies its owner");
assert.deepStrictEqual(splitId(`${PREFIX}123:odd:name`), ["123", "odd:name"], "only the first colon splits");

// An exact roster hit preselects. Anything else must not — a near-miss would
// hang the quest on the wrong character with nobody looking.
const roster = [{ name: "DarkJokowi", role: "FU" }, { name: "KucingTayo", role: "Healer" }];
const defaults = (name) =>
  buildQuestModal(roster, false, { charName: name }).toJSON()
    .components[0].component.options.filter((o) => o.default).map((o) => o.value);
assert.deepStrictEqual(defaults("DarkJokowi"), ["DarkJokowi"]);
assert.deepStrictEqual(defaults("darkjokowi"), ["DarkJokowi"], "case does not matter");
assert.deepStrictEqual(defaults(" DarkJokowi "), ["DarkJokowi"], "nor does whitespace");
assert.deepStrictEqual(defaults("DarkJoko"), [], "a near-miss preselects nothing");
assert.deepStrictEqual(defaults(""), [], "and so does an empty message");
assert.deepStrictEqual(defaults("on char DarkJokowi"), [], "a sentence is not a character name");
console.log("✅ only an exact roster name preselects the character");

// The mode letter is how the submit handler tells a screenshot read from a
// panel. Get it wrong and the read reply is redrawn as a bounty panel.
const modeOf = (replace, fromImage) =>
  buildQuestModal(roster, replace, { fromImage }).toJSON().custom_id.slice(-1);
assert.strictEqual(modeOf(false, false), "a", "panel/slash append");
assert.strictEqual(modeOf(true, false), "r", "replace");
assert.strictEqual(modeOf(false, true), "i", "screenshot read");
assert.strictEqual(modeOf(true, true), "i", "the image flow never replaces");
console.log("✅ the modal carries which flow opened it");

// ── Deleting the screenshot ─────────────────────────────────────────────────
// It happens on the button, never on the read, and never before the modal is
// open. Deleting a picture nobody has looked at yet destroys the only copy of
// a read that may have been wrong.
const src = require("fs").readFileSync(`${__dirname}/questImage.js`, "utf8");
const modalSrc = require("fs").readFileSync(`${__dirname}/handlers/modals/bountyQuest.js`, "utf8");
const clearSrc = src.slice(src.indexOf("async function clearRead"));
const beforeClear = src.slice(0, src.indexOf("async function clearRead"));

// Neither reading the picture nor opening the modal may delete anything. A
// modal someone closes has to leave both messages standing.
assert.ok(!beforeClear.includes(".delete("), "nothing is deleted before the modal is submitted");
// Both go, not just the picture: a surviving reply keeps a button that reopens
// a modal prefilled with quests already saved.
assert.match(clearSrc, /messages\.delete\(/, "the picture goes");
assert.match(clearSrc, /message\.delete\(/, "and so does the read reply");
// Missing Manage Messages must not break a flow that already succeeded.
assert.strictEqual((clearSrc.match(/\.catch\(/g) || []).length, 2, "both deletes are caught");
// Only after something was saved — a paste that all failed keeps its button.
assert.match(modalSrc, /if \(saved\.length\)\s*\n?\s*await require\("\.\.\/\.\.\/questImage"\)\.clearRead/);
// And the read reply must never be redrawn as a panel, which is what
// isFromMessage() would otherwise do to it.
assert.ok(
  modalSrc.indexOf("if (fromImage)") < modalSrc.indexOf("if (interaction.isFromMessage())"),
  "the image branch is taken before the panel branch",
);
console.log("✅ both messages are cleared on submit, and only once something saved");

// ── Overlapping screenshots ─────────────────────────────────────────────────
// The Weekly Events list scrolls, so a six-quest week takes two shots and
// consecutive shots share rows. Read apart and concatenated the overlap
// double-counts; deduped, a genuinely repeated quest vanishes — and repeats are
// real, one character held two Gigantes Challenge. Only one call seeing both
// can tell those apart, so the merge instruction must exist and must say both.
assert.match(MERGE_NOTE, /SAME quest and is reported once/, "the overlap is merged");
assert.match(MERGE_NOTE, /twice only when a single image shows it twice/, "a real repeat survives");
assert.match(MERGE_NOTE, /overlapping views of ONE scrolling list/, "and the images are one list");
// Every attachment goes, not just the first — that was the bug this fixes.
assert.match(src, /message\.attachments\.values\(\)\]\.filter\(isBoard\)/, "all attachments are taken");
assert.match(src, /\.slice\(0, 4\)/, "and capped");
console.log("✅ overlapping screenshots are merged in one call, not concatenated");

// ── Image resolution ────────────────────────────────────────────────────────
// A zoomed screenshot read the scroll type correctly where a full-screen one
// answered "acc" for everything, so the emblem is being tiled away before the
// model sees it. Asking for high media resolution is the lever — but not every
// model takes the field, and losing the whole read to it is the worse trade.
assert.match(src, /MEDIA_RESOLUTION_HIGH/, "high resolution is requested");
assert.match(src, /res\.status === 400[\s\S]{0,200}?ask\(\{ temperature: 0 \}\)/,
  "a rejected field falls back instead of failing the read");
assert.ok(
  src.indexOf("MEDIA_RESOLUTION_HIGH") < src.indexOf("res.status === 400"),
  "the fallback comes second, so the good path is tried first",
);
console.log("✅ high media resolution is asked for, and degrades if refused");

// ── Magnifying the bands ────────────────────────────────────────────────────
// The whole reason this exists: a full-screen shot read the scroll type wrong
// every time and differently each time, and zooming in by hand read it right.
// Bands have to actually come out enlarged and actually overlap, or a quest row
// can fall between two of them and vanish.
const sharpLib = require("sharp");
const bandsCheck = (async () => {
  const shot = await sharpLib({
    create: { width: 1920, height: 1080, channels: 3, background: { r: 20, g: 20, b: 20 } },
  }).png().toBuffer();

  const bands = await magnify(shot);
  assert.ok(bands.length >= 3, `a 1080p shot yields bands, got ${bands.length}`);
  const metas = await Promise.all(bands.map((b) => sharpLib(b).metadata()));
  for (const m of metas) {
    assert.strictEqual(m.width, 3840, "each band is enlarged 2x");
    assert.ok(m.height > BAND, "and taller than the slice it came from");
  }
  // Overlap, not abutment: rows are ~130px and a seam through one would hide it
  // from both bands. Covered height must exceed the original.
  const covered = metas.reduce((n, m) => n + m.height / 2, 0);
  assert.ok(covered > 1080, `bands overlap, covered ${covered} of 1080`);

  // An image shorter than one band is left alone — nothing to slice.
  const small = await sharpLib({
    create: { width: 400, height: 200, channels: 3, background: { r: 0, g: 0, b: 0 } },
  }).png().toBuffer();
  assert.deepStrictEqual(await magnify(small), [], "a small shot is not sliced");
  console.log("✅ bands come out enlarged and overlapping, small shots untouched");
})();

// A non-image attachment must never reach a paid API call.
assert.ok(isBoard({ contentType: "image/png", size: 100 }));
assert.ok(!isBoard({ contentType: "text/plain", size: 100 }));
assert.ok(!isBoard({ contentType: undefined, size: 100 }));
assert.ok(!isBoard({ contentType: "image/png", size: 20 * 1024 * 1024 }));
console.log("✅ only real, sane images are sent");

// Missing key fails loudly here rather than posting a confusing reply later.
const had = process.env.GEMINI_API_KEY;
delete process.env.GEMINI_API_KEY;
const keyCheck = readBoard(Buffer.from("x")).then(
  () => { throw new Error("should have thrown without a key"); },
  (e) => {
    assert.match(e.message, /GEMINI_API_KEY/);
    if (had) process.env.GEMINI_API_KEY = had;
    console.log("✅ a missing key throws before any request");
  },
);

// Both async checks have to be waited on, or a rejection turns into a warning
// and the run still exits 0 — a suite that cannot fail is not a suite.
Promise.all([bandsCheck, keyCheck]).then(
  () => console.log("\n🎉 All checks passed."),
  (err) => { console.error(err); process.exit(1); },
);
