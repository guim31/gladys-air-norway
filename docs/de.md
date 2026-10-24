# Luftqualität Norwegen

## Was die Integration macht

Diese Integration bringt die **Luftqualitätsvorhersage von MET Norway**, dem norwegischen Meteorologischen Institut, in Gladys: den norwegischen Luftqualitätsindex und die Schadstoffe, aus denen er besteht, für die aktuelle Stunde und die nächsten 24 Stunden. Das Modell ist das offizielle norwegische (dasselbe wie auf der Karte luftkvalitet.info), bis auf Ebene des Viertels.

- **Ein Gerät pro Ort**: jedes Haus von Gladys mit Standort in Norwegen und die Messstationen, die du hinzufügst.
- **Szenen-Auslöser**: Luftqualität jetzt verschlechtert, Verschlechterung innerhalb von 24 Stunden erwartet, wieder normal.
- **Eine Szenen-Aktion**, die die Luftqualität eines Orts liefert, mit einem fertigen Satz für eine Benachrichtigung.
- **Ein Dashboard-Widget**: die Schadstoffe, die Stufe jetzt und über die nächsten 24 Stunden.

Nur lesend, über die offene API von MET Norway (`api.met.no`): ohne Konto, ohne Schlüssel. Nicht mit MET Norway verbunden.

## Voraussetzungen

- Gladys Assistant **5.2.0** oder neuer.
- Ein Haus mit Standort **in Norwegen** (Einstellungen → Zuhause → Standort) oder der Code einer norwegischen Messstation. Anderswo hat MET Norway keine Luftqualitätsvorhersage.
- Internetzugang zu `api.met.no`.

## Konfiguration

| Feld               | Was du eingibst                                                                                                                                                                                                         |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Gebiet um ein Haus | Das Gebiet, dessen Vorhersage ein Haus bekommt: sein **Viertel** (grunnkrets, Standard, am feinsten), sein **Bezirk** (delområde) oder seine **Gemeinde** (kommune).                                                    |
| Stationen          | Optional. Die Codes zusätzlicher Messstationen, durch Kommas getrennt (höchstens 10), zum Beispiel `NO0057A`. Der Button **Station finden** liefert sie, nach Name oder in der Nähe eines Hauses, mit ihrer Entfernung. |
| Sprache            | Sprache der Funktionsnamen (beim Hinzufügen eines Geräts festgelegt) und der Szenentexte. Standardmäßig Französisch.                                                                                                    |

Jedes Haus mit Standort wird ein Gerät im Reiter **Entdecken**, wenn es in Norwegen liegt. Ein Haus außerhalb Norwegens wird ausgelassen; der Status der Konfigurationsseite sagt es, wenn kein Ort übrig bleibt.

Der Button **Orte prüfen** liest jeden Ort sofort und zeigt, was MET Norway vorhersagt: die Stufe und die schlechteste Stufe der nächsten 24 Stunden.

## Geräte

Jeder Ort (Haus oder Station) ergibt ein Gerät namens `MET Norway <Haus oder Station>` mit:

| Funktion                        | Bedeutung                                                                                                    |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Luftqualitätsindex              | Der norwegische Index der aktuellen Stunde: **unter 2 gering, 2 bis 3 mäßig, 3 bis 4 hoch, ab 4 sehr hoch**. |
| Luftqualität                    | Seine Stufe als Wort: Gering, Mäßig, Hoch, Sehr hoch.                                                        |
| PM2.5, PM10, NO₂, O₃            | Die vorhergesagten Konzentrationen in µg/m³.                                                                 |
| Höchster Index, nächste 24 Std. | Die schlechteste Stunde von jetzt bis in 24 Stunden.                                                         |
| Luftqualität, nächste 24 Std.   | Deren Stufe als Wort.                                                                                        |

Der Index wird mit einer Nachkommastelle angezeigt und nie über eine Stufengrenze aufgerundet (1,96 ist „Gering“ und wird als 1.9 angezeigt). Der Gesamtindex ist der höchste der Schadstoff-Indizes.

MET Norway aktualisiert die Vorhersage einige Male am Tag. Die Integration liest jeden Ort **einmal pro Stunde** mit einer bedingten Anfrage (nichts wird geladen, wenn sich die Vorhersage nicht geändert hat) und geht von selbst zur nächsten Stunde über.

## Widget

**Luftqualität Norwegen**: mit einem in den Einstellungen gewählten Ort vier Kacheln (PM2.5, PM10, NO₂, O₃), die dem Gerät folgen, die Stufe jetzt und die schlechteste Stufe der nächsten 24 Stunden mit ihrer Uhrzeit, grün (gering), orange (mäßig) oder rot (hoch, sehr hoch). Ohne Ort: eine Zeile pro hinzugefügtem Ort mit seiner aktuellen Stufe.

## Szenen

### Auslöser

- **Luft Norwegen: Luftqualität verschlechtert**: die Stufe eines Orts steigt jetzt auf „Mäßig“ oder schlechter, oder verschlechtert sich weiter. Filter: der Ort, die neuen Stufen (wähle ab deiner Schwelle). Variablen: Name des Orts, Stufe, Index, vorherige Stufe, Schadstoff, der den Index bestimmt, Zusammenfassung.
- **Luft Norwegen: Verschlechterung erwartet**: die schlechteste Stufe der nächsten 24 Stunden steigt auf „Mäßig“ oder schlechter, oder verschlechtert sich weiter. Filter: der Ort, die erwarteten Stufen. Variablen: dieselben, dazu die Uhrzeit der Spitze und die Stunden bis dahin.
- **Luft Norwegen: wieder normal**: die Stufe kehrt nach einer Verschlechterung zu „Gering“ zurück. Filter: der Ort, die schlechteste erreichte Stufe. Variablen: Name des Orts, Stufe, Index, schlechteste Stufe, Zusammenfassung.

Die erste Auswertung nach der Installation legt nur die Ausgangsstufen fest: nichts wird ausgelöst. Ein Neustart löst nichts erneut aus.

### Aktion

**Luft Norwegen: Luftqualität abrufen**: für einen Ort oder den Ort mit dem schlechtesten Index. Ausgaben: Zusammenfassung (zum Beispiel `MET Norway Hjemme: Gering (1.6) · PM2.5 2.8 µg/m³ · … · Nächste 24 Std.: Mäßig um 17:00`), Name des Orts, Stufe, Index, Schadstoff, die vier Konzentrationen, die schlechteste Stufe, der Index und die Uhrzeit der nächsten 24 Stunden.

## Szenenbeispiele

- **Warnen, bevor es schlecht wird**: Auslöser „Verschlechterung erwartet“, Stufen Hoch und Sehr hoch → Nachricht senden „Luftqualität {{trigger.level_label}} um {{trigger.time}} bei {{trigger.place_name}} erwartet“.
- **Fenster schließen**: Auslöser „Luftqualität verschlechtert“, Stufe Mäßig und schlechter → benachrichtigen oder die Lüftung herunterregeln; Auslöser „wieder normal“ → wieder hochregeln.
- **Morgenbriefing**: um 7:00 Aktion „Luftqualität abrufen“ → `{{summary}}` mit dem Wetter senden.

## Fehlerbehebung

- **Kein Gerät in Entdecken**: das Haus hat keinen Standort oder liegt außerhalb Norwegens (siehe den Status der Konfigurationsseite und den Button **Orte prüfen**). Lege den Standort unter Einstellungen → Zuhause fest.
- **„keine Station von MET Norway“**: der Code steht nicht in der Stationsliste. Nutze **Station finden**; bei einigen lokalen Stationen ist der Code groß-/kleinschreibungsabhängig (`Loallme`).
- **„MET Norway antwortet nicht“**: die API ist nicht erreichbar; die Werte der bereits gelesenen Vorhersage werden weiter veröffentlicht, solange sie die Stunde abdeckt.
- Mehr Details: der Reiter **Protokolle** der Integration (`LOG_LEVEL=debug` für jede Anfrage).

## Grenzen

- Eine **Vorhersage**, keine Messung, aus einem Modell auf Ebene des Viertels: ein Stationsgerät liefert die Vorhersage an der Station, nicht ihre Messwerte.
- Nur Norwegen. Der Index ist der norwegische, nicht der europäische.
- Bedingungen von MET Norway: ein User-Agent, der die Integration nennt, höchstens eine Anfrage pro Ort und Stunde, eine Pause bei HTTP 429. Daten © MET Norway, unter der Lizenz CC BY 4.0 ([Bedingungen](https://api.met.no/doc/TermsOfService)).
