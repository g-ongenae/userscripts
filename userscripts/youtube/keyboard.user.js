// ==UserScript==
// @name         YouTube — Keyboard shortcuts
// @namespace    https://github.com/g-ongenae/userscripts
// @author       g-ongenae
// @version      1.0.1
// @description  Drives YouTube comments from the keyboard, next to YouTube's own shortcuts: n / p move between comments, r replies, e shows / hides the replies, g goes back to the top, h opens the home page and H (Shift+h) lists the shortcuts, YouTube's included.
// @description:fr Ajoute des raccourcis clavier pour les commentaires YouTube. n permet de passer au commentaire suivant et p au précédent, r répond, e affiche ou masque les réponses, g remonte en haut, h ouvre l’accueil et H (Maj+h) affiche la liste des raccourcis, y compris ceux de YouTube.
// @license      MIT
// @homepageURL  https://github.com/g-ongenae/userscripts/blob/main/userscripts/youtube/keyboard.user.js
// @supportURL   https://github.com/g-ongenae/userscripts/issues
// @match        https://www.youtube.com/*
// @run-at       document-idle
// @noframes
// @grant        none
// ==/UserScript==

(() => {
  'use strict';

  // ---------- Settings ----------
  // Space kept below the top bar when the comment moved to has to be scrolled into view
  const MARGIN_PX = 8;
  // How long to wait for the reply box YouTube opens
  const WAIT_MS = 3000;
  // How long to wait for YouTube to load the comments once their section is scrolled to
  const LOAD_MS = 10000;

  // A comment or a reply. A thread is a comment with its replies; with threaded replies, a reply that
  // has replies of its own is a thread too (is-sub-thread), nested in its parent's.
  const COMMENT = 'ytd-comment-view-model';
  const THREAD = 'ytd-comment-thread-renderer';
  const REPLIES = ':scope > #replies > ytd-comment-replies-renderer';
  // "62 replies" (threaded replies, then the older layout) and "Hide replies". YouTube only shows the
  // latter once every reply is loaded; until then the replies renderer folds them itself (see below).
  const SHOW_REPLIES = '#more-replies-sub-thread, #more-replies';
  const HIDE_REPLIES = '#less-replies-sub-thread, #less-replies, #less-replies-icon';
  const SHOWN_REPLIES = ':is(#expanded-threads, #expander-contents):not([hidden])';
  const REPLY = ':scope > #body > #main > #action-buttons #reply-button-end :is(button, a)';
  const REPLY_BOX = '#reply-dialog #contenteditable-root';
  // The comments section: YouTube loads its comments once it is scrolled near
  const SECTION = 'ytd-comments#comments';
  const TOP_BAR = '#masthead-container';
  const LOGO = 'ytd-masthead a#logo';
  const EDITABLE = 'input, textarea, select, [contenteditable=""], [contenteditable="true"]';
  const CURRENT = 'data-ytk-current'; // the comment moved to

  const SHORTCUTS = [
    ['Comments', null],
    ['n', 'Next comment'],
    ['p', 'Previous comment'],
    ['r', 'Reply to the comment'],
    ['e', 'Show / hide the replies of the comment'],
    ['g', 'Top of the page'],
    ['h', 'Home page'],
    ['Esc', 'Leave the reply box'],
    ['H', 'Show / hide this list (Shift+h)'],
    ["YouTube's", null],
    ['k  Space', 'Play / pause'],
    ['j  l', 'Back / forward 10 seconds'],
    ['←  →', 'Back / forward 5 seconds'],
    ['↑  ↓', 'Volume up / down'],
    [',  .', 'Previous / next frame, while paused'],
    ['<  >', 'Slower / faster'],
    ['0 … 9', 'Go to 0 % … 90 % of the video'],
    ['m', 'Mute / unmute'],
    ['c', 'Subtitles on / off'],
    ['f', 'Full screen'],
    ['t', 'Theater mode'],
    ['i', 'Miniplayer'],
    ['N  P', 'Next / previous video (Shift+N, Shift+P)'],
    ['/', 'Search'],
  ];

  // ---------- Styles ----------
  const style = document.createElement('style');
  style.textContent = `
    ${COMMENT}[${CURRENT}] > #body {
      outline: 2px solid var(--yt-spec-call-to-action, #065fd4); outline-offset: 4px;
      border-radius: 12px;
    }
  `;
  document.head.append(style);

  // The help and the messages live in a shadow root, safe from YouTube's styles. Custom properties
  // still inherit through it, so the panel follows YouTube's light or dark theme.
  const host = document.createElement('div');
  const ui = host.attachShadow({ mode: 'open' });
  const uiStyle = document.createElement('style');
  uiStyle.textContent = `
    :host { all: initial; }
    .help {
      position: fixed; inset: 0; z-index: 2147483647;
      display: flex; align-items: center; justify-content: center;
      background: rgba(0, 0, 0, 0.5);
    }
    .panel, .toast {
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
      font: 14px/1.5 Roboto, Arial, sans-serif;
    }
    .panel {
      min-width: 360px; max-height: 90vh; overflow: auto; padding: 20px 24px; border-radius: 12px;
      background: var(--yt-spec-menu-background, #fff); color: var(--yt-spec-text-primary, #0f0f0f);
    }
    h2 { margin: 0 0 8px; font-size: 18px; font-weight: 500; }
    table { border-collapse: collapse; }
    th {
      padding: 12px 0 4px; text-align: left; font-size: 12px; font-weight: 500;
      color: var(--yt-spec-text-secondary, #606060);
    }
    td { padding: 3px 0; vertical-align: top; }
    td:first-child { padding-right: 20px; white-space: nowrap; }
    kbd {
      display: inline-block; min-width: 1.6em; padding: 1px 6px; text-align: center;
      border: 1px solid var(--yt-spec-10-percent-layer, rgba(0, 0, 0, 0.1)); border-bottom-width: 2px;
      border-radius: 4px; background: var(--yt-spec-badge-chip-background, rgba(0, 0, 0, 0.05));
      font: 13px ui-monospace, monospace; white-space: pre;
    }
    .toast {
      position: fixed; z-index: 2147483647; left: 50%; bottom: 24px; transform: translateX(-50%);
      padding: 10px 16px; border-radius: 8px; background: #0f0f0f; color: #fff;
    }
  `;
  ui.append(uiStyle);

  function show(el) {
    if (!host.isConnected) document.documentElement.append(host);
    ui.append(el);
  }

  let toastTimer = 0;
  function toast(text) {
    ui.querySelector('.toast')?.remove();
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = text;
    show(el);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.remove(), 2500);
    return el;
  }

  // ---------- Helpers ----------
  // Resolves with what `find` returns once it returns something, or null after `ms`
  function waitFor(find, ms = WAIT_MS) {
    return new Promise((resolve) => {
      const found = find();
      if (found) return resolve(found);
      const done = (value) => {
        observer.disconnect();
        clearTimeout(timer);
        resolve(value);
      };
      // At most once a frame: the page mutates all the time while a video plays
      let pending = false;
      const observer = new MutationObserver(() => {
        if (pending) return;
        pending = true;
        requestAnimationFrame(() => {
          pending = false;
          const el = find();
          if (el) done(el);
        });
      });
      observer.observe(document.body, { childList: true, subtree: true });
      const timer = setTimeout(() => done(null), ms);
    });
  }

  const visible = (el) => el.getClientRects().length > 0;
  // The visible element of `replies` matching `selector`, not one of the replies nested in them
  const own = (replies, selector) =>
    [...replies.querySelectorAll(selector)].find(
      (el) => el.closest('ytd-comment-replies-renderer') === replies && visible(el),
    ) || null;
  // A YouTube button is a renderer around the <button> or <a> that listens to clicks
  const press = (el) => (el.querySelector('button, a') || el).click();

  // ---------- Comments ----------
  const comments = () => [...document.querySelectorAll(COMMENT)].filter(visible);

  // The bottom of the fixed top bar: what is under it is not on screen
  function topInset() {
    const bar = document.querySelector(TOP_BAR);
    return bar && visible(bar) ? Math.max(0, bar.getBoundingClientRect().bottom) : 0;
  }

  function onScreen(el) {
    const r = el.getBoundingClientRect();
    return r.bottom > topInset() && r.top < window.innerHeight;
  }

  let current = null;

  function select(comment) {
    if (current) current.removeAttribute(CURRENT);
    current = comment;
    comment.setAttribute(CURRENT, '');
    // Scrolls only when it is not wholly on screen, putting its top under the top bar: long comments
    // are read from their start
    const inset = topInset();
    const r = comment.getBoundingClientRect();
    if (r.top < inset || r.bottom > window.innerHeight) {
      comment.style.scrollMarginTop = `${inset + MARGIN_PX}px`;
      comment.scrollIntoView({ block: 'start' });
    }
  }

  // The comment moved to, unless it was hidden or scrolled away: then the first one on screen
  function target(list = comments()) {
    if (current && list.includes(current) && onScreen(current)) return current;
    const inset = topInset();
    return list.find((c) => onScreen(c) && c.getBoundingClientRect().top >= inset) || list.find(onScreen) || null;
  }

  function move(step) {
    const list = comments();
    if (!list.length) return loadComments();
    const from = target(list);
    if (from && from !== current) return select(from);
    if (from) return select(list[Math.max(0, Math.min(list.length - 1, list.indexOf(from) + step))]);
    // No comment on screen (the video, or past the comments): the first one below, or the last one above
    const inset = topInset();
    const next =
      step > 0
        ? list.find((c) => c.getBoundingClientRect().top >= inset)
        : list.findLast((c) => c.getBoundingClientRect().bottom <= inset);
    select(next || list[step > 0 ? list.length - 1 : 0]);
  }

  function loadComments() {
    const section = document.querySelector(SECTION);
    if (!section || !visible(section)) return toast('No comments on this page');
    section.style.scrollMarginTop = `${topInset() + MARGIN_PX}px`;
    section.scrollIntoView({ block: 'start' });
    const message = toast('Loading the comments…');
    // The first comment is selected once loaded, unless another key moved to one or the user scrolled away
    waitFor(() => comments()[0] || null, LOAD_MS).then((first) => {
      message.remove();
      if (!first || (current && visible(current) && onScreen(current)) || !onScreen(section)) return;
      select(first);
    });
  }

  // The target, made current
  function pick() {
    const comment = target();
    if (!comment) toast('No comment on screen: n moves to the next one');
    else if (comment !== current) select(comment);
    return comment;
  }

  function reply() {
    const comment = pick();
    if (!comment) return;
    const button = comment.querySelector(REPLY);
    if (!button) return toast('No reply button: sign in to reply');
    button.click();
    waitFor(() => {
      const el = comment.querySelector(REPLY_BOX);
      return el && visible(el) ? el : null;
    }).then((box) => box && document.activeElement !== box && box.focus());
  }

  // The replies of the comment, or of the thread it is a reply in: from the comment's own thread
  // up, the first one whose replies can be shown or hidden
  function repliesOf(comment) {
    for (let thread = comment.closest(THREAD); thread; thread = thread.parentElement?.closest(THREAD)) {
      const replies = thread.querySelector(REPLIES);
      if (!replies) continue;
      const showButton = own(replies, SHOW_REPLIES);
      if (showButton || own(replies, SHOWN_REPLIES)) return { thread, replies, showButton };
    }
    return null;
  }

  function toggleReplies() {
    const comment = pick();
    if (!comment) return;
    const found = repliesOf(comment);
    if (!found) return toast('No replies');
    const { thread, replies, showButton } = found;
    if (showButton) return press(showButton);

    const hideButton = own(replies, HIDE_REPLIES);
    if (hideButton) press(hideButton);
    else {
      // More replies to load: YouTube has no "Hide replies" button yet, but the renderer's own handler folds them
      const renderer = replies.polymerController || replies.inst || replies;
      if (typeof renderer.handleIsShowLessTap !== 'function') return toast('Load every reply to hide them');
      renderer.handleIsShowLessTap();
    }
    // The comment moved to may be one of the replies just hidden: the thread's comment becomes current
    const top = thread.querySelector(COMMENT);
    if (top && top !== current) requestAnimationFrame(() => visible(top) && select(top));
  }

  // ---------- Page ----------
  function top() {
    window.scrollTo(0, 0);
    if (current) current.removeAttribute(CURRENT);
    current = null;
  }

  // The logo's link navigates within the page, without reloading YouTube
  function home() {
    const logo = document.querySelector(LOGO);
    if (logo) logo.click();
    else location.assign('/');
  }

  // ---------- Help ----------
  let help = null;
  let helpOpener = null; // what had the focus before the help opened, focused again once it closes

  function toggleHelp() {
    if (help) {
      help.remove();
      help = null;
      if (helpOpener?.isConnected) helpOpener.focus({ preventScroll: true });
      helpOpener = null;
      return;
    }
    helpOpener = document.activeElement;
    help = document.createElement('div');
    help.className = 'help';
    // Focused, so that the player behind it no longer receives the keys; Tab is kept inside it below
    const panel = document.createElement('div');
    panel.className = 'panel';
    panel.tabIndex = -1;
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-labelledby', 'ytk-help-title');
    const title = document.createElement('h2');
    title.id = 'ytk-help-title';
    title.textContent = 'Keyboard shortcuts';
    const table = document.createElement('table');
    for (const [key, label] of SHORTCUTS) {
      const row = table.insertRow();
      if (label === null) {
        const th = document.createElement('th');
        th.colSpan = 2;
        th.textContent = key;
        row.append(th);
        continue;
      }
      const kbd = document.createElement('kbd');
      kbd.textContent = key;
      row.insertCell().append(kbd);
      row.insertCell().textContent = label;
    }
    panel.append(title, table);
    help.append(panel);
    help.addEventListener('click', (e) => e.target === help && toggleHelp());
    show(help);
    panel.focus({ preventScroll: true });
  }

  // ---------- Keys ----------
  // None is a YouTube shortcut: the player only acts on N and P with Shift (next / previous video).
  // Letters only, read from `e.key`: on AZERTY, symbols share key codes with YouTube's shortcuts.
  const KEYS = {
    n: () => move(1),
    p: () => move(-1),
    r: reply,
    e: toggleReplies,
    g: top,
    h: home,
    H: toggleHelp,
  };

  // Listening on the window, in the capture phase, runs before YouTube's own handlers
  window.addEventListener(
    'keydown',
    (e) => {
      // While the help is open, no key reaches YouTube: Esc and H close it, Tab stays on it, and the
      // others keep their default action on it (scrolling it)
      if (help) {
        e.stopImmediatePropagation();
        const close = e.key === 'Escape' || (e.key === 'H' && !e.metaKey && !e.ctrlKey && !e.altKey);
        if (close || e.key === 'Tab') e.preventDefault();
        if (close && !e.repeat) toggleHelp();
        return;
      }

      if (e.isComposing || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target instanceof Element ? e.target : null;

      // Other fields (search, the comment box) keep YouTube's Esc
      if (e.key === 'Escape') {
        if (el?.closest(REPLY_BOX)) el.blur();
        return;
      }

      if (el?.closest(EDITABLE)) return;
      const action = KEYS[e.key];
      if (!action) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      // Holding a key repeats only the moves
      if (!e.repeat || /^[np]$/.test(e.key)) action();
    },
    true,
  );
  // YouTube plays / pauses on the release of Space: none reaches it while the help is open either
  window.addEventListener('keyup', (e) => help && e.stopImmediatePropagation(), true);
})();
