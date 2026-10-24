# Air quality Norway for Gladys Assistant

External integration for [Gladys Assistant](https://gladysassistant.com) that
brings the **air quality forecast of [MET Norway](https://www.met.no)** (the
Norwegian Meteorological Institute) into Gladys: the Norwegian air quality
index and its pollutants, for the hour that is now and the next 24 hours, at
the scale of the neighbourhood.

This integration is **not affiliated with MET Norway**.

Looking for an air quality anywhere in the world? See
[`prohand/gladys-airquality`](https://github.com/prohand/gladys-airquality)
(Copernicus CAMS, a global model). Here: the official Norwegian model, down to
the neighbourhood (grunnkrets). Measurements rather than forecasts:
[`guim31/gladys-sensor-community`](https://github.com/guim31/gladys-sensor-community)
(citizen sensors), [`guim31/gladys-gios`](https://github.com/guim31/gladys-gios)
(Polish stations).

## What it does

- **One device per place**: each house of Gladys located in Norway (its
  neighbourhood, district or municipality, to choose), and the measuring
  stations typed in the configuration. A **Find a station** button searches
  them by name, or lists the nearest to a house.
- Each device: the Norwegian **air quality index** for the hour (below 2 low,
  2 to 3 moderate, 3 to 4 high, 4 and more very high) and its level as a word,
  the **PM2.5, PM10, NO₂ and O₃** concentrations (µg/m³), and the **highest
  index of the next 24 hours** with its level.
- Three scene triggers: **air quality degraded** (the level now rises to
  "moderate" or worse), **degradation forecast** (the worst level of the next
  24 hours does, with the hour of the peak) and **back to normal**; a scene
  action **Get the air quality** (one place or the worst, with a sentence
  ready for a notification); an **Air quality Norway** dashboard widget.
- A house outside Norway gets a clear message on the Configuration screen:
  MET Norway has no air quality forecast there.

Read only. Tested against the real API (Oslo, Bergen, Trondheim, the station
Alnabru): the test fixtures are its recorded answers.

The user documentation, in [English](docs/en.md), [French](docs/fr.md),
[German](docs/de.md) and [Spanish](docs/es.md), is re-hosted by Gladys behind
the **Documentation** link of the Configuration screen.

## Requirements

- Gladys Assistant **5.2.0** or later (the station search uses the house
  picker of 5.2.0; the widget and the scene cards need 5.1).
- A house located in Norway, or a Norwegian station code.
- Internet access to `api.met.no`.

## Installation

In Gladys, open **Integrations → Install from GitHub** and enter
`https://github.com/guim31/gladys-air-norway`. Then fill the Configuration
tab: see [the documentation](docs/en.md#configuration).

## Respect of the API

The [terms of MET Norway](https://api.met.no/doc/TermsOfService) are followed:

- a `User-Agent` naming the integration, its version and this repository;
- coordinates with 4 decimals at most;
- each place read **once an hour** at most, never before the `Expires` of the
  previous answer, with `If-Modified-Since` (a 304 downloads nothing); the
  hour moves on without any request;
- a 429 pauses every request (its `Retry-After`, else 30 minutes), a 403 for
  6 hours;
- only the places whose device was added to Gladys are read (and, once, the
  new ones, to list them in the Discovery tab); a place outside Norway is
  tried again once a day.

Data © MET Norway, under the [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)
licence.

## Limits

- A forecast, not a measurement: a station device gives the model at the
  station, not what the station measures.
- Norway only; the Norwegian index, not the European one.
- The pollution fractions of the API (traffic, heating, shipping…) are left
  out.

## Development

```bash
npm install
npm run format:check   # Prettier
npm run lint           # ESLint
npm test               # node --test, against the SDK's fake Gladys
```

The tests never touch the network: they run on the answers of the MET Norway
API recorded on 24 October 2026 (`test/fixtures/met`). The architecture and
the rules of the project are in [`CLAUDE.md`](CLAUDE.md).

## Credits

- [MET Norway](https://www.met.no) (Meteorologisk institutt), with the
  Norwegian Institute for Air Research (NILU) and the Norwegian Environment
  Agency, for the air quality forecast, the index and the open API.
- The Home Assistant [`norway_air` integration](https://www.home-assistant.io/integrations/norway_air/)
  and the [`pyMetno`](https://github.com/Danielhiversen/pyMetno) library by
  Daniel Høyer Iversen (MIT): the API usage and the index levels, read for
  reference, nothing copied.
- The logo on the cover is the MET Norway logo, from
  [met.no](https://www.met.no); it only names the data source.
- Built from the official
  [JavaScript template](https://github.com/GladysAssistant/integration-template-js)
  and SDK [`@gladysassistant/integration-sdk`](https://github.com/GladysAssistant/integration-sdk-js).

## License

[Apache-2.0](LICENSE)
