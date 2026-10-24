// -----------------------------------------------------------------------------
// Reading a forecast: the hour that is now, the worst hour of the next 24, the
// level of an index.
//
// The Norwegian air quality index (luftkvalitetsindeks) of MET Norway and the
// Norwegian Institute of Public Health is a continuous number: below 2 low
// (lite), 2 to 3 moderate (moderat), 3 to 4 high (høy), 4 and more very high
// (svært høy). The overall index is the highest of the pollutants' ones.
// -----------------------------------------------------------------------------

import { POLLUTANTS } from './api.js';

/** The levels, from 1 (low) to 4 (very high), by stable key (scene filters and outputs). */
export const LEVEL_KEYS = ['low', 'moderate', 'high', 'very_high'];

/** From this level on, the air quality is degraded ("moderate", 2). */
export const DEGRADED_FROM = 2;

const HOUR_MS = 3_600_000;

/** The look-ahead of the forecast maximum. */
export const HORIZON_MS = 24 * HOUR_MS;

/** Hours kept before now (a forecast run that starts later still has a current hour). */
const KEEP_PAST_MS = 3 * HOUR_MS;

/**
 * The level of an index: 1 low, 2 moderate, 3 high, 4 very high.
 * @param {number} aqi
 */
export function levelOf(aqi) {
  if (aqi < 2) {
    return 1;
  }
  if (aqi < 3) {
    return 2;
  }
  return aqi < 4 ? 3 : 4;
}

/** The key of a level ("low"...), null for none. */
export function levelKey(level) {
  return LEVEL_KEYS[level - 1] ?? null;
}

/**
 * The index as published: one decimal, but never rounded across a level
 * boundary (1.96 is "low": 1.9, not 2.0).
 */
export function displayIndex(aqi) {
  const rounded = Math.round(aqi * 10) / 10;
  return levelOf(rounded) > levelOf(aqi) ? Math.floor(aqi * 10) / 10 : rounded;
}

/** A concentration as published: one decimal. */
export function displayValue(value) {
  return Math.round(value * 10) / 10;
}

/**
 * Merge a new series into the known one: the new run wins hour by hour, the
 * hours older than a few hours are dropped.
 * @param {Array<{ at: number }>} known
 * @param {Array<{ at: number }>} fresh
 * @param {number} now
 */
export function mergeHours(known, fresh, now) {
  const byHour = new Map();
  for (const hour of [...(known ?? []), ...fresh]) {
    byHour.set(hour.at, hour);
  }
  return [...byHour.values()]
    .filter((hour) => hour.at >= now - KEEP_PAST_MS)
    .sort((a, b) => a.at - b.at);
}

/** The pollutants setting the index of an hour (their sub-index is the highest). */
export function dominantPollutants(hour) {
  const subs = POLLUTANTS.filter((key) => typeof hour?.sub?.[key] === 'number');
  if (subs.length === 0) {
    return [];
  }
  const highest = Math.max(...subs.map((key) => hour.sub[key]));
  return subs.filter((key) => hour.sub[key] >= highest - 1e-9);
}

/**
 * What a series says now: the current hour, and the worst hour from now to
 * 24 hours ahead. Null when the series does not cover now.
 * @param {Array<object>} hours sorted by time
 * @param {number} now
 * @returns {{ current: object, peak: object } | null}
 */
export function evaluate(hours, now) {
  const list = hours ?? [];
  let current = null;
  for (const hour of list) {
    if (hour.at <= now && now - hour.at < HOUR_MS) {
      current = hour;
    }
  }
  if (!current) {
    return null;
  }
  let peak = current;
  for (const hour of list) {
    if (hour.at > current.at && hour.at <= now + HORIZON_MS && hour.aqi > peak.aqi) {
      peak = hour;
    }
  }
  return { current, peak };
}
