// ==UserScript==
// @name         GitHub — Hide the Agents tab
// @namespace    https://github.com/g-ongenae/dotfiles
// @author       g-ongenae
// @version      1.5.0
// @description  Hides the "Agents" tab of the repository navigation bar, its entry in the overflow menu shown on narrow windows, the Copilot button (and its dropdown) of the page header, the Copilot panel button of the pull request header, the "Ask about this diff" button of each file in the pull request diff, and the "Ask Copilot about this file" button of the file view.
// @description:fr Masque l’onglet « Agents » de la navigation du dépôt GitHub, y compris dans le menu affiché quand la fenêtre est étroite. Masque aussi le bouton Copilot et son menu dans l’en-tête de la page, le bouton du panneau Copilot dans l’en-tête des pull requests le bouton « Ask about this diff » de chaque fichier modifié et le bouton « Ask Copilot about this file » de l’affichage d’un fichier.
// @license      MIT
// @homepageURL  https://github.com/g-ongenae/userscripts/blob/main/userscripts/github/hide-agents-tab.user.js
// @supportURL   https://github.com/g-ongenae/userscripts/issues
// @updateURL    https://update.greasyfork.org/scripts/604907.meta.js
// @downloadURL  https://update.greasyfork.org/scripts/604907.user.js
// @match        https://github.com/*
// @run-at       document-start
// @noframes
// @grant        none
// ==/UserScript==

(() => {
  'use strict';

  // The tab links to /<owner>/<repo>/agents; matched by its tab name and id, whatever GitHub's
  // language, in the navigation bar and in the "…" overflow menu that holds the tabs not fitting the
  // window. Its link is only a fallback for entries without a tab name: the Code tab of a repository
  // named "agents" links to /<owner>/agents too
  const TAB = [
    'a[data-tab-item="agents"]',
    'a[data-tab-item$="agents-tab"]',
    '#agents-tab',
    'a[href$="/agents"]:not([data-tab-item])',
    'a[href*="/agents?"]:not([data-tab-item])',
  ].join(', ');
  const TAB_IS = `:is(${TAB})`;
  const HIDDEN = [
    `nav[aria-label="Repository"] ${TAB_IS}`,
    `nav[aria-label="Repository"] li:has(> ${TAB_IS})`,
    '.js-responsive-underlinenav [data-menu-item$="agents-tab"]',
    `[role="menu"] :is(li, [role="menuitem"]):has(> ${TAB_IS})`,
  ].join(', ');
  // The hidden tab never fits the bar, so GitHub flags it as overflowing (aria-hidden) and shows a
  // "More" button just for it; drop that button unless another tab overflows too. Kept in its own
  // rule, and without nested :has() (invalid CSS), so a parse failure can't unhide the tab
  const MORE = `nav[aria-label="Repository"]:not(:has(> ul > li[aria-hidden="true"] > a:not(${TAB_IS})))
    > div:has(> [data-component="overflow-menu-button"])`;
  // The Copilot button of the page header, next to the search bar, and its dropdown arrow. The
  // dropdown is labelled, but the button itself isn't (its tooltip names it), so it is matched by
  // its Copilot icon, in its own rule so a browser without :has() still hides the dropdown
  const COPILOT = [
    '.AppHeader-CopilotChat',
    '#copilot-chat-header-button',
    'header :is(button, a)[aria-label*="Copilot"]',
  ].join(', ');
  const COPILOT_ICON = 'header :is(button, a):has(svg.octicon-copilot)';
  // The Copilot panel button of the pull request header (Overview and Files changed), right of
  // "Submit review": unlabelled too, so matched by its icon, with the tooltip wrapped next to it
  const COPILOT_PANEL =
    '[data-testid="diff-comparison-viewer-sticky-header-bar"] div:has(> button > svg.octicon-copilot)';
  // The "Ask about this diff" button of each file header in the pull request diff, left of
  // "Viewed"; the wrapper holding it and its tooltip is hidden too, so no gap is left behind
  const COPILOT_DIFF = '[data-testid="copilot-diff-explain-button"]';
  const COPILOT_DIFF_WRAPPER = `span:has(> ${COPILOT_DIFF})`;
  // The "Ask Copilot about this file" button of the file view header, left of "Raw"; its tooltip
  // is a popover sibling that only shows on hover, so it disappears with the button
  const COPILOT_FILE = ':is([data-testid="copilot-ask-menu"], #blob-view-header-copilot-icon)';

  // ---------- Styles ----------
  // Injected at document-start so the tab never flashes
  const style = document.createElement('style');
  style.textContent = `
    ${HIDDEN} { display: none !important; }
    ${MORE} { display: none !important; }
    ${COPILOT} { display: none !important; }
    ${COPILOT_ICON} { display: none !important; }
    ${COPILOT_PANEL} { display: none !important; }
    ${COPILOT_DIFF} { display: none !important; }
    ${COPILOT_DIFF_WRAPPER} { display: none !important; }
    ${COPILOT_FILE} { display: none !important; }
  `;
  (document.head || document.documentElement).appendChild(style);
})();
