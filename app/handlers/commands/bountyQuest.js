const {
  MessageFlags,
  ModalBuilder,
  LabelBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder,
} = require("discord.js");
const { getChars } = require("../../state");
const { DPS_TIERS, RARITY, SCROLL } = require("../../data/bounty");
const { VARIANT_LIST } = require("../../bounty");

const MODAL_PREFIX = "bounty-modal:quest:";

// The character is a select INSIDE the modal, so picking it and typing the
// quests is one step. It used to be a slash option with autocomplete, plus a
// second select on the confirmation to reach the next character — three
// surfaces for one question, none of which a button could open.
//
// Mode rides in the customId because a modal cannot see what opened it: "a"
// appends, "r" replaces.
const MAX_OPTS = 25;

const pick = (id, label, options, required = true, description) => {
  const l = new LabelBuilder().setLabel(label).setStringSelectMenuComponent(
    new StringSelectMenuBuilder()
      .setCustomId(id)
      .setRequired(required)
      .setPlaceholder(required ? "Select" : "Optional")
      .addOptions(options.slice(0, MAX_OPTS)),
  );
  return description ? l.setDescription(description) : l;
};

// Card box rides on the rarity rather than taking a field of its own — six
// options in one list instead of a second yes/no, which is what leaves room for
// the free-text field below.
const RARITY_OPTS = Object.entries(RARITY).flatMap(([key, r]) => [
  { label: r.label, value: key },
  { label: `${r.label} + card box`, value: `${key}|box` },
]);
const SCROLL_OPTS = Object.entries(SCROLL).map(([key, s]) => ({ label: s.label, value: key }));
const POOL_OPTS = VARIANT_LIST.map((v) => ({
  label: v.short,
  value: v.poolKey,
  description: v.name.slice(0, 100),
}));

// Dropdowns for one quest, plus a box for the rest.
//
// 14 of 19 characters in the real data hold exactly ONE quest, so the dropdowns
// cover the common case in the same number of interactions typing took — minus
// the syntax and minus any chance of a parse error. The text field stays for
// people who are fluent, for pasting, and for the character holding three.
function buildQuestModal(chars, replace = false, { prefill = "", charName = "", fromImage = false } = {}) {
  // Only an exact roster hit preselects. A near-miss would put the quest on
  // the wrong character silently, which is worse than one extra click.
  const chosen = chars.find((c) => c.name.toLowerCase() === String(charName).trim().toLowerCase());
  const lines = new TextInputBuilder()
    .setCustomId("lines")
    .setPlaceholder(["ddn hc u wep", "gdn cl leg acc box", "memo 1 rl wtd"].join("\n"))
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(false)
    .setMaxLength(600);
  // Only when a screenshot was read. Set unconditionally this would hand
  // Discord value:"" on every ordinary open, for nothing.
  if (prefill) lines.setValue(prefill.slice(0, 600));

  return new ModalBuilder()
    // "i" appends like "a", and additionally means the message this was opened
    // from is a screenshot read — which must be deleted rather than redrawn as
    // a panel, because it is not one.
    .setCustomId(`${MODAL_PREFIX}${fromImage ? "i" : replace ? "r" : "a"}`)
    .setTitle(replace ? "Edit quest" : "Add quest")
    .setLabelComponents(
      // A roster over 25 loses its tail here. MAX_CHARS is 40, but the biggest
      // real roster is ~15, and Discord allows no more.
      pick(
        "char",
        "Character",
        chars.map((c) => ({
          label: c.name.slice(0, 100),
          value: c.name.slice(0, 100),
          description: `${c.role || "?"} · ${DPS_TIERS[c.dpsTier] || "?"}`.slice(0, 100),
          ...(chosen && c.name === chosen.name ? { default: true } : {}),
        })),
      ),
      pick("pool", "Dungeon", POOL_OPTS, false),
      pick("rarity", "Rarity", RARITY_OPTS, false),
      pick("scroll", "Scroll", SCROLL_OPTS, false),
      new LabelBuilder()
        .setLabel("Type more quests")
        // The only instructions anyone sees at the moment they type, so between
        // them the label and placeholder carry the whole format.
        .setDescription("1 per line · u / leg / rl · wep wtd acc arm · box")
        .setTextInputComponent(lines),
    );
}

// Shared by the slash command and, later, the panel button: both need the same
// roster check before there is anything to put in the select.
async function openQuestModal(interaction, replace = false) {
  const { isHunter, notHunter } = require("./bountyChar");
  if (!isHunter(interaction))
    return interaction.reply({ content: notHunter, flags: MessageFlags.Ephemeral });

  const chars = await getChars(interaction.user.id);
  if (!chars.length)
    return interaction.reply({
      content: "Belum ada karakter. Bikin dulu lewat **➕ Add Character** di panel-mu (`/bounty-me`).",
      flags: MessageFlags.Ephemeral,
    });

  return interaction.showModal(buildQuestModal(chars, replace));
}

const handleBountyQuest = (interaction) =>
  openQuestModal(interaction, interaction.options.getBoolean("replace") || false);

module.exports = { handleBountyQuest, openQuestModal, buildQuestModal, MODAL_PREFIX };
