// -----------------------------------------------------------------------------
// The measuring stations of MET Norway (about 80), for the "Find a station"
// button: read on demand, kept in memory a day, searched by name or
// municipality, or sorted by distance to a house.
// -----------------------------------------------------------------------------

import { fetchStations } from './api.js';

const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export class Catalog {
  /**
   * @param {{ deps: { fetch?: typeof fetch }, now?: () => number }} options
   */
  constructor({ deps, now = () => Date.now() }) {
    this.deps = deps;
    this.now = now;
    this.stations = null;
    this.readAt = 0;
  }

  /** The station list, read again past a day. */
  async ensure() {
    if (!this.stations || this.now() - this.readAt >= MAX_AGE_MS) {
      this.stations = await fetchStations(this.deps);
      this.readAt = this.now();
    }
    return this.stations;
  }
}

/**
 * Lower case, without accents; the Norwegian letters spelled out (ø → o,
 * æ → ae, å → a), so "Tromso" finds "Tromsø".
 */
export function fold(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/ø/g, 'o')
    .replace(/æ/g, 'ae')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim();
}

/** Great-circle distance in km. */
export function distanceKm(a, b) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/**
 * The stations matching a name or municipality (every word), sorted by
 * distance to `origin` when given, else by name.
 * @param {Array<{ id: string, name: string, municipality: string|null, lat: number, lon: number }>} stations
 * @param {{ query?: string, origin?: { lat: number, lon: number } }} options
 */
export function searchStations(stations, { query = '', origin } = {}) {
  const words = fold(query).split(/\s+/).filter(Boolean);
  const found = stations
    .filter((station) => {
      const haystack = fold(`${station.name} ${station.municipality ?? ''} ${station.id}`);
      return words.every((word) => haystack.includes(word));
    })
    .map((station) =>
      origin ? { ...station, distanceKm: distanceKm(origin, station) } : { ...station },
    );
  return origin
    ? found.sort((a, b) => a.distanceKm - b.distanceKm)
    : found.sort((a, b) => a.name.localeCompare(b.name, 'nb'));
}
