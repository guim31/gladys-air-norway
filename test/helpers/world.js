// -----------------------------------------------------------------------------
// A complete test world: the SDK's fake Gladys, the simulated MET Norway API,
// a store in memory, a clock, and the integration wired on top.
// -----------------------------------------------------------------------------

import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { registerHandlers } from '../../src/app.js';
import { MemoryStore } from '../../src/store.js';
import { HOUSES, createNetwork } from './network.js';

// The integration logs its lifecycle; keep the test output readable
// (LOG_LEVEL is read on every log call). LOG_LEVEL=debug npm test shows them.
process.env.LOG_LEVEL ??= 'silent';
// Hours are formatted in the local time of Gladys: Oslo in the tests.
process.env.TZ = 'Europe/Oslo';

/** The test clock starts here: 11:22 in Oslo, when the fixtures were recorded. */
export const START = Date.parse('2026-10-24T09:22:00Z');

export const HOUR = 3_600_000;

/**
 * @param {object} [options]
 * @param {object} [options.config] raw integration config
 * @param {Array} [options.devices] devices already created in Gladys
 * @param {Array} [options.houses] houses of Gladys (Oslo by default)
 * @param {object} [options.store] persistence (MemoryStore by default)
 * @param {(network: object) => void} [options.setup] prepares the network before connecting
 * @param {number} [options.start] the clock at the start
 * @param {boolean} [options.connect]
 */
export async function createWorld({
  config = {},
  devices = [],
  houses = [HOUSES.oslo],
  store = new MemoryStore(),
  setup = () => {},
  start = START,
  connect = true,
} = {}) {
  const clock = { now: start };
  const now = () => clock.now;
  const network = createNetwork({ now });
  setup(network);
  const gladys = createFakeGladys({ config, devices, houses });
  const app = registerHandlers(gladys, { store, fetch: network.fetch, timers: false, now });
  if (connect) {
    await gladys.connect();
  }
  return {
    gladys,
    app,
    network,
    store,
    clock,
    hub: app.hub,
    /** Move the clock forward. */
    advance(ms) {
      clock.now += ms;
    },
  };
}

/** Add every discovered device to Gladys, as the user would. */
export async function createAll(world) {
  for (const device of world.gladys.fake.discoveredDevices) {
    await world.gladys.fake.deviceCreated(device);
  }
}

/** The external ids of a place ("house:hjemme", "station:NO0057A"). */
export function idsOf(world, placeId) {
  const [kind, id] = placeId.split(':');
  return world.gladys.externalIds(kind, id);
}

/** The discovered device of a place. */
export function discovered(world, placeId) {
  const id = idsOf(world, placeId).device;
  return world.gladys.fake.discoveredDevices.find((device) => device.external_id === id);
}

/** The last published value of a feature of a place. */
export function lastState(world, placeId, key) {
  return world.gladys.fake.lastState(idsOf(world, placeId).feature(key));
}
