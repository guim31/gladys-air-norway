// -----------------------------------------------------------------------------
// Scene action "Get the air quality" (Gladys 5.1+).
//
// Gives a scene the air quality of one place, or of the worst of the added
// places, as outputs a notification can quote: "{{...summary}}" reads
// "MET Norway Home: Low (1.6) · PM2.5 2.8 µg/m³ · … · Next 24 h: Moderate at 08:00".
// The devices already give each value to the scene conditions; what this
// action adds is the choice of the worst place, the levels as words in the
// configured language, the hour of the coming peak, and a ready-made sentence.
//
// The triggers are fired by the hub (src/hub.js) on each hourly evaluation.
// -----------------------------------------------------------------------------

import { formatHour, LEVELS, MESSAGES, TEXT } from './i18n.js';

export const GET_AIR_QUALITY = 'get_air_quality';

/**
 * @param {import('./hub.js').Hub} hub
 * @param {{ place?: string }} fields
 * @param {string} language
 */
export function getAirQuality(hub, fields, language) {
  const created = hub
    .configuredRecords()
    .filter((record) => hub.isCreated(record) && hub.snapshot(record));
  let record;
  if (fields.place) {
    record = created.find((candidate) => candidate === hub.recordByDevice(fields.place));
  } else {
    // The worst current index; the first place on a tie.
    record = [...created].sort((a, b) => hub.snapshot(b).index - hub.snapshot(a).index)[0];
  }
  const snap = record ? hub.snapshot(record) : null;
  if (!snap) {
    throw new Error(MESSAGES.thrown(TEXT.noReading));
  }
  const outputs = {
    summary: hub.summary(record, language),
    place_name: hub.nameOf(record),
    level: snap.key,
    level_label: LEVELS[snap.key][language],
    index: snap.index,
    pollutant: hub.formulas(snap.pollutants) || null,
    pm25: snap.values.pm25 ?? null,
    pm10: snap.values.pm10 ?? null,
    no2: snap.values.no2 ?? null,
    o3: snap.values.o3 ?? null,
    peak_level: snap.peak.key,
    peak_level_label: LEVELS[snap.peak.key][language],
    peak_index: snap.peak.index,
    peak_time: formatHour(snap.peak.at),
  };
  // A value the forecast lacks is left out (null for the scene).
  return Object.fromEntries(Object.entries(outputs).filter(([, value]) => value !== null));
}
