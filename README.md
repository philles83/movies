# TizenBrew Streaming Browser

Ein kleines **Site Modification Module** für `https://67movies.st/`: frühe Popup-Sperre, gezielte DOM-Filter und Fokusnavigation mit der Samsung-TV-Fernbedienung. Zielgerät ist ein Samsung-TV von 2022; die tatsächliche Firmware, Tizen-Version und Player-Kompatibilität müssen auf diesem Gerät geprüft werden.

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

`websiteURL` enthält die Startadresse, aktuell `https://67movies.st/`. Der Start-Hostname wird automatisch erlaubt. `navigation.allowedHosts` ergänzt **exakte, kleingeschriebene Hostnamen**, keine URLs oder Wildcards. Beispiel für eine eigene Änderung: `['www.67movies.st']` würde diesen Host zusätzlich erlauben; derzeit ist er **nicht** freigegeben.

Domains nicht vorsorglich freigeben. Nur erforderliche Navigationsziele nach Prüfung ergänzen. Die Allowlist kontrolliert Linkaktivierungen, **nicht** Ressourcen oder eingebettete Player. Bild-, Skript-, API-, CDN- und Videohosts müssen deshalb nicht pauschal in die Navigationsliste.

`navigation.blockPopups: true` sperrt jeden kontrollierbaren `window.open`-Aufruf, auch zu erlaubten Hosts, und liefert `null`. `navigation.guardLinks: true` sperrt nicht erlaubte beziehungsweise nicht-HTTP(S)-Linkziele. Erlaubte Links werden auf denselben Kontext umgestellt; auch benannte Fenster und `<base target>` werden dabei berücksichtigt.

### Gezielte Filter und Player-Schutz

- `filters.adSelectors`: bekannte Werbeelemente.
- `filters.overlaySelectors`: ausdrücklich identifizierte Werbe-Overlays; zunächst leer.
- `filters.protectedSelectors`: Playercontainer und erforderliche Bedienelemente.
- `filters.maxNodesPerPass` / `batchDelayMs`: Arbeitsbudget und Bündelungsintervall.
- `filters.enabled: false`: DOM-Filter zur Fehlerdiagnose ausschalten.

Aktiv ist zunächst nur `#nw-ad-loader`. Diese Kennung wurde im öffentlich ausgelieferten `AdProvider` der Zielseite gefunden. Die Kennung ist keine Garantie für dauerhaft stabile Filter. Das Entfernen eines bereits eingefügten Skriptelements macht dessen ausgeführten Code und angelegte Listener **nicht** rückgängig.

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

Geprüfte Szenarien: frühe Popup-Sperre, Mehrfach-Injection, statische/dynamische Werbung, Attributänderungen, Player-/Iframe-Schutz, legitime Dialoge, ungültige Selektoren, Mutation-Sturm und Ruhe danach, erlaubte/gesperrte Links, Fokus/Enter/Formulare, Menü/Zurück, Vollbild-Ablehnung, SPA- und Dokument-History, datensparsame Fehlerlogs und Produktionsmodus. Ein lokaler Screenshot wird unter `test-results/fixture-tv.png` erzeugt.

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
4. Für die Paketversion `0.1.0` einen unveränderlichen Git-Tag `v0.1.0` auf dem geprüften Commit erstellen und pushen:

   ```sh
   git tag v0.1.0
   git push origin v0.1.0
   ```

5. Die öffentlich abrufbaren CDN-Dateien kontrollieren; `OWNER` und `REPO` ersetzen:

   ```text
   https://cdn.jsdelivr.net/gh/OWNER/REPO@v0.1.0/package.json
   https://cdn.jsdelivr.net/gh/OWNER/REPO@v0.1.0/main.js
   ```

6. In TizenBrew **Modulverwaltung → GitHub-Modul hinzufügen** öffnen. Als Kennung `OWNER/REPO@v0.1.0` eingeben, ohne `gh/` und ohne vollständige URL. Das entspricht dem im aktuellen Loader verwendeten jsDelivr-GitHub-Pfad. Das Modul muss als **Streaming Browser (0.1.0)** erscheinen.
7. Zum Dashboard zurückkehren und das Modul starten. TizenBrew öffnet die Website und injiziert `main.js`.

Kennungen ohne Tag (`OWNER/REPO`) sind grundsätzlich möglich, können aber durch CDN-Caches verzögerte Änderungen zeigen. Für nachvollziehbare Tests und Releases getaggte Versionen verwenden. Öffentliche Konfiguration enthält keine Zugangsdaten.

### Änderungen und Rollback

1. Konfiguration/Quellcode ändern und Versionsnummer in `package.json` erhöhen.
2. Neu bauen, lokal prüfen und Änderungen einschließlich Bundle und Lockdatei committen.
3. Neuen Tag, beispielsweise `v0.1.1`, pushen. Bestehende Tags nicht verschieben.
4. Neue CDN-Dateien prüfen, den neuen Moduleintrag `OWNER/REPO@v0.1.1` hinzufügen und den alten Eintrag nach erfolgreicher Prüfung entfernen. Dies benötigt keine erfundene Update-API.
5. TizenBrew vollständig beenden und neu starten, damit der pro Modul gehaltene Injection-Cache erneuert wird. Ein Reload der Website allein genügt dafür möglicherweise nicht.
6. Für einen Rollback den vorherigen Tag erneut als Modul hinzufügen, den fehlerhaften Eintrag entfernen und TizenBrew neu starten.

## 7. TV-Abnahme und Fehlerdiagnose

Das folgende Protokoll vor Ort ausfüllen. **Alle Hardwareprüfungen sind derzeit offen.**

| Umgebung | Wert |
| --- | --- |
| TV-Modell | offen |
| Firmware / Tizen-Version | offen |
| TizenBrew-Version | offen |
| Modulversion / Git-Tag | 0.1.0 / geplanter Tag v0.1.0 |
| Prüfdatum | offen |

| Priorität | Prüfung | Erfolgskriterium | TV-Status |
| --- | --- | --- | --- |
| 1 | Modul wird erkannt | Name und Version in der Modulverwaltung | offen |
| 2 | Website öffnet | Startseite ohne Modulfehler erreichbar | offen |
| 3 | Injection läuft | TV-Menü sichtbar; Debug-Version meldet Injection OK | offen |
| 4 | Popup-Sperre | Kontrollierbare neue Fenster bleiben aus; Zähler steigt | offen |
| 5 | DOM-Filter | Bekannter Treffer entfernt; Player und Controls erhalten | offen |
| 6 | Fernbedienung | Pfeile, einmaliges Enter, Menü, Zurück und Vollbild geprüft | offen |

- **Unknown Module / Modul fehlt:** Repository öffentlich? Tag vorhanden? Root-`package.json` unter der CDN-URL tatsächlich JSON? `packageType`, `main` und `npm run check` prüfen.
- **Website öffnet, aber kein TV-Menü:** Injection-/Debugger-Status in TizenBrew prüfen. Stimmt der aktuelle Host exakt mit der Konfiguration überein? Nach Domainwechsel wird nicht blind auf unbekannte Hosts injiziert. CDN-Bundle und Tag prüfen; TizenBrew neu starten.
- **Werbung bleibt:** Debug-Version zeigt nur konfigurierte Treffer. Im Inspector gezielte Selektoren bestimmen, Player-Schutz zuerst ergänzen und einzeln prüfen. Skriptentfernung verhindert keine bereits gestartete Werbung; fremde Frames sind ausgenommen.
- **Player oder notwendiger Link funktioniert nicht:** Zunächst DOM-Filter über `filters.enabled` isolieren. Danach bei Bedarf Linkschutz separat diagnostizieren; ausschließlich geprüfte Zielhosts freigeben. Die Popup-Sperre ist absichtlich streng und kann legitime Popup-Abläufe verhindern.
- **Zurück/Fokus reagiert nicht im Player:** Bei Fokus in einem Cross-Origin-Iframe erreichen dessen Tastendrücke den übergeordneten Kontext möglicherweise nicht. Das wird nicht durch Sicherheitsumgehungen repariert. Vorhandene native Playersteuerung prüfen.
- **Vollbild abgelehnt / Video schwarz:** Playerberechtigung, Format, Codec, DRM und Firmware prüfen. Dieses Modul ersetzt keinen Player und implementiert kein AVPlay oder Transcoding.
- **Debug benötigt:** Nur vertrauenswürdige lokale Inspector-Verbindungen nach Samsung-/TizenBrew-Anleitung verwenden. Das Modul öffnet keinen eigenen Debug-Port. Nach Diagnose Debug wieder ausschalten.

## Technische Grenzen

JavaScript-Injection ist kein Netzwerk-Adblocker. Requests, Pre-Rolls, serverseitig eingefügte Werbung, HTTP-Redirects und direkte `location`-Zuweisungen sind damit nicht zuverlässig blockierbar. Die Seite kann Hooks überschreiben oder vor der Injection bereits Code ausgeführt haben.

Das Modul läuft nur im obersten Dokument auf konfigurierten Hosts. Es injiziert nicht selbst in fremde oder gleichoriginige Frames. Same-Origin-Policy, CSP, Sandbox, Zertifikatsprüfung und andere Sicherheitsmechanismen werden nicht global abgeschaltet. Es gibt keine Stream-Extraktion, keinen Proxy und keine Umgehung von DRM oder Playerbeschränkungen.

Die Live-Website lädt Inhalte dynamisch und verweist auf Drittanbieter. Ihre aktuelle Struktur kann sich ändern. Der genaue Wiedergabeablauf, die externe Playerbedienung und die Funktionsfähigkeit auf dem konkreten 2022er Fernseher bleiben bis zur Hardwareprüfung unbestätigt.
