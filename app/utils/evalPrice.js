// Safely evaluate a price expression: digits and + - * / ( ) only.
// Tolerates commas and a trailing "g". Returns a floored non-negative integer,
// or null if the input is empty/invalid (so callers can leave the price unchanged).
function evalPrice(raw) {
  if (raw == null) return null;
  const s = String(raw).replace(/,/g, "").replace(/\s*g\s*$/i, "").trim();
  if (s === "") return null;
  if (!/^[\d.+\-*/()\s]+$/.test(s)) return null; // no letters → nothing callable

  let val;
  try {
    // eslint-disable-next-line no-new-func
    val = Function(`"use strict"; return (${s});`)();
  } catch {
    return null;
  }
  if (typeof val !== "number" || !isFinite(val) || val < 0) return null;
  return Math.floor(val);
}

module.exports = { evalPrice };
