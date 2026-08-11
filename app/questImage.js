// Reads a bounty-board screenshot into the same text a person would type, then
// hands it to the existing "Add quest" modal as a prefill. Nothing here writes
// to the database — a wrong read costs one edit, not a bad record.
//
// ponytail: no SDK, one fetch. Tesseract got 6/11 on real screenshots because
// the ones people actually post are ~590px wide; upscaling adds no pixels.
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

const PROMPT = `This is a Dragon Nest bounty board screenshot. Each card shows a quest.

Report ONLY cards that name a nest from this list, one per line, as:
<nest> <variant> <rarity>

${MENU}

rarity: ${RARITIES}

Rules:
- Every card PRINTS its rarity in brackets above the quest text: [Magic]
  [Rare] [Epic] [Unique] [Legendary]. Read that word. Never infer rarity from
  the card colour — the colours are washed out and mislead.
- Report ONLY [Unique] and [Legendary] cards. SKIP [Epic], [Rare] and [Magic]
  even when the card names a nest.
- A yellow glowing border means that card is selected. It is not a rarity.
- Ignore the detail panel on the right; it repeats one card you already have.
- SKIP every card that is not a nest: "Abyss Stage", "FTG Stage", "any stage with FTG cost".
- A card can appear twice; report it twice.
- Card text wraps mid-word ("Green Drag / on Nest") — join it.
- Output nothing else. No prose, no code fence. Empty output is a valid answer.`;

// Returns the suggested text, or throws. The caller decides what a failure
// looks like to the person who posted the picture.
async function readBoard(buffer, mimeType = "image/png") {
  if (!KEY()) throw new Error("GEMINI_API_KEY not set");

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
    {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": KEY() },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: PROMPT },
            { inline_data: { mime_type: mimeType, data: buffer.toString("base64") } },
          ],
        }],
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

  const img = message.attachments.find(isBoard);
  if (!img || !KEY()) return;

  const lines = await (async () => {
    const buf = Buffer.from(await (await fetch(img.url)).arrayBuffer());
    return readBoard(buf, img.contentType.split(";")[0]);
  })().catch((err) => {
    console.error("❌ readBoard:", err.message);
    return null;
  });

  if (lines === null)
    return message.reply("⚠️ Gagal membaca gambarnya. Pakai **🎯 Add quest** seperti biasa.").catch(() => {});
  if (!lines)
    return message.reply("Tidak ada quest nest di gambar itu.").catch(() => {});

  // The character name, if they typed one, is theirs to confirm in the modal —
  // guessing it here would put a quest on the wrong character silently.
  // The board never shows the scroll type, so the read is one word short on
  // purpose. Saying so here beats letting the modal reject every line.
  return message.reply({
    content: `Kebaca dari gambar:\n\`\`\`\n${lines}\`\`\``
      + "Cek dulu, lalu tambahkan jenis scroll tiap baris — `wep` `wtd` `acc` `arm` (`box` kalau ada).",
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`${PREFIX}${message.author.id}`)
        .setLabel("🎯 Add quest")
        .setStyle(ButtonStyle.Primary),
    )],
  }).catch(() => {});
}

async function handleImageButton(interaction) {
  if (interaction.customId.slice(PREFIX.length) !== interaction.user.id)
    return interaction.reply({ content: "⛔ Itu bukan gambarmu.", flags: MessageFlags.Ephemeral });

  const prefill = (interaction.message.content.match(FENCE) || [, ""])[1].trim();
  const { getChars } = require("./state");
  const chars = await getChars(interaction.user.id);
  if (!chars.length)
    return interaction.reply({
      content: "Belum ada karakter. Bikin dulu lewat **➕ Add Character**.",
      flags: MessageFlags.Ephemeral,
    });

  const { buildQuestModal } = require("./handlers/commands/bountyQuest");
  return interaction.showModal(buildQuestModal(chars, false, prefill));
}

module.exports = { readBoard, pickText, handleImage, handleImageButton, isBoard, PREFIX, PROMPT };
