# markdown-it

Pinned browser bundle: **markdown-it 15.0.3** (MIT), from the official npm package:
https://registry.npmjs.org/markdown-it/-/markdown-it-15.0.3.tgz

Tarball integrity: `sha512-+Az7Ojz3iRGu8KYMvJ6xVhvrxP3eE+vEtJX75Ow88XBpcQNV/0lGX5ZynIIBftREo4DC2jsveAMDaeltmm8QvQ==`

`markdown_it.js` contains `dist/browser/markdown-it.umd.min.js`, with its source-map comment removed, enclosed by a LuCI `baseclass` adapter and a local CommonJS `module`/`exports` pair. The bundle itself is otherwise unchanged. It loads only when the Carbon settings view requires it; no CDN or package manager is needed on the router.

The upstream license is in `markdown-it.LICENSE`. Bundled dependency notices are in `THIRD-PARTY-LICENSES.txt`. When updating, verify the npm integrity, keep the adapter and notices, and rerun `node --test tests/markdown.test.js` plus the LuCI preview checks.

Do not enable raw HTML or add arbitrary Markdown plugins in the wrapper. Link destinations are constrained in `../markdown.js`.
