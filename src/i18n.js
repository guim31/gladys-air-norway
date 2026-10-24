// -----------------------------------------------------------------------------
// Every text the integration produces, in the four languages of the Gladys
// interface: English, French, German ("du") and Spanish ("usted").
//
// The four levels of the Norwegian air quality index are translated from their
// official names (lite, moderat, høy, svært høy forurensning).
// -----------------------------------------------------------------------------

import { LEVEL_KEYS } from './forecast.js';

export { LEVEL_KEYS };

const LANGS = ['en', 'fr', 'de', 'es'];

export const LEVELS = {
  low: { en: 'Low', fr: 'Faible', de: 'Gering', es: 'Bajo' },
  moderate: { en: 'Moderate', fr: 'Modéré', de: 'Mäßig', es: 'Moderado' },
  high: { en: 'High', fr: 'Élevé', de: 'Hoch', es: 'Alto' },
  very_high: { en: 'Very high', fr: 'Très élevé', de: 'Sehr hoch', es: 'Muy alto' },
};

/** Chemical formulas: the same in every language. */
export const FORMULAS = {
  pm25: 'PM2.5',
  pm10: 'PM10',
  no2: 'NO₂',
  o3: 'O₃',
};

/** Feature names, by language (fixed when the device is added). */
export const NAMES = {
  en: {
    index: 'Air quality index',
    quality: 'Air quality',
    pm25: 'PM2.5',
    pm10: 'PM10',
    no2: 'Nitrogen dioxide (NO₂)',
    o3: 'Ozone (O₃)',
    peak_index: 'Highest index, next 24 h',
    peak_quality: 'Air quality, next 24 h',
  },
  fr: {
    index: "Indice de qualité de l'air",
    quality: "Qualité de l'air",
    pm25: 'PM2.5',
    pm10: 'PM10',
    no2: "Dioxyde d'azote (NO₂)",
    o3: 'Ozone (O₃)',
    peak_index: 'Indice maximal sur 24 h',
    peak_quality: "Qualité de l'air sur 24 h",
  },
  de: {
    index: 'Luftqualitätsindex',
    quality: 'Luftqualität',
    pm25: 'PM2.5',
    pm10: 'PM10',
    no2: 'Stickstoffdioxid (NO₂)',
    o3: 'Ozon (O₃)',
    peak_index: 'Höchster Index, nächste 24 Std.',
    peak_quality: 'Luftqualität, nächste 24 Std.',
  },
  es: {
    index: 'Índice de calidad del aire',
    quality: 'Calidad del aire',
    pm25: 'PM2.5',
    pm10: 'PM10',
    no2: 'Dióxido de nitrógeno (NO₂)',
    o3: 'Ozono (O₃)',
    peak_index: 'Índice máximo, próximas 24 h',
    peak_quality: 'Calidad del aire, próximas 24 h',
  },
};

/** Fixed texts. */
export const TEXT = {
  notConfigured: {
    en: 'Nothing to follow: set the location of a house in Norway (Settings → Houses), or type a station.',
    fr: 'Rien à suivre : placez une maison en Norvège (Paramètres → Maisons), ou saisissez une station.',
    de: 'Nichts zu verfolgen: lege den Standort eines Hauses in Norwegen fest (Einstellungen → Zuhause) oder gib eine Station ein.',
    es: 'Nada que seguir: ubique una casa en Noruega (Configuración → Viviendas) o escriba una estación.',
  },
  apiUnreachable: {
    en: 'MET Norway does not answer: the forecasts are not updated.',
    fr: 'MET Norway ne répond pas : les prévisions ne sont plus mises à jour.',
    de: 'MET Norway antwortet nicht: Die Vorhersagen werden nicht aktualisiert.',
    es: 'MET Norway no responde: las previsiones no se actualizan.',
  },
  initFailed: {
    en: 'The integration could not start: see the Logs tab.',
    fr: "L'intégration n'a pas pu démarrer : voir l'onglet Journaux.",
    de: 'Die Integration konnte nicht starten: siehe Reiter Protokolle.',
    es: 'La integración no pudo iniciarse: consulte la pestaña Registros.',
  },
  noReading: {
    en: 'No air quality forecast yet.',
    fr: "Pas encore de prévision de la qualité de l'air.",
    de: 'Noch keine Vorhersage der Luftqualität.',
    es: 'Todavía no hay previsión de la calidad del aire.',
  },
  noPlace: {
    en: 'No place added to Gladys yet.',
    fr: 'Aucun lieu ajouté à Gladys.',
    de: 'Noch kein Ort zu Gladys hinzugefügt.',
    es: 'Ningún lugar añadido a Gladys.',
  },
  unknownPlace: {
    en: 'This place is no longer followed: check the configuration.',
    fr: "Ce lieu n'est plus suivi : vérifiez la configuration.",
    de: 'Dieser Ort wird nicht mehr verfolgt: prüfe die Konfiguration.',
    es: 'Este lugar ya no se sigue: compruebe la configuración.',
  },
  nothingConfigured: {
    en: 'No house located in Norway and no station.',
    fr: 'Aucune maison située en Norvège, aucune station.',
    de: 'Kein Haus mit Standort in Norwegen und keine Station.',
    es: 'Ninguna casa ubicada en Noruega y ninguna estación.',
  },
  noHouse: {
    en: 'Type a name, or set the location of a house in Settings → Houses.',
    fr: 'Saisissez un nom, ou placez une maison dans Paramètres → Maisons.',
    de: 'Gib einen Namen ein oder lege den Standort eines Hauses unter Einstellungen → Zuhause fest.',
    es: 'Escriba un nombre, o defina la ubicación de una casa en Configuración → Viviendas.',
  },
  catalogUnavailable: {
    en: 'The station list of MET Norway cannot be read now: try again in a minute.',
    fr: 'La liste des stations de MET Norway est illisible pour le moment : réessayez dans une minute.',
    de: 'Die Stationsliste von MET Norway ist gerade nicht lesbar: versuche es in einer Minute erneut.',
    es: 'La lista de estaciones de MET Norway no se puede leer ahora: inténtelo de nuevo en un minuto.',
  },
  now: { en: 'Now', fr: 'Maintenant', de: 'Jetzt', es: 'Ahora' },
  next24h: { en: 'Next 24 h', fr: 'Sur 24 h', de: 'Nächste 24 Std.', es: 'Próximas 24 h' },
  next24hInline: { en: 'next 24 h', fr: 'sur 24 h', de: 'nächste 24 Std.', es: 'próximas 24 h' },
  noData: {
    en: 'No forecast',
    fr: 'Pas de prévision',
    de: 'Keine Vorhersage',
    es: 'Sin previsión',
  },
  source: {
    en: 'Norwegian index · MET Norway forecast',
    fr: 'Indice norvégien · prévision MET Norway',
    de: 'Norwegischer Index · Vorhersage von MET Norway',
    es: 'Índice noruego · previsión de MET Norway',
  },
};

/** "15:00": an hour in the local time of Gladys (the supervisor sets TZ). */
export function formatHour(ms) {
  const date = new Date(ms);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/** A number with one decimal at most. */
export function formatNumber(value) {
  return String(Math.round(value * 10) / 10);
}

const colonOf = (lang) => (lang === 'fr' ? ' :' : ':');
const each = (build) => Object.fromEntries(LANGS.map((lang) => [lang, build(lang)]));

/** Texts built from values. */
export const MESSAGES = {
  /** "Moderate at 15:00" (the worst hour of the next 24). */
  peakAt(level, at) {
    const hour = formatHour(at);
    return {
      en: `${LEVELS[level].en} at ${hour}`,
      fr: `${LEVELS[level].fr} à ${hour}`,
      de: `${LEVELS[level].de} um ${hour}`,
      es: `${LEVELS[level].es} a las ${hour}`,
    };
  },

  /**
   * "MET Norway Home: Low (1.6) · PM2.5 2.8 µg/m³ · … · next 24 h: Moderate at 15:00".
   * @param {{ place: string, level: string|null, index?: number, values?: Record<string, number>, peak?: { level: string, at: number }|null }} options
   */
  summary({ place, level, index, values = {}, peak = null }) {
    const parts = ['pm25', 'pm10', 'no2', 'o3']
      .filter((key) => typeof values[key] === 'number')
      .map((key) => `${FORMULAS[key]} ${formatNumber(values[key])} µg/m³`);
    const later = peak ? MESSAGES.peakAt(peak.level, peak.at) : null;
    return each((lang) => {
      const head = level
        ? `${place}${colonOf(lang)} ${LEVELS[level][lang]} (${formatNumber(index)})`
        : `${place}${colonOf(lang)} ${TEXT.noData[lang]}`;
      const tail = later ? [`${TEXT.next24h[lang]}${colonOf(lang)} ${later[lang]}`] : [];
      return [head, ...parts, ...tail].join(' · ');
    });
  },

  /** An error thrown to Gladys: one text, the four languages joined. */
  thrown(text) {
    return LANGS.map((lang) => text[lang]).join(' / ');
  },

  /** The status of the Configuration screen when no place is in Norway. */
  outsideNorway(names) {
    const list = names.join(', ');
    return {
      en: `Outside Norway, where MET Norway has no air quality forecast: ${list}.`,
      fr: `Hors de Norvège, où MET Norway n'a pas de prévision de qualité de l'air : ${list}.`,
      de: `Außerhalb Norwegens, wo MET Norway keine Luftqualitätsvorhersage hat: ${list}.`,
      es: `Fuera de Noruega, donde MET Norway no tiene previsión de calidad del aire: ${list}.`,
    };
  },

  /** The status of the Configuration screen when only unknown station codes are left. */
  unknownStations(codes) {
    const list = codes.join(', ');
    return {
      en: `Unknown station codes: ${list}. Use "Find a station".`,
      fr: `Codes de station inconnus : ${list}. Utilisez « Trouver une station ».`,
      de: `Unbekannte Stationscodes: ${list}. Nutze „Station finden“.`,
      es: `Códigos de estación desconocidos: ${list}. Use «Buscar una estación».`,
    };
  },

  /** One line of the "Check the places" report. */
  checkPlace({ name, level, index, peak, error, outside, unknownStation }) {
    if (outside) {
      return {
        en: `${name}: outside Norway, no forecast there`,
        fr: `${name} : hors de Norvège, pas de prévision`,
        de: `${name}: außerhalb Norwegens, keine Vorhersage`,
        es: `${name}: fuera de Noruega, sin previsión`,
      };
    }
    if (unknownStation) {
      return {
        en: `${name}: not a MET Norway station (see "Find a station")`,
        fr: `${name} : pas une station de MET Norway (voir « Trouver une station »)`,
        de: `${name}: keine Station von MET Norway (siehe „Station finden“)`,
        es: `${name}: no es una estación de MET Norway (vea «Buscar una estación»)`,
      };
    }
    if (error) {
      return each(
        (lang) =>
          `${name}${colonOf(lang)} ${lang === 'de' ? 'Fehler' : lang === 'fr' ? 'erreur' : 'error'} (${error})`,
      );
    }
    if (!level) {
      return each((lang) => `${name}${colonOf(lang)} ${TEXT.noData[lang]}`);
    }
    const later = peak ? MESSAGES.peakAt(peak.level, peak.at) : null;
    return each(
      (lang) =>
        `${name}${colonOf(lang)} ${LEVELS[level][lang]} (${formatNumber(index)})` +
        (later ? `, ${TEXT.next24hInline[lang]}${colonOf(lang)} ${later[lang]}` : ''),
    );
  },

  invalidIds(ids) {
    const list = ids.join(', ');
    return {
      en: `Ignored, not station codes: ${list}`,
      fr: `Ignorés, ce ne sont pas des codes de station : ${list}`,
      de: `Ignoriert, keine Stationscodes: ${list}`,
      es: `Ignorados, no son códigos de estación: ${list}`,
    };
  },

  tooManyIds(max) {
    return {
      en: `Only the first ${max} stations are read.`,
      fr: `Seules les ${max} premières stations sont lues.`,
      de: `Nur die ersten ${max} Stationen werden gelesen.`,
      es: `Solo se leen las ${max} primeras estaciones.`,
    };
  },

  /**
   * The result of "Find a station".
   * @param {{ query: string, house?: string, stations: Array<{ id: string, name: string, municipality?: string|null, distanceKm?: number }>, more: number }} options
   */
  found({ query, house, stations, more }) {
    const where = query
      ? {
          en: `for "${query}"`,
          fr: `pour « ${query} »`,
          de: `für „${query}“`,
          es: `para «${query}»`,
        }
      : {
          en: `near ${house}`,
          fr: `autour de ${house}`,
          de: `in der Nähe von ${house}`,
          es: `cerca de ${house}`,
        };
    if (stations.length === 0) {
      return {
        en: `No MET Norway station ${where.en}.`,
        fr: `Aucune station de MET Norway ${where.fr}.`,
        de: `Keine Station von MET Norway ${where.de}.`,
        es: `Ninguna estación de MET Norway ${where.es}.`,
      };
    }
    const lines = stations.map((station) => {
      const extra = [
        station.municipality,
        station.distanceKm === undefined ? null : `${formatNumber(station.distanceKm)} km`,
      ].filter(Boolean);
      return `${station.id} ${station.name}${extra.length ? ` (${extra.join(', ')})` : ''}`;
    });
    const head = {
      en: `MET Norway stations ${where.en}, codes to type in "Stations":`,
      fr: `Stations de MET Norway ${where.fr}, codes à saisir dans « Stations » :`,
      de: `Stationen von MET Norway ${where.de}, Codes für „Stationen“:`,
      es: `Estaciones de MET Norway ${where.es}, códigos para escribir en «Estaciones»:`,
    };
    const tail = more
      ? {
          en: `…and ${more} more: refine the search.`,
          fr: `…et ${more} autres : affinez la recherche.`,
          de: `…und ${more} weitere: verfeinere die Suche.`,
          es: `…y ${more} más: afine la búsqueda.`,
        }
      : null;
    return each((lang) => [head[lang], ...lines, ...(tail ? [tail[lang]] : [])].join('\n'));
  },
};
