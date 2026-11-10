# Navigation and menu cache regressions

Run `node --test tests/menu-cache.test.js` from the repository root. This executes the production LuCI menu module with both menu-cache layers and checks version invalidation, retained session data, unchanged-version reuse and retry after failure. CI runs this suite before packaging.

Serve the repository locally (for example, `python -m http.server 8080 --bind 127.0.0.1`) and open `/tests/navigation.html` at a **390 × 844** viewport. All ten checks must show `PASS`. The page loads the production theme script and stylesheet and tests route tabs, nested tabs, asynchronously inserted form tabs, hidden panes, resizing, manual scrolling and focus/vertical-scroll preservation. A desktop viewport fails the viewport check because desktop tabs wrap instead of overflowing.

Also verify in a disposable LuCI environment: open a multi-page app with an active tab beyond the initial visible area, then navigate between nested pages. When testing a real upgrade, keep the existing login session, install the native package and reload. LuCI uses the package database modification time to invalidate JavaScript module URLs; merely copying files into an already loaded development instance does not reproduce this part of installation.

For signed APK and native IPK updater integration tests, see [online-update.md](../docs/online-update.md#maintainers).
