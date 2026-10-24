// -----------------------------------------------------------------------------
// The pure parts: the configuration, the API answers, the levels.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeConfig, parseStationIds } from '../src/config.js';
import { ApiError, fetchForecast, parseForecast, queryOf } from '../src/api.js';
import {
  displayIndex,
  dominantPollutants,
  evaluate,
  levelKey,
  levelOf,
  mergeHours,
} from '../src/forecast.js';
import { fold, searchStations } from '../src/catalog.js';
import { fixture } from './helpers/network.js';

test('the configuration: defaults, station codes, unknown values', () => {
  assert.deepEqual(normalizeConfig(), {
    areaLevel: 'grunnkrets',
    stationIds: [],
    invalidStationIds: [],
    droppedStationIds: [],
    language: 'fr',
  });
  assert.deepEqual(parseStationIds(' no0057a; Loallme,NO0057A  é'), {
    valid: ['NO0057A', 'Loallme'],
    invalid: ['é'],
  });
  const config = normalizeConfig({ area_level: 'fylke', language: 'nb' });
  assert.equal(config.areaLevel, 'grunnkrets');
  assert.equal(config.language, 'fr');
  const many = Array.from({ length: 12 }, (_, i) => `NO00${String(i + 10)}A`).join(',');
  assert.equal(normalizeConfig({ stations: many }).droppedStationIds.length, 2);
});

test('the query: 4 decimals at most, the area, or the station', () => {
  assert.equal(
    queryOf({ lat: 59.913_912_3, lon: 10.752_245, areaLevel: 'kommune' }),
    'lat=59.9139&lon=10.7522&areaclass=kommune',
  );
  assert.equal(queryOf({ station: 'NO0057A' }), 'station=NO0057A');
});

test('a real answer: the place, and every hour with the index and the pollutants', () => {
  const forecast = parseForecast(fixture('forecast-oslo'));
  assert.equal(forecast.name, 'Sentrum 2 - Rode 11'); // double space folded
  assert.equal(forecast.path, 'Oslo/Oslo/Sentrum 2/Sentrum 2 - Rode 11');
  // 55 hours; the daily aggregate MET Norway appends ("from" ≠ "to") is left out.
  assert.equal(forecast.hours.length, 55);
  assert.equal(new Set(forecast.hours.map((hour) => hour.at)).size, 55);
  const first = forecast.hours[0];
  assert.equal(first.at, Date.parse('2026-10-24T06:00:00Z'));
  assert.equal(Math.round(first.aqi * 100) / 100, 1.61);
  assert.deepEqual(Object.keys(first.values), ['pm25', 'pm10', 'no2', 'o3']);
  assert.deepEqual(dominantPollutants(first), ['o3']);
  const trondheim = parseForecast(fixture('forecast-trondheim'));
  assert.equal(trondheim.path, 'Trøndelag - Trööndelage/Trondheim - Tråante/Midtbyen/Midtbyen 11');
});

test('the levels of the Norwegian index, and the number shown', () => {
  assert.deepEqual([1, 1.99, 2, 2.99, 3, 3.99, 4, 7].map(levelOf), [1, 1, 2, 2, 3, 3, 4, 4]);
  assert.deepEqual([1, 2, 3, 4, 5].map(levelKey), ['low', 'moderate', 'high', 'very_high', null]);
  assert.equal(displayIndex(1.6056), 1.6);
  assert.equal(displayIndex(1.4968), 1.5);
  // Never across a boundary: 1.96 is low, shown 1.9.
  assert.equal(displayIndex(1.96), 1.9);
  assert.equal(displayIndex(2.96), 2.9);
  assert.equal(displayIndex(2.0), 2);
});

test('now and the worst hour of the next 24; nothing past the series', () => {
  const { hours } = parseForecast(fixture('forecast-oslo'));
  const now = Date.parse('2026-10-24T09:22:00Z');
  const { current, peak } = evaluate(hours, now);
  assert.equal(current.at, Date.parse('2026-10-24T09:00:00Z'));
  assert.equal(peak.at, Date.parse('2026-10-25T07:00:00Z'));
  assert.equal(evaluate(hours, Date.parse('2026-10-24T05:59:00Z')), null);
  assert.equal(evaluate(hours, Date.parse('2026-10-26T13:00:00Z')), null);
  // A newer run replaces its hours; old hours go.
  const merged = mergeHours(hours, [{ at: hours[3].at, aqi: 3 }], now);
  assert.equal(merged.find((hour) => hour.at === hours[3].at).aqi, 3);
  assert.ok(merged[0].at >= now - 3 * 3_600_000);
});

test('the API errors: outside Norway, unknown station, throttled', async () => {
  const answer =
    (status, body, headers = {}) =>
    async () =>
      new Response(JSON.stringify(body), { status, headers });
  await assert.rejects(
    fetchForecast(
      { lat: 48.8566, lon: 2.3522, areaLevel: 'grunnkrets' },
      { fetch: answer(400, { detail: 'unknown location: (2.3522,48.8566)' }) },
    ),
    (err) => err instanceof ApiError && err.outside && !err.unknownStation,
  );
  await assert.rejects(
    fetchForecast(
      { station: 'XX' },
      { fetch: answer(400, { detail: 'undefined station requested' }) },
    ),
    (err) => err.unknownStation,
  );
  await assert.rejects(
    fetchForecast({ station: 'NO0057A' }, { fetch: answer(429, {}, { 'retry-after': '120' }) }),
    (err) => err.status === 429 && err.retryAfterMs === 120_000,
  );
  await assert.rejects(
    fetchForecast(
      { station: 'NO0057A' },
      {
        fetch: async () => {
          throw Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNRESET' } });
        },
      },
    ),
    (err) => err.unreachable && /ECONNRESET/.test(err.message),
  );
});

test('the station search folds the Norwegian letters', () => {
  assert.equal(fold('Tromsø Ålesund Bærum'), 'tromso alesund baerum');
  const stations = [
    { id: 'A', name: 'Tromsø Hansjordnesbukta', municipality: 'Tromsø', lat: 69.65, lon: 18.96 },
    { id: 'B', name: 'Alnabru', municipality: 'Oslo', lat: 59.93, lon: 10.85 },
  ];
  assert.deepEqual(
    searchStations(stations, { query: 'tromso' }).map((s) => s.id),
    ['A'],
  );
  assert.deepEqual(
    searchStations(stations, { origin: { lat: 59.91, lon: 10.75 } }).map((s) => s.id),
    ['B', 'A'],
  );
});
