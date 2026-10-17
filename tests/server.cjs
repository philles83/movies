'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { render } = require('../scripts/build.js');
const config = require('../config.js');

function testConfig(port) {
  return {
    ...config,
    websiteURL: `http://localhost:${port}/`,
    filters: { ...config.filters, adSelectors: ['#nw-ad-loader', '[data-test-ad]', '['],
      overlaySelectors: ['[data-test-overlay]'],
      protectedSelectors: [...config.filters.protectedSelectors, '.protected-player'],
      maxNodesPerPass: 35, batchDelayMs: 10 },
    debug: { enabled: true, showOverlay: true, maxEntries: 8 }
  };
}

async function start(port = 0) {
  const server = http.createServer((req, res) => {
    const actualPort = server.address().port;
    if (req.url === '/test-bundle.js') {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      res.end(render(testConfig(actualPort)));
    } else if (req.url === '/frame') {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end('<!doctype html><html lang="de"><title>Frame</title><body><button id="frame-button">Frame-Steuerung</button></body></html>');
    } else {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(fs.readFileSync(path.join(__dirname, 'fixture.html'), 'utf8').replaceAll('PORT', actualPort));
    }
  });
  await new Promise(resolve => server.listen(port, '127.0.0.1', resolve));
  return { server, port: server.address().port, url: `http://localhost:${server.address().port}/` };
}
module.exports = { start, testConfig };
if (require.main === module) start(8787).then(({ url }) => console.log('Lokale Simulation: ' + url));
