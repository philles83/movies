# TizenBrew Streaming Browser

Ein kleines **Site Modification Module** für eine frei konfigurierbare Website: Popup-Sperre ab Injection, gezielte DOM-Filter und Fokusnavigation mit der Samsung-TV-Fernbedienung. Die Startadresse wird über `TARGET_WEBSITE_URL` in `config.js` gesetzt; Standard ist die einfache Testseite `https://example.com/`. Ursprünglich war ein Samsung-TV von 2022 angenommen. Das tatsächliche Gerät ist ein **UE55RU7179UXZG von 2019 mit Tizen 5.0**. Die zuvor untersuchte Website `67movies.st` ist mit dessen Browser nicht kompatibel; siehe den dokumentierten Hardwarebefund unten.

**Status:** Prototyp. Das fertige `main.js` liegt im Repository. Die lokale Simulation prüft Modulverhalten, ersetzt aber keine TV-Abnahme. GitHub-Veröffentlichung und Installation auf einem Fernseher erfolgen nicht automatisch.

## 1. Modulstruktur und geprüfte Schnittstelle

```text
package.json          TizenBrew-Metadaten; websiteURL wird beim Build synchronisiert
config.js             Zentrale Konfiguration
main.js               Generiertes, eigenständiges Injection-Bundle; mit veröffentlichen!
src/runtime.js        Popup-/Linkschutz, Filter, Fernbedienung und Debug
src/tv.css            Eingebettete Menü- und Fokusstyles
scripts/build.js      Build und Konsistenzprüfung mit Node-Bordmitteln
tests/                Lokale Fixtures und automatisierte Prüfungen
```

Das Modul verwendet `packageType: "mods"`, `appName`, `websiteURL`, `main`, `keys` und `evaluateScriptOnDocumentStart`. TizenBrew lädt genau die Datei aus `main`; es lädt **nicht** automatisch `config.js`, CSS-Dateien oder CommonJS-Imports nach. Deshalb bindet der Build Konfiguration und CSS in `main.js` ein. Es gibt keine Laufzeitabhängigkeiten und keinen `serviceFile`.

**Startkorrektur in 0.1.1:** `evaluateScriptOnDocumentStart` ist ausdrücklich `false`. Im untersuchten TizenBrew-Code wartet die Oberfläche bei `true` auf ein Startsignal. Der Service sendet dabei `mdl.name`, die Oberfläche sucht jedoch nach `fullName`; außerdem wird die Signalübermittlung erst bei einem neuen Ausführungskontext angestoßen. Der normale Pfad wechselt direkt zur Zieladresse und verwendet die reguläre Injection. Die Popup-Sperre gilt deshalb erst ab der tatsächlichen Injection; vorher ausgeführter Code kann nicht rückwirkend blockiert werden. Quellen: [Startaktion](https://github.com/reisxd/TizenBrew/blob/main/tizenbrew-app/TizenBrew/tizenbrew-ui/src/components/Modules.jsx), [Empfänger](https://github.com/reisxd/TizenBrew/blob/main/tizenbrew-app/TizenBrew/tizenbrew-ui/src/components/WebSocketClient.js), [Service](https://github.com/reisxd/TizenBrew/blob/main/tizenbrew-app/TizenBrew/service-nextgen/service/utils/debugger.js).

`keys` ist leer: Pfeile, Enter und Zurück benötigen keine zusätzliche Registrierung. Es werden keine nicht dokumentierten TizenBrew-JavaScript-APIs aufgerufen. DOM und Browser-APIs werden direkt verwendet; Vollbild wird auf Verfügbarkeit geprüft.

Vor der Implementierung geprüft:

- [Offizielle Moduldokumentation](https://github.com/reisxd/TizenBrew/blob/main/docs/MODULES.md): Paketfelder für Site Modification Modules.
- [Module Loader](https://github.com/reisxd/TizenBrew/blob/main/tizenbrew-app/TizenBrew/service-nextgen/service/utils/moduleLoader.js): tatsächliche Übernahme der Paketfelder, einschließlich `evaluateScriptOnDocumentStart` für `mods`.
- [Injection und Script-Cache](https://github.com/reisxd/TizenBrew/blob/main/tizenbrew-app/TizenBrew/service-nextgen/service/utils/debugger.js): Injection über den Debugger; Bundle wird pro Modulkennung gecacht.
- [Modulverwaltung](https://github.com/reisxd/TizenBrew/blob/main/tizenbrew-app/TizenBrew/tizenbrew-ui/src/pages/ModuleManager.jsx): GitHub-Kennungen werden mit `gh/` an den CDN-Loader weitergegeben.
- [TizenTube-Paket](https://github.com/reisxd/TizenTube/blob/main/package.json) und [Injection-Einstieg](https://github.com/reisxd/TizenTube/blob/main/mods/userScript.js): Beispiel eines gebündelten Site-Moduls.
- [TizenPortal-Paket](https://github.com/axelnanol/tizenportal/blob/master/package.json): weiteres Site-Modul mit gebündeltem Runtime-Skript; dessen Portal, Bundles und Cursor werden hier nicht übernommen.
- [Samsung: Fernbedienung](https://developer.samsung.com/smarttv/develop/guides/user-interaction/remote-control.html): Tasten und Registrierung.

## 2. Konfigurieren und bauen

Für die Entwicklung: **Node.js 20 oder neuer**. Build und Konsistenzprüfung benötigen keine installierten npm-Pakete:

```sh
npm run build
npm run check
```

Nur `config.js` beziehungsweise `src/` bearbeiten, nicht das generierte Bundle. Nach jeder Änderung neu bauen und `main.js` sowie die aktualisierte `package.json` mit veröffentlichen. `npm run check` meldet veraltete Artefakte, ohne sie zu verändern.

### Zielseite und Navigation

Oben in `config.js` ausschließlich diese Konstante auf die gewünschte vollständige HTTP(S)-Adresse ändern:

```js
const TARGET_WEBSITE_URL = 'https://example.com/';
```

Danach im Projektordner ausführen:

```sh
npm run build
npm run check
```

Der Build übernimmt die Adresse sowohl in die TizenBrew-`websiteURL` in `package.json` als auch in das Injection-Bundle `main.js`. Injection-Hostprüfung, Navigationsfreigabe und „Startseite“ im TV-Menü verwenden dieselbe Adresse; diese Stellen müssen nicht zusätzlich bearbeitet werden. Direkte Änderungen nur an `package.json` genügen nicht und werden beim nächsten Build überschrieben.

Der Start-Hostname wird automatisch erlaubt. `navigation.allowedHosts` ergänzt **exakte, kleingeschriebene Hostnamen**, keine URLs oder Wildcards. Wechselt eine neue Website etwa zwischen ihrer Hauptdomain und `www`, den tatsächlich benötigten zweiten Host ausdrücklich ergänzen. Beim Wechsel zu einer anderen Website alte manuell eingetragene Navigationshosts und eigene Filter ebenfalls überprüfen.

Ab Version 0.1.2 dient `example.com` als einfacher erster TV-Test. Eine andere Adresse lässt sich durch Ändern der Konstante und erneutes Bauen einsetzen. Die Browser-Kompatibilität jeder Website und ihrer Player muss separat geprüft werden; die Änderung aktualisiert die TV-Browserengine nicht.

Domains nicht vorsorglich freigeben. Nur erforderliche Navigationsziele nach Prüfung ergänzen. Die Allowlist kontrolliert Linkaktivierungen, **nicht** Ressourcen oder eingebettete Player. Bild-, Skript-, API-, CDN- und Videohosts müssen deshalb nicht pauschal in die Navigationsliste.

`navigation.blockPopups: true` sperrt jeden kontrollierbaren `window.open`-Aufruf, auch zu erlaubten Hosts, und liefert `null`. `navigation.guardLinks: true` sperrt nicht erlaubte beziehungsweise nicht-HTTP(S)-Linkziele. Erlaubte Links werden auf denselben Kontext umgestellt; auch benannte Fenster und `<base target>` werden dabei berücksichtigt.

### Gezielte Filter und Player-Schutz

- `filters.adSelectors`: bekannte Werbeelemente.
- `filters.overlaySelectors`: ausdrücklich identifizierte Werbe-Overlays; zunächst leer.
- `filters.protectedSelectors`: Playercontainer und erforderliche Bedienelemente.
- `filters.maxNodesPerPass` / `batchDelayMs`: Arbeitsbudget und Bündelungsintervall.
- `filters.enabled: false`: DOM-Filter zur Fehlerdiagnose ausschalten.

Für neue Websites sind zunächst keine Werbeselektoren aktiv. Ausschließlich beim Zielhost `67movies.st` wird die dort geprüfte Regel `#nw-ad-loader` automatisch verwendet. Diese Kennung wurde im öffentlich ausgelieferten `AdProvider` jener Website gefunden. Die Kennung ist keine Garantie für dauerhaft stabile Filter. Das Entfernen eines bereits eingefügten Skriptelements macht dessen ausgeführten Code und angelegte Listener **nicht** rückgängig. Die allgemeine Popup-Sperre und Fokusnavigation bleiben unabhängig von dieser Filterregel aktiv.

Neue Filter zuerst an der lokalen Fixture prüfen und anschließend auf dem TV einzeln aktivieren. Keine Regeln wie `iframe`, `[role="dialog"]`, `[class*="overlay"]` oder pauschale Containerfilter verwenden.

Medienelemente, Iframes, konfigurierte Playerbereiche, ihre Nachfahren und Container mit geschützten Nachfahren werden nicht entfernt. Die Basisregeln für `video`, `audio`, `iframe`, `object` und `embed` bleiben immer aktiv. Dieser konservative Schutz kann auch Werbung erhalten, wenn diese Medien enthält.

Der Observer verarbeitet hinzugefügte Teilbäume und Attributänderungen in begrenzten Durchläufen. Reine Entfernungen und eigene UI-Änderungen erzeugen keine erneute Filterarbeit. Bei mehr als 512 ausstehenden Wurzeln wird zu einem schrittweisen Dokument-Scan zusammengefasst. Ungültige Selektoren werden einzeln ignoriert, im Debug-Modus mit Regellisten-Index gemeldet. Es gibt keine Polling-Endlosschleife.

### Debug- und Produktionsmodus

Produktion ist der Standard:

```js
debug: { enabled: false, showOverlay: false, maxEntries: 40 }
```

Für die Diagnose `enabled` und bei Bedarf `showOverlay` auf `true` stellen, neu bauen und die Debug-Version bereitstellen. Die Anzeige lässt sich im TV-Menü ausblenden. Danach wieder eine Produktionsversion bauen.

Protokolliert werden nur feste Ereigniskategorien, Zähler und Filterregel-Indizes: entfernte Elemente, blockierte Pop-ups/Links, Injection-Status und Fehlerkategorien. Der Speicherpuffer ist begrenzt. Keine DOM-Schnipsel, Texte, Eingaben, Fehlermeldungen, URL-Parameter oder Stacktraces werden durch das Modul geloggt. Fehlerereignisse und Promise-Rejections werden ausschließlich kategorisiert; es gibt keinen Telemetrie-Endpunkt und keine Speicherung der Logs.

Webseiten und TizenBrew können unabhängig davon eigene Konsolenausgaben und Netzwerkzugriffe erzeugen. Der Modul-Debugfilter bereinigt diese fremden Ausgaben nicht.

## 3. Bedienung auf dem Fernseher

| Taste / Aktion | Verhalten |
| --- | --- |
| Pfeile | Räumlich zum nächsten sichtbaren Bedienelement; sonst scrollen |
| Enter | Einmal aktivieren; gehaltenes Enter löst keine weiteren künstlichen Klicks aus |
| Zurück (10009) | Eigenes Menü schließen → kontrollierbares Vollbild beenden → bekannte Website-History zurück |
| TV-Menü | Startseite, Vollbild, Schließen; Debug-Anzeige nur im Debug-Modus |
| Escape am PC | Lokale Simulation von Zurück |

Am Einstieg konsumiert das Modul Zurück nicht; die Rückgabe an TizenBrew muss am TV bestätigt werden. Texteingaben und erkennbare Playerbereiche behalten ihre native Tastaturbedienung. Das Modul registriert keine Medien- oder Farbtasten und bietet keinen Cursor-Modus.

Für die interne History ergänzt das Modul einen numerischen Eintrag `__tbStreamNavigation` in objektförmigen `history.state`-Werten, ohne deren andere Felder zu entfernen. SPA-`pushState`/`replaceState` werden entsprechend begleitet. Für kontrollierte Seitenwechsel innerhalb derselben Origin wird nur die nächste Tiefe kurz in `sessionStorage` hinterlegt. Keine URLs oder Seiteninhalte werden dort gespeichert. Bei primitiven History-States, unbekannten Navigationen oder neuen Origins wird konservativ nicht selbst zurücknavigiert. Native Hash-Navigation und seiteninterne Spezialsteuerungen können zusätzliche Anpassungen benötigen.

Vollbild verlangt eine Benutzeraktion. Verwendet werden verfügbare Standard- beziehungsweise WebKit-Funktionen; Ablehnung bleibt ohne Absturz. Bei einem fremden Iframe wird ausschließlich dessen äußeres Element verwendet, nicht sein innerer Player. Die Website, Browserberechtigungen und der Player können Vollbild oder künstliche Klicks ablehnen.

## 4. Lokal testen – keine TV-Installation

```sh
npm ci
npx playwright install chromium
npm test
npm run check
```

Playwright ist ausschließlich Entwicklungsabhängigkeit. `npm test` prüft Paket/Build und startet für die Browsertests einen temporären lokalen HTTP-Server. Externe Requests werden in diesen Tests blockiert. Die Tests verwenden **keine echten Streams** und ändern keine Live-Website.

Mit vorhandenem kompatiblem Chromium kann dessen Pfad über `TIZEN_BROWSER_PATH` gesetzt werden. Das ist ein lokaler Testparameter, kein TizenBrew-Feld.

Für eine manuelle Browserprüfung:

```sh
npm run test:serve
```

Dann `http://localhost:8787/` öffnen. Die Simulation verwendet automatisch eine lokale Ziel-URL und zusätzliche Testselektoren; die Produktionskonfiguration bleibt unverändert. Der zweite Frame nutzt `127.0.0.1` als andere Origin. Beenden mit Ctrl+C.

Geprüfte Szenarien: Popup-Sperre ab Injection, Mehrfach-Injection, statische/dynamische Werbung, Attributänderungen, Player-/Iframe-Schutz, legitime Dialoge, ungültige Selektoren, Mutation-Sturm und Ruhe danach, erlaubte/gesperrte Links, Fokus/Enter/Formulare, Menü/Zurück, Vollbild-Ablehnung, SPA- und Dokument-History, datensparsame Fehlerlogs und Produktionsmodus. Ein lokaler Screenshot wird unter `test-results/fixture-tv.png` erzeugt.

Eine erfolgreiche lokale Prüfung beweist weder TizenBrew-Erkennung noch TV-Injection, Streaming-Wiedergabe oder Fernbedienungsereignisse aus fremden Iframes.

## 5. TizenBrew auf dem TV installieren

Maßgeblich ist die [aktuelle offizielle Installationsanleitung](https://github.com/reisxd/TizenBrew/blob/main/docs/README.md). Für den ersten Aufbau den dort bevorzugten **TizenBrew Installer Desktop** verwenden:

1. PC und Fernseher im selben lokalen Netzwerk betreiben. TV-Modell, Firmware und tatsächliche Tizen-Version notieren; nicht allein aus dem Baujahr ableiten.
2. Auf dem TV **Apps** beziehungsweise **App Settings** öffnen und `12345` eingeben, um den Entwicklermodus zu öffnen.
3. Entwicklermodus aktivieren, die lokale IP-Adresse des PCs als Host-PC-IP eintragen und den Fernseher neu starten.
4. Das zum PC passende Programm aus den [TizenBrewInstaller-Releases](https://github.com/reisxd/TizenBrewInstaller/releases/latest) herunterladen und starten. Unter macOS/Linux gegebenenfalls nach offizieller Anleitung ausführbar machen.
5. Im Installer **Install TizenBrew** wählen und dessen Geräte-/Verbindungsschritte ausführen. Ab Tizen 7 beschreibt die offizielle Anleitung die Anmeldung am Samsung-Konto und das Erstellen des Samsung-Zertifikats; den tatsächlich angezeigten Zertifikatsablauf befolgen.
6. TizenBrew starten und seinen betriebsbereiten Zustand prüfen. Für Debug-Verbindungsfehler die Hinweise des Installers und der offiziellen Anleitung zur Host-PC-IP berücksichtigen; eine manuelle CLI-Installation hat eigene Schritte zur Umstellung auf `127.0.0.1`.

Die manuelle Alternative über Tizen Studio, SDB und signiertes WGT ist in der offiziellen Anleitung beschrieben. Das Modul selbst ist **kein WGT** und muss nicht bei jeder Änderung neu als TV-App installiert werden. Die frühere USB-Demo-Methode ist laut aktueller Anleitung eingestellt.

## 6. Über GitHub bereitstellen und installieren

1. Ein öffentliches GitHub-Repository anlegen, beispielsweise `OWNER/tizenbrew-streaming-browser`.
2. Konfiguration prüfen, `npm run build`, `npm test` und `npm run check` ausführen.
3. Die Projektdateien einschließlich **Root-`package.json` und `main.js`** committen und pushen. `node_modules/` und `test-results/` werden ausgeschlossen. GitHub Pages und npm-Publishing sind nicht erforderlich.
4. Für die Paketversion `0.1.2` einen unveränderlichen Git-Tag `v0.1.2` auf dem geprüften Commit erstellen und pushen:

   ```sh
   git tag v0.1.2
   git push origin v0.1.2
   ```

5. Die öffentlich abrufbaren CDN-Dateien kontrollieren; `OWNER` und `REPO` ersetzen:

   ```text
   https://cdn.jsdelivr.net/gh/OWNER/REPO@v0.1.2/package.json
   https://cdn.jsdelivr.net/gh/OWNER/REPO@v0.1.2/main.js
   ```

6. In TizenBrew **Modulverwaltung → GitHub-Modul hinzufügen** öffnen. Als Kennung `OWNER/REPO@v0.1.2` eingeben, ohne `gh/` und ohne vollständige URL. Das entspricht dem im aktuellen Loader verwendeten jsDelivr-GitHub-Pfad. Das Modul muss als **Streaming Browser (0.1.2)** erscheinen.
7. Zum Dashboard zurückkehren und das Modul starten. TizenBrew öffnet die Website und injiziert `main.js`.

Kennungen ohne Tag (`OWNER/REPO`) sind grundsätzlich möglich, können aber durch CDN-Caches verzögerte Änderungen zeigen. Für nachvollziehbare Tests und Releases getaggte Versionen verwenden. Öffentliche Konfiguration enthält keine Zugangsdaten.

### Änderungen und Rollback

1. Konfiguration/Quellcode ändern und Versionsnummer in `package.json` erhöhen.
2. Neu bauen, lokal prüfen und Änderungen einschließlich Bundle und Lockdatei committen.
3. Neuen Tag, beispielsweise `v0.1.3`, pushen. Bestehende Tags nicht verschieben.
4. Neue CDN-Dateien prüfen, den neuen Moduleintrag `OWNER/REPO@v0.1.3` hinzufügen und den alten Eintrag nach erfolgreicher Prüfung entfernen. Dies benötigt keine erfundene Update-API.
5. TizenBrew vollständig beenden und neu starten, damit der pro Modul gehaltene Injection-Cache erneuert wird. Ein Reload der Website allein genügt dafür möglicherweise nicht.
6. Für einen Rollback den vorherigen Tag erneut als Modul hinzufügen, den fehlerhaften Eintrag entfernen und TizenBrew neu starten.

## 7. TV-Abnahme und Fehlerdiagnose

Ergebnisse der Hardwarediagnose vom 17.10.2026. Die Website ist auf diesem Gerät derzeit nicht vollständig nutzbar.

| Umgebung | Wert |
| --- | --- |
| TV-Modell | UE55RU7179UXZG, Modelljahr 2019 |
| Firmware / Tizen-Version | T-MSLDEUC-1500.9 / 5.0 (Tizen-Version über SDB bestätigt) |
| TizenBrew-Version | offen |
| Modulversion / Git-Tag | 0.1.1 / v0.1.1 |
| Prüfdatum | 17.10.2026 |

| Priorität | Prüfung | Erfolgskriterium | TV-Status |
| --- | --- | --- | --- |
| 1 | Modul wird erkannt | Name und Version in der Modulverwaltung | Nutzer bestätigt Erkennung und Start |
| 2 | Website öffnet | Vollständige Startseite erreichbar | Nur HTML-Hülle; dynamische Inhalte scheitern auch im normalen TV-Browser |
| 3 | Injection läuft | TV-Menü sichtbar; eigenes Bundle syntaktisch gültig | Menü sichtbar und bedienbar; Runtime.compileScript meldet module-parse-ok |
| 4 | Popup-Sperre | Kontrollierbare neue Fenster bleiben aus; Zähler steigt | offen |
| 5 | DOM-Filter | Bekannter Treffer entfernt; Player und Controls erhalten | offen |
| 6 | Fernbedienung | Pfeile, einmaliges Enter, Menü, Zurück und Vollbild geprüft | Eigenes Menü bedienbar; vollständige Website-/Player-Abnahme bleibt offen |

### Bestätigte Browser-Inkompatibilität der Zielseite

Samsung ordnet dem Modelljahr 2019 Tizen 5.0 und Chromium M63 zu: [Modellseite](https://www.samsung.com/de/support/model/UE55RU7179UXZG/), [Web-Engine-Tabelle](https://developer.samsung.com/smarttv/develop/specifications/web-engine-specifications.html). Die Seite lädt auf anderen Geräten im selben Netzwerk vollständig. Das eigene Modul wird vom TV syntaktisch verstanden.

Die Diagnose über das Chrome DevTools Protocol ergab für die unveränderte Zielseite:

| Öffentliche Skriptdatei | Befund |
| --- | --- |
| `7123-58fe19839f944a93.js` | ReferenceError: globalThis fehlt |
| `8274-3b78bb132b2fd728.js`, Zeile 1, Spalte 41711 | SyntaxError an optional chaining (`?.`); an dieser Stelle direkt im öffentlichen Skript bestätigt |
| `5958-d41e57a2fc51d334.js`, Zeile 1, Spalte 3394 | SyntaxError an nullish coalescing (`??`); an dieser Stelle direkt im öffentlichen Skript bestätigt |

In einer zweiten, temporären Testphase wurden vor den Seitenskripten `globalThis` und `queueMicrotask` ergänzt. Damit verschwanden diese fehlenden Funktionen als erster Fehler, anschließend scheiterte die Seite an `AbortController`. Beide Syntaxfehler blieben bestehen. Nach jeweils zwölf Sekunden: null Buttons und null Links. Das Testprogramm entfernt die temporäre Startregistrierung bei regulärem Abschluss; ein vollständiges Beenden der Debug-Sitzung entfernt sie ebenfalls. Diese Ergänzungen sind nicht Teil des veröffentlichten Bundles.

`?.` und `??` werden von Chrome erst ab Version 80 unterstützt: [V8: Optional chaining](https://v8.dev/features/optional-chaining), [V8: Nullish coalescing](https://v8.dev/features/nullish-coalescing). Normale Polyfills ergänzen Funktionen, ändern aber nicht die vom Browser verstandene Syntax. Für diese Website wären vor der Ausführung umgeschriebene Skripte und zusätzliche API-Kompatibilität erforderlich. Das normale Site-Modul garantiert keine solche Umwandlung vor dem Parsen externer Seitenskripte. Ein anderer User-Agent aktualisiert die Browserengine ebenfalls nicht.

Es wird deshalb keine weitere Modulversion als angebliche Reparatur dieses Ladefehlers ausgeliefert. Eine Lösung über einen separaten Kompatibilitätsproxy, eine eigene Oberfläche oder einen Browser auf einem anderen Gerät wäre ein eigener Arbeitsumfang. Wiedergabe, Drittanbieter-Player, Codecs und DRM wären danach weiterhin separat zu prüfen.

- **Unknown Module / Modul fehlt:** Repository öffentlich? Tag vorhanden? Root-`package.json` unter der CDN-URL tatsächlich JSON? `packageType`, `main` und `npm run check` prüfen.
- **Home-Bildschirm bleibt beim Start unverändert:** Mindestens Modulversion 0.1.1 verwenden und im veröffentlichten Paket `evaluateScriptOnDocumentStart: false` prüfen. Alten getaggten Moduleintrag durch den neuen ersetzen; TizenBrew vollständig neu starten.
- **Website öffnet, aber kein TV-Menü:** Injection-/Debugger-Status in TizenBrew prüfen. Stimmt der aktuelle Host exakt mit der Konfiguration überein? Nach Domainwechsel wird nicht blind auf unbekannte Hosts injiziert. CDN-Bundle und Tag prüfen; TizenBrew neu starten.
- **Werbung bleibt:** Debug-Version zeigt nur konfigurierte Treffer. Im Inspector gezielte Selektoren bestimmen, Player-Schutz zuerst ergänzen und einzeln prüfen. Skriptentfernung verhindert keine bereits gestartete Werbung; fremde Frames sind ausgenommen.
- **Player oder notwendiger Link funktioniert nicht:** Zunächst DOM-Filter über `filters.enabled` isolieren. Danach bei Bedarf Linkschutz separat diagnostizieren; ausschließlich geprüfte Zielhosts freigeben. Die Popup-Sperre ist absichtlich streng und kann legitime Popup-Abläufe verhindern.
- **Zurück/Fokus reagiert nicht im Player:** Bei Fokus in einem Cross-Origin-Iframe erreichen dessen Tastendrücke den übergeordneten Kontext möglicherweise nicht. Das wird nicht durch Sicherheitsumgehungen repariert. Vorhandene native Playersteuerung prüfen.
- **Vollbild abgelehnt / Video schwarz:** Playerberechtigung, Format, Codec, DRM und Firmware prüfen. Dieses Modul ersetzt keinen Player und implementiert kein AVPlay oder Transcoding.
- **Debug benötigt:** Nur vertrauenswürdige lokale Inspector-Verbindungen nach Samsung-/TizenBrew-Anleitung verwenden. Das Modul öffnet keinen eigenen Debug-Port. Nach Diagnose Debug wieder ausschalten.

## Technische Grenzen

JavaScript-Injection ist kein Netzwerk-Adblocker. Requests, Pre-Rolls, serverseitig eingefügte Werbung, HTTP-Redirects und direkte `location`-Zuweisungen sind damit nicht zuverlässig blockierbar. Die Seite kann Hooks überschreiben oder vor der Injection bereits Code ausgeführt haben.

Das Modul läuft nur im obersten Dokument auf konfigurierten Hosts. Es injiziert nicht selbst in fremde oder gleichoriginige Frames. Same-Origin-Policy, CSP, Sandbox, Zertifikatsprüfung und andere Sicherheitsmechanismen werden nicht global abgeschaltet. Es gibt keine Stream-Extraktion, keinen Proxy und keine Umgehung von DRM oder Playerbeschränkungen.

Die Live-Website lädt Inhalte dynamisch und verweist auf Drittanbieter. Ihre aktuelle Struktur kann sich ändern. Auf dem tatsächlich vorhandenen 2019er Fernseher verhindern die oben belegten Browser-Inkompatibilitäten bereits den Aufbau der Startseite. Wiedergabe und externe Playerbedienung sind damit noch nicht geprüft.
