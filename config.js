'use strict';

// HIER die gewünschte Website eintragen. Danach: npm run build.
// example.com ist eine einfache Startseite zum Prüfen des TV-Browsers.
const TARGET_WEBSITE_URL = 'https://google.com/';

// Bereits bekannte Regel nur auf der dafür geprüften Website verwenden.
const KNOWN_AD_SELECTORS = new URL(TARGET_WEBSITE_URL).hostname === '67movies.st'
  ? ['#nw-ad-loader']
  : [];

// Einzige Quelle für Startadresse und Laufzeitoptionen.
module.exports = {
  websiteURL: TARGET_WEBSITE_URL,
  navigation: {
    // Exakte Hostnamen, keine Wildcards; Start-Host wird automatisch ergänzt.
    allowedHosts: [],
    blockPopups: true,
    guardLinks: true
  },
  filters: {
    enabled: true,
    // Hier gezielte Regeln für die neue Website ergänzen.
    adSelectors: KNOWN_AD_SELECTORS,
    overlaySelectors: [],
    // Bekannte Playercontainer hier ergänzen, bevor breitere Filter aktiviert werden.
    protectedSelectors: [
      'video', 'audio', 'iframe', 'object', 'embed',
      '[data-player]', '.video-js', '.jwplayer', '.plyr'
    ],
    maxNodesPerPass: 250,
    batchDelayMs: 32
  },
  remote: { enabled: true, scrollStep: 300 },
  debug: { enabled: false, showOverlay: false, maxEntries: 40 }
};
