// Single source of truth for the bot version = package.json "version".
// Bump with `npm run release:patch|minor|major` (see CHANGELOG.md).
const { version } = require("../package.json");

module.exports = { version, VERSION: version };
