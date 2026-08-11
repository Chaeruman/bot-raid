// Run: node app/_questImageTest.js — no network, no key needed.
const assert = require("assert");
const { PROMPT, isBoard, readBoard, pickText } = require("./questImage");
const { parseQuestLines, VARIANT_LIST } = require("./bounty");

// The whole design rests on one claim: the format the model is told to emit is
// the format the parser already eats. If that drifts, every read silently
// becomes a parse error, so it is checked against every nest there is.
// A board screenshot cannot show the scroll type, so a read is deliberately one
// word short of a storable quest. What it MUST get right is the nest and the
// rarity — those are the parts that are painful to type and easy to typo.
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
console.log(`✅ all ${VARIANT_LIST.length} nests resolve; only the scroll type is left to type`);

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

// A non-image attachment must never reach a paid API call.
assert.ok(isBoard({ contentType: "image/png", size: 100 }));
assert.ok(!isBoard({ contentType: "text/plain", size: 100 }));
assert.ok(!isBoard({ contentType: undefined, size: 100 }));
assert.ok(!isBoard({ contentType: "image/png", size: 20 * 1024 * 1024 }));
console.log("✅ only real, sane images are sent");

// Missing key fails loudly here rather than posting a confusing reply later.
const had = process.env.GEMINI_API_KEY;
delete process.env.GEMINI_API_KEY;
readBoard(Buffer.from("x")).then(
  () => { throw new Error("should have thrown without a key"); },
  (e) => {
    assert.match(e.message, /GEMINI_API_KEY/);
    if (had) process.env.GEMINI_API_KEY = had;
    console.log("✅ a missing key throws before any request");
    console.log("\n🎉 All checks passed.");
  },
);
