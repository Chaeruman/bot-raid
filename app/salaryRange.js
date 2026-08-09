// Salary ranges, anchored to the boundaries people actually think in.
//
// They used to be rolling windows: "7 hari" meant seven days back from the
// moment you asked, so the same question gave a different answer every hour and
// a payout from Saturday morning fell out of "this week" by Saturday afternoon.
// Guild life runs on the Saturday reset and the calendar month, so those are
// what the ranges cut on.
const { resetSaturday } = require("./bounty");

const HOUR_MS = 60 * 60 * 1000;
const WIB = 7 * HOUR_MS;

// resetSaturday works in a timeline shifted back an hour, so its answer sits
// exactly one hour before the real 08:00 WIB boundary. Adding it back gives the
// instant the week actually turned over.
const weekStart = (now = new Date()) => new Date(resetSaturday(now).getTime() + HOUR_MS);

// The 1st at 00:00 WIB, found in WIB space and shifted back to UTC.
function monthStart(now = new Date()) {
  const wib = new Date(now.getTime() + WIB);
  return new Date(Date.UTC(wib.getUTCFullYear(), wib.getUTCMonth(), 1) - WIB);
}

const RANGES = {
  week: { label: "sejak reset Sabtu terakhir", since: weekStart },
  month: { label: "bulan ini", since: monthStart },
  all: { label: "semua", since: () => new Date(0) },
};

// Unknown values fall back rather than throwing. A command registered before
// this change still sends "7d", and an interaction that dies on an old choice
// tells the person nothing.
const rangeOf = (key) => RANGES[key] || RANGES.week;

module.exports = { RANGES, rangeOf, weekStart, monthStart };
