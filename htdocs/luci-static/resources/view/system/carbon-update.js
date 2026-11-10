'use strict';
'require view';
'require rpc';
'require poll';
'require ui';
'require carbon.markdown as markdown';

const status = rpc.declare({ object: 'luci.carbon_update', method: 'status', expect: { '': {} }, raise: true });
const check = rpc.declare({ object: 'luci.carbon_update', method: 'check', expect: { '': {} }, raise: true });
const upgrade = rpc.declare({ object: 'luci.carbon_update', method: 'upgrade', params: [ 'version' ], expect: { '': {} }, raise: true });
const configure = rpc.declare({ object: 'luci.carbon_update', method: 'configure', params: [ 'mirror' ], expect: { '': {} }, raise: true });
const MIRROR_RE = /^https:\/\/[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?(:[0-9]{1,5})?(\/[A-Za-z0-9._~%+-]+)*\/?$/;
/* Theme strings: Carbon's bundled catalogue when the theme is active, otherwise
   LuCI's (luci-i18n-carbon-* packages built from po/). */
const N_ = s => s;
const tr = (s, ...args) => (window.Carbon && typeof window.Carbon.t === 'function') ?
	window.Carbon.t(s, ...args) : (args.length ? _(s).format(...args) : _(s));
const errors = {
	network: N_('Download failed. Check internet access, DNS, router time and GitHub availability.'),
	metadata: N_('Release metadata or package version is invalid. Nothing was installed.'),
	checksum: N_('The downloaded file failed its size or SHA-256 check. Nothing was installed.'),
	signature: N_('APK signature verification failed. Nothing was installed; signature checks remain enabled.'),
	install: N_('The package manager could not finish installation. See the log below.'),
	version: N_('The installed version does not match the release. Check the installation log.'),
	settings: N_('The package was installed, but restoring theme preferences failed. Check System → Language and Style.'),
	interrupted: N_('The update was interrupted. Check the installed version before trying again.'),
	stale: N_('The release changed, expired, or is no longer newer. Check for updates again.'),
	invalid: N_('Invalid update request.'),
	busy: N_('Another update operation is running.'),
	dependencies: N_('Install curl, ca-bundle and flock, and restore the Carbon public key if missing.'),
	manual_install: N_('Install Carbon through the native package manager once to enable online upgrades.'),
	space: N_('Not enough temporary storage or unable to create update files.'),
	state: N_('Unable to access update state storage.'),
	invalid_mirror: N_('Enter an HTTPS mirror prefix such as https://mirror.example.com/ (letters, digits and . _ ~ % + - only).')
};
const message = code => errors[code] ? tr(errors[code]) : String(code || '');

return view.extend({
	load() { return status(); },
	render(data) {
		const self = this;
		let current = data, pending = false, renderedNotes;
		const installedText = E('strong');
		const latestText = E('strong');
		const stateText = E('p', { 'role': 'status', 'aria-live': 'polite' });
		const errorText = E('p', { 'role': 'alert', 'class': 'alert-message warning', 'hidden': true });
		const securityText = E('p', { 'class': 'cbi-section-descr' });
		const notes = E('div', { 'class': 'cb-release-notes', 'tabindex': '0', 'role': 'region', 'aria-label': tr('Release notes') });
		const logs = E('pre', { 'style': 'white-space:pre-wrap;overflow-wrap:anywhere;max-height:16rem;overflow:auto' });
		const refresh = E('button', { 'class': 'cbi-button cbi-button-action', 'click': () => {
			ui.menu.flushCache();
			window.location.reload();
		} }, tr('Reload page'));
		const checkButton = E('button', { 'class': 'cbi-button cbi-button-action', 'click': () => run(check) }, tr('Check for updates'));
		const updateButton = E('button', { 'class': 'cbi-button cbi-button-positive', 'click': () => {
			if (!current.can_upgrade || current.busy || pending || !L.hasViewPermission()) return;
			const version = current.latest;
			ui.showModal(tr('Update Carbon'), [
				E('p', {}, tr('Install version %s? Your theme preferences will be retained. Do not power off the router during installation.', version)),
				E('div', { 'class': 'right' }, [
					E('button', { 'class': 'cbi-button', 'click': ui.hideModal }, tr('Cancel')), ' ',
					E('button', { 'class': 'cbi-button cbi-button-positive', 'click': () => { ui.hideModal(); return run(() => upgrade(version)); } }, tr('Confirm update'))
				])
			]);
		} }, tr('Install update'));
		const mirrorInput = E('input', {
			'class': 'cbi-input-text', 'id': 'carbon-mirror', 'type': 'url', 'inputmode': 'url', 'maxlength': '200',
			'placeholder': 'https://mirror.example.com/', 'spellcheck': 'false', 'autocomplete': 'off', 'value': data.mirror || ''
		});
		const mirrorStatus = E('span', { 'role': 'status', 'aria-live': 'polite', 'style': 'margin-left:.5rem' });
		const mirrorSave = E('button', { 'class': 'cbi-button cbi-button-save', 'click': async () => {
			const value = mirrorInput.value.trim();
			if (value && !MIRROR_RE.test(value)) { mirrorStatus.textContent = message('invalid_mirror'); return; }
			mirrorSave.disabled = true;
			try {
				const result = await configure(value);
				if (result.error) mirrorStatus.textContent = message(result.error);
				else {
					mirrorInput.value = result.mirror || '';
					mirrorStatus.textContent = result.mirror ? tr('Saved. Downloads try the mirror first, then GitHub.') : tr('Saved. Downloads use GitHub directly.');
				}
			}
			catch (e) { mirrorStatus.textContent = e.message; }
			finally { mirrorSave.disabled = !L.hasViewPermission(); }
		} }, tr('Save'));
		if (!L.hasViewPermission()) { mirrorInput.disabled = true; mirrorSave.disabled = true; }
		function paint(value) {
			current = value;
			installedText.textContent = value.current || tr('Unknown');
			latestText.textContent = value.latest || tr('Not checked');
			const labels = {
				checking: N_('Checking for updates…'), downloading: N_('Downloading update…'),
				verifying: N_('Verifying update…'), installing: N_('Installing update…'),
				success: N_('Update complete. Reload this page to use the new version.'),
				failed: N_('Update failed.')
			};
			stateText.textContent = labels[value.state] ? tr(labels[value.state]) :
				value.can_upgrade ? tr('A new version is available.') :
				value.latest && value.current === value.latest ? tr('You are using the latest version.') : tr('Check the latest stable Carbon release.');
			const issue = value.error || value.reason;
			errorText.textContent = message(issue); errorText.hidden = !issue;
			securityText.textContent = value.manager === 'apk' ?
				tr('APK signature, SHA-256 and file size are verified before installation. Your signature checks remain enabled.') :
				tr('IPK updates are downloaded over HTTPS and checked against the release SHA-256 and file size.');
			// Keep selection, focus and scroll position while status polls every 2s.
			const nextNotes = value.notes || '';
			if (nextNotes !== renderedNotes) {
				if (nextNotes) notes.innerHTML = markdown.render(nextNotes);
				else notes.textContent = tr('Release notes will appear after checking.');
				renderedNotes = nextNotes;
			}
			logs.textContent = value.log || tr('No installation log yet.');
			checkButton.disabled = pending || value.busy || !!value.reason;
			updateButton.disabled = pending || value.busy || !value.can_upgrade || !L.hasViewPermission();
			refresh.hidden = value.state !== 'success';
		}
		async function sync() {
			try { paint(await status()); }
			catch (e) {
				errorText.hidden = false;
				errorText.textContent = tr('Connection interrupted. Progress will resume when LuCI reconnects. %s', e.message);
				checkButton.disabled = true; updateButton.disabled = true;
			}
		}
		async function run(action) {
			if (pending) return;
			pending = true; paint(current);
			let issue;
			try { const result = await action(); if (result.error) issue = message(result.error); }
			catch (e) { issue = e.message; }
			finally { pending = false; await sync(); }
			if (issue) { errorText.textContent = issue; errorText.hidden = false; }
		}
		paint(data);
		self.pollStatus = sync;
		poll.add(sync, 2);
		return E('div', { 'class': 'cbi-map cb-update' }, [
			E('h2', {}, tr('Carbon Theme Settings')),
			E('p', { 'class': 'cbi-map-descr' }, tr('Update the theme without changing your router configuration.')),
			E('section', { 'class': 'cbi-section' }, [
				E('div', { 'style': 'display:flex;gap:3rem;flex-wrap:wrap;margin:1rem 0' }, [
					E('div', {}, [E('p', {}, tr('Installed version')), installedText]),
					E('div', {}, [E('p', {}, tr('Latest stable version')), latestText])
				]), stateText, errorText, securityText,
				E('div', { 'style': 'display:flex;gap:0.75rem;flex-wrap:wrap;margin:1rem 0' }, [checkButton, updateButton, refresh]),
				E('a', { 'href': 'https://github.com/mrjoechen/luci-theme-carbon/releases', 'target': '_blank', 'rel': 'noopener noreferrer' }, tr('View releases on GitHub'))
			]),
			E('section', { 'class': 'cbi-section' }, [E('h3', {}, tr('Release notes')), notes]),
			E('section', { 'class': 'cbi-section' }, [
				E('h3', {}, tr('Download mirror')),
				E('p', { 'class': 'cbi-section-descr' }, tr('Optional. If GitHub downloads are slow or blocked, enter an HTTPS prefix that proxies GitHub links, for example https://mirror.example.com/ for https://mirror.example.com/https://github.com/…. Release information is still read from GitHub, and the downloaded file must match the size and SHA-256 published there; GitHub is tried if the mirror fails.')),
				E('div', { 'class': 'cbi-value' }, [
					E('label', { 'class': 'cbi-value-title', 'for': 'carbon-mirror' }, tr('Mirror prefix')),
					E('div', { 'class': 'cbi-value-field' }, [mirrorInput, ' ', mirrorSave, mirrorStatus])
				])
			]),
			E('details', { 'class': 'cbi-section' }, [E('summary', {}, tr('Installation log')), logs])
		]);
	},
	handleSave: null,
	handleSaveApply: null,
	handleReset: null
});
