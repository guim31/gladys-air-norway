// -----------------------------------------------------------------------------
// Integration configuration.
//
// The configuration is filled in by the user in Gladys, from the `config_schema`
// declared in `gladys-assistant-integration.json`. This module provides the
// defaults and normalizes the received object, so the rest of the code never
// deals with `undefined`, strings typed with spaces, or invalid values.
// -----------------------------------------------------------------------------

/** The languages of the Gladys interface, the ones every text carries. */
export const LANGUAGES = ['en', 'fr', 'de', 'es'];

/**
 * The areas MET Norway forecasts for, finest first (the `areaclass` of the
 * API): a neighbourhood (grunnkrets), a district (delområde), a municipality
 * (kommune).
 */
export const AREA_LEVELS = ['grunnkrets', 'delomrade', 'kommune'];

/** At most this many stations are read, on top of the houses. */
export const MAX_STATIONS = 10;

// Defaults: they MUST stay consistent with the `default` values declared in the
// `config_schema` of the manifest (test/manifest.test.js checks it).
export const DEFAULT_CONFIG = {
  area_level: 'grunnkrets', // the area of a house's forecast
  stations: '', // measuring station codes, e.g. "NO0057A, NO0011A"
  language: 'fr', // language of the feature names and of the generated texts
};

/**
 * Merge the user config with the defaults and normalize every value.
 * @param {Record<string, unknown>} [raw] config returned by the SDK
 */
export function normalizeConfig(raw = {}) {
  const ids = parseStationIds(raw.stations ?? DEFAULT_CONFIG.stations);
  const areaLevel = String(raw.area_level ?? DEFAULT_CONFIG.area_level).trim();
  const language = String(raw.language ?? DEFAULT_CONFIG.language).trim();
  return {
    areaLevel: AREA_LEVELS.includes(areaLevel) ? areaLevel : DEFAULT_CONFIG.area_level,
    stationIds: ids.valid.slice(0, MAX_STATIONS),
    invalidStationIds: ids.invalid,
    droppedStationIds: ids.valid.slice(MAX_STATIONS),
    language: LANGUAGES.includes(language) ? language : DEFAULT_CONFIG.language,
  };
}

/**
 * Split a typed list of station codes, as MET Norway lists them: mostly EoI
 * codes of the European network ("NO0057A", upper-cased here), a few local
 * ones ("Loallme", case-sensitive for the API). Commas, semicolons and spaces
 * separate them. Duplicates are dropped, the order is kept.
 * @param {unknown} text
 * @returns {{ valid: string[], invalid: string[] }}
 */
export function parseStationIds(text) {
  const valid = [];
  const invalid = [];
  for (const token of String(text).split(/[\s,;]+/)) {
    if (token === '') {
      continue;
    }
    const id = /^no\d{4}[a-z]$/i.test(token) ? token.toUpperCase() : token;
    if (/^[A-Za-z0-9]{3,16}$/.test(id)) {
      if (!valid.includes(id)) {
        valid.push(id);
      }
    } else {
      invalid.push(token);
    }
  }
  return { valid, invalid };
}
