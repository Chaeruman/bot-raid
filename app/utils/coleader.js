const config = require("../config");

// True if the interacting member is a Co-Leader.
// Prefers COLEADER_ROLE_ID if set, otherwise matches a role named like "co-leader".
function isCoLeader(interaction) {
  const roles = interaction.member?.roles?.cache;
  if (!roles) return false;
  if (config.coLeaderRoleId && roles.has(config.coLeaderRoleId)) return true;
  return roles.some((r) => /co.?leader/i.test(r.name));
}

module.exports = { isCoLeader };
