// Waking up at a wall-clock time in WIB.
//
// Both digests used to be an hourly setInterval plus an "is it the right hour?"
// check. An interval starts ticking when the PROCESS does, so the post landed
// at whatever minute the bot last booted — the daily Lucky Zone post was going
// out at 00:47 because that is when Render last restarted it. Sleeping to the
// actual time fixes it, and re-arming from the clock afterwards means a slow
// send or a restart shifts nothing.
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

// Milliseconds until the next `hour` in WIB, optionally only on `day`
// (0 = Sunday, as getUTCDay counts). Never 0 — landing exactly on the target
// returns a full period, because 0 would fire again immediately.
function msUntilWib(hour, day = null, now = Date.now()) {
  const wib = now + 7 * HOUR_MS; // fixed offset; no timezone library needed
  let target = Math.floor(wib / DAY_MS) * DAY_MS + hour * HOUR_MS;
  if (target <= wib) target += DAY_MS;
  // At most seven hops, and obviously right, which beats modular arithmetic
  // nobody can check by eye.
  while (day !== null && new Date(target).getUTCDay() !== day) target += DAY_MS;
  return target - wib;
}

// Sleeps to the next occurrence, runs, then measures the following one from the
// clock again rather than from this one.
function armAt(hour, day, fn) {
  const arm = () => {
    setTimeout(() => {
      try {
        fn();
      } finally {
        arm(); // a throwing job must not stop the schedule
      }
    }, msUntilWib(hour, day));
  };
  arm();
}

module.exports = { msUntilWib, armAt };
