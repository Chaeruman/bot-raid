const http = require("http");
const axios = require("axios");
const config = require("../config");

function start() {
  http.createServer((_, res) => res.end("OK")).listen(config.port);

  if (config.renderUrl) {
    setInterval(() => {
      axios
        .get(config.renderUrl)
        .then((r) => console.log(`🔄 Kept alive: ${r.status}`))
        .catch((e) => console.error(`❌ Keep-alive failed: ${e.message}`));
    }, 30000);
  }
}

module.exports = { start };
