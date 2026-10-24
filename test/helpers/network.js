// -----------------------------------------------------------------------------
// A simulated MET Norway air quality API, answering with the real responses
// recorded on 2026-10-24 around 11:20 Oslo time (test/fixtures/met): the
// neighbourhoods of Oslo (Sentrum), Bergen (Vaskerelven) and Trondheim
// (Midtbyen), the station Alnabru (NO0057A), and the station list. The
// pollution fractions are trimmed from all but Oslo. Tests never touch the
// real network.
//
// It honours `If-Modified-Since` (304 while the forecast did not change) and
// answers `Expires` 5 minutes ahead, as the real API does.
// -----------------------------------------------------------------------------

import { existsSync, readFileSync } from 'node:fs';

const url = (name) => new URL(`../fixtures/met/${name}.json`, import.meta.url);

/** A recorded answer, parsed (null when there is none). */
export function fixture(name) {
  return existsSync(url(name)) ? JSON.parse(readFileSync(url(name), 'utf8')) : null;
}

/** City-centre points of the fixtures, and the station. */
export const OSLO = { lat: 59.9139, lon: 10.7522 };
export const BERGEN = { lat: 60.3913, lon: 5.3221 };
export const TRONDHEIM = { lat: 63.4305, lon: 10.3951 };
export const PARIS = { lat: 48.8566, lon: 2.3522 };
export const ALNABRU = 'NO0057A';

/** The houses of Gladys for these points. */
export const HOUSES = {
  oslo: { id: 'h1', name: 'Hjemme', selector: 'hjemme', latitude: OSLO.lat, longitude: OSLO.lon },
  bergen: {
    id: 'h2',
    name: 'Hytta',
    selector: 'hytta',
    latitude: BERGEN.lat,
    longitude: BERGEN.lon,
  },
  trondheim: {
    id: 'h3',
    name: 'Leilighet',
    selector: 'leilighet',
    latitude: TRONDHEIM.lat,
    longitude: TRONDHEIM.lon,
  },
  paris: {
    id: 'h4',
    name: 'Maison',
    selector: 'maison',
    latitude: PARIS.lat,
    longitude: PARIS.lon,
  },
  unlocated: { id: 'h5', name: 'Bureau', selector: 'bureau', latitude: null, longitude: null },
};

const FIXTURE_BY_POINT = new Map([
  [`${OSLO.lat},${OSLO.lon}`, 'forecast-oslo'],
  [`${BERGEN.lat},${BERGEN.lon}`, 'forecast-bergen'],
  [`${TRONDHEIM.lat},${TRONDHEIM.lon}`, 'forecast-trondheim'],
]);

/**
 * A forecast whose overall index follows `aqiAt(hourMs)` (the pollutants'
 * sub-indexes follow: PM2.5 sets it), for scene tests.
 * @param {string} name fixture
 * @param {(at: number) => number|undefined} aqiAt
 */
export function withIndex(name, aqiAt) {
  const body = fixture(name);
  for (const entry of body.data.time) {
    const aqi = aqiAt(Date.parse(entry.from));
    if (aqi !== undefined) {
      entry.variables.AQI.value = aqi;
      entry.variables.AQI_pm25.value = aqi;
    }
  }
  return body;
}

/**
 * @param {object} [options]
 * @param {() => number} [options.now]
 */
export function createNetwork({ now = () => Date.now() } = {}) {
  const calls = [];
  const network = {
    /** Every request: { path, headers }. */
    calls,
    /** Overrides by fixture name ("forecast-oslo", "station-NO0057A"): a body, an Error, or { status, body? }. */
    routes: {},
    /** Last-Modified of each answer, by fixture name (changes when a route changes). */
    versions: {},
    /** The whole API unreachable. */
    down: false,
    fetch,
  };

  const httpDate = (ms) => new Date(ms).toUTCString();

  function answer(name, fallback, headers) {
    const route = network.routes[name];
    if (route instanceof Error) {
      throw route;
    }
    if (route && typeof route === 'object' && typeof route.status === 'number') {
      return new Response(JSON.stringify(route.body ?? { detail: 'error' }), {
        status: route.status,
        headers: { 'content-type': 'application/json', ...(route.headers ?? {}) },
      });
    }
    const body = route ?? fallback;
    if (!body) {
      return new Response(JSON.stringify({ detail: 'unknown location: (0,0)' }), { status: 400 });
    }
    const text = JSON.stringify(body);
    const version = network.versions[name];
    if (!version || version.text !== text) {
      network.versions[name] = { text, at: httpDate(now()) };
    }
    const lastModified = network.versions[name].at;
    const common = { expires: httpDate(now() + 5 * 60_000), 'last-modified': lastModified };
    if (headers['if-modified-since'] === lastModified) {
      return new Response(null, { status: 304, headers: common });
    }
    return new Response(text, {
      status: 200,
      headers: { 'content-type': 'application/json', ...common },
    });
  }

  async function fetch(href, init = {}) {
    const target = new URL(String(href));
    const headers = Object.fromEntries(
      Object.entries(init.headers ?? {}).map(([key, value]) => [key.toLowerCase(), value]),
    );
    calls.push({ path: `${target.pathname}${target.search}`, headers });
    if (network.down) {
      throw Object.assign(new TypeError('fetch failed'), { cause: { code: 'ENOTFOUND' } });
    }
    if (target.pathname.endsWith('/stations')) {
      return answer('stations', fixture('stations'), headers);
    }
    const station = target.searchParams.get('station');
    if (station) {
      const name = `station-${station}`;
      const body = fixture(`forecast-${name}`);
      if (!body && !network.routes[name]) {
        return new Response(JSON.stringify({ detail: 'undefined station requested' }), {
          status: 400,
        });
      }
      return answer(name, body, headers);
    }
    const point = `${target.searchParams.get('lat')},${target.searchParams.get('lon')}`;
    const name = FIXTURE_BY_POINT.get(point);
    if (!name) {
      return new Response(
        JSON.stringify({
          detail: `unknown location: (${target.searchParams.get('lon')},${target.searchParams.get('lat')})`,
        }),
        { status: 400 },
      );
    }
    return answer(name, fixture(name), headers);
  }

  return network;
}
