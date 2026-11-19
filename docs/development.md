# Development

How to change a userscript, check it and publish it on Greasy Fork.

## Layout

```text
userscripts/<website>/<name>.user.js   # one folder per website, no website prefix in the name
.github/workflows/lint.yml             # ESLint, Prettier and the @version check
.github/scripts/                       # the @version check and its tests (Node.js)
eslint.config.mjs, .prettierrc.json    # lint and format rules
package.json, package-lock.json        # npm scripts, pinned ESLint and Prettier
```

A script is a single classic browser script with a `// ==UserScript==` header
and `@grant none`: no `GM_*` API, no `@require`, no build step. The file is
exactly what the userscript manager runs.

## Header

The header of a published script follows this shape:

```js
// ==UserScript==
// @name         Website — What it does
// @namespace    https://github.com/g-ongenae/dotfiles
// @author       g-ongenae
// @version      1.2.3
// @description  One paragraph: what it hides, adds or changes.
// @license      MIT
// @homepageURL  https://github.com/g-ongenae/userscripts/blob/main/userscripts/<website>/<name>.user.js
// @supportURL   https://github.com/g-ongenae/userscripts/issues
// @updateURL    https://update.greasyfork.org/scripts/<id>.meta.js
// @downloadURL  https://update.greasyfork.org/scripts/<id>.user.js
// @match        https://example.com/*
// @run-at       document-start
// @noframes
// @grant        none
// ==/UserScript==
```

- **`@name` and `@namespace` never change.** Userscript managers identify an
  installed script by the pair, and Greasy Fork warns when the namespace
  changes on an update. The namespace still names the dotfiles repository,
  where the scripts started; keep it as it is for existing scripts. A new
  script can use `https://github.com/g-ongenae/userscripts`.
- **`@version` grows with every change**, even to the header alone. Managers
  and Greasy Fork only fetch a new copy when it is higher, so an edit published
  under the old number never reaches installed copies. CI enforces it (see
  below).
- **`@updateURL` and `@downloadURL`** point at Greasy Fork, by script id.
  Greasy Fork strips both keys from what it serves, so they only matter for a
  copy installed from a raw GitHub URL: it then updates from Greasy Fork too.
  A script that is not on Greasy Fork leaves them out and updates from its raw
  URL on `main`.
- **`@grant none`** and **`@noframes`** unless the script needs otherwise.

## Checks

```bash
npm ci --ignore-scripts                 # once: install ESLint and Prettier into node_modules/
npm run lint                            # ESLint findings and Prettier differences
npm run lint:fix                        # apply ESLint's fixes, then reformat in place
npm run check-versions -- origin/main   # version check: working tree against main
npm test                                # test the version check
```

- **ESLint** runs its recommended rules (`eslint.config.mjs`); userscripts are
  checked as classic browser scripts, with Firefox's `exportFunction` as a
  known global.
- **Prettier** (`.prettierrc.json`): single quotes, lines of up to 120
  characters.
- **The version check** fails when a script changed since the merge base with
  the given branch without a higher `@version`. Added scripts are not checked.

[`.github/workflows/lint.yml`](../.github/workflows/lint.yml) runs `npm run lint`,
`npm test` and the version check on every push to `main` and every pull request.

## Trying a change

In Violentmonkey, open the installed script and paste the new source, or
install the file from your branch's raw URL
(`https://raw.githubusercontent.com/g-ongenae/userscripts/<branch>/userscripts/<website>/<name>.user.js`).
A script installed from a raw URL keeps updating from its `@downloadURL`, so
reinstall from Greasy Fork once the change is published.

## Publishing on Greasy Fork

Scripts are published under
[the Greasy Fork profile](https://greasyfork.org/en/users/1663163-guillaume-ongenae).

- **Updating a script**: after the change is merged into `main`, either let
  Greasy Fork sync it or upload it by hand from the script's **Update** page.
  To sync, set the script's sync source (on its Greasy Fork admin page) to its raw URL on
  `main`: `https://raw.githubusercontent.com/g-ongenae/userscripts/main/userscripts/<website>/<name>.user.js`.
  Scripts that synced from the dotfiles repository need that URL changed.
- **Publishing a new script**: create it on Greasy Fork from its raw URL, then
  add `@updateURL` / `@downloadURL` with the new id and an install link in the
  [README](../README.md#install) and a section in [scripts.md](scripts.md).
