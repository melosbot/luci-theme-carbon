'use strict';
/*
 * Package feed layout (scripts/build-feed.py) and the usign helper.
 * Signing and the opkg/apk round trip run in CI (scripts/publish-feed.sh).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const zlib = require('node:zlib');
const { execFileSync, spawnSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const VERSION = /PKG_VERSION:=(\S+)/.exec(fs.readFileSync(path.join(ROOT, 'Makefile'), 'utf8'))[1] + '-r' +
	/PKG_RELEASE:=(\S+)/.exec(fs.readFileSync(path.join(ROOT, 'Makefile'), 'utf8'))[1];

let ipkDir = null;
function assets() {
	if (!ipkDir) {
		ipkDir = fs.mkdtempSync(path.join(os.tmpdir(), 'carbon-feed-ipk-'));
		execFileSync('sh', [path.join(ROOT, 'scripts/build-ipk.sh'), ipkDir], { stdio: 'ignore' });
	}
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'carbon-feed-assets-'));
	for (const f of fs.readdirSync(ipkDir)) fs.copyFileSync(path.join(ipkDir, f), path.join(dir, f));
	fs.writeFileSync(path.join(dir, `luci-theme-carbon-${VERSION}.apk`), 'apk bytes');
	return dir;
}
const feed = (dir, ...extra) => {
	const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'carbon-feed-out-')), 'feed');
	const r = spawnSync('python3', ['-I', path.join(ROOT, 'scripts/build-feed.py'), dir, out, ...extra], { encoding: 'utf8' });
	return { out, code: r.status, err: r.stderr };
};

test('opkg index matches the package, like ipkg-make-index.sh', () => {
	const dir = assets();
	const { out, code, err } = feed(dir);
	assert.equal(code, 0, err);
	const ipk = `luci-theme-carbon_${VERSION}_all.ipk`;
	const bytes = fs.readFileSync(path.join(out, 'opkg', ipk));
	const index = fs.readFileSync(path.join(out, 'opkg/Packages'), 'utf8');
	assert.match(index, /^Package: luci-theme-carbon\n/);
	assert.match(index, new RegExp(`^Version: ${VERSION.replace(/\./g, '\\.')}$`, 'm'));
	assert.match(index, /^Architecture: all$/m);
	assert.match(index, /^Depends: luci-base, curl, ca-bundle, flock$/m);
	assert.match(index, new RegExp(`Filename: ${ipk.replace(/\./g, '\\.')}\nSize: ${bytes.length}\nSHA256sum: ${crypto.createHash('sha256').update(bytes).digest('hex')}\nDescription: `));
	assert.ok(index.endsWith('\n\n'), 'stanza ends with a blank line');
	assert.equal(zlib.gunzipSync(fs.readFileSync(path.join(out, 'opkg/Packages.gz'))).toString(), index);
	assert.ok(fs.existsSync(path.join(out, 'apk', `luci-theme-carbon-${VERSION}.apk`)));
	for (const key of ['carbon-feed.pub', 'carbon-apk.pem'])
		assert.deepEqual(fs.readFileSync(path.join(out, key)), fs.readFileSync(path.join(ROOT, 'keys', key)));
	/* deterministic: same input, same compressed index */
	const again = feed(dir);
	assert.deepEqual(fs.readFileSync(path.join(again.out, 'opkg/Packages.gz')), fs.readFileSync(path.join(out, 'opkg/Packages.gz')));
});

test('the setup page uses the repository\'s Pages URL', () => {
	const { out, code, err } = feed(assets(), '--repository', 'Someone/luci-theme-carbon');
	assert.equal(code, 0, err);
	const page = fs.readFileSync(path.join(out, 'index.html'), 'utf8');
	assert.match(page, /src\/gz carbon https:\/\/someone\.github\.io\/luci-theme-carbon\/feed\/opkg/);
	assert.match(page, /https:\/\/someone\.github\.io\/luci-theme-carbon\/feed\/apk\/packages\.adb/);
	assert.match(page, new RegExp(crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, 'keys/carbon-apk.pem'))).digest('hex')));
	assert.equal(feed(assets(), '--base-url', 'http://insecure.example/feed').code, 1);
	assert.equal(feed(assets(), '--repository', 'bad name').code, 1);
});

test('mismatched or ambiguous release assets are refused', () => {
	const dir = assets();
	fs.renameSync(path.join(dir, `luci-theme-carbon-${VERSION}.apk`), path.join(dir, 'luci-theme-carbon-0.0.1-r1.apk'));
	assert.match(feed(dir).err, /versions differ/);
	fs.writeFileSync(path.join(dir, `luci-theme-carbon-${VERSION}.apk`), 'x');
	assert.match(feed(dir).err, /exactly one \.apk/);
	assert.match(feed(fs.mkdtempSync(path.join(os.tmpdir(), 'carbon-feed-empty-'))).err, /exactly one \.ipk/);
});

test('the committed feed key is a usign public key named like opkg-key would', () => {
	const lines = fs.readFileSync(path.join(ROOT, 'keys/carbon-feed.pub'), 'ascii').trim().split('\n');
	assert.match(lines[0], /^untrusted comment: /);
	const blob = Buffer.from(lines[1], 'base64');
	assert.equal(blob.length, 42);
	assert.equal(blob.subarray(0, 2).toString(), 'Ed');
	const sums = fs.readFileSync(path.join(ROOT, 'keys/SHA256SUMS'), 'utf8');
	assert.ok(sums.includes(crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, 'keys/carbon-feed.pub'))).digest('hex') + '  carbon-feed.pub'));
});

/* usign.py needs the Python cryptography package; CI signs with OpenWrt's usign instead */
const hasCrypto = spawnSync('python3', ['-c', 'import cryptography']).status === 0;
test('usign.py keys and signatures follow the usign format', { skip: !hasCrypto && 'python3 cryptography not installed' }, () => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'carbon-usign-'));
	const run = (...args) => spawnSync('python3', [path.join(ROOT, 'scripts/usign.py'), ...args], { cwd: dir, encoding: 'utf8' });
	const fp = run('keygen', 'k.sec', 'k.pub', 'test').stdout.trim();
	assert.match(fp, /^[0-9a-f]{16}$/);
	assert.equal(fs.statSync(path.join(dir, 'k.sec')).mode & 0o777, 0o600);
	assert.equal(run('fingerprint', 'k.pub').stdout.trim(), fp);
	fs.writeFileSync(path.join(dir, 'Packages'), 'Package: x\n\n');
	assert.equal(run('sign', 'k.sec', 'Packages', 'Packages.sig').status, 0);
	const sig = fs.readFileSync(path.join(dir, 'Packages.sig'), 'ascii').split('\n');
	assert.equal(sig[0], 'untrusted comment: signed by key ' + fp);
	assert.equal(Buffer.from(sig[1], 'base64').length, 74);
	assert.equal(run('verify', 'k.pub', 'Packages', 'Packages.sig').status, 0);
	/* standard Ed25519: Node's own implementation accepts the signature */
	const pub = Buffer.from(fs.readFileSync(path.join(dir, 'k.pub'), 'ascii').split('\n')[1], 'base64').subarray(10);
	const key = crypto.createPublicKey({ key: Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), pub]), format: 'der', type: 'spki' });
	assert.ok(crypto.verify(null, fs.readFileSync(path.join(dir, 'Packages')), key, Buffer.from(sig[1], 'base64').subarray(10)));
	fs.appendFileSync(path.join(dir, 'Packages'), 'tampered');
	assert.equal(run('verify', 'k.pub', 'Packages', 'Packages.sig').status, 1);
	assert.notEqual(run('keygen', 'k.sec', 'other.pub').status, 0, 'never overwrites a secret key');
});
