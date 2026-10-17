'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const { start, testConfig } = require('./server.cjs');
const { render } = require('../scripts/build.js');
const production = require('../config.js');

(async () => {
  const local = await start();
  let browser;
  let checks = 0;
  async function check(name, work) { await work(); checks++; console.log('OK ' + name); }
  try {
    browser = await chromium.launch({ headless: true,
      ...(process.env.TIZEN_BROWSER_PATH ? { executablePath: process.env.TIZEN_BROWSER_PATH } : {}) });
    const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    // Tests dürfen ausschließlich lokale Fixtures laden.
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      return ['localhost', '127.0.0.1'].includes(url.hostname) ? route.continue() : route.abort();
    });
    const page = await context.newPage();
    const logs = [];
    page.on('console', msg => logs.push(msg.text()));
    await page.goto(local.url);
    await page.waitForFunction(() => window.__TB_STREAM_BROWSER__?.ready && !document.querySelector('#static-ad'));

    await check('Injection vor Seitenskripten und idempotentes Bundle', async () => {
      assert.equal(await page.evaluate(() => window.earlyPopupResult), null);
      assert.equal(await page.evaluate(() => window.__TB_STREAM_BROWSER__.counts.popupBlocked), 1);
      await page.addScriptTag({ content: render(testConfig(local.port)) });
      assert.equal(await page.locator('#tb-stream-ui').count(), 1);
      await page.evaluate(() => window.open('https://blocked.invalid/secret'));
      assert.equal(await page.evaluate(() => window.__TB_STREAM_BROWSER__.counts.popupBlocked), 2);
    });

    await check('DOM-Filter bewahren Player, Bedienelemente und legitime Dialoge', async () => {
      for (const id of ['player', 'video', 'player-control', 'legitimate-overlay', 'iframe-wrapper']) {
        assert.equal(await page.locator('#' + id).count(), 1, id);
      }
      assert.equal(await page.frameLocator('#same-frame').locator('#frame-button').count(), 1);
      assert.equal(await page.frameLocator('#foreign-frame').locator('#frame-button').count(), 1);
      await page.evaluate(() => {
        const overlay = document.createElement('div');
        overlay.id = 'dynamic-ad'; overlay.setAttribute('data-test-overlay', '');
        document.body.appendChild(overlay);
        document.querySelector('#changed').id = 'nw-ad-loader';
      });
      await page.waitForFunction(() => !document.querySelector('#dynamic-ad,#nw-ad-loader'));
    });

    await check('Mutation-Sturm wird abgearbeitet und kommt zur Ruhe', async () => {
      await page.evaluate(() => {
        const group = document.createElement('section');
        group.id = 'storm';
        for (let i = 0; i < 1500; i++) {
          const node = document.createElement('div');
          if (i % 3 === 0) node.setAttribute('data-test-ad', '');
          group.appendChild(node);
        }
        document.body.appendChild(group);
      });
      await page.waitForFunction(() => document.querySelectorAll('#storm > div').length === 1000);
      const passes = await page.evaluate(() => window.__TB_STREAM_BROWSER__.counts.passes);
      await page.waitForTimeout(180);
      assert.equal(await page.evaluate(() => window.__TB_STREAM_BROWSER__.counts.passes), passes);
      assert.ok(passes > 1);
    });

    await check('Externe, ähnlich benannte und gefährliche Linkziele gesperrt', async () => {
      for (const id of ['external', 'deceptive', 'unsafe']) {
        await page.locator('#' + id).click();
        assert.equal(page.url(), local.url);
      }
      assert.equal(await page.evaluate(() => !!window.unsafeRan), false);
      assert.equal(context.pages().length, 1);
      assert.equal(await page.evaluate(() => window.__TB_STREAM_BROWSER__.counts.navigationBlocked), 3);
    });

    await check('Fokus, genau eine Aktivierung pro Enter und Formulare', async () => {
      await page.evaluate(() => {
        document.addEventListener('keyup', event => {
          if (event.key === 'Enter' && document.activeElement.id === 'one') window.activations++;
        });
      });
      await page.locator('#one').focus();
      await page.keyboard.press('ArrowRight');
      assert.equal(await page.locator(':focus').getAttribute('id'), 'two');
      await page.keyboard.press('ArrowLeft');
      await page.keyboard.press('Enter');
      assert.equal(await page.evaluate(() => window.activations), 1);
      await page.keyboard.down('Enter');
      await page.keyboard.down('Enter');
      await page.keyboard.up('Enter');
      assert.equal(await page.evaluate(() => window.activations), 2);
      await page.locator('#search').fill('abc');
      await page.keyboard.press('ArrowLeft');
      assert.equal(await page.locator(':focus').getAttribute('id'), 'search');
      assert.equal(await page.locator('#search').inputValue(), 'abc');
      await page.locator('#player-control').focus();
      const consumed = await page.evaluate(() => {
        const event = new KeyboardEvent('keydown', { keyCode: 39, bubbles: true, cancelable: true });
        document.activeElement.dispatchEvent(event);
        return event.defaultPrevented;
      });
      assert.equal(consumed, false);
    });

    await check('TV-Menü, Zurück und Vollbild-Fehlerpfad', async () => {
      await page.locator('#tb-stream-ui > button').focus();
      await page.keyboard.press('Enter');
      assert.equal(await page.locator('#tb-stream-panel').isVisible(), true);
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('#tb-stream-panel').isVisible(), false);
      await page.locator('#tb-stream-ui > button').click();
      await page.evaluate(() => {
        document.querySelectorAll('video,.protected-player').forEach(node => {
          node.requestFullscreen = () => Promise.reject(new Error('secret fullscreen error'));
        });
      });
      await page.getByRole('button', { name: 'Vollbild', exact: true }).click();
      await page.waitForFunction(() => window.__TB_STREAM_BROWSER__.counts.errors > 0);
      await page.locator('#tb-stream-ui > button').click();
      await page.keyboard.press('Escape');
    });

    await check('SPA-History und Rückgabe von Zurück am Einstieg', async () => {
      await page.evaluate(() => {
        history.pushState({ site: 'preserved' }, '', '/spa');
        history.replaceState({ site: 'replacement' }, '', '/spa');
      });
      assert.equal(await page.evaluate(() => history.state.site), 'replacement');
      await page.locator('#one').focus();
      await page.keyboard.press('Escape');
      await page.waitForURL(local.url);
      const consumed = await page.evaluate(() => {
        const event = new KeyboardEvent('keydown', { keyCode: 10009, bubbles: true, cancelable: true });
        document.body.dispatchEvent(event); return event.defaultPrevented;
      });
      assert.equal(consumed, false);
    });

    await check('Interner Link bleibt im selben Kontext; Zurück über Dokumentgrenze', async () => {
      await page.locator('#internal').click();
      await page.waitForURL(local.url + 'next');
      await page.waitForFunction(() => window.__TB_STREAM_BROWSER__?.ready);
      assert.equal(context.pages().length, 1);
      await page.locator('#one').focus();
      await page.keyboard.press('Escape');
      await page.waitForURL(local.url);
    });

    await check('Debug protokolliert ausschließlich Kategorien', async () => {
      await page.evaluate(() => {
        window.dispatchEvent(new ErrorEvent('error', { message: 'sensitive website content', filename: 'https://private.invalid/?secret' }));
        window.dispatchEvent(new PromiseRejectionEvent('unhandledrejection', {
          promise: Promise.resolve(), reason: 'sensitive rejection'
        }));
      });
      const hud = await page.locator('[data-debug]').textContent();
      assert.match(hud, /javascript-error/);
      assert.match(hud, /promise-error/);
      const moduleLogs = logs.filter(line => line.startsWith('[Streaming Browser]'));
      assert.ok(moduleLogs.some(line => line.includes('invalid-ad-selector')));
      assert.doesNotMatch(moduleLogs.join('\n') + hud, /sensitive|private=|secret|blocked\.invalid/);
      fs.mkdirSync(path.join(__dirname, '../test-results'), { recursive: true });
      await page.screenshot({ path: path.join(__dirname, '../test-results/fixture-tv.png') });
    });

    await check('Produktionsmodus ohne Debug-UI, Logs und Frame-Injection', async () => {
      await page.evaluate(() => window.__TB_STREAM_BROWSER__.destroy());
      const prodConfig = { ...production, websiteURL: local.url };
      const before = logs.filter(line => line.startsWith('[Streaming Browser]')).length;
      await page.addScriptTag({ content: render(prodConfig) });
      assert.equal(await page.locator('[data-debug]').count(), 0);
      await page.evaluate(() => window.open('https://blocked.invalid/'));
      assert.equal(logs.filter(line => line.startsWith('[Streaming Browser]')).length, before);
      await page.frames().find(frame => frame.url().endsWith('/frame') && frame.url().includes('localhost'))
        .addScriptTag({ content: render(prodConfig) });
      assert.equal(await page.frameLocator('#same-frame').locator('#tb-stream-ui').count(), 0);
      await page.evaluate(() => window.__TB_STREAM_BROWSER__.destroy());
      assert.equal(await page.locator('#tb-stream-ui').count(), 0);
    });

    await check('Host-Grenze, deaktivierte Funktionen und blockierter Popup-Hook', async () => {
      await page.addScriptTag({ content: render(production) });
      assert.equal(await page.evaluate(() => !!window.__TB_STREAM_BROWSER__), false);
      const disabled = testConfig(local.port);
      disabled.remote = { ...disabled.remote, enabled: false };
      disabled.filters = { ...disabled.filters, enabled: false };
      disabled.navigation = { ...disabled.navigation, guardLinks: false };
      await page.evaluate(() => {
        Object.defineProperty(window, 'open', { value: () => 'site-owned-hook', writable: false, configurable: true });
      });
      await page.addScriptTag({ content: render(disabled) });
      assert.match(await page.locator('[data-debug]').textContent(), /popup-hook-unavailable/);
      await page.evaluate(() => {
        const node = document.createElement('div');
        node.id = 'disabled-ad'; node.setAttribute('data-test-ad', ''); document.body.appendChild(node);
      });
      await page.waitForTimeout(60);
      assert.equal(await page.locator('#disabled-ad').count(), 1);
      assert.equal(await page.evaluate(() => window.__TB_STREAM_BROWSER__.counts.passes), 0);
      await page.evaluate(() => window.__TB_STREAM_BROWSER__.destroy());
    });
    await check('Normaler Injection-Pfad funktioniert auch nach vollständigem Seitenaufbau', async () => {
      await page.goto(local.url + 'late');
      assert.equal(await page.evaluate(() => !!window.__TB_STREAM_BROWSER__), false);
      assert.equal(await page.locator('#static-ad').count(), 1);
      await page.addScriptTag({ content: render(testConfig(local.port)) });
      await page.waitForFunction(() => window.__TB_STREAM_BROWSER__?.ready && !document.querySelector('#static-ad'));
      assert.equal(await page.locator('#tb-stream-ui > button').isVisible(), true);
      assert.equal(await page.evaluate(() => window.open('https://blocked.invalid/')), null);
      await page.locator('#one').focus();
      await page.keyboard.press('ArrowRight');
      assert.equal(await page.locator(':focus').getAttribute('id'), 'two');
    });
    console.log(`${checks} Browser-Szenarien bestanden.`);
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => local.server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
