// -----------------------------------------------------------------------------
// The container's own timer.
//
// The places are read hourly, far beyond the 60 s the core can schedule: the
// devices are published with `should_poll: false` and the container reads
// them by itself. One timer ticks every minute:
//   - it reads the places that are due (src/hub.js isDue: an hour since the
//     last read and the answer expired), one after the other;
//   - when a place was read or the hour turned, it evaluates the levels and
//     publishes (afterCycle).
// The houses of Gladys are read again at the same time (a local call).
//
// What is read: the places whose device the user added to Gladys, and the
// places never read yet (their first read tells whether MET Norway covers
// them, for the Discovery tab).
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';

const logger = createLogger({ name: 'poller' });

/** The timer's tick. */
export const TICK_MS = 60_000;

const HOUR_MS = 3_600_000;

/**
 * @param {object} options
 * @param {object} options.gladys
 * @param {import('./hub.js').Hub} options.hub
 * @param {() => Promise<void>} options.afterCycle evaluates and publishes
 * @param {boolean} [options.timers] run the periodic timer (tests may turn it off)
 * @param {() => number} [options.now]
 */
export function createPoller({
  gladys,
  hub,
  afterCycle = async () => {},
  timers = true,
  now = () => Date.now(),
}) {
  let timer = null;
  let stopped = true;
  /** The hour of the last evaluation. */
  let evaluatedHour = null;
  /** The cycles run one after the other: the last one queued. */
  let queue = Promise.resolve();

  /** The places to read: added to Gladys, or never read yet. */
  function wantedPlaces() {
    return hub.places().filter((place) => {
      const record = hub.records.get(place.id);
      return !record?.fetchedAt || hub.isCreated(record) || !hub.isKnown(record);
    });
  }

  /** Read one place; failures are logged once by the hub's issue log. */
  async function readPlace(place) {
    try {
      await hub.refresh(place);
    } catch (err) {
      logger.debug(`${place.id}: ${err.message}`);
    }
  }

  /**
   * One cycle: the due places, in sequence, then the evaluation. Cycles never
   * overlap (timer, restart, device added, actions): each waits for the
   * previous one.
   * @returns {Promise<boolean>} true when a place was read
   */
  function cycle(options = {}) {
    const run = queue.then(() => runCycle(options));
    queue = run.catch(() => {});
    return run;
  }

  async function runCycle({ force = false, ids, maxAgeMs = 0 } = {}) {
    if (gladys.connected === false) {
      logger.debug('Gladys unreachable: cycle skipped');
      return false;
    }
    const hour = Math.floor(now() / HOUR_MS);
    const turned = hour !== evaluatedHour;
    if (turned || force) {
      await hub.loadHouses();
    }
    let read = false;
    const places = ids ? hub.places().filter((place) => ids.includes(place.id)) : wantedPlaces();
    for (const place of places) {
      if (hub.isPaused()) {
        break;
      }
      const minAgeMs = ids ? maxAgeMs : undefined;
      if (hub.isDue(hub.records.get(place.id), place, minAgeMs)) {
        await readPlace(place);
        read = true;
      }
    }
    if (read || turned || force) {
      evaluatedHour = hour;
      await afterCycle();
    }
    return read;
  }

  function schedule() {
    clearTimeout(timer);
    timer = null;
    if (!timers || stopped) {
      return;
    }
    timer = setTimeout(async () => {
      timer = null;
      try {
        await cycle();
      } catch (err) {
        logger.error(`Polling cycle failed (${err.message})`);
      } finally {
        schedule();
      }
    }, TICK_MS);
  }

  return {
    /** (Re)start: a cycle now (devices and states from /data at least), then the timer. */
    async restart() {
      stopped = false;
      try {
        await cycle({ force: true });
      } finally {
        schedule();
      }
    },

    /** One timer cycle (tests). */
    cycle,

    /**
     * The core's onPoll, a fallback only (the devices do not ask for it): a
     * timer cycle, which reads the place if it is due.
     */
    async pollFromCore(device) {
      if (!hub.recordByDevice(device.external_id)) {
        logger.debug(`onPoll ignored (not a configured place): ${device.external_id}`);
        return;
      }
      await cycle();
    },

    /**
     * Read some places now (a device just added, the check action), unless
     * they were read less than `maxAgeMs` ago or their last answer has not
     * expired yet; then evaluate and publish.
     * @returns {Promise<boolean>} true when a place was read
     */
    refreshNow(ids, { maxAgeMs = 0 } = {}) {
      return cycle({ force: true, ids, maxAgeMs });
    },

    stop() {
      stopped = true;
      clearTimeout(timer);
      timer = null;
    },
  };
}
