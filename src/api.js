// -----------------------------------------------------------------------------
// The MET Norway air quality forecast API (Airqualityforecast 0.1), open,
// without key: the only module that knows its URLs and field names.
//
//   GET https://api.met.no/weatherapi/airqualityforecast/0.1/
//       ?lat=..&lon=..&areaclass=grunnkrets|delomrade|kommune
//       ?station=<code>
//   GET .../stations   the measuring stations (82 on 2026-10-24)
//
// An answer is an hourly series (about 55 hours, from 06:00 UTC of the run's
// day) of the Norwegian AQI — 1 to 2 low, 2 to 3 moderate, 3 to 4 high, 4 and
// more very high — overall and per pollutant, with the concentrations in
// µg/m³. A point outside Norway is a 400 "unknown location", an unknown
// station a 400 "undefined station requested".
//
// The terms of MET Norway (https://api.met.no/doc/TermsOfService) ask:
//   - an identifying User-Agent with a contact (a generic one gets 403);
//   - coordinates with 4 decimals at most;
//   - no request before the `Expires` of the previous answer, then a
//     conditional one (`If-Modified-Since`): 304 when nothing changed;
//   - 429 means throttled: slow down at once.
// -----------------------------------------------------------------------------

import { readFileSync } from 'node:fs';

export const API_URL = 'https://api.met.no/weatherapi/airqualityforecast/0.1';

const CONTACT = 'github.com/guim31/gladys-air-norway';
const PACKAGE = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
export const USER_AGENT = `gladys-air-norway/${PACKAGE.version} ${CONTACT}`;

const TIMEOUT_MS = 20_000;

/** The pollutants of the forecast, in display order, by our key. */
export const POLLUTANTS = ['pm25', 'pm10', 'no2', 'o3'];

export class ApiError extends Error {
  /**
   * @param {string} message
   * @param {{ status?: number, unreachable?: boolean, outside?: boolean, unknownStation?: boolean, retryAfterMs?: number|null }} [details]
   */
  constructor(message, details = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = details.status;
    /** No answer at all (DNS, network, timeout): one problem for every place. */
    this.unreachable = details.unreachable === true;
    /** The point is outside the forecast area (Norway). */
    this.outside = details.outside === true;
    /** The station code is not one MET Norway knows. */
    this.unknownStation = details.unknownStation === true;
    this.retryAfterMs = details.retryAfterMs ?? null;
  }
}

/** Coordinates with 4 decimals at most (the terms of MET Norway). */
const coordinate = (value) => String(Math.round(Number(value) * 10_000) / 10_000);

/**
 * The query of a place.
 * @param {{ station?: string, lat?: number, lon?: number, areaLevel?: string }} place
 */
export function queryOf(place) {
  const params = new URLSearchParams();
  if (place.station) {
    params.set('station', place.station);
  } else {
    params.set('lat', coordinate(place.lat));
    params.set('lon', coordinate(place.lon));
    params.set('areaclass', place.areaLevel);
  }
  return params.toString();
}

const readDate = (value) => {
  const ms = Date.parse(value ?? '');
  return Number.isFinite(ms) ? ms : null;
};

/** The reason of an error answer: JSON `detail`, or the first line of a text. */
function reasonOf(text) {
  try {
    const detail = JSON.parse(text)?.detail;
    if (typeof detail === 'string') {
      return detail.slice(0, 200);
    }
  } catch {
    // plain text
  }
  const line = String(text ?? '')
    .split('\n')
    .map((item) => item.trim())
    .find((item) => item !== '' && !/^<|^\d{3} /.test(item));
  return line ? line.slice(0, 200) : null;
}

/**
 * GET a path of the API.
 * @param {string} path
 * @param {{ fetch?: typeof fetch, lastModified?: string|null }} [options]
 * @returns {Promise<{ status: number, body: any, expiresAt: number|null, lastModified: string|null }>}
 */
async function get(path, { fetch: fetchImpl = globalThis.fetch, lastModified = null } = {}) {
  const headers = { accept: 'application/json', 'user-agent': USER_AGENT };
  if (lastModified) {
    headers['if-modified-since'] = lastModified;
  }
  let response;
  try {
    response = await fetchImpl(`${API_URL}${path}`, {
      headers,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    const reason = err?.name === 'TimeoutError' ? 'timeout' : err?.cause?.code || err?.message;
    throw new ApiError(`MET Norway unreachable (${reason})`, { unreachable: true });
  }
  const expiresAt = readDate(response.headers.get('expires'));
  const received = response.headers.get('last-modified');
  if (response.status === 304) {
    return { status: 304, body: null, expiresAt, lastModified: received ?? lastModified };
  }
  if (!response.ok) {
    const reason = reasonOf(await response.text().catch(() => ''));
    const retryAfter = Number(response.headers.get('retry-after'));
    throw new ApiError(`MET Norway: HTTP ${response.status}${reason ? ` (${reason})` : ''}`, {
      status: response.status,
      outside: response.status === 400 && /unknown location/i.test(reason ?? ''),
      unknownStation: response.status === 400 && /undefined station/i.test(reason ?? ''),
      retryAfterMs: Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : null,
    });
  }
  let body;
  try {
    body = await response.json();
  } catch {
    throw new ApiError('MET Norway: unreadable answer', { status: response.status });
  }
  return { status: response.status, body, expiresAt, lastModified: received };
}

const number = (value) => {
  const parsed = typeof value === 'string' ? Number(value) : value;
  return typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : null;
};

/**
 * The neutral form of a forecast answer.
 * @param {any} body
 * @returns {{ name: string|null, areaCode: string|null, path: string|null, reftime: number|null, hours: Array<object> }}
 */
export function parseForecast(body) {
  const location = body?.meta?.location ?? {};
  const hours = [];
  for (const entry of body?.data?.time ?? []) {
    const at = readDate(entry?.from);
    // The series ends with an aggregate over the next local day ("from"
    // 22:00 UTC "to" 22:00 UTC the day after, its maxima): hours only.
    const to = readDate(entry?.to);
    if (to !== null && to !== at) {
      continue;
    }
    const variables = entry?.variables ?? {};
    const value = (key) => number(variables[key]?.value);
    const aqi = value('AQI');
    if (at === null || aqi === null) {
      continue;
    }
    const hour = { at, aqi, sub: {}, values: {} };
    for (const key of POLLUTANTS) {
      const sub = value(`AQI_${key}`);
      const concentration = value(`${key}_concentration`);
      if (sub !== null) {
        hour.sub[key] = sub;
      }
      if (concentration !== null) {
        hour.values[key] = concentration;
      }
    }
    hours.push(hour);
  }
  hours.sort((a, b) => a.at - b.at);
  // MET Norway pads the station names with double spaces ("Sentrum 2  - Rode 11").
  const clean = (text) => (typeof text === 'string' ? text.replace(/\s+/g, ' ').trim() : null);
  return {
    name: clean(location.name) || null,
    areaCode: clean(location.areacode),
    path: clean(location.path),
    reftime: readDate(body?.meta?.reftime),
    hours,
  };
}

/**
 * The forecast of a place, conditional on `lastModified`.
 * @param {{ station?: string, lat?: number, lon?: number, areaLevel?: string }} place
 * @param {{ fetch?: typeof fetch, lastModified?: string|null }} [options]
 * @returns {Promise<{ status: number, forecast: ReturnType<typeof parseForecast>|null, expiresAt: number|null, lastModified: string|null }>}
 */
export async function fetchForecast(place, options = {}) {
  const answer = await get(`/?${queryOf(place)}`, options);
  if (answer.status === 304) {
    return { ...answer, forecast: null };
  }
  const forecast = parseForecast(answer.body);
  if (forecast.hours.length === 0) {
    throw new ApiError('MET Norway: a forecast without any hour', { status: answer.status });
  }
  return {
    status: answer.status,
    forecast,
    expiresAt: answer.expiresAt,
    lastModified: answer.lastModified,
  };
}

/**
 * The measuring stations.
 * @param {{ fetch?: typeof fetch }} [options]
 * @returns {Promise<Array<{ id: string, name: string, municipality: string|null, lat: number, lon: number }>>}
 */
export async function fetchStations(options = {}) {
  const { body } = await get('/stations', options);
  if (!Array.isArray(body)) {
    throw new ApiError('MET Norway: unreadable station list');
  }
  return body
    .map((item) => ({
      id: String(item?.eoi ?? ''),
      name: String(item?.name ?? '').trim(),
      municipality: item?.kommune?.name ?? null,
      lat: number(item?.latitude),
      lon: number(item?.longitude),
    }))
    .filter((item) => item.id !== '' && item.name !== '' && item.lat !== null && item.lon !== null);
}
