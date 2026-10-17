'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { render, validate } = require('../scripts/build.js');
const config = require('../config.js');
const manifest = require('../package.json');

test('Das ausgelieferte TizenBrew-Modul ist konsistent und eigenständig', () => {
  assert.equal(manifest.packageType, 'mods');
  assert.equal(manifest.main, 'main.js');
  assert.equal(manifest.websiteURL, config.websiteURL);
  assert.equal(manifest.evaluateScriptOnDocumentStart, true);
  const bundle = fs.readFileSync(require.resolve('../main.js'), 'utf8');
  assert.equal(bundle, render(config));
  assert.doesNotMatch(bundle, /require\(|module\.exports|import\s/);
  assert.equal(manifest.dependencies, undefined);
});

test('Fehlkonfigurationen scheitern vor dem Deployment', () => {
  for (const websiteURL of ['javascript:alert(1)', 'https://user:secret@example.com/', 'file:///tmp/a']) {
    assert.throws(() => validate({ ...config, websiteURL }));
  }
  for (const host of ['*.67movies.st', '67movies.st/evil', '67movies.st:443', '67movies.st@evil.test', '']) {
    assert.throws(() => validate({ ...config, navigation: { ...config.navigation, allowedHosts: [host] } }));
  }
  assert.throws(() => validate({ ...config, filters: { ...config.filters, maxNodesPerPass: 0 } }));
  assert.doesNotThrow(() => validate(config));
});
