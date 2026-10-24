// -----------------------------------------------------------------------------
// The places the integration follows, what it knows about them, and what it
// publishes to Gladys.
//
// A place is a house of Gladys with a location (its forecast for the
// neighbourhood, district or municipality around it), or a measuring station
// typed in the configuration. Reading a place (refresh) keeps its hourly
// forecast in a "record", persisted under /data; every hour, the record gives
// the current values and the worst hour of the next 24 (src/forecast.js),
// published as the states of its Gladys device (src/devices.js).
//
// MET Norway runs the model a few times a day: a place is read hourly, by a
// conditional request (304 when nothing changed), never before the `Expires`
// of the previous answer. The current hour moves without any request.
//
// Scene triggers, evaluated every hour:
//   air_quality_degraded          the current level rises to "moderate" or worse;
//   air_quality_forecast_degraded the worst level of the next 24 h does;
//   air_quality_back_to_normal    the current level comes back to "low".
// The first evaluation after the install sets the starting levels, without event.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { ApiError, fetchForecast, queryOf } from './api.js';
import { Catalog } from './catalog.js';
import {
  FEATURE_KEYS,
  INDEX_KEY,
  PEAK_INDEX_KEY,
  PEAK_QUALITY_KEY,
  QUALITY_KEY,
  buildDevice,
  deviceName,
  idsOf,
  placeIdOf,
} from './devices.js';
import {
  DEGRADED_FROM,
  displayIndex,
  displayValue,
  dominantPollutants,
  evaluate,
  levelKey,
  levelOf,
  mergeHours,
} from './forecast.js';
import { createIssueLog } from './issues.js';
import { FORMULAS, LEVELS, MESSAGES, formatHour } from './i18n.js';

const logger = createLogger({ name: 'places' });

const HOUR_MS = 3_600_000;

/** A place is read again this often (if its answer expired). */
export const READ_EVERY_MS = HOUR_MS;

/** A place outside Norway, or an unknown station, is tried again this often. */
const RETRY_UNKNOWN_MS = 24 * HOUR_MS;

/** Pause of every request after a 429 without Retry-After, and after a 403. */
const THROTTLED_PAUSE_MS = 30 * 60_000;
const FORBIDDEN_PAUSE_MS = 6 * HOUR_MS;

/** An unchanged value is published again this often (Gladys: "no recent value" past 48 h). */
export const STATE_HEARTBEAT_MS = 6 * HOUR_MS;

/**
 * A level seen longer ago than this is no reference for a scene event (the
 * container was stopped, the device added days later): the next one starts
 * afresh, without event.
 */
const ANNOUNCED_MAX_AGE_MS = 3 * HOUR_MS;

/** Keys of the scene triggers. */
export const TRIGGER = {
  DEGRADED: 'air_quality_degraded',
  FORECAST_DEGRADED: 'air_quality_forecast_degraded',
  BACK_TO_NORMAL: 'air_quality_back_to_normal',
};

const STORE_VERSION = 1;

export class Hub {
  /**
   * @param {object} options
   * @param {object} options.gladys GladysIntegration (or the SDK's fake Gladys)
   * @param {() => object} options.getConfig the current normalized config
   * @param {{ load: Function, save: Function }} options.store
   * @param {typeof fetch} [options.fetch]
   * @param {() => number} [options.now]
   */
  constructor({ gladys, getConfig, store, fetch, now = () => Date.now() }) {
    this.gladys = gladys;
    this.getConfig = getConfig;
    this.store = store;
    this.deps = { fetch };
    this.now = now;
    this.catalog = new Catalog({ deps: this.deps, now });
    /** Record by place id ("house:<selector>", "station:<code>"). */
    this.records = new Map();
    /** The located houses of Gladys, as last read. */
    this.houses = [];
    /** Set when the device list must be published again. */
    this.devicesChanged = false;
    /** Set when the widget content changed. */
    this.widgetChanged = false;
    this.persistNeeded = false;
    /** Scene events waiting for the publication of their place's states. */
    this.pendingEvents = new Map();
    /** Outcome of the last read of each place: { ok, error?, outside?, unknownStation? }. */
    this.lastResults = new Map();
    /** No request before this time (429, 403). */
    this.pausedUntil = 0;
    this.issues = createIssueLog(logger);
  }

  async load() {
    const data = await this.store.load();
    if (data.version !== STORE_VERSION) {
      return;
    }
    for (const record of data.records ?? []) {
      if (record && /^(house|station):[^:]+$/.test(String(record.id))) {
        this.records.set(record.id, record);
      }
    }
    if (Array.isArray(data.houses)) {
      this.houses = data.houses;
    }
  }

  async persist() {
    await this.store.save({
      version: STORE_VERSION,
      houses: this.houses,
      records: [...this.records.values()],
    });
  }

  /** Persist if anything changed since the last save. */
  async save() {
    if (this.persistNeeded) {
      this.persistNeeded = false;
      await this.persist();
    }
  }

  /**
   * Read the houses of Gladys again (a local call; no update event exists).
   * A failure keeps the previous list.
   */
  async loadHouses() {
    try {
      const houses = (await this.gladys.getHouses())
        .filter(
          (house) => typeof house.latitude === 'number' && typeof house.longitude === 'number',
        )
        .map((house) => ({
          selector: house.selector,
          name: house.name,
          lat: house.latitude,
          lon: house.longitude,
        }));
      this.issues.ok('houses', 'The houses of Gladys are readable again');
      if (JSON.stringify(houses) !== JSON.stringify(this.houses)) {
        this.houses = houses;
        this.persistNeeded = true;
      }
    } catch (err) {
      this.issues.fail('houses', `Cannot read the houses of Gladys: ${err.message}`);
    }
  }

  /** The places to follow: the located houses, then the stations. */
  places(config = this.getConfig()) {
    return [
      ...this.houses.map((house) => ({
        id: `house:${house.selector}`,
        label: house.name,
        lat: house.lat,
        lon: house.lon,
        areaLevel: config.areaLevel,
      })),
      ...config.stationIds.map((code) => ({ id: `station:${code}`, station: code })),
    ];
  }

  /** The configured place ids. */
  units(config = this.getConfig()) {
    return this.places(config).map((place) => place.id);
  }

  /** The records of the configured places, in order. */
  configuredRecords(config = this.getConfig()) {
    return this.units(config)
      .map((id) => this.records.get(id))
      .filter(Boolean);
  }

  /** The record of a device (or feature) external id, if configured. */
  recordByDevice(externalId) {
    const id = placeIdOf(this.gladys, externalId);
    return id && this.units().includes(id) ? this.records.get(id) : undefined;
  }

  /** True when the user added the place's device to Gladys. */
  isCreated(record) {
    const id = idsOf(this.gladys, record.id).device;
    return (this.gladys.devices ?? []).some((device) => device.external_id === id);
  }

  /** The name the user gave the device in Gladys, else ours. */
  nameOf(record) {
    const id = idsOf(this.gladys, record.id).device;
    return (
      (this.gladys.devices ?? []).find((device) => device.external_id === id)?.name ||
      deviceName(record)
    );
  }

  /** True once MET Norway gave a forecast for the place. */
  isKnown(record) {
    return Boolean(record?.fetchedAt) && !record.outside && !record.unknownStation;
  }

  /** The discovery payloads of the configured places with a forecast. */
  buildDevices(config = this.getConfig()) {
    return this.configuredRecords(config)
      .filter((record) => this.isKnown(record))
      .map((record) => buildDevice(this.gladys, record, config.language));
  }

  /** The configured places MET Norway does not cover, by name. */
  outsideNames(config = this.getConfig()) {
    return this.configuredRecords(config)
      .filter((record) => record.outside || record.unknownStation)
      .map((record) => record.label || record.id.split(':')[1]);
  }

  /**
   * True when the place should be read now: never read, moved, or read
   * `minAgeMs` ago (an hour by default) with an expired answer.
   */
  isDue(record, place, minAgeMs = READ_EVERY_MS) {
    if (!record?.fetchedAt || record.query !== queryOf(place)) {
      return true;
    }
    const age = this.now() - record.fetchedAt;
    if (record.outside || record.unknownStation) {
      // Tried again daily, or at once when the user asks (a shorter minAgeMs).
      return age >= (minAgeMs < READ_EVERY_MS ? minAgeMs : RETRY_UNKNOWN_MS);
    }
    return age >= minAgeMs && (record.expiresAt ?? 0) <= this.now();
  }

  /** True while a 429 or a 403 holds every request. */
  isPaused() {
    return this.now() < this.pausedUntil;
  }

  /**
   * What a place says now: `{ level, key, index, values, pollutants, peak }`,
   * or null when its forecast does not cover the hour.
   */
  snapshot(record) {
    const result = evaluate(record?.hours, this.now());
    if (!result) {
      return null;
    }
    const { current, peak } = result;
    const level = levelOf(current.aqi);
    const peakLevel = levelOf(peak.aqi);
    const values = {};
    for (const [key, value] of Object.entries(current.values)) {
      values[key] = displayValue(value);
    }
    return {
      level,
      key: levelKey(level),
      index: displayIndex(current.aqi),
      values,
      pollutants: dominantPollutants(current),
      peak: {
        level: peakLevel,
        key: levelKey(peakLevel),
        index: displayIndex(peak.aqi),
        at: peak.at,
        pollutants: dominantPollutants(peak),
      },
    };
  }

  /**
   * Read one place: its forecast, conditional on the last answer.
   * @param {{ id: string, label?: string, station?: string }} place
   */
  async refresh(place) {
    const record = this.records.get(place.id) ?? { id: place.id, hours: [] };
    this.records.set(place.id, record);
    const query = queryOf(place);
    if (record.query !== query) {
      // Another point or area: the old forecast is not this place's.
      Object.assign(record, { query, hours: [], lastModified: null, expiresAt: null });
    }
    if (place.label && record.label !== place.label) {
      record.label = place.label;
      this.devicesChanged = true;
    }
    const wasKnown = this.isKnown(record);
    try {
      const answer = await fetchForecast(place, {
        fetch: this.deps.fetch,
        lastModified: record.lastModified,
      });
      record.fetchedAt = this.now();
      record.expiresAt = answer.expiresAt;
      record.lastModified = answer.lastModified;
      record.outside = false;
      record.unknownStation = false;
      if (answer.forecast) {
        const { forecast } = answer;
        record.hours = mergeHours(record.hours, forecast.hours, this.now());
        record.reftime = forecast.reftime;
        record.area = forecast.path;
        if (forecast.name && record.name !== forecast.name) {
          if (!record.label && place.station) {
            record.label = forecast.name;
          }
          record.name = forecast.name;
          this.devicesChanged = true;
        }
      }
      if (!wasKnown) {
        this.devicesChanged = true;
        logger.info(`${deviceName(record)}: forecast found (${record.area ?? record.name ?? '-'})`);
      }
      this.persistNeeded = true;
      this.lastResults.set(place.id, { ok: true });
      this.issues.ok(`place:${place.id}`, `${deviceName(record)}: read again`);
      this.issues.ok('api', 'MET Norway answers again');
      logger.debug(`${deviceName(record)}: HTTP ${answer.status}`);
      return record;
    } catch (err) {
      this.lastResults.set(place.id, {
        ok: false,
        error: err.message,
        outside: err.outside === true,
        unknownStation: err.unknownStation === true,
      });
      if (err instanceof ApiError && (err.outside || err.unknownStation)) {
        // Known for good: no device, a status message, tried again tomorrow.
        record.fetchedAt = this.now();
        record.outside = err.outside;
        record.unknownStation = err.unknownStation;
        record.hours = [];
        this.persistNeeded = true;
        if (wasKnown) {
          this.devicesChanged = true;
        }
        this.issues.fail(
          `place:${place.id}`,
          `${deviceName(record)}: ${err.outside ? 'outside Norway' : 'unknown station'}`,
        );
      } else if (err instanceof ApiError && (err.status === 429 || err.status === 403)) {
        const pause =
          err.status === 403 ? FORBIDDEN_PAUSE_MS : (err.retryAfterMs ?? THROTTLED_PAUSE_MS);
        this.pausedUntil = this.now() + pause;
        this.issues.fail('api', `${err.message}: no request for ${Math.round(pause / 60_000)} min`);
      } else if (err instanceof ApiError && err.unreachable) {
        this.issues.fail('api', err.message);
      } else {
        this.issues.fail(`place:${place.id}`, `${deviceName(record)}: ${err.message}`);
      }
      throw err;
    }
  }

  /**
   * The hourly evaluation of every configured place: its levels, the scene
   * events they raise, whether the widget must be refreshed.
   */
  evaluateAll() {
    for (const record of this.configuredRecords()) {
      const snap = this.snapshot(record);
      const signature = snap ? JSON.stringify(snap) : null;
      if (signature !== (record.lastSignature ?? null)) {
        record.lastSignature = signature;
        this.widgetChanged = true;
        this.persistNeeded = true;
      }
      if (!snap || !this.isCreated(record)) {
        continue;
      }
      for (const event of [this.currentEvent(record, snap), this.peakEvent(record, snap)]) {
        if (event) {
          const list = this.pendingEvents.get(record.id) ?? [];
          list.push(event);
          this.pendingEvents.set(record.id, list);
        }
      }
    }
  }

  /** The previous level of a mark, null when none or too old. */
  previous(mark) {
    const recent = typeof mark?.at === 'number' && this.now() - mark.at <= ANNOUNCED_MAX_AGE_MS;
    return recent ? mark.level : null;
  }

  /** The events of the current level, if any. */
  currentEvent(record, snap) {
    const mark = record.current ?? {};
    const previous = this.previous(mark);
    const { level } = snap;
    record.current = { level, at: this.now(), worst: mark.worst ?? null };
    this.persistNeeded = true;
    if (previous === null) {
      record.current.worst = level >= DEGRADED_FROM ? level : null;
      return null;
    }
    const language = this.getConfig().language;
    const common = this.eventCommon(record, snap.key, language);
    if (level >= DEGRADED_FROM && level > previous) {
      record.current.worst = Math.max(mark.worst ?? level, level);
      return {
        key: TRIGGER.DEGRADED,
        data: {
          ...common,
          index: snap.index,
          previous_level: levelKey(previous),
          pollutant: this.formulas(snap.pollutants),
          summary: this.summary(record, language),
        },
      };
    }
    if (level < DEGRADED_FROM && previous >= DEGRADED_FROM) {
      const worst = Math.max(mark.worst ?? previous, previous);
      record.current.worst = null;
      return {
        key: TRIGGER.BACK_TO_NORMAL,
        data: {
          ...common,
          index: snap.index,
          worst_level: levelKey(worst),
          worst_level_label: LEVELS[levelKey(worst)][language],
          summary: this.summary(record, language),
        },
      };
    }
    if (level >= DEGRADED_FROM) {
      record.current.worst = Math.max(mark.worst ?? level, level);
    }
    return null;
  }

  /** The event of the worst level of the next 24 h, if it rises. */
  peakEvent(record, snap) {
    const previous = this.previous(record.peak);
    const { peak } = snap;
    record.peak = { level: peak.level, at: this.now() };
    this.persistNeeded = true;
    if (previous === null || peak.level < DEGRADED_FROM || peak.level <= previous) {
      return null;
    }
    const language = this.getConfig().language;
    return {
      key: TRIGGER.FORECAST_DEGRADED,
      data: {
        ...this.eventCommon(record, peak.key, language),
        index: peak.index,
        previous_level: levelKey(previous),
        time: formatHour(peak.at),
        hours_ahead: Math.max(0, Math.round((peak.at - this.now()) / HOUR_MS)),
        pollutant: this.formulas(peak.pollutants),
        summary: this.summary(record, language),
      },
    };
  }

  eventCommon(record, key, language) {
    return {
      place: idsOf(this.gladys, record.id).device,
      place_name: this.nameOf(record),
      level: key,
      level_label: LEVELS[key][language],
    };
  }

  /** "PM2.5, NO₂" */
  formulas(keys) {
    return keys.map((key) => FORMULAS[key]).join(', ');
  }

  /** The ready-made sentence of a place, in a language. */
  summary(record, language) {
    const snap = this.snapshot(record);
    // The coming hours are worth a word only when they get worse.
    const peak =
      snap && snap.peak.level > snap.level ? { level: snap.peak.key, at: snap.peak.at } : null;
    return MESSAGES.summary({
      place: this.nameOf(record),
      level: snap?.key ?? null,
      index: snap?.index,
      values: snap?.values,
      peak,
    })[language];
  }

  /**
   * Publish the states of a place whose device exists in Gladys. Only the
   * changes go out (the SDK deduplicates), plus a heartbeat.
   * @param {object} record
   * @param {{ force?: boolean }} [options] force: the device was just added
   */
  async publishStates(record, { force = false } = {}) {
    if (!this.isCreated(record)) {
      this.pendingEvents.delete(record.id);
      return;
    }
    const ids = idsOf(this.gladys, record.id);
    if (force) {
      this.gladys.forgetPublishedStates(ids.device);
    }
    const language = this.getConfig().language;
    const snap = this.snapshot(record);
    const states = [];
    const state = (key, value) =>
      states.push({
        device_feature_external_id: ids.feature(key),
        ...(typeof value === 'string' ? { text: value } : { state: value }),
      });
    if (snap) {
      state(INDEX_KEY, snap.index);
      state(QUALITY_KEY, LEVELS[snap.key][language]);
      for (const key of FEATURE_KEYS) {
        if (typeof snap.values[key] === 'number') {
          state(key, snap.values[key]);
        }
      }
      state(PEAK_INDEX_KEY, snap.peak.index);
      state(PEAK_QUALITY_KEY, LEVELS[snap.peak.key][language]);
    }
    let failure = null;
    if (states.length > 0) {
      try {
        await this.gladys.publishChangedStates(states, { heartbeat: STATE_HEARTBEAT_MS });
      } catch (err) {
        failure = err;
      }
    }
    // The events go out even if the states failed: the marks already moved.
    const events = this.pendingEvents.get(record.id) ?? [];
    while (events.length > 0) {
      const event = events[0];
      await this.gladys.publishSceneEvent(event.key, event.data);
      events.shift();
      logger.info(`${deviceName(record)}: ${event.key} (${event.data.level})`);
    }
    this.pendingEvents.delete(record.id);
    if (failure) {
      throw failure;
    }
  }

  /** Forget the records of the places no longer configured. */
  prune(config = this.getConfig()) {
    const kept = new Set(this.units(config));
    for (const id of this.records.keys()) {
      if (!kept.has(id)) {
        this.records.delete(id);
        this.persistNeeded = true;
      }
    }
  }
}
