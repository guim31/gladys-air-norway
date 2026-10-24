# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
uses [semantic versioning](https://semver.org/).

Describe each change under `## [Unreleased]` as you make it. The Release
workflow moves that section under the version it ships, and the section becomes
the notes of the version's GitHub Release.

## [Unreleased]

### Added

- The air quality forecast of MET Norway in Gladys: one device per house
  located in Norway (its neighbourhood, district or municipality) and per
  measuring station typed in the configuration, with the Norwegian air quality
  index and its level, PM2.5, PM10, NO₂ and O₃ for the hour, and the highest
  index of the next 24 hours.
- A **Find a station** button (by name, or the nearest to a house) and a
  **Check the places** button.
- Scene triggers **air quality degraded**, **degradation forecast** (within
  24 hours, with the hour of the peak) and **back to normal**, with level
  filters; a scene action **Get the air quality** with a sentence ready for a
  notification; an **Air quality Norway** dashboard widget.
- A clear message on the Configuration screen for a house outside Norway.
- Feature names and texts in English, French, German and Spanish, and the
  documentation in the four languages.

[Unreleased]: https://github.com/guim31/gladys-air-norway/commits/main
