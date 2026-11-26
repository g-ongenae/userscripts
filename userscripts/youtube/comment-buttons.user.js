// ==UserScript==
// @name         YouTube — Comment icon buttons
// @namespace    https://github.com/g-ongenae/userscripts
// @author       g-ongenae
// @version      1.0.1
// @description  Turns the "Translate to …" link and the "Read more" / "Show less" buttons of comments into icon buttons next to Reply.
// @description:fr Remplace le lien « Traduire en… » et les boutons « Lire la suite » et « Afficher moins » des commentaires YouTube par des icônes à côté de « Répondre ».
// @license      MIT
// @homepageURL  https://github.com/g-ongenae/userscripts/blob/main/userscripts/youtube/comment-buttons.user.js
// @supportURL   https://github.com/g-ongenae/userscripts/issues
// @match        https://www.youtube.com/*
// @run-at       document-start
// @noframes
// @grant        none
// ==/UserScript==

(() => {
  'use strict';

  const COMMENT = 'ytd-comment-view-model'; // a comment or a reply
  const TRANSLATE = '#main > .translate-button'; // "Translate to French" / "See original", state="toggled" when translated
  const EXPANDER = '#main > ytd-expander'; // the text; "collapsed" while cut to 4 lines
  const BTN = 'ytc-btn';
  // On a comment whose replacement button is mounted and shown: only then is the native control hidden
  const HAS_TRANSLATE = 'data-ytc-translate';
  const HAS_EXPAND = 'data-ytc-expand';

  // ---------- Styles ----------
  // Injected at document-start; a native control stays visible until its replacement is in place
  const style = document.createElement('style');
  style.textContent = `
    ${COMMENT}[${HAS_TRANSLATE}] ${TRANSLATE},
    ${COMMENT}[${HAS_EXPAND}] ${EXPANDER} > #more,
    ${COMMENT}[${HAS_EXPAND}] ${EXPANDER} > #less { display: none !important; }
    /* Look comes from the classes copied off the Like button */
    .${BTN} { position: relative; }
    .${BTN}[hidden] { display: none !important; }
    .${BTN} svg { display: block; width: 18px; height: 18px; }
    .${BTN}[aria-pressed="true"] { color: var(--yt-spec-call-to-action, #065fd4) !important; }
  `;
  (document.head || document.documentElement).appendChild(style);

  // Line icons on a 20px grid, like those of the LinkedIn declutter: 文A (translate), ↨ (expand), ↥ (collapse)
  const ICONS = {
    translate:
      'M2 4.5h8M6 2.5v2M8.5 4.5c-.6 3.4-2.8 6-6 7.5M4 7c1 2 2.6 3.5 4.5 4.3M10.5 18l3.5-8.5 3.5 8.5M11.7 15.2h4.6',
    expand: 'M10 2v13M6 6l4-4 4 4M6 11l4 4 4-4M5 18h10',
    collapse: 'M10 15V3M6 7l4-4 4 4M5 18h10',
  };
  const SVG_NS = 'http://www.w3.org/2000/svg';
  function icon(name) {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 20 20');
    svg.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', ICONS[name]);
    for (const [k, v] of Object.entries({
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': '1.8',
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
    }))
      path.setAttribute(k, v);
    svg.appendChild(path);
    return svg;
  }

  // Attributes are only written when they change: an observed one written again re-queues the comment
  function set(el, name, value) {
    if (value === null) {
      if (el.hasAttribute(name)) el.removeAttribute(name);
    } else if (el.getAttribute(name) !== value) el.setAttribute(name, value);
  }

  // ---------- Buttons ----------
  /** An icon button in the comment's action bar, after Reply (and after the buttons added before it). */
  function button(comment, kind, onClick) {
    const toolbar = comment.querySelector('#action-buttons #toolbar');
    if (!toolbar) return null;
    let btn = toolbar.querySelector(`:scope > .${BTN}[data-kind="${kind}"]`);
    if (btn) {
      styleLikeLike(btn, toolbar);
      return btn;
    }
    btn = document.createElement('button');
    btn.type = 'button';
    btn.className = BTN;
    btn.dataset.kind = kind;
    const inner = document.createElement('div');
    inner.setAttribute('aria-hidden', 'true');
    btn.appendChild(inner);
    styleLikeLike(btn, toolbar);
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      onClick(comment);
    });
    const before =
      [...toolbar.querySelectorAll(`:scope > .${BTN}`)].pop() || toolbar.querySelector('#reply-button-end');
    if (before) before.after(btn);
    else toolbar.appendChild(btn);
    return btn;
  }

  /** Same classes as Like (an icon button too) so size, padding and hover match. YouTube may render
   *  Like after the toolbar: a button made before then is styled on a later pass. */
  function styleLikeLike(btn, toolbar) {
    if (btn.hasAttribute('data-styled')) return;
    const like = toolbar.querySelector('#like-button yt-button-shape > :is(button, a)');
    if (!like) return;
    btn.setAttribute('data-styled', '');
    btn.className = `${like.className} ${BTN}`;
    const likeIcon = like.querySelector('[class*="Icon"]');
    if (likeIcon) btn.firstElementChild.className = likeIcon.className;
    const feedback = like.querySelector('yt-touch-feedback-shape');
    if (feedback) btn.appendChild(feedback.cloneNode(true));
  }

  function setIcon(btn, name) {
    if (btn.dataset.icon === name) return;
    btn.dataset.icon = name;
    btn.firstElementChild.replaceChildren(icon(name));
  }

  /** Mirror a hidden YouTube control: same label, same pressed state, shown only when it is. */
  function sync(btn, { show, label, pressed, iconName }) {
    if (btn.hidden !== !show) btn.hidden = !show;
    if (!show) return;
    setIcon(btn, iconName);
    set(btn, 'title', label);
    set(btn, 'aria-label', label);
    set(btn, 'aria-pressed', pressed === null ? null : String(pressed));
  }

  const label = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');
  const shown = (el) => !!el && !el.hidden;

  function clickTranslate(comment) {
    const translate = comment.querySelector(TRANSLATE);
    if (translate) (translate.querySelector('tp-yt-paper-button') || translate).click();
  }

  function clickExpander(comment) {
    const expander = comment.querySelector(EXPANDER);
    const target =
      expander && [expander.querySelector(':scope > #more'), expander.querySelector(':scope > #less')].find(shown);
    if (target) target.click();
  }

  function update(comment) {
    // YouTube reuses comment elements for other comments: both buttons are re-synced every time
    const translate = comment.querySelector(TRANSLATE);
    const translateLabel = label(translate);
    const tBtn = button(comment, 'translate', clickTranslate);
    if (tBtn) {
      sync(tBtn, {
        show: shown(translate) && !!translateLabel, // "Translate to <your language>", absent on comments already in it
        label: translateLabel,
        pressed: !!translate && translate.getAttribute('state') === 'toggled',
        iconName: 'translate',
      });
    }
    set(comment, HAS_TRANSLATE, tBtn && !tBtn.hidden ? '' : null);

    const expander = comment.querySelector(EXPANDER);
    const more = expander && expander.querySelector(':scope > #more');
    const less = expander && expander.querySelector(':scope > #less');
    const open = !shown(more) && shown(less);
    const eBtn = button(comment, 'expand', clickExpander);
    if (eBtn) {
      sync(eBtn, {
        show: shown(more) || shown(less), // both hidden when the text fits in 4 lines
        label: label(open ? less : more),
        pressed: null,
        iconName: open ? 'collapse' : 'expand',
      });
      set(eBtn, 'aria-expanded', open ? 'true' : 'false');
    }
    set(comment, HAS_EXPAND, eBtn && !eBtn.hidden ? '' : null);
  }

  // ---------- Main pass (YouTube is an SPA) ----------
  // Only comments touched by a mutation are updated: the page mutates all the time while a video plays
  const dirty = new Set();
  let queued = false;
  function flush() {
    queued = false;
    for (const comment of dirty) if (comment.isConnected) update(comment);
    dirty.clear();
  }
  function queue() {
    if (dirty.size && !queued) {
      queued = true;
      requestAnimationFrame(flush);
    }
  }
  new MutationObserver((records) => {
    for (const r of records) {
      const target = r.target.nodeType === Node.ELEMENT_NODE ? r.target : r.target.parentElement;
      const comment = target && target.closest(COMMENT);
      if (comment) dirty.add(comment);
      for (const n of r.addedNodes) {
        if (n.nodeType !== Node.ELEMENT_NODE) continue;
        if (n.localName === COMMENT) dirty.add(n);
        for (const c of n.getElementsByTagName(COMMENT)) dirty.add(c);
      }
    }
    queue();
  }).observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['hidden', 'state', 'collapsed'],
  });
  // Comments already there when the userscript manager injects the script
  for (const c of document.getElementsByTagName(COMMENT)) dirty.add(c);
  queue();
})();
