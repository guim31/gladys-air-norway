# Air quality Norway

## What it does

This integration brings the **air quality forecast of MET Norway**, the Norwegian Meteorological Institute, into Gladys: the Norwegian air quality index and the pollutants it is made of, for the hour that is now and the next 24 hours. The model is the official Norwegian one (the same as the luftkvalitet.info map), down to the neighbourhood.

- **One device per place**: each house of Gladys located in Norway, and the measuring stations you add.
- **Scene triggers**: air quality degraded now, degradation forecast within 24 hours, back to normal.
- **A scene action** giving the air quality of a place, with a sentence ready for a notification.
- **A dashboard widget**: the pollutants, the level now and over the next 24 hours.

Read only, through the open API of MET Norway (`api.met.no`): no account, no key. Not affiliated with MET Norway.

## Requirements

- Gladys Assistant **5.2.0** or later.
- A house located **in Norway** (Settings → Houses → location), or the code of a Norwegian measuring station. MET Norway has no air quality forecast elsewhere.
- Internet access to `api.met.no`.

## Configuration

| Field               | What to enter                                                                                                                                                                                           |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Area around a house | The area whose forecast a house gets: its **neighbourhood** (grunnkrets, the default, the finest), its **district** (delområde) or its **municipality** (kommune).                                      |
| Stations            | Optional. Codes of measuring stations to follow too, separated by commas (10 at most), for example `NO0057A`. The **Find a station** button gives them, by name or around a house, with their distance. |
| Language            | Language of the feature names (set when a device is added) and of the scene texts. French by default.                                                                                                   |

Every house with a location becomes a device in the **Discovery** tab, if it is in Norway. A house outside Norway is left out, and said in the status of the Configuration screen when no place is left.

The **Check the places** button reads every place now and tells what MET Norway forecasts: the level, and the worst level of the next 24 hours.

## Devices

Each place (house or station) gives one device, named `MET Norway <house or station>`, with:

| Feature                  | Meaning                                                                                                            |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| Air quality index        | The Norwegian index for the hour that is now: **below 2 low, 2 to 3 moderate, 3 to 4 high, 4 and more very high**. |
| Air quality              | Its level as a word: Low, Moderate, High, Very high.                                                               |
| PM2.5, PM10, NO₂, O₃     | The forecast concentrations, in µg/m³.                                                                             |
| Highest index, next 24 h | The worst hour from now to 24 hours ahead.                                                                         |
| Air quality, next 24 h   | Its level as a word.                                                                                               |

The index is shown with one decimal, never rounded up across a level boundary (1.96 is "Low" and shows 1.9). The overall index is the highest of the pollutants' ones.

MET Norway updates the forecast a few times a day. The integration reads each place **once an hour**, with a conditional request (nothing is downloaded when the forecast did not change), and moves to the next hour on its own.

## Widget

**Air quality Norway**: with a place chosen in its settings, four tiles (PM2.5, PM10, NO₂, O₃) that follow the device, the level now and the worst level of the next 24 hours with its hour, colored green (low), orange (moderate) or red (high, very high). Without a place: one row per added place, its level now.

## Scenes

### Triggers

- **Norway air: air quality degraded**: the level of a place now rises to "Moderate" or worse, or gets worse again. Filters: the place, the new levels (tick from your threshold up). Variables: place name, level, index, previous level, pollutant setting the index, summary.
- **Norway air: degradation forecast**: the worst level of the next 24 hours rises to "Moderate" or worse, or gets worse again. Filters: the place, the forecast levels. Variables: the same, plus the hour of the peak and the hours until it.
- **Norway air: back to normal**: the level comes back to "Low" after a degradation. Filters: the place, the worst level reached. Variables: place name, level, index, worst level, summary.

The first evaluation after the installation only sets the starting levels: nothing fires. A restart fires nothing again.

### Action

**Norway air: get the air quality**: of one place, or of the place with the worst index. Outputs: summary (for example `MET Norway Hjemme: Low (1.6) · PM2.5 2.8 µg/m³ · … · Next 24 h: Moderate at 17:00`), place name, level, index, pollutant, the four concentrations, the worst level, index and hour of the next 24 hours.

## Scene examples

- **Warn before it gets bad**: trigger "degradation forecast", levels High and Very high → send a message "Air quality {{trigger.level_label}} expected at {{trigger.time}} near {{trigger.place_name}}".
- **Close the windows**: trigger "air quality degraded", level Moderate and worse → notify, or turn the ventilation down; trigger "back to normal" → turn it back up.
- **Morning briefing**: at 7:00, action "get the air quality" → send `{{summary}}` with the weather.

## Troubleshooting

- **No device in Discovery**: the house has no location, or is outside Norway (see the status of the Configuration screen and the **Check the places** button). Set the location in Settings → Houses.
- **"not a MET Norway station"**: the code is not in the station list. Use **Find a station**; codes are case-sensitive for a few local stations (`Loallme`).
- **"MET Norway does not answer"**: the API is unreachable; the values of the forecast already read keep being published while it covers the hour.
- More details: the **Logs** tab of the integration (`LOG_LEVEL=debug` for every request).

## Limits

- A **forecast**, not a measurement, from a model at the scale of the neighbourhood: a station device gives the forecast at the station, not what it measures.
- Norway only. The index is the Norwegian one, not the European one.
- Terms of MET Norway: an identifying User-Agent, one request per place per hour at most, and a pause on HTTP 429. Data © MET Norway, under the CC BY 4.0 licence ([terms](https://api.met.no/doc/TermsOfService)).
