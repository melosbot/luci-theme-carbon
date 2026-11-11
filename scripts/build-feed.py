#!/usr/bin/env python3
"""Lay out Carbon's opkg / apk package feed for GitHub Pages.

    python3 -I scripts/build-feed.py ASSETS_DIR OUT_DIR [--base-url URL]

ASSETS_DIR holds a release's luci-theme-carbon_*_all.ipk and signed
luci-theme-carbon-*.apk. OUT_DIR receives

    index.html          setup instructions
    carbon-feed.pub     usign key for opkg (keys/carbon-feed.pub)
    carbon-apk.pem      APK key (keys/carbon-apk.pem)
    opkg/               the .ipk, Packages, Packages.gz
    apk/                the .apk

Signing needs the private keys and OpenWrt tools, so CI adds the rest
(.github/workflows/pages.yml): opkg/Packages.sig (usign) and
apk/packages.adb (apk mkndx --sign-key).
"""
import argparse
import gzip
import hashlib
import html
import io
from pathlib import Path
import re
import shutil
import sys
import tarfile

ROOT = Path(__file__).resolve().parent.parent
IPK_RE = re.compile(r'^luci-theme-carbon_([0-9A-Za-z.+~-]+)_all\.ipk$')
APK_RE = re.compile(r'^luci-theme-carbon-([0-9A-Za-z.+~_-]+)\.apk$')


def control_of(ipk):
    """control file of an .ipk (gzip'd tar holding control.tar.gz)."""
    with tarfile.open(ipk, 'r:gz') as outer:
        member = next((m for m in outer.getmembers() if m.name.lstrip('./') == 'control.tar.gz'), None)
        if member is None:
            raise SystemExit(f'{ipk.name}: no control.tar.gz')
        data = outer.extractfile(member).read()
    with tarfile.open(fileobj=io.BytesIO(data), mode='r:gz') as inner:
        member = next((m for m in inner.getmembers() if m.name.lstrip('./') == 'control'), None)
        if member is None:
            raise SystemExit(f'{ipk.name}: no control file')
        return inner.extractfile(member).read().decode('utf-8')


def packages_entry(ipk):
    """One Packages stanza, laid out like OpenWrt's ipkg-make-index.sh."""
    blob = ipk.read_bytes()
    extra = f'Filename: {ipk.name}\nSize: {len(blob)}\nSHA256sum: {hashlib.sha256(blob).hexdigest()}\n'
    control = control_of(ipk).strip('\n') + '\n'
    if not re.search(r'^Package: luci-theme-carbon$', control, re.M):
        raise SystemExit(f'{ipk.name}: unexpected package name')
    if re.search(r'^Description:', control, re.M):
        control = re.sub(r'^Description:', lambda m: extra + 'Description:', control, count=1, flags=re.M)
    else:
        control += extra
    return control + '\n'


def pick(assets, pattern, kind):
    found = sorted(p for p in assets.iterdir() if pattern.match(p.name))
    if len(found) != 1:
        raise SystemExit(f'expected exactly one {kind} in {assets}, found {len(found)}')
    return found[0]


PAGE = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Carbon package feed</title>
<style>
:root {{ color-scheme: light dark; --fg: #1d1d1f; --fg2: #6e6e73; --bg: #f5f5f7; --card: #fff; --code: #f0f0f3; --accent: #4f5bea; }}
@media (prefers-color-scheme: dark) {{ :root {{ --fg: #f5f5f7; --fg2: #a1a1a6; --bg: #000; --card: #1c1c1e; --code: #2c2c2e; --accent: #8a93ff; }} }}
* {{ box-sizing: border-box; }}
body {{ margin: 0; padding: 32px 16px 48px; background: var(--bg); color: var(--fg); font: 15px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif; }}
main {{ max-width: 760px; margin: 0 auto; }}
h1 {{ font-size: 26px; margin: 0 0 4px; }} h2 {{ font-size: 18px; margin: 0 0 8px; }}
p {{ margin: 8px 0; }} .sub {{ color: var(--fg2); margin-bottom: 24px; }}
section {{ background: var(--card); border-radius: 16px; padding: 18px 20px; margin: 16px 0; }}
pre {{ background: var(--code); border-radius: 10px; padding: 12px 14px; overflow-x: auto; font: 13px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace; }}
code {{ font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: .92em; }}
a {{ color: var(--accent); }} ol {{ padding-left: 1.3em; }} li {{ margin: 4px 0; }}
</style>
</head>
<body>
<main>
<h1>Carbon package feed</h1>
<p class="sub">luci-theme-carbon {version} · <a href="{repo}">GitHub</a> · <a href="{site}">Live demo</a></p>

<section>
<h2>OpenWrt / ImmortalWrt 25.x, snapshot (apk)</h2>
<pre>wget -O /etc/apk/keys/carbon-apk.pem {base}/carbon-apk.pem
echo '{base}/apk/packages.adb' &gt;&gt; /etc/apk/repositories.d/customfeeds.list
apk update &amp;&amp; apk add luci-theme-carbon</pre>
</section>

<section>
<h2>OpenWrt / ImmortalWrt 23.05, 24.10 (opkg)</h2>
<pre>wget -O /tmp/carbon-feed.pub {base}/carbon-feed.pub &amp;&amp; opkg-key add /tmp/carbon-feed.pub
echo 'src/gz carbon {base}/opkg' &gt;&gt; /etc/opkg/customfeeds.conf
opkg update &amp;&amp; opkg install luci-theme-carbon</pre>
</section>

<section>
<h2>In LuCI only · 仅用网页</h2>
<ol>
<li><b>System → Administration → Repo Public Keys</b>: paste <a href="carbon-apk.pem">carbon-apk.pem</a> (apk) or <a href="carbon-feed.pub">carbon-feed.pub</a> (opkg) and add it.<br>系统 → 管理权 → 软件源公钥：粘贴对应公钥并添加。</li>
<li><b>System → Software → Configure apk/opkg…</b>: add <code>{base}/apk/packages.adb</code> to <code>customfeeds.list</code>, or <code>src/gz carbon {base}/opkg</code> to <code>customfeeds.conf</code>.<br>系统 → 软件包 → 配置：把上面的源地址加入自定义软件源。</li>
<li><b>Update lists…</b>, then search for <code>carbon</code>. New releases appear under <b>Updates</b>.<br>更新列表后搜索 carbon；新版本会出现在「更新」中。</li>
</ol>
<p>Key fingerprints: APK <code>{apk_fp}</code> (SHA-256 of carbon-apk.pem) · usign <code>{usign_fp}</code>.</p>
</section>
</main>
</body>
</html>
"""


def usign_fingerprint(pub):
    import base64
    blob = base64.b64decode(pub.read_text(encoding='ascii').splitlines()[1])
    return blob[2:10].hex()


def build(assets, out, base, repo, site):
    if out.is_symlink():
        raise SystemExit(f'unsafe output directory: {out}')
    if out.exists():
        shutil.rmtree(out)
    (out / 'opkg').mkdir(parents=True)
    (out / 'apk').mkdir()
    ipk = pick(assets, IPK_RE, '.ipk')
    apk = pick(assets, APK_RE, '.apk')
    version = IPK_RE.match(ipk.name).group(1)
    if APK_RE.match(apk.name).group(1) != version:
        raise SystemExit(f'.ipk ({version}) and .apk ({apk.name}) versions differ')

    shutil.copyfile(ipk, out / 'opkg' / ipk.name)
    entry = packages_entry(out / 'opkg' / ipk.name)
    (out / 'opkg' / 'Packages').write_text(entry, encoding='utf-8')
    with open(out / 'opkg' / 'Packages.gz', 'wb') as raw:
        # mtime 0: identical input gives an identical file
        with gzip.GzipFile(filename='Packages', mode='wb', fileobj=raw, mtime=0) as gz:
            gz.write(entry.encode('utf-8'))
    shutil.copyfile(apk, out / 'apk' / apk.name)

    for key in ('carbon-feed.pub', 'carbon-apk.pem'):
        shutil.copyfile(ROOT / 'keys' / key, out / key)
    apk_fp = hashlib.sha256((ROOT / 'keys' / 'carbon-apk.pem').read_bytes()).hexdigest()
    page = PAGE.format(version=html.escape(version), base=html.escape(base), repo=html.escape(repo),
                       site=html.escape(site), apk_fp=apk_fp, usign_fp=usign_fingerprint(ROOT / 'keys' / 'carbon-feed.pub'))
    (out / 'index.html').write_text(page, encoding='utf-8')
    print(f'Built feed for luci-theme-carbon {version}: {out}')
    return version


def main(argv):
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument('assets', type=Path)
    ap.add_argument('out', type=Path)
    ap.add_argument('--repository', default='mrjoechen/luci-theme-carbon', help='GitHub owner/name')
    ap.add_argument('--base-url', help='public feed URL (default: the repository\'s GitHub Pages /feed)')
    a = ap.parse_args(argv)
    if not re.fullmatch(r'[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+', a.repository):
        raise SystemExit('invalid --repository')
    owner, name = a.repository.split('/')
    site = f'https://{owner.lower()}.github.io/{name}/'
    base = (a.base_url or site + 'feed').rstrip('/')
    if not re.fullmatch(r'https://[A-Za-z0-9.-]+(:[0-9]+)?(/[A-Za-z0-9._~%+-]+)*', base):
        raise SystemExit('invalid --base-url')
    build(a.assets, a.out, base, f'https://github.com/{a.repository}', site)
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
