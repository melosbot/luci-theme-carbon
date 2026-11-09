'use strict';
'require baseclass';
'require ui';
'require rpc';
'require fs';

/*
 * Carbon — LuCI glue.
 * Reads LuCI's menu tree, renders the sidebar / tab bar and mounts the
 * dashboard on Status → Overview. Everything visual lives in carbon.js.
 * All calls below are read-only.
 */

const callBoard = rpc.declare({ object: 'system', method: 'board', expect: { '': {} } });
const callInfo = rpc.declare({ object: 'system', method: 'info', expect: { '': {} } });
const callIfaces = rpc.declare({ object: 'network.interface', method: 'dump', expect: { 'interface': [] } });
const callDevice = rpc.declare({ object: 'network.device', method: 'status', params: [ 'name' ], expect: { '': {} } });
const callNetDevs = rpc.declare({ object: 'luci-rpc', method: 'getNetworkDevices', expect: { '': {} } });
const callLeases = rpc.declare({ object: 'luci-rpc', method: 'getDHCPLeases', expect: { '': {} } });
const callWireless = rpc.declare({ object: 'network.wireless', method: 'status', expect: { '': {} } });
const callUciGet = rpc.declare({ object: 'uci', method: 'get', params: [ 'config', 'section' ], expect: { values: {} } });
const callUciSet = rpc.declare({ object: 'uci', method: 'set', params: [ 'config', 'section', 'values' ] });
const callUciCommit = rpc.declare({ object: 'uci', method: 'commit', params: [ 'config' ] });

/*
 * Interface language: writes luci.main.lang — exactly what
 * System → System → Language does — then the page reloads.
 * Chinese uses whichever zh catalogue is installed (zh_cn / zh_Hans …).
 */
const language = {
	current: /^zh/i.test(document.documentElement.getAttribute('lang') || '') ? 'zh' : 'en',
	set: (target) => callUciGet('luci', 'languages').then((langs) => {
		let code = 'en';

		if (target === 'zh') {
			const zh = Object.keys(langs || {})
				.filter((k) => k.charAt(0) !== '.' && /^zh/i.test(k))
				.sort((a, b) => (/hans|cn/i.test(b) ? 1 : 0) - (/hans|cn/i.test(a) ? 1 : 0));

			if (!zh.length)
				throw new Error('No Chinese translation installed (luci-i18n-base-zh-cn)');

			code = zh[0];
		}

		return callUciSet('luci', 'main', { lang: code });
	}).then((rc) => {
		if (typeof rc === 'number' && rc !== 0)
			throw new Error('uci set failed: ' + rc);

		return callUciCommit('luci');
	}).then((rc) => {
		if (typeof rc === 'number' && rc !== 0)
			throw new Error('uci commit failed: ' + rc);
	})
};

const provider = {
	board: () => callBoard().then((r) => (r && r.hostname) ? r : null),
	info: () => callInfo().then((r) => (r && (r.memory || r.uptime != null)) ? r : null),
	cpuStat: () => fs.read('/proc/stat'),
	interfaces: () => callIfaces().then((r) => (Array.isArray(r) && r.length) ? r : null),
	devStats: (dev, alt) => callDevice(dev).then((r) => {
		if (r && r.statistics && r.statistics.rx_bytes != null)
			return r.statistics;

		return callNetDevs().then((all) => {
			const d = (all && (all[dev] || (alt && all[alt]))) || null;
			return (d && d.stats) ? d.stats : null;
		});
	}),
	leases: () => callLeases().then((r) => (r && Array.isArray(r.dhcp_leases)) ? r : null),
	wireless: () => callWireless(),
	conntrack: () => Promise.all([
		fs.read('/proc/sys/net/netfilter/nf_conntrack_count'),
		fs.read('/proc/sys/net/netfilter/nf_conntrack_max').catch(() => null)
	]),
	temperature: () => fs.read('/sys/class/thermal/thermal_zone0/temp')
};

return baseclass.extend({
	__init__() {
		ui.menu.load().then((tree) => this.render(tree));
	},

	render(tree) {
		const C = window.Carbon;
		const roots = ui.menu.getChildren(tree);
		const reqRoot = L.env.requestpath.length ? L.env.requestpath[0] : null;
		const root = roots.filter((c) => c.name === reqRoot)[0] || roots[0];

		if (!C || !root)
			return;

		const categories = ui.menu.getChildren(root).map((cat) => ({
			name: cat.name,
			title: _(cat.title),
			path: root.name + '/' + cat.name,
			url: L.url(root.name, cat.name),
			children: ui.menu.getChildren(cat).map((ch) => ({
				name: ch.name,
				title: C.t(_(ch.title)),
				path: root.name + '/' + cat.name + '/' + ch.name,
				url: L.url(root.name, cat.name, ch.name)
			}))
		}));

		const known = {};
		categories.forEach((c) => {
			known[c.path] = c;
			c.children.forEach((ch) => { known[ch.path] = ch; });
		});

		C.initShell({
			logoutUrl: known[root.name + '/logout'] ? L.url(root.name, 'logout') : null,
			language: language
		});

		C.renderNav({
			root: root.name,
			categories: categories,
			activePath: L.env.dispatchpath,
			url: (p) => L.url(p)
		});

		/* toolbar title: Category › Page */
		const dp = L.env.dispatchpath;
		const cat = known[dp.slice(0, 2).join('/')];
		const page = known[dp.slice(0, 3).join('/')];
		C.setTitle([cat && cat.title, page && page.title]);

		/* third level and below → segmented tab bar */
		if (dp.length >= 3) {
			let node = tree, url = '';
			for (let i = 0; i < 3 && node; i++) {
				node = node.children[dp[i]];
				url = url + (url ? '/' : '') + dp[i];
			}
			if (node)
				this.renderTabMenu(node, url);
		}

		if (dp.join('/') === root.name + '/status/overview')
			this.mountDashboard(root.name, known);
	},

	renderTabMenu(tree, url, level) {
		const container = document.querySelector('#tabmenu');
		const ul = E('ul', { 'class': 'tabs' });
		const children = ui.menu.getChildren(tree);
		let activeNode = null;

		children.forEach((child) => {
			const isActive = (L.env.dispatchpath[3 + (level || 0)] == child.name);
			const className = 'tabmenu-item-%s %s'.format(child.name, isActive ? 'active' : '');

			ul.appendChild(E('li', { 'class': className }, [
				E('a', { 'href': L.url(url, child.name) }, [ _(child.title) ])
			]));

			if (isActive)
				activeNode = child;
		});

		if (ul.children.length == 0 || !container)
			return E([]);

		container.appendChild(ul);
		container.style.display = '';

		if (activeNode)
			this.renderTabMenu(activeNode, url + '/' + activeNode.name, (level || 0) + 1);

		return ul;
	},

	mountDashboard(rootName, known) {
		const C = window.Carbon;
		const main = document.getElementById('maincontent');
		const view = document.getElementById('view');

		if (!main)
			return;

		const link = (p) => known[rootName + '/' + p] ? L.url(rootName, p) : null;
		const host = E('div', { 'id': 'cb-dashboard' });

		main.insertBefore(host, (view && view.parentNode === main) ? view : null);

		C.Dashboard.mount(host, provider, {
			urls: {
				network: link('network/network'),
				wireless: link('network/wireless'),
				devices: link('network/dhcp')
			}
		});

		C.detailsToggle(host, C.mode.get() === 'pro');
	}
});
