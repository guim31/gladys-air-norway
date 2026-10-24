// -----------------------------------------------------------------------------
// The "Air quality" dashboard widget (Gladys 5.1+).
//
// With a place chosen in its settings: live tiles of its four pollutants
// (bound to the device features, so they follow every state), the level now
// and the worst level of the next 24 hours, colored by band. Without one: one
// row per added place, its level now.
//
// The content is built from what the integration already read: showing the
// widget never calls the API. The core caches it per (settings, language,
// units), so the texts are localized in the language it asks for.
// -----------------------------------------------------------------------------

import { WIDGET_COLORS } from '@gladysassistant/integration-sdk';
import { POLLUTANTS } from './api.js';
import { FORMULAS, LEVELS, MESSAGES, TEXT, formatNumber } from './i18n.js';
import { idsOf } from './devices.js';
import { LANGUAGES } from './config.js';

export const WIDGET_KEY = 'air_quality';

/** Seconds the core keeps a content: the values move hourly. */
const TTL_SECONDS = 300;

/** Rows of the all-places view. */
const MAX_ROWS = 10;

/** Color of a level: low green, moderate orange, high and very high red. */
export function levelColor(level) {
  if (level <= 1) {
    return WIDGET_COLORS.SUCCESS;
  }
  return level === 2 ? WIDGET_COLORS.WARNING : WIDGET_COLORS.DANGER;
}

const clip = (text, max) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

/** The level row of a place: its label and color, neutral without forecast. */
function levelItem(snap, label, language) {
  if (!snap) {
    return { label, value: TEXT.noData[language], color: WIDGET_COLORS.NEUTRAL };
  }
  return {
    label,
    value: clip(`${LEVELS[snap.key][language]} (${formatNumber(snap.index)})`, 40),
    color: levelColor(snap.level),
  };
}

/**
 * The widget content.
 * @param {object} options
 * @param {import('./hub.js').Hub} options.hub
 * @param {object} options.gladys
 * @param {{ place?: string }} [options.settings]
 * @param {string} [options.language]
 */
export function buildAirQualityContent({ hub, gladys, settings = {}, language = 'en' }) {
  const lang = LANGUAGES.includes(language) ? language : 'en';
  const caption = { type: 'text', variant: 'caption', text: TEXT.source[lang] };

  if (settings.place) {
    const record = hub.recordByDevice(settings.place);
    if (!record) {
      return {
        ttl_seconds: TTL_SECONDS,
        components: [{ type: 'text', text: TEXT.unknownPlace[lang] }],
      };
    }
    const ids = idsOf(gladys, record.id);
    const snap = hub.snapshot(record);
    const tiles = POLLUTANTS.map((key) => ({
      type: 'value',
      label: FORMULAS[key],
      device_feature: ids.feature(key),
    }));
    const items = [levelItem(snap, TEXT.now[lang], lang)];
    if (snap) {
      items.push({
        label: TEXT.next24h[lang],
        value: clip(MESSAGES.peakAt(snap.peak.key, snap.peak.at)[lang], 40),
        color: levelColor(snap.peak.level),
        icon: 'clock',
      });
    }
    return {
      ttl_seconds: TTL_SECONDS,
      components: [...tiles, { type: 'status', items }, caption],
    };
  }

  const created = hub.configuredRecords().filter((record) => hub.isCreated(record));
  if (created.length === 0) {
    return {
      ttl_seconds: TTL_SECONDS,
      components: [{ type: 'text', text: TEXT.noPlace[lang] }],
    };
  }
  return {
    ttl_seconds: TTL_SECONDS,
    components: [
      {
        type: 'status',
        items: created
          .slice(0, MAX_ROWS)
          .map((record) => levelItem(hub.snapshot(record), clip(hub.nameOf(record), 40), lang)),
      },
      caption,
    ],
  };
}
