async function ack(interaction, fn) {
  if (interaction.replied || interaction.deferred) return;
  try {
    await fn();
  } catch {
    /* ignore */
  }
}

module.exports = { ack };
