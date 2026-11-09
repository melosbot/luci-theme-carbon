'use strict';
'require view';
'require rpc';
'require poll';
'require ui';

const status = rpc.declare({ object: 'luci.carbon_update', method: 'status', expect: { '': {} }, raise: true });
const check = rpc.declare({ object: 'luci.carbon_update', method: 'check', expect: { '': {} }, raise: true });
const upgrade = rpc.declare({ object: 'luci.carbon_update', method: 'upgrade', params: [ 'version' ], expect: { '': {} }, raise: true });
const tr = (en, zh) => /^zh/i.test(document.documentElement.lang) ? zh : en;
const errors = {
	network: ['Download failed. Check internet access, DNS, router time and GitHub availability.', '下载失败，请检查网络、DNS、路由器时间及 GitHub 连通性。'],
	metadata: ['Release metadata or package version is invalid. Nothing was installed.', '更新信息或包版本不匹配，未执行安装。'],
	checksum: ['The downloaded file failed its size or SHA-256 check. Nothing was installed.', '下载文件大小或 SHA-256 校验失败，未执行安装。'],
	signature: ['APK signature verification failed. Nothing was installed; signature checks remain enabled.', 'APK 签名校验失败，未执行安装；签名校验保持启用。'],
	install: ['The package manager could not finish installation. See the log below.', '包管理器未能完成安装，请查看下方日志。'],
	version: ['The installed version does not match the release. Check the installation log.', '安装后的版本与目标版本不符，请查看安装日志。'],
	settings: ['The package was installed, but restoring theme preferences failed. Check System → Language and Style.', '软件包已安装，但恢复主题偏好失败，请检查「系统 → 语言和界面」。'],
	interrupted: ['The update was interrupted. Check the installed version before trying again.', '更新已中断，请确认当前版本后重试。'],
	stale: ['The release changed, expired, or is no longer newer. Check for updates again.', '更新信息已变化、过期或不再是新版本，请重新检查更新。'],
	invalid: ['Invalid update request.', '更新请求无效。'],
	busy: ['Another update operation is running.', '已有更新任务正在执行。'],
	dependencies: ['Install curl, ca-bundle and flock, and restore the Carbon public key if missing.', '请安装 curl、ca-bundle、flock，并检查 Carbon 公钥文件是否完整。'],
	manual_install: ['Install Carbon through the native package manager once to enable online upgrades.', '请先通过系统包管理器安装一次 Carbon，以启用在线升级。'],
	space: ['Not enough temporary storage or unable to create update files.', '临时存储空间不足或无法创建更新文件。'],
	state: ['Unable to access update state storage.', '无法访问更新状态目录。']
};
const message = code => errors[code] ? tr.apply(null, errors[code]) : String(code || '');

return view.extend({
	load() { return status(); },
	render(data) {
		const self = this;
		let current = data, pending = false;
		const installedText = E('strong');
		const latestText = E('strong');
		const stateText = E('p', { 'role': 'status', 'aria-live': 'polite' });
		const errorText = E('p', { 'role': 'alert', 'class': 'alert-message warning', 'hidden': true });
		const securityText = E('p', { 'class': 'cbi-section-descr' });
		const notes = E('pre', { 'style': 'white-space:pre-wrap;overflow-wrap:anywhere;max-height:24rem;overflow:auto' });
		const logs = E('pre', { 'style': 'white-space:pre-wrap;overflow-wrap:anywhere;max-height:16rem;overflow:auto' });
		const refresh = E('button', { 'class': 'cbi-button cbi-button-action', 'click': () => window.location.reload() }, tr('Reload page', '刷新页面'));
		const checkButton = E('button', { 'class': 'cbi-button cbi-button-action', 'click': () => run(check) }, tr('Check for updates', '检查更新'));
		const updateButton = E('button', { 'class': 'cbi-button cbi-button-positive', 'click': () => {
			if (!current.can_upgrade || current.busy || pending || !L.hasViewPermission()) return;
			const version = current.latest;
			ui.showModal(tr('Update Carbon', '升级 Carbon'), [
				E('p', {}, tr('Install version ', '安装版本 ') + version + tr('? Your theme preferences will be retained. Do not power off the router during installation.', '？主题偏好将保留，安装时请勿关闭路由器。')),
				E('div', { 'class': 'right' }, [
					E('button', { 'class': 'cbi-button', 'click': ui.hideModal }, tr('Cancel', '取消')), ' ',
					E('button', { 'class': 'cbi-button cbi-button-positive', 'click': () => { ui.hideModal(); return run(() => upgrade(version)); } }, tr('Install update', '确认升级'))
				])
			]);
		} }, tr('Install update', '一键升级'));
		function paint(value) {
			current = value;
			installedText.textContent = value.current || tr('Unknown', '未知');
			latestText.textContent = value.latest || tr('Not checked', '尚未检查');
			const labels = {
				checking: ['Checking for updates…', '正在检查更新…'], downloading: ['Downloading update…', '正在下载更新…'],
				verifying: ['Verifying update…', '正在校验更新…'], installing: ['Installing update…', '正在安装更新…'],
				success: ['Update complete. Reload this page to use the new version.', '更新完成，请刷新页面使用新版本。'],
				failed: ['Update failed.', '更新失败。']
			};
			stateText.textContent = labels[value.state] ? tr.apply(null, labels[value.state]) :
				value.can_upgrade ? tr('A new version is available.', '发现新版本。') :
				value.latest && value.current === value.latest ? tr('You are using the latest version.', '已是最新版本。') : tr('Check the latest stable Carbon release.', '检查 Carbon 最新稳定版。');
			const issue = value.error || value.reason;
			errorText.textContent = message(issue); errorText.hidden = !issue;
			securityText.textContent = value.manager === 'apk' ?
				tr('APK signature, SHA-256 and file size are verified before installation. Your signature checks remain enabled.', '安装前验证 APK 签名、SHA-256 和文件大小，保留签名校验。') :
				tr('IPK updates are downloaded over HTTPS and checked against the release SHA-256 and file size.', 'IPK 更新通过 HTTPS 下载，并核对发布文件的 SHA-256 和大小。');
			notes.textContent = value.notes || tr('Release notes will appear after checking.', '检查后显示更新说明。');
			logs.textContent = value.log || tr('No installation log yet.', '暂无安装日志。');
			checkButton.disabled = pending || value.busy || !!value.reason;
			updateButton.disabled = pending || value.busy || !value.can_upgrade || !L.hasViewPermission();
			refresh.hidden = value.state !== 'success';
		}
		async function sync() {
			try { paint(await status()); }
			catch (e) {
				errorText.hidden = false;
				errorText.textContent = tr('Connection interrupted. Progress will resume when LuCI reconnects. ', '连接暂时中断，LuCI 恢复后将继续显示进度。 ') + e.message;
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
			E('h2', {}, tr('Carbon Update', 'Carbon 更新')),
			E('p', { 'class': 'cbi-map-descr' }, tr('Update the theme without changing your router configuration.', '在线更新主题，保留路由器配置。')),
			E('section', { 'class': 'cbi-section' }, [
				E('div', { 'style': 'display:flex;gap:3rem;flex-wrap:wrap;margin:1rem 0' }, [
					E('div', {}, [E('p', {}, tr('Installed version', '当前版本')), installedText]),
					E('div', {}, [E('p', {}, tr('Latest stable version', '最新稳定版')), latestText])
				]), stateText, errorText, securityText,
				E('div', { 'style': 'display:flex;gap:0.75rem;flex-wrap:wrap;margin:1rem 0' }, [checkButton, updateButton, refresh]),
				E('a', { 'href': 'https://github.com/mrjoechen/luci-theme-carbon/releases', 'target': '_blank', 'rel': 'noopener noreferrer' }, tr('View releases on GitHub', '在 GitHub 查看发布版本'))
			]),
			E('section', { 'class': 'cbi-section' }, [E('h3', {}, tr('Release notes', '更新说明')), notes]),
			E('details', { 'class': 'cbi-section' }, [E('summary', {}, tr('Installation log', '安装日志')), logs])
		]);
	},
	handleSave: null,
	handleSaveApply: null,
	handleReset: null
});
