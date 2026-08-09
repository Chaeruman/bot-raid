// Run: node app/_salaryMenuTest.js — the pinned salary buttons.
//
// The trap here is that both handlers used to read interaction.options, which a
// button does not have. Calling them from a button would have thrown, and the
// user would have seen "Something went wrong" with nothing to act on.
const assert = require("assert");
const config = require("./config");
const { MENUS, messageFor, handleSalaryButton, PREFIX } = require("./salaryMenu");
const { EVENT_FREE } = require("./handlers/buttons");
const { ButtonStyle } = require("discord.js");

// These panels are not activeEvents entries, so the router has to let them past
// its "this panel is no longer active" guard or the button is dead on arrival.
assert.ok(EVENT_FREE.some((p) => `${PREFIX}kirim`.startsWith(p)), "router lets the button through");

config.kirimGajiChannelId = "k";
config.gajiSayaChannelId = "g";
const menus = MENUS();
assert.deepStrictEqual(menus.map((m) => m.key), ["kirim", "saya"]);

for (const m of menus) {
  const btns = messageFor(m).components[0].toJSON().components;
  assert.ok(btns.length >= 1, `${m.key} has a button`);
  for (const btn of btns) {
    assert.ok(btn.custom_id.startsWith(`${PREFIX}${m.key}`), `${btn.custom_id} belongs to ${m.key}`);
    assert.strictEqual(btn.style, ButtonStyle.Success, `${m.key} is green`);
  }
  assert.ok(messageFor(m).content.length < 300, `${m.key} says its piece briefly`);
}
// One button per range, not a picker behind a button: an extra interaction to
// reach a three-item list is a menu about itself.
const sayaBtns = messageFor(menus.find((m) => m.key === "saya")).components[0].toJSON().components;
assert.deepStrictEqual(
  sayaBtns.map((b) => b.custom_id.slice(PREFIX.length)),
  ["saya:week", "saya:month", "saya:all"],
);
console.log("✅ menus post green buttons that reach their handler");

// The week runs from the Saturday reset, not from seven days before you asked —
// otherwise the same question answers differently every hour, and a payout from
// Saturday morning drops out of "this week" by Saturday afternoon.
const { RANGES, rangeOf } = require("./salaryRange");
const sunday = new Date("2026-08-09T05:00:00Z"); // Sunday 12:00 WIB
const asWib = (d) => new Date(d.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 16);
assert.strictEqual(asWib(RANGES.week.since(sunday)), "2026-08-08T08:00", "week starts at the reset");
assert.strictEqual(asWib(RANGES.month.since(sunday)), "2026-08-01T00:00", "month starts on the 1st");
// Saturday BEFORE the reset still belongs to the week that is ending.
const satEarly = new Date("2026-08-08T00:30:00Z"); // 07:30 WIB
assert.strictEqual(asWib(RANGES.week.since(satEarly)), "2026-08-01T08:00");
// A command registered before this change still sends "7d"; dying on it would
// tell the person nothing.
assert.strictEqual(rangeOf("7d"), RANGES.week, "an unknown range falls back");
console.log("✅ ranges are anchored to the reset and the calendar month");

// A channel left unconfigured is skipped, not posted somewhere unintended.
config.gajiSayaChannelId = undefined;
assert.strictEqual(MENUS().filter((m) => m.channelId).length, 1);
config.gajiSayaChannelId = "g";

// The whole point: a button carries no options, and the handlers must not reach
// for them. Both are called with an explicit value here, exactly as the button
// does, and neither may throw.
(async () => {
  const seen = {};
  const pressed = {
    customId: `${PREFIX}saya`,
    user: { id: "u" },
    reply: async (o) => { seen.reply = o; },
    deferReply: async () => { seen.deferred = true; },
    editReply: async (o) => { seen.reply = o; },
  };
  await handleSalaryButton(pressed); // no `.options` anywhere on it
  assert.ok(seen.reply, "the salary view answered without touching interaction.options");
  console.log("✅ a button press needs no slash options");
})();
