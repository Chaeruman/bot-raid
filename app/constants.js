// Flips a signup between bounty-only and open. One constant, because the id
// appears in the builder, the router and the host gate — and a rename that
// missed the gate would unlock it for everyone without breaking anything.
const BOUNTY_TOGGLE = "bounty-open";

module.exports = {
  COOLDOWN: 3000,
  BOUNTY_TOGGLE,
  HOST_ONLY_BUTTONS: ["toggle_lock", "cancel_run", "done_run", "remove_member", "party_ping", "party_up", BOUNTY_TOGGLE],
};
