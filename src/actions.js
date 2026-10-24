// -----------------------------------------------------------------------------
// The buttons of the Configuration screen (manifest `actions`).
//
//   find_station : the MET Norway measuring stations matching a name, or the
//                  nearest to a house of Gladys, with their code — to type
//                  in "Stations".
//   check_places : what MET Norway forecasts now for each place followed.
// -----------------------------------------------------------------------------

import { searchStations } from './catalog.js';
import { deviceName } from './devices.js';
import { MESSAGES, TEXT } from './i18n.js';

export const ACTION = {
  FIND_STATION: 'find_station',
  CHECK_PLACES: 'check_places',
};

/** The search lists this many stations at most (the message stays readable). */
const MAX_LISTED = 8;

/**
 * @param {object} gladys
 * @param {import('./hub.js').Hub} hub
 * @param {{ query?: string, house?: string }} fields
 */
export async function findStation(gladys, hub, fields) {
  const query = String(fields.query ?? '').trim();
  let origin;
  let houseName;
  if (fields.house || !query) {
    const houses = (await gladys.getHouses()).filter(
      (house) => typeof house.latitude === 'number' && typeof house.longitude === 'number',
    );
    const house = fields.house
      ? houses.find((candidate) => candidate.selector === fields.house)
      : houses[0];
    if (!house && !query) {
      throw new Error(MESSAGES.thrown(TEXT.noHouse));
    }
    if (house) {
      origin = { lat: house.latitude, lon: house.longitude };
      houseName = house.name;
    }
  }
  let stations;
  try {
    stations = await hub.catalog.ensure();
  } catch {
    throw new Error(MESSAGES.thrown(TEXT.catalogUnavailable));
  }
  const found = searchStations(stations, { query, origin });
  return MESSAGES.found({
    query,
    house: houseName,
    stations: found.slice(0, MAX_LISTED),
    more: Math.max(0, found.length - MAX_LISTED),
  });
}

/**
 * Read every place (unless read in the last minute) and report.
 * @param {import('./hub.js').Hub} hub
 * @param {ReturnType<import('./poller.js').createPoller>} poller
 * @param {object} config the normalized config
 */
export async function checkPlaces(hub, poller, config) {
  await hub.loadHouses();
  const ids = hub.units(config);
  const lines = [];
  if (ids.length === 0) {
    lines.push(TEXT.nothingConfigured);
  } else {
    await poller.refreshNow(ids, { maxAgeMs: 60_000 });
  }
  for (const id of ids) {
    const record = hub.records.get(id);
    const result = hub.lastResults.get(id);
    const snap = hub.snapshot(record);
    lines.push(
      MESSAGES.checkPlace({
        name: record ? deviceName(record) : id,
        level: snap?.key ?? null,
        index: snap?.index,
        peak:
          snap && snap.peak.level > snap.level ? { level: snap.peak.key, at: snap.peak.at } : null,
        error:
          result && !result.ok && !result.outside && !result.unknownStation ? result.error : null,
        outside: record?.outside === true,
        unknownStation: record?.unknownStation === true,
      }),
    );
  }
  if (config.invalidStationIds.length > 0) {
    lines.push(MESSAGES.invalidIds(config.invalidStationIds));
  }
  if (config.droppedStationIds.length > 0) {
    lines.push(MESSAGES.tooManyIds(config.stationIds.length));
  }
  return Object.fromEntries(
    Object.keys(lines[0]).map((lang) => [lang, lines.map((line) => line[lang]).join('\n')]),
  );
}
