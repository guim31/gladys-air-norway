// -----------------------------------------------------------------------------
// The integration end to end, against the SDK's fake Gladys and the simulated
// MET Norway API (real answers of 2026-10-24).
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MemoryStore } from '../src/store.js';
import { USER_AGENT } from '../src/api.js';
import {
  HOUR,
  START,
  createAll,
  createWorld,
  discovered,
  idsOf,
  lastState,
} from './helpers/world.js';
import { ALNABRU, HOUSES, withIndex } from './helpers/network.js';

const HOME = 'house:hjemme';
const STATION = `station:${ALNABRU}`;

const forecastCalls = (w) => w.network.calls.filter((call) => !call.path.endsWith('/stations'));

test('one device per located house in Norway and per station, nothing for the others', async () => {
  const w = await createWorld({
    config: { stations: `${ALNABRU}, no9999x` },
    houses: [HOUSES.oslo, HOUSES.paris, HOUSES.unlocated],
  });
  const names = w.gladys.fake.discoveredDevices.map((device) => device.name);
  assert.deepEqual(names, ['MET Norway Hjemme', 'MET Norway Alnabru']);
  const device = discovered(w, HOME);
  assert.equal(device.should_poll, false);
  assert.equal(device.poll_frequency, undefined);
  assert.deepEqual(device.params, [{ name: 'place', value: HOME }]);
  // Paris is outside Norway, NO9999X is no station: some places still work.
  assert.equal(w.gladys.fake.connectionStatus.connected, true);
  const first = forecastCalls(w)[0];
  assert.equal(
    first.path,
    '/weatherapi/airqualityforecast/0.1/?lat=59.9139&lon=10.7522&areaclass=grunnkrets',
  );
  assert.equal(first.headers['user-agent'], USER_AGENT);
  assert.match(
    USER_AGENT,
    /^gladys-air-norway\/\d+\.\d+\.\d+ github\.com\/guim31\/gladys-air-norway$/,
  );
});

test('a house outside Norway alone: a clear status on the Configuration screen', async () => {
  const w = await createWorld({ houses: [HOUSES.paris] });
  assert.deepEqual(w.gladys.fake.discoveredDevices, []);
  const status = w.gladys.fake.connectionStatus;
  assert.equal(status.connected, false);
  assert.match(status.message.fr, /Hors de Norvège.*Maison/);
  assert.match(status.message.en, /Outside Norway/);
});

test('nothing to follow: the status says what to do', async () => {
  const w = await createWorld({ houses: [HOUSES.unlocated] });
  const status = w.gladys.fake.connectionStatus;
  assert.equal(status.connected, false);
  assert.match(status.message.en, /Settings → Houses/);
});

test('an added device gets the forecast of the hour that is now, and the 24-hour peak', async () => {
  const w = await createWorld({ config: { stations: ALNABRU } });
  await createAll(w);
  // 09:22 UTC: the 09:00 hour of the Oslo answer (AQI 1.506, PM2.5 2.47...).
  assert.equal(lastState(w, HOME, 'index'), 1.5);
  assert.equal(lastState(w, HOME, 'quality'), 'Faible');
  assert.equal(typeof lastState(w, HOME, 'pm25'), 'number');
  assert.equal(typeof lastState(w, HOME, 'no2'), 'number');
  assert.equal(typeof lastState(w, HOME, 'o3'), 'number');
  // The worst hour up to 09:00 UTC tomorrow: 1.77 at 07:00 UTC.
  assert.equal(lastState(w, HOME, 'peak_index'), 1.8);
  assert.equal(lastState(w, HOME, 'peak_quality'), 'Faible');
  assert.ok(lastState(w, STATION, 'index') >= 1);
  assert.ok(w.gladys.fake.widgetRefreshes.includes('air_quality'));
});

test('the timer reads hourly with a conditional request, and moves the hour without one', async () => {
  const w = await createWorld();
  await createAll(w);
  const before = forecastCalls(w).length;
  // Within the hour: no request.
  w.advance(10 * 60_000);
  await w.app.poller.cycle();
  assert.equal(forecastCalls(w).length, before);
  // An hour later: If-Modified-Since, 304, and the 10:00 values.
  w.advance(HOUR);
  await w.app.poller.cycle();
  const calls = forecastCalls(w);
  assert.equal(calls.length, before + 1);
  assert.ok(calls.at(-1).headers['if-modified-since']);
  assert.equal(lastState(w, HOME, 'index'), 1.5); // 10:00 UTC, AQI 1.50
  const states = w.gladys.fake.states.length;
  // Nothing changed within the hour: nothing is published.
  w.advance(5 * 60_000);
  await w.app.poller.cycle();
  assert.equal(w.gladys.fake.states.length, states);
});

test('a house moved, or another area: the place is read again at once', async () => {
  const w = await createWorld();
  await createAll(w);
  const before = forecastCalls(w).length;
  await w.gladys.fake.configUpdated({ area_level: 'kommune' });
  const call = forecastCalls(w).at(-1);
  assert.equal(forecastCalls(w).length, before + 1);
  assert.match(call.path, /areaclass=kommune$/);
  assert.equal(call.headers['if-modified-since'], undefined);
});

test('scene triggers: degradation forecast, degradation, back to normal, once each', async () => {
  const store = new MemoryStore();
  const w = await createWorld({ store });
  await createAll(w);
  // Low all along: the starting levels are set, without event.
  w.advance(HOUR);
  await w.app.poller.cycle();
  assert.deepEqual(w.gladys.fake.sceneEvents, []);

  // The next run sees moderate air at 15:00 UTC (17:00 in Oslo).
  const peakAt = Date.parse('2026-10-24T15:00:00Z');
  w.network.routes['forecast-oslo'] = withIndex('forecast-oslo', (at) =>
    at === peakAt ? 2.6 : undefined,
  );
  w.advance(HOUR);
  await w.app.poller.cycle();
  let events = w.gladys.fake.sceneEvents;
  assert.equal(events.length, 1);
  assert.equal(events[0].key, 'air_quality_forecast_degraded');
  assert.equal(events[0].data.place, idsOf(w, HOME).device);
  assert.equal(events[0].data.level, 'moderate');
  assert.equal(events[0].data.level_label, 'Modéré');
  assert.equal(events[0].data.index, 2.6);
  assert.equal(events[0].data.time, '17:00');
  assert.equal(events[0].data.hours_ahead, 4);
  assert.equal(events[0].data.pollutant, 'PM2.5');
  assert.match(events[0].data.summary, /Sur 24 h : Modéré à 17:00/);
  assert.equal(lastState(w, HOME, 'peak_quality'), 'Modéré');

  // 15:22 UTC: moderate now (the timer ticks all along).
  for (let i = 0; i < 4; i += 1) {
    w.advance(HOUR);
    await w.app.poller.cycle();
  }
  events = w.gladys.fake.sceneEvents;
  assert.equal(events.length, 2);
  assert.equal(events[1].key, 'air_quality_degraded');
  assert.equal(events[1].data.previous_level, 'low');
  assert.equal(lastState(w, HOME, 'quality'), 'Modéré');

  // A restart does not fire anything again.
  const again = await createWorld({ store, devices: w.gladys.devices, start: w.clock.now });
  await again.app.poller.cycle();
  assert.deepEqual(again.gladys.fake.sceneEvents, []);

  // 16:22 UTC: low again.
  w.advance(HOUR);
  await w.app.poller.cycle();
  events = w.gladys.fake.sceneEvents;
  assert.equal(events.length, 3);
  assert.equal(events[2].key, 'air_quality_back_to_normal');
  assert.equal(events[2].data.worst_level, 'moderate');
  assert.equal(events[2].data.level, 'low');
});

test('the get_air_quality scene action: the worst place, values and peak', async () => {
  const w = await createWorld({
    config: { stations: ALNABRU, language: 'en' },
    houses: [HOUSES.oslo, HOUSES.bergen],
  });
  await createAll(w);
  const ack = await w.gladys.fake.sceneAction('get_air_quality', {});
  assert.equal(ack.success, true, JSON.stringify(ack));
  const outputs = ack.data.outputs;
  assert.equal(outputs.level, 'low');
  assert.equal(outputs.level_label, 'Low');
  assert.equal(typeof outputs.index, 'number');
  assert.equal(typeof outputs.pm25, 'number');
  assert.match(outputs.peak_time, /^\d\d:00$/);
  assert.match(outputs.summary, /^MET Norway \S+: Low \(\d\.\d\) · PM2\.5 /);
  const one = await w.gladys.fake.sceneAction('get_air_quality', {
    place: idsOf(w, 'house:hytta').device,
  });
  assert.equal(one.data.outputs.place_name, 'MET Norway Hytta');
});

test('the scene action without any forecast fails with a readable message', async () => {
  const w = await createWorld({ houses: [HOUSES.paris] });
  const ack = await w.gladys.fake.sceneAction('get_air_quality', {});
  assert.equal(ack.success, false);
  assert.match(JSON.stringify(ack), /No air quality forecast yet/);
});

test('the widget: tiles bound to the features, now and the next 24 h, or one row per place', async () => {
  const w = await createWorld({ config: { stations: ALNABRU } });
  await createAll(w);
  const one = await w.gladys.fake.widgetGet('air_quality', {
    settings: { place: idsOf(w, HOME).device },
    language: 'de',
  });
  assert.equal(one.success, true, JSON.stringify(one));
  const components = one.data.content.components;
  assert.ok(components.length <= 8);
  const features = discovered(w, HOME).features.map((feature) => feature.external_id);
  for (const tile of components.filter((component) => component.type === 'value')) {
    assert.ok(features.includes(tile.device_feature), tile.device_feature);
  }
  const status = components.find((component) => component.type === 'status');
  assert.deepEqual(
    status.items.map((item) => [item.label, item.color]),
    [
      ['Jetzt', 'success'],
      ['Nächste 24 Std.', 'success'],
    ],
  );
  assert.match(status.items[1].value, /^Gering um \d\d:00$/);
  const all = await w.gladys.fake.widgetGet('air_quality', { language: 'es' });
  const rows = all.data.content.components[0].items;
  assert.deepEqual(
    rows.map((row) => row.label),
    ['MET Norway Hjemme', 'MET Norway Alnabru'],
  );
  assert.match(rows[0].value, /^Bajo \(\d\.\d\)$/);
});

test('find a station: by name (ø optional), or the nearest to a house', async () => {
  const w = await createWorld();
  const byName = await w.gladys.fake.action('find_station', { query: 'tromso' });
  assert.equal(byName.success, true, JSON.stringify(byName));
  assert.match(byName.data.message.en, /Tromsø/);
  const near = await w.gladys.fake.action('find_station', {});
  const lines = near.data.message.fr.split('\n');
  assert.match(lines[0], /autour de Hjemme/);
  assert.match(lines[1], /^\S+ .* \(Oslo, \d+(\.\d)? km\)$/);
  assert.equal(lines.length, 10); // the head, 8 stations, "…and N more"
  const nothing = await w.gladys.fake.action('find_station', { query: 'Paris' });
  assert.match(nothing.data.message.en, /No MET Norway station for "Paris"/);
});

test('check the places: one line each, the station unknown and the house abroad said', async () => {
  const w = await createWorld({
    config: { stations: `${ALNABRU},NO9999X,é` },
    houses: [HOUSES.oslo, HOUSES.paris],
  });
  const ack = await w.gladys.fake.action('check_places', {});
  assert.equal(ack.success, true, JSON.stringify(ack));
  const lines = ack.data.message.en.split('\n');
  assert.match(lines[0], /^MET Norway Hjemme: Low \(1\.5\)/);
  assert.match(lines[1], /^MET Norway Maison: outside Norway/);
  assert.match(lines[2], /^MET Norway Alnabru: Low/);
  assert.match(lines[3], /^MET Norway NO9999X: not a MET Norway station/);
  assert.match(lines[4], /Ignored, not station codes: é/);
});

test('429: every request waits, then starts again', async () => {
  const w = await createWorld({ config: { stations: ALNABRU } });
  await createAll(w);
  w.network.routes['forecast-oslo'] = { status: 429, headers: { 'retry-after': '1800' } };
  w.advance(HOUR);
  await w.app.poller.cycle();
  const after429 = forecastCalls(w).length;
  // Paused: the station is not read either, for half an hour.
  w.advance(20 * 60_000);
  await w.app.poller.cycle();
  assert.equal(forecastCalls(w).length, after429);
  delete w.network.routes['forecast-oslo'];
  w.advance(15 * 60_000);
  await w.app.poller.cycle();
  assert.ok(forecastCalls(w).length > after429);
});

test('the API down: the status says it, the values stay until the forecast runs out', async () => {
  const w = await createWorld();
  await createAll(w);
  w.network.down = true;
  w.advance(HOUR);
  await w.app.poller.cycle();
  assert.equal(w.gladys.fake.connectionStatus.connected, false);
  assert.match(w.gladys.fake.connectionStatus.message.en, /MET Norway does not answer/);
  // The forecast still covers the hour: the state moved on.
  assert.equal(typeof lastState(w, HOME, 'index'), 'number');
  w.network.down = false;
  w.advance(HOUR);
  await w.app.poller.cycle();
  assert.equal(w.gladys.fake.connectionStatus.connected, true);
});

test('a restart publishes the devices from /data, even with the API down', async () => {
  const store = new MemoryStore();
  await createWorld({ store });
  const w = await createWorld({
    store,
    setup: (network) => {
      network.down = true;
    },
  });
  assert.deepEqual(
    w.gladys.fake.discoveredDevices.map((device) => device.name),
    ['MET Norway Hjemme'],
  );
});

test('the core poll is only a fallback: it does not read a place read recently', async () => {
  const w = await createWorld();
  await createAll(w);
  const before = forecastCalls(w).length;
  await w.gladys.fake.poll(discovered(w, HOME));
  assert.equal(forecastCalls(w).length, before);
  assert.equal(START, Date.parse('2026-10-24T09:22:00Z'));
});

test('a failing read waits 5, then 15 minutes, then an hour, before the next one', async () => {
  const w = await createWorld();
  await createAll(w);
  w.network.routes['forecast-oslo'] = { status: 503 };
  w.advance(HOUR);
  await w.app.poller.cycle();
  const start = forecastCalls(w).length;
  const minutes = [];
  for (let minute = 1; minute <= 90; minute += 1) {
    w.advance(60_000);
    const before = forecastCalls(w).length;
    await w.app.poller.cycle();
    if (forecastCalls(w).length > before) {
      minutes.push(minute);
    }
  }
  assert.deepEqual(minutes, [5, 20, 80]);
  assert.equal(forecastCalls(w).length, start + 3);
});

test('only unknown station codes: the status says so, not "outside Norway"', async () => {
  const w = await createWorld({ config: { stations: 'NO9999A' }, houses: [] });
  const status = w.gladys.fake.connectionStatus;
  assert.equal(status.connected, false);
  assert.match(status.message.en, /Unknown station codes: NO9999A/);
});

test('another area: a house not added yet is read again, the Discovery tab follows', async () => {
  const w = await createWorld();
  const before = forecastCalls(w).length;
  await w.gladys.fake.configUpdated({ area_level: 'delomrade' });
  assert.equal(forecastCalls(w).length, before + 1);
  assert.match(forecastCalls(w).at(-1).path, /areaclass=delomrade$/);
});

test('the devices cannot be published at start: the timer still starts and retries', async () => {
  const w = await createWorld({ connect: false });
  const publish = w.gladys.publishDiscoveredDevices.bind(w.gladys);
  let refused = 0;
  w.gladys.publishDiscoveredDevices = async (devices) => {
    if (refused < 2) {
      refused += 1;
      throw new Error('HTTP 500');
    }
    return publish(devices);
  };
  await w.gladys.connect();
  assert.equal(refused, 2);
  w.advance(HOUR);
  await w.app.poller.cycle();
  assert.deepEqual(
    w.gladys.fake.discoveredDevices.map((device) => device.name),
    ['MET Norway Hjemme'],
  );
});
