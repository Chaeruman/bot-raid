// Reads a bounty-board screenshot into the same text a person would type, then
// hands it to the existing "Add quest" modal as a prefill. Nothing here writes
// to the database — a wrong read costs one edit, not a bad record.
//
// ponytail: no SDK, one fetch. Tesseract got 6/11 on real screenshots because
// the ones people actually post are ~590px wide; upscaling adds no pixels.
const fs = require("fs");
const path = require("path");
const { MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { VARIANT_LIST } = require("./bounty");
const { RARITY } = require("./data/bounty");

const PREFIX = "bounty-img:";
// An alias, not a pinned version: gemini-2.5-flash was retired mid-testing and
// answered 404 "no longer available to new users". GEMINI_MODEL overrides.
const MODEL = process.env.GEMINI_MODEL || "gemini-flash-latest";
const KEY = () => process.env.GEMINI_API_KEY;

// The model may only answer in words the parser already knows, so a
// hallucinated nest is rejected downstream instead of stored.
const MENU = VARIANT_LIST
  .map((v) => `${v.nestAliases[0]} ${v.variantAliases[0]} = ${v.name}`)
  .join("\n");

const RARITIES = Object.entries(RARITY)
  .map(([, r]) => `${r.aliases[r.aliases.length - 1]} = ${r.label}`)
  .join(", ");

// The scroll type exists only as a reward icon, and the four artworks differ
// by a ~15px emblem in one corner. Describing them in prose would encode my
// reading of a small picture into the prompt; sending the pictures does not.
// Loaded once, and a missing file drops the whole feature rather than the bot.
const REFS = [["wep", "scroll-wep.png"], ["arm", "scroll-armor.png"],
  ["acc", "scroll-acc.png"], ["wtd", "scroll-wtd.png"]]
  .map(([alias, file]) => {
    try {
      const data = fs.readFileSync(path.join(__dirname, "assets", file)).toString("base64");
      return { alias, data };
    } catch (err) {
      console.error(`⚠️ scroll reference ${file} missing — scroll type will stay blank`);
      return null;
    }
  })
  .filter(Boolean);

const HAS_REFS = REFS.length === 4;

const SCROLL_RULE = HAS_REFS
  ? `- The scroll type comes from the reward icons. Four labelled reference
  icons are attached BEFORE the screenshot. Match each quest's reward icon
  against them — they differ only by the small emblem in the top-left corner,
  so compare that corner. Append the matching alias.
- If a reward icon matches none of the four clearly, leave the scroll off.
  A missing word costs one keystroke; a wrong one is stored as fact.`
  : `- Leave the scroll type off entirely. Do not guess it.`;

const PROMPT = `This is a Dragon Nest Group Bounty screenshot. It is one of two screens:
- the pinboard of pinned cards, or
- the Weekly Events list, one quest per row.
Both list the same quests. Read whichever you are given.

Report ONLY quests that name a nest from this list, one per line, as:
<nest> <variant> <rarity> [scroll]

${MENU}

rarity: ${RARITIES}
scroll: wep = Weapon, arm = Armor, acc = Accessory, wtd = W/T/D

Rules:
- Every quest PRINTS its rarity in brackets: [Magic] [Rare] [Epic] [Unique]
  [Legendary]. Read that word. Never infer rarity from a card's colour — the
  colours are washed out and mislead.
- Report ONLY [Unique] and [Legendary] quests. SKIP [Epic], [Rare] and
  [Magic] even when they name a nest.
- SKIP everything that is not a nest: "Abyss Stage", "FTG Stage", "any stage
  with FTG cost".
- The same quest can appear twice; report it twice.
${SCROLL_RULE}
- On the pinboard, card text wraps mid-word ("Green Drag / on Nest") — join
  it. A yellow glowing border means selected, not a rarity. Ignore the detail
  panel on the right; it repeats one card you already have.
- Output nothing else. No prose, no code fence. Empty output is a valid answer.`;

// Takes every screenshot at once, because the Weekly Events list SCROLLS: a
// six-quest week needs two shots, and consecutive shots overlap. Read apart and
// concatenated, the overlap double-counts; deduped, a genuinely repeated quest
// disappears. Only something seeing both at once can tell those apart.
async function readBoard(shots, mimeType = "image/png") {
  if (!KEY()) throw new Error("GEMINI_API_KEY not set");
  const images = (Array.isArray(shots) ? shots : [{ buffer: shots, mimeType }])
    .map((s) => (Buffer.isBuffer(s) ? { buffer: s, mimeType } : s));

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
    {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": KEY() },
      body: JSON.stringify({
        contents: [{ parts: [
          { text: PROMPT },
          // Label then picture, so each reference is unambiguously named, and
          // the screenshot comes last so "this one" cannot be misread.
          ...REFS.flatMap((r) => [
            { text: `Reference reward icon — scroll type "${r.alias}":` },
            { inline_data: { mime_type: "image/png", data: r.data } },
          ]),
          { text: images.length > 1
            ? `Now read these ${images.length} screenshots. They are overlapping views of ONE scrolling list, in order. Merge them into a single list: a quest visible in two screenshots is the SAME quest and is reported once. Report a quest twice only when one screenshot shows it twice.`
            : "Now read this screenshot:" },
          ...images.map((im) => ({
            inline_data: { mime_type: im.mimeType || mimeType, data: im.buffer.toString("base64") },
          })),
        ] }],
        generationConfig: { temperature: 0 },
      }),
    },
  );
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`);

  return pickText(await res.json());
}

// Every current Gemini model thinks, and a thinking part is still a text part.
// Joining the lot would paste the model's reasoning into the quest box.
function pickText(json) {
  const text = (json.candidates?.[0]?.content?.parts || [])
    .filter((p) => !p.thought)
    .map((p) => p.text || "")
    .join("");
  return text.replace(/```/g, "").split("\n").map((l) => l.trim()).filter(Boolean).join("\n");
}

// ── Discord side ────────────────────────────────────────────────────────────

const isBoard = (a) => (a.contentType || "").startsWith("image/") && a.size < 8 * 1024 * 1024;

// The bot's own reply holds the suggestion, so pressing the button days later
// still works and a restart loses nothing. No Map, no state, no expiry.
const FENCE = /```\n([\s\S]*?)```/;

async function handleImage(message) {
  const { bountyThreads } = require("./state");
  const owner = Object.keys(bountyThreads)
    .find((uid) => bountyThreads[uid]?.threadId === message.channelId);
  if (!owner || owner !== message.author.id) return;

  // Every picture in the message, in the order they were attached — the list
  // scrolls, so one shot need not hold the whole week. Capped because a board
  // is six quests and two shots cover it; more is somebody's holiday album.
  const imgs = [...message.attachments.values()].filter(isBoard).slice(0, 4);
  if (!imgs.length || !KEY()) return;

  const lines = await (async () => {
    const shots = await Promise.all(imgs.map(async (a) => ({
      buffer: Buffer.from(await (await fetch(a.url)).arrayBuffer()),
      mimeType: (a.contentType || "image/png").split(";")[0],
    })));
    return readBoard(shots);
  })().catch((err) => {
    console.error("❌ readBoard:", err.message);
    return null;
  });

  if (lines === null)
    return message.reply("⚠️ Gagal membaca gambarnya. Pakai **🎯 Add quest** seperti biasa.").catch(() => {});
  if (!lines)
    return message.reply("Tidak ada quest nest di gambar itu.").catch(() => {});

  // Whatever they typed next to the picture rides along in the customId, so an
  // exact roster hit arrives preselected. Never trusted further: a name nobody
  // owns preselects nothing and the picker still opens.
  const typed = message.content.trim().replace(/\s+/g, " ").slice(0, 60);

  // The scroll type only exists as a reward icon, so some lines arrive without
  // one. Naming the missing word beats letting the modal reject the line.
  const needScroll = lines.split("\n").some((l) => !/\b(wep|wtd|acc|arm)\b/.test(l));

  return message.reply({
    content: `Kebaca dari gambar:\n\`\`\`\n${lines}\`\`\`` + (needScroll
      ? "Cek dulu, lalu lengkapi jenis scroll yang belum ada — `wep` `wtd` `acc` `arm` (`box` kalau ada)."
      : "Cek dulu, betulkan yang salah."),
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`${PREFIX}${message.author.id}:${typed}`)
        .setLabel("🎯 Add quest")
        .setStyle(ButtonStyle.Primary),
    )],
  }).catch(() => {});
}

// "<userId>:<whatever they typed>" — the name may hold anything, including
// colons, so only the first one separates.
const splitId = (customId) => {
  const rest = customId.slice(PREFIX.length);
  const cut = rest.indexOf(":");
  return cut < 0 ? [rest, ""] : [rest.slice(0, cut), rest.slice(cut + 1)];
};

async function handleImageButton(interaction) {
  const [ownerId, typed] = splitId(interaction.customId);
  if (ownerId !== interaction.user.id)
    return interaction.reply({ content: "⛔ Itu bukan gambarmu.", flags: MessageFlags.Ephemeral });

  const prefill = (interaction.message.content.match(FENCE) || [, ""])[1].trim();
  const { getChars } = require("./state");
  const chars = await getChars(interaction.user.id);
  if (!chars.length)
    return interaction.reply({
      content: "Belum ada karakter. Bikin dulu lewat **➕ Add Character**.",
      flags: MessageFlags.Ephemeral,
    });

  // Cleanup waits for the modal to be SUBMITTED, not opened — see the "i" mode
  // in bountyQuest. A modal someone closes must leave both messages standing,
  // or backing out costs them the read.
  const { buildQuestModal } = require("./handlers/commands/bountyQuest");
  return interaction.showModal(
    buildQuestModal(chars, false, { prefill, charName: typed, fromImage: true }),
  );
}

// The read is spent once the quests are in. Both messages go: the picture, and
// the bot's own reply holding the text — leaving the reply would leave a button
// that reopens a modal prefilled with quests already saved.
async function clearRead(message) {
  const imageId = message.reference?.messageId;
  if (imageId)
    await message.channel.messages.delete(imageId).catch((err) =>
      console.error(`❌ delete board image ${imageId}:`, err.message),
    );
  await message.delete().catch((err) => console.error("❌ delete read reply:", err.message));
}

module.exports = {
  readBoard, pickText, handleImage, handleImageButton, clearRead, splitId, isBoard,
  REFS, HAS_REFS, PREFIX, PROMPT,
};
