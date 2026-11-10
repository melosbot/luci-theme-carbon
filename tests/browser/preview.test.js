'use strict';

/*
 * Browser tests against the static preview (no router needed):
 *   npm install && npx playwright install chromium && npm run test:browser
 *
 * - tests/navigation.html regression page at phone width
 * - preview pages in zh/en × light/dark × desktop/phone: no script errors,
 *   screenshots written to .cache/screenshots for review
 * - dashboard data (devices, Wi‑Fi, IPv6, sensors, traffic picker)
 * - keyboard / touch / drawer accessibility
 * - the minified release build computes the same styles as the sources
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { execFileSync } = require('node:child_process');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');
const SHOTS = path.join(ROOT, '.cache', 'screenshots');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json' };

let server, base, browser, minRoot;

function serve(roots) {
	return http.createServer((req, res) => {
		const url = new URL(req.url, 'http://x');
		const [, mount, ...rest] = url.pathname.split('/');
		const root = roots[mount];
		const file = root && path.resolve(root, decodeURIComponent(rest.join('/')));
		if (!file || !file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
			res.writeHead(404); res.end(); return;
		}
		res.writeHead(200, { 'content-type': (TYPES[path.extname(file)] || 'application/octet-stream') + '; charset=utf-8' });
		fs.createReadStream(file).pipe(res);
	});
}

test.before(async () => {
	minRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'carbon-min-'));
	for (const dir of ['htdocs', 'preview'])
		fs.cpSync(path.join(ROOT, dir), path.join(minRoot, dir), { recursive: true });
	execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'minify.mjs'), minRoot], { stdio: 'pipe' });
	server = serve({ src: ROOT, min: minRoot });
	await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
	base = 'http://127.0.0.1:' + server.address().port;
	browser = await chromium.launch();
	fs.mkdirSync(SHOTS, { recursive: true });
});

test.after(async () => {
	if (browser) await browser.close();
	if (server) server.close();
	if (minRoot) fs.rmSync(minRoot, { recursive: true, force: true });
});

async function open(url, { width = 1280, height = 900, appearance = 'light', storage = {}, touch = false } = {}) {
	const context = await browser.newContext({ viewport: { width, height }, hasTouch: touch, colorScheme: appearance === 'dark' ? 'dark' : 'light' });
	await context.addInitScript((items) => {
		for (const [k, v] of Object.entries(items)) localStorage.setItem(k, v);
	}, Object.assign({ 'carbon.appearance': appearance }, storage));
	const page = await context.newPage();
	const errors = [];
	page.on('pageerror', (e) => errors.push(e.message));
	page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
	await page.goto(base + url);
	return { page, context, errors };
}

/* every async source has rendered: leases, Wi‑Fi stations, sensors, languages */
const dashboardReady = (page) => page.waitForFunction(() =>
	document.querySelectorAll('.cb-card.span-8 .cb-list li').length >= 8 && document.querySelector('.cb-tag-wifi') &&
	document.querySelectorAll('.cb-kv li').length >= 3 && document.querySelector('.cb-lang .cb-seg'));

test('navigation regression page passes at phone width', async () => {
	const { page, context } = await open('/src/tests/navigation.html', { width: 390, height: 844 });
	await page.waitForFunction(() => /^(PASS|FAIL)/.test(document.title));
	const results = await page.textContent('#results');
	assert.match(await page.title(), /^PASS/, results);
	await context.close();
});

for (const lang of ['zh-Hans', 'en']) {
	for (const appearance of ['light', 'dark']) {
		for (const [device, width, height] of [['desktop', 1440, 1000], ['phone', 390, 844]]) {
			test(`preview ${lang} ${appearance} ${device} renders without errors`, async () => {
				const { page, context, errors } = await open(`/src/preview/index.html?lang=${lang}`, { width, height, appearance });
				await dashboardReady(page);
				assert.equal(await page.getAttribute('html', 'data-darkmode'), appearance === 'dark' ? 'true' : 'false');
				await page.screenshot({ path: path.join(SHOTS, `overview-${lang}-${appearance}-${device}.png`), fullPage: true });
				assert.deepEqual(errors, []);
				await context.close();
			});
		}
	}
}

test('dashboard shows merged devices, Wi-Fi details, IPv6, sensors and a traffic picker', async () => {
	const { page, context } = await open('/src/preview/index.html?lang=en');
	await dashboardReady(page);
	const info = await page.evaluate(() => ({
		count: document.querySelector('.cb-count').textContent,
		wifiTags: document.querySelectorAll('.cb-tag-wifi').length,
		nas: [...document.querySelectorAll('.cb-list-title')].some((e) => e.textContent === 'DiskStation'),
		gateway: document.body.textContent.includes('100.64.0.1') && [...document.querySelectorAll('.cb-list .cb-mono')].some((e) => e.textContent === '100.64.0.1'),
		ipv6: !document.querySelector('.cb-ip6').closest('.cb-meta').classList.contains('hidden') && document.querySelector('.cb-ip6').textContent,
		sensors: [...document.querySelectorAll('.cb-kv li')].map((li) => li.firstChild.textContent).filter((t) => t.startsWith('Temperature')),
		options: [...document.querySelectorAll('.cb-traffic-select option')].map((o) => o.value),
		tile: document.querySelector('.cb-tile .cb-tile-sub').textContent
	}));
	assert.equal(info.count, '17');
	assert.ok(info.wifiTags >= 3, 'Wi-Fi tags among the first eight devices');
	assert.ok(info.nas, 'static-IP device from ARP named by host hints');
	assert.equal(info.gateway, false, 'upstream gateway is not a LAN device');
	assert.equal(info.ipv6, '240e:3a1:4c2:8f0::1');
	assert.deepEqual(info.sensors, ['Temperature · cpu', 'Temperature · mt7986 phy1']);
	assert.deepEqual(info.options, ['auto', 'br-lan', 'pppoe-wan']);
	assert.match(info.tile, /^\d+ on Wi-Fi$/);

	await page.selectOption('.cb-traffic-select', 'br-lan');
	assert.equal(await page.evaluate(() => localStorage.getItem('carbon.traffic')), 'br-lan');
	await context.close();
});

test('language switch lists catalogues and switches the preview language', async () => {
	const { page, context } = await open('/src/preview/index.html?lang=en');
	await page.waitForSelector('.cb-lang .cb-seg-btn');
	assert.deepEqual(await page.$$eval('.cb-lang .cb-seg-btn', (b) => b.map((x) => x.textContent)), ['English', '中文']);
	await Promise.all([page.waitForURL(/lang=zh-Hans/), page.click('.cb-lang .cb-seg-btn:nth-child(2)')]);
	await page.waitForSelector('.cb-dash');
	assert.equal(await page.textContent('.cb-card.cb-traffic h3'), '实时流量');
	await context.close();
});

test('segmented controls follow the radio pattern', async () => {
	const { page, context } = await open('/src/preview/index.html?lang=en');
	await page.waitForSelector('#cb-appearance .cb-seg-btn');
	await page.focus('#cb-appearance .cb-seg-btn[aria-checked="true"]');
	await page.keyboard.press('ArrowRight');           // auto | light | dark: light → dark
	assert.equal(await page.getAttribute('html', 'data-appearance'), 'dark');
	assert.deepEqual(await page.$$eval('#cb-appearance .cb-seg-btn', (b) => b.map((x) => x.tabIndex)), [-1, -1, 0]);
	assert.equal(await page.evaluate(() => document.activeElement.getAttribute('aria-checked')), 'true');
	// language uses manual activation: arrows move focus only (switching reloads the page)
	await page.focus('.cb-lang .cb-seg-btn[aria-checked="true"]');
	await page.keyboard.press('ArrowRight');
	assert.equal(new URL(page.url()).searchParams.get('lang'), 'en');
	await context.close();
});

test('collapsed rail: keyboard opens and leaves the sub-menu, touch taps toggle it', async () => {
	const storage = { 'carbon.collapsed': '1', 'carbon.mode': 'pro' };
	let { page, context } = await open('/src/preview/index.html?lang=en', { storage });
	await page.waitForSelector('.cb-nav-head');
	await page.focus('.cb-nav-head');
	await page.keyboard.press('Enter');
	assert.equal(await page.evaluate(() => document.activeElement.closest('.cb-fly') !== null), true, 'focus moved into the flyout');
	await page.keyboard.press('Escape');
	assert.equal(await page.evaluate(() => document.activeElement.classList.contains('cb-nav-head')), true);
	assert.equal(await page.$eval('.cb-fly', (f) => f.classList.contains('show')), false);
	await context.close();

	({ page, context } = await open('/src/preview/index.html?lang=en', { storage, touch: true }));
	await page.waitForSelector('.cb-nav-head');
	const before = page.url();
	await page.tap('.cb-nav-head');
	assert.equal(await page.$eval('.cb-fly', (f) => f.classList.contains('show')), true, 'tap shows the sub-menu');
	assert.equal(page.url(), before, 'tap does not navigate');
	await page.tap('.cb-hero');
	assert.equal(await page.$eval('.cb-fly', (f) => f.classList.contains('show')), false, 'tapping elsewhere closes it');
	await context.close();
});

test('phone drawer traps the page behind it and restores focus', async () => {
	const { page, context } = await open('/src/preview/index.html?lang=en', { width: 390, height: 844 });
	await page.waitForSelector('.cb-nav a');
	assert.equal(await page.$eval('#cb-sidebar', (e) => e.hasAttribute('inert')), true);
	await page.click('#cb-burger');
	assert.equal(await page.getAttribute('#cb-burger', 'aria-expanded'), 'true');
	assert.equal(await page.$eval('.cb-main', (e) => e.hasAttribute('inert')), true);
	assert.equal(await page.evaluate(() => document.activeElement.closest('#cb-sidebar') !== null), true);
	await page.keyboard.press('Escape');
	assert.equal(await page.evaluate(() => document.activeElement.id), 'cb-burger');
	assert.equal(await page.$eval('.cb-main', (e) => e.hasAttribute('inert')), false);
	await context.close();
});

async function styleSnapshot(url, width) {
	const { page, context, errors } = await open(url, { width, height: 900 });
	if (url.includes('index.html')) await dashboardReady(page);
	else await page.waitForSelector('.cb-login-card');
	await page.waitForTimeout(300);
	const props = ['display', 'position', 'color', 'background-color', 'background-image', 'font-size', 'font-weight', 'line-height',
		'padding-top', 'padding-left', 'margin-top', 'margin-left', 'border-top-width', 'border-top-color', 'border-top-left-radius',
		'gap', 'opacity', 'visibility', 'box-shadow', 'backdrop-filter', 'grid-template-columns', 'flex-direction', 'transform', 'text-decoration-line'];
	const snapshot = await page.evaluate((list) => [...document.querySelectorAll('body *:not(svg *)')]
		.filter((el) => !el.closest('.cb-chart, .cb-spark, .cb-ring'))
		.map((el) => { const cs = getComputedStyle(el); return el.tagName + '.' + el.className + ' ' + list.map((p) => cs.getPropertyValue(p)).join('|'); }), props);
	await context.close();
	return { snapshot, errors };
}

for (const [name, url, width] of [['overview', 'preview/index.html?lang=en', 1440], ['overview phone', 'preview/index.html?lang=en', 390], ['login', 'preview/login.html?lang=en', 1280]]) {
	test(`minified build computes the same styles: ${name}`, async () => {
		const src = await styleSnapshot('/src/' + url, width);
		const min = await styleSnapshot('/min/' + url, width);
		assert.deepEqual(min.errors, []);
		assert.equal(min.snapshot.length, src.snapshot.length);
		const diff = src.snapshot.map((line, i) => line === min.snapshot[i] ? null : line + '\n  ≠ ' + min.snapshot[i]).filter(Boolean);
		assert.deepEqual(diff.slice(0, 5), []);
	});
}
