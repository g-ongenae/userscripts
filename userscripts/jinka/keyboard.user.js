// ==UserScript==
// @name         Jinka — Keyboard shortcuts
// @namespace    https://github.com/g-ongenae/userscripts
// @author       g-ongenae
// @version      1.0.0
// @description  Review Jinka listings with j / k, open a listing with o, browse its photos with ← / →, toggle its favorite with f, and change result pages with n / p. Press ? for all shortcuts.
// @license      MIT
// @homepageURL  https://github.com/g-ongenae/userscripts/blob/main/userscripts/jinka/keyboard.user.js
// @supportURL   https://github.com/g-ongenae/userscripts/issues
// @match        https://www.jinka.fr/*
// @match        https://jinka.fr/*
// @run-at       document-idle
// @noframes
// @grant        none
// ==/UserScript==

(() => {
  'use strict';

  const CARD = `main a[href^="/ad/"], main a[href^="${location.origin}/ad/"]`;
  const PAGINATION = 'nav[aria-label="Pagination"]';
  const FAVORITE = 'button:is([aria-label="Ajouter aux favoris"], [aria-label="Retirer des favoris"])';
  const EDITOR = [
    'input, textarea, select, [contenteditable]:not([contenteditable="false"])',
    '[role="textbox"], [role="combobox"], [role="listbox"], [role="menu"], [role="slider"]',
  ].join(', ');

  const style = document.createElement('style');
  style.textContent = `
    :is(${CARD}):focus {
      outline: 3px solid #5344c6;
      outline-offset: 3px;
      border-radius: 6px;
    }
    dialog[data-jinka-shortcuts] {
      box-sizing: border-box;
      width: min(28rem, calc(100% - 2rem));
      max-height: calc(100% - 2rem);
      margin: auto;
      padding: 1.25rem;
      border: 1px solid #d8d6e4;
      border-radius: 12px;
      background: #fff;
      color: #242137;
      font: 14px/1.5 system-ui, sans-serif;
    }
    dialog[data-jinka-shortcuts]::backdrop { background: rgb(28 23 53 / 45%); }
    [data-jinka-shortcuts] h2 { margin: 0 0 0.75rem; font-size: 1.125rem; font-weight: 700; }
    [data-jinka-shortcuts] dl {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 0.45rem 1rem;
      margin: 0;
    }
    [data-jinka-shortcuts] dt { white-space: nowrap; }
    [data-jinka-shortcuts] dd { margin: 0; }
    [data-jinka-shortcuts] kbd {
      padding: 0.1rem 0.35rem;
      border: 1px solid #d8d6e4;
      border-radius: 4px;
      background: #f5f4fa;
      font: 13px ui-monospace, monospace;
    }
    [data-jinka-shortcuts] button {
      display: block;
      margin: 1rem 0 0 auto;
      padding: 0.3rem 0.8rem;
      border: 1px solid #a29abf;
      border-radius: 6px;
      cursor: pointer;
    }
  `;
  document.head.append(style);

  function isVisible(element) {
    return element.getClientRects().length > 0 && getComputedStyle(element).visibility === 'visible';
  }

  function selectedCard() {
    return document.activeElement?.closest(CARD);
  }

  function move(step) {
    const cards = [...document.querySelectorAll(CARD)].filter(isVisible);
    if (!cards.length) return false;

    const headerBottom = document.querySelector('header')?.getBoundingClientRect().bottom ?? 0;
    const index = cards.indexOf(selectedCard());
    let card;
    if (index === -1) {
      const ordered = step > 0 ? cards : cards.toReversed();
      card = ordered.find((candidate) => {
        const { top, bottom } = candidate.getBoundingClientRect();
        return bottom > headerBottom && top < window.innerHeight;
      });
      // If between the grid and the footer, resume at the last card.
      card ??= cards[0].getBoundingClientRect().top >= window.innerHeight ? cards[0] : cards.at(-1);
    } else {
      card = cards[index + step] ?? cards[index];
    }

    card.focus({ preventScroll: true });
    const { top, bottom } = card.getBoundingClientRect();
    if (top < headerBottom || bottom > window.innerHeight) card.scrollIntoView({ block: 'center' });
    return true;
  }

  function click(control) {
    if (!control || control.matches(':disabled, [aria-disabled="true"]')) return false;
    control.click();
    return true;
  }

  function openInNewTab() {
    const card = selectedCard();
    if (!card) return false;

    window.open(card.href, '_blank', 'noopener');
    return true;
  }

  function goToSection(path) {
    return click(document.querySelector(`a:is([href="${path}"], [href="${location.origin}${path}"])`));
  }

  const SHORTCUTS = [
    ['j', 'J', 'Annonce suivante', () => move(1), true],
    ['k', 'K', 'Annonce précédente', () => move(-1), true],
    ['o', 'O / Entrée', 'Ouvrir l’annonce sélectionnée', () => click(selectedCard())],
    ['Shift+o', 'Maj+O', 'Ouvrir l’annonce dans un nouvel onglet', openInNewTab],
    [
      'ArrowLeft',
      '←',
      'Photo précédente',
      () => click(selectedCard()?.querySelector('button[aria-label="Image précédente"]')),
      true,
    ],
    [
      'ArrowRight',
      '→',
      'Photo suivante',
      () => click(selectedCard()?.querySelector('button[aria-label="Image suivante"]')),
      true,
    ],
    ['f', 'F', 'Ajouter ou retirer l’annonce des favoris', () => click(selectedCard()?.querySelector(FAVORITE))],
    [
      'n',
      'N',
      'Page de résultats suivante',
      () => click(document.querySelector(`${PAGINATION} a[aria-label="Page suivante"]`)),
    ],
    [
      'p',
      'P',
      'Page de résultats précédente',
      () => click(document.querySelector(`${PAGINATION} a[aria-label="Page précédente"]`)),
    ],
    ['a', 'A', 'Aller à « Ma recherche »', () => goToSection('/alerts')],
    ['Shift+f', 'Maj+F', 'Aller aux favoris', () => goToSection('/favorites')],
    ['?', '?', 'Afficher les raccourcis (Échap pour fermer)', toggleHelp],
  ];

  let help;

  function toggleHelp() {
    if (!help) {
      help = document.createElement('dialog');
      help.setAttribute('data-jinka-shortcuts', '');
      help.setAttribute('aria-labelledby', 'jinka-shortcuts-title');
      help.lang = 'fr';
      help.innerHTML = `
        <h2 id="jinka-shortcuts-title">Raccourcis clavier</h2>
        <dl>${SHORTCUTS.map(([, key, label]) => `<dt><kbd>${key}</kbd></dt><dd>${label}</dd>`).join('')}</dl>
        <form method="dialog"><button autofocus>Fermer</button></form>
      `;
      document.body.append(help);
    }
    if (help.open) help.close();
    else help.showModal();
    return true;
  }

  document.addEventListener('keydown', (event) => {
    if (event.defaultPrevented || event.isComposing || event.ctrlKey || event.metaKey || event.altKey) return;

    const { key, shiftKey, repeat } = event;
    if (help?.open) {
      if (key === '?' && !repeat) {
        event.preventDefault();
        toggleHelp();
      }
      return;
    }
    if (event.composedPath().some((element) => element instanceof Element && element.matches(EDITOR))) return;

    const shortcutKey = key === '?' ? key : `${shiftKey ? 'Shift+' : ''}${key.length === 1 ? key.toLowerCase() : key}`;
    const shortcut = SHORTCUTS.find(([binding]) => binding === shortcutKey);
    if (!shortcut) return;
    if ([...document.querySelectorAll('dialog[open], [role="dialog"], [role="alertdialog"]')].some(isVisible)) return;

    const [, , , action, allowRepeat] = shortcut;
    if ((!repeat || allowRepeat) && action()) event.preventDefault();
  });
})();
