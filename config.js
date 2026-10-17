'use strict';

// Einzige Quelle für Startadresse und Laufzeitoptionen. Danach: npm run build.
module.exports = {
  websiteURL: 'https://67movies.st/',
  navigation: {
    // Exakte Hostnamen, keine Wildcards; Start-Host wird automatisch ergänzt.
    allowedHosts: [],
    blockPopups: true,
    guardLinks: true
  },
  filters: {
    enabled: true,
    adSelectors: ['#nw-ad-loader'],
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
