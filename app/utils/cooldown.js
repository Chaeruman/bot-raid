const { cooldowns } = require("../state");
const { COOLDOWN } = require("../constants");

function checkCooldown(userId) {
  const now = Date.now();
  const last = cooldowns.get(userId) || 0;
  const onCooldown = now - last < COOLDOWN;
  if (!onCooldown) cooldowns.set(userId, now);
  return onCooldown;
}

module.exports = { checkCooldown };
