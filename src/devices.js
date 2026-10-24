// -----------------------------------------------------------------------------
// The Gladys devices: one per place followed — a house of Gladys (its
// location, in Norway) or a measuring station.
//
// External ids (forever, see CLAUDE.md):
//   ext:<selector>:house:<house selector>
//   ext:<selector>:station:<station code>
//   features :index, :quality, :pm25, :pm10, :no2, :o3, :peak_index, :peak_quality
//
// Features (all forecasts of MET Norway, for the hour that is now):
//   - index        : the Norwegian air quality index, `airquality-sensor/aqi`,
//                    1 (and below 2) low to 4 and more very high, one decimal;
//   - quality      : its level as a word, in the configured language (text/text);
//   - pm25, pm10, no2, o3 : the concentrations, µg/m³;
//   - peak_index   : the highest index of the next 24 hours;
//   - peak_quality : its level as a word.
// -----------------------------------------------------------------------------

import {
  DEVICE_FEATURE_CATEGORIES as CATEGORIES,
  DEVICE_FEATURE_TYPES as TYPES,
  DEVICE_FEATURE_UNITS as UNITS,
} from '@gladysassistant/integration-sdk';
import { POLLUTANTS } from './api.js';
import { NAMES } from './i18n.js';

export const INDEX_KEY = 'index';
export const QUALITY_KEY = 'quality';
export const PEAK_INDEX_KEY = 'peak_index';
export const PEAK_QUALITY_KEY = 'peak_quality';

/** Every feature, in display order. */
export const FEATURE_KEYS = [
  INDEX_KEY,
  QUALITY_KEY,
  ...POLLUTANTS,
  PEAK_INDEX_KEY,
  PEAK_QUALITY_KEY,
];

const concentration = (category, max) => ({
  category,
  type: TYPES.SENSOR.DECIMAL,
  unit: UNITS.MICROGRAM_PER_CUBIC_METER,
  min: 0,
  max,
  keep_history: true,
});

const index = {
  category: CATEGORIES.AIRQUALITY_SENSOR,
  type: TYPES.AIRQUALITY_SENSOR.AQI,
  unit: UNITS.AQI,
  // Display bounds (Gladys never clamps a state with them): the scale
  // starts at 1, "very high" from 4.
  min: 1,
  max: 5,
  keep_history: true,
};

const text = {
  category: CATEGORIES.TEXT,
  type: TYPES.TEXT.TEXT,
  min: 0,
  max: 0,
  keep_history: false,
};

const SHAPES = {
  index,
  quality: text,
  pm25: concentration(CATEGORIES.PM25_SENSOR, 500),
  pm10: concentration(CATEGORIES.PM10_SENSOR, 500),
  no2: concentration(CATEGORIES.NO2_SENSOR, 400),
  o3: concentration(CATEGORIES.O3_SENSOR, 400),
  peak_index: { ...index, keep_history: false },
  peak_quality: text,
};

/** The external ids of a place ("house:<selector>" or "station:<code>"). */
export function idsOf(gladys, placeId) {
  const [kind, ...rest] = String(placeId).split(':');
  return gladys.externalIds(kind, rest.join(':'));
}

/** The place id ("house:maison", "station:NO0057A") of a device or feature external id, or null. */
export function placeIdOf(gladys, externalId) {
  const prefix = gladys.externalId('');
  const text = String(externalId ?? '');
  if (!text.startsWith(prefix)) {
    return null;
  }
  const match = /^(house|station):([^:]+)/.exec(text.slice(prefix.length));
  return match ? `${match[1]}:${match[2]}` : null;
}

/** The device name: the source and the place, never translated. */
export function deviceName(record) {
  return `MET Norway ${record.label || record.name || record.id.split(':')[1]}`;
}

/**
 * The discovery payload of a place.
 * @param {object} gladys
 * @param {{ id: string, label?: string, name?: string }} record
 * @param {string} language language of the feature names
 */
export function buildDevice(gladys, record, language) {
  const names = NAMES[language] ?? NAMES.fr;
  const ids = idsOf(gladys, record.id);
  return {
    name: deviceName(record),
    external_id: ids.device,
    model: record.id.startsWith('station:') ? 'Station' : 'Forecast',
    // A forecast run every 6 hours, read hourly: the container reads the
    // places on its own timer (src/poller.js), well beyond the 60 s the core
    // can schedule.
    should_poll: false,
    features: FEATURE_KEYS.map((key) => ({
      name: names[key],
      external_id: ids.feature(key),
      ...SHAPES[key],
      read_only: true,
      has_feedback: false,
    })),
    params: [{ name: 'place', value: record.id }],
  };
}
