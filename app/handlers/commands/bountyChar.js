const { MessageFlags } = require("discord.js");
const { getChars, saveChars } = require("../../state");
const { DPS_TIERS } = require("../../data/bounty");

// A roster this size already means something has gone wrong — nobody plays 40
// characters. It exists to stop a scripted loop filling the document, not to
// limit a real player: the biggest known roster is ~15.
const MAX_CHARS = 40;
const MAX_NAME = 32;

const norm = (s) => (s || "").trim().replace(/\s+/g, " ");
const same = (a, b) => a.toLowerCase() === b.toLowerCase();
const reply = (interaction, content) =>
  interaction.reply({ content: content.slice(0, 2000), flags: MessageFlags.Ephemeral });

async function handleBountyChar(interaction) {
  switch (interaction.options.getSubcommand()) {
    case "add":
      return addChar(interaction);
    case "list":
      return listChars(interaction);
    case "remove":
      return removeChar(interaction);
  }
}

// `add` upserts by name, so re-running it on an existing character edits that
// character. That's why there is no separate `edit` subcommand — one verb, and
// the reply says which of the two happened.
async function addChar(interaction) {
  const name = norm(interaction.options.getString("name"));
  const role = interaction.options.getString("role");
  const job = norm(interaction.options.getString("job"));
  const dpsTier = interaction.options.getString("dps");

  if (!name) return reply(interaction, "❌ Name cannot be empty.");
  if (name.length > MAX_NAME) return reply(interaction, `❌ Name is too long (max ${MAX_NAME}).`);

  const chars = await getChars(interaction.user.id);
  const existing = chars.find((c) => same(c.name, name));

  if (existing) {
    // Assign in place rather than replacing the object: this document is shared
    // with the activity planner, and its stat fields on this character have to
    // survive untouched (docs/bounty-arch.md §2.4).
    existing.name = name;
    existing.role = role;
    existing.dpsTier = dpsTier;
    if (job) existing.job = job; // optional — don't wipe the planner's class on edit
  } else {
    if (chars.length >= MAX_CHARS) return reply(interaction, `❌ Roster is full (${MAX_CHARS}).`);
    chars.push({ name, role, dpsTier, ...(job ? { job } : {}) });
  }

  if (!(await saveChars(interaction.user.id, chars)))
    return reply(interaction, "⚠️ MongoDB is not configured — nothing was saved.");

  const verb = existing ? "✏️ Updated" : "✅ Added";
  return reply(
    interaction,
    `${verb} **${name}** — ${role} · ${DPS_TIERS[dpsTier]}${job ? ` · ${job}` : ""}`,
  );
}

async function listChars(interaction) {
  const chars = await getChars(interaction.user.id);
  if (!chars.length)
    return reply(interaction, "No characters yet. Add one with `/bounty-char add`.");

  const lines = chars.map(
    (c) =>
      `• **${c.name}** — ${c.role || "no role set"} · ` +
      `${DPS_TIERS[c.dpsTier] || "no DPS tier set"}${c.job ? ` · ${c.job}` : ""}`,
  );
  return reply(interaction, `**Your characters (${chars.length})**\n${lines.join("\n")}`);
}

async function removeChar(interaction) {
  const name = norm(interaction.options.getString("name"));
  const chars = await getChars(interaction.user.id);
  const idx = chars.findIndex((c) => same(c.name, name));

  if (idx === -1) return reply(interaction, `❌ No character named **${name}**.`);

  const [gone] = chars.splice(idx, 1);
  if (!(await saveChars(interaction.user.id, chars)))
    return reply(interaction, "⚠️ MongoDB is not configured — nothing was saved.");

  // This week's quests are keyed by character name and are left alone on
  // purpose: removing a character is usually a typo fix or a rename, and
  // deleting recorded claims would lose real history to a mistake.
  return reply(
    interaction,
    `🗑️ Removed **${gone.name}**. Quests already recorded this week are kept.`,
  );
}

async function autocompleteBountyChar(interaction) {
  const focused = interaction.options.getFocused().toLowerCase();
  const chars = await getChars(interaction.user.id);
  const hits = chars
    .filter((c) => c.name.toLowerCase().includes(focused))
    .slice(0, 25)
    .map((c) => ({ name: c.name, value: c.name }));
  return interaction.respond(hits);
}

module.exports = { handleBountyChar, autocompleteBountyChar };
