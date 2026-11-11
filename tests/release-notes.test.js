'use strict';
/* Release body assembly (scripts/release-notes.sh): one complete section per language. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const RELEASES = path.join(ROOT, 'docs/releases');

function notes(tag, files, repo) {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'carbon-notes-'));
	for (const f of ['install.en.md', 'install.zh-CN.md']) fs.copyFileSync(path.join(RELEASES, f), path.join(dir, f));
	for (const [name, text] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), text);
	const args = [path.join(ROOT, 'scripts/release-notes.sh'), tag].concat(repo ? [repo] : []);
	return spawnSync('sh', args, { encoding: 'utf8', env: Object.assign({}, process.env, { RELEASE_NOTES_DIR: dir }) });
}

test('English first, then Simplified Chinese, each with its notes and install guide', () => {
	const en = fs.readFileSync(path.join(RELEASES, 'next.en.md'), 'utf8');
	const zh = fs.readFileSync(path.join(RELEASES, 'next.zh-CN.md'), 'utf8');
	const r = notes('v9.9.9', { 'v9.9.9.en.md': en, 'v9.9.9.zh-CN.md': zh }, 'someone/fork');
	assert.equal(r.status, 0, r.stderr);
	const out = r.stdout;
	const order = ['## English', "### What's new", '### Upgrade notes', '### Install', '---', '## 简体中文', '### 更新内容', '### 升级须知', '### 安装']
		.map((h) => out.indexOf('\n' + h) >= 0 ? out.indexOf('\n' + h) : out.indexOf(h));
	assert.ok(order.every((i, k) => i >= 0 && (k === 0 || i > order[k - 1])), 'sections in order: ' + order.join(','));
	/* no Chinese in the English half, no English prose headings in the Chinese half */
	const [enPart, zhPart] = out.split('\n---\n\n## 简体中文');
	assert.doesNotMatch(enPart, /[一-鿿]/);
	assert.doesNotMatch(zhPart, /### (What's new|Upgrade notes|Install)\b/);
	assert.match(out, /github\.com\/someone\/fork\/releases\/latest\/download\/carbon-install\.sh/);
	assert.doesNotMatch(out, /@REPOSITORY@/);
});

test('older single-file notes are kept above both sections', () => {
	const r = notes('v1.0.9', { 'v1.0.9.md': '### v1.0.9\n\n- 旧格式 / old format\n' });
	assert.equal(r.status, 0, r.stderr);
	assert.match(r.stdout, /^### v1\.0\.9\n\n- 旧格式 \/ old format\n\n---\n\n## English\n\n### Install/);
	assert.match(r.stdout, /mrjoechen\/luci-theme-carbon/);
});

test('tag and repository are validated', () => {
	assert.notEqual(notes('latest', {}).status, 0);
	assert.notEqual(notes('v1.2.3', {}, 'bad repo').status, 0);
});
