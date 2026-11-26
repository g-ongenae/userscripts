// ==UserScript==
// @name         GitHub — Zoom pull request images
// @namespace    https://github.com/g-ongenae/userscripts
// @author       g-ongenae
// @version      1.0.1
// @description  Shows the image files of pull request diffs as small thumbnails; hovering one, or an image of the description, a comment or a review, shows it bigger in the middle of the window. Escape closes it.
// @description:fr Affiche les images modifiées dans les pull requests GitHub sous forme de vignettes. Survolez une vignette ou une image dans la description, un commentaire ou une revue pour l’agrandir au centre de la fenêtre. Appuyez sur Échap pour fermer l’image.
// @license      MIT
// @homepageURL  https://github.com/g-ongenae/userscripts/blob/main/userscripts/github/pr-image-zoom.user.js
// @supportURL   https://github.com/g-ongenae/userscripts/issues
// @match        https://github.com/*
// @run-at       document-start
// @noframes
// @grant        none
// ==/UserScript==

(() => {
  'use strict';

  // ---------- Settings ----------
  // Height of the thumbnails of the diff's image files, in pixels
  const THUMB_HEIGHT = 200;
  // Hover time before the picture shows, so that moving the mouse across the page shows nothing
  const DELAY_MS = 300;
  // Space kept around the preview, in pixels
  const MARGIN = 16;

  const PR_PAGE = /^\/[^/]+\/[^/]+\/pull\/\d+/;
  // Images of the description, comments and reviews; not emoji or avatars
  const MARKDOWN_IMG = '.markdown-body img:not(.emoji, .avatar)';
  // Image files of the diff: drawn at full size by a viewer in a cross-origin iframe (Files changed and the classic
  // diff), where the page sees no hover. Its address carries the image's: a thumbnail replaces the viewer
  const VIEWER = '[data-type="img"]';
  const VIEWER_FRAME = 'iframe[src^="https://viewscreen.githubusercontent.com/"]';
  const THUMBS = 'ghz-thumbs';
  const THUMB = 'ghz-thumb';
  const REPLACED = 'data-ghz-replaced'; // on a viewer hidden behind thumbnails
  const NATIVE = 'data-ghz-native'; // on thumbnails put aside for GitHub's viewer
  const PREVIEW = 'ghz-preview';
  const SHOWN = 'ghz-preview--shown';

  // ---------- Styles ----------
  const style = document.createElement('style');
  style.textContent = `
    /* Not display: none, so the viewer keeps its width and measures its content right for when it is shown */
    ${VIEWER}[${REPLACED}] {
      height: 0 !important;
      min-height: 0 !important;
      overflow: hidden !important;
      visibility: hidden !important;
    }
    .${THUMBS} {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      padding: 16px;
      background: var(--bgColor-muted, #f6f8fa);
    }
    .${THUMBS}[${NATIVE}] { padding: 8px; }
    .${THUMBS}[${NATIVE}] .ghz-versions { display: none; }
    .ghz-versions {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 16px;
      max-width: 100%;
    }
    .ghz-version {
      margin: 0;
      max-width: 100%;
      text-align: center;
      color: var(--fgColor-muted, #59636e);
      font-size: 12px;
    }
    .${THUMB} {
      display: block;
      max-width: 100%;
      max-height: ${THUMB_HEIGHT}px;
      cursor: zoom-in;
      background: var(--bgColor-default, #fff);
      border: 1px solid var(--borderColor-default, #d1d9e0);
    }
    .${PREVIEW} {
      display: none;
      position: fixed;
      z-index: 2147483647;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      max-width: calc(100vw - ${2 * MARGIN}px);
      max-height: calc(100vh - ${2 * MARGIN}px);
      pointer-events: none;
      background: var(--bgColor-default, #fff);
      border: 1px solid var(--borderColor-default, #d1d9e0);
      border-radius: 6px;
      box-shadow: var(--shadow-floating-large, 0 8px 24px rgba(0, 0, 0, 0.3));
    }
    .${PREVIEW}.${SHOWN} { display: block; }
  `;
  (document.head || document.documentElement).appendChild(style);

  // On <html>: Turbo replaces <body> when navigating
  const preview = document.createElement('img');
  preview.className = PREVIEW;
  preview.alt = '';
  document.documentElement.appendChild(preview);

  // ---------- Thumbnails ----------
  // The raw addresses of the images a viewer shows, hex-encoded, with a token on private repositories: enc_url for an
  // added or deleted image, enc_url1 (before) and enc_url2 (after) for a changed one
  function imageUrls(frame) {
    const urls = [];
    try {
      const params = [...new URL(frame.src).searchParams].filter(([key]) => /^enc_url\d*$/.test(key)).sort();
      for (const [, value] of params) {
        if (!/^(?:[\da-f]{2})+$/i.test(value)) return [];
        const url = decodeURIComponent(value.replace(/../g, '%$&'));
        if (!url.startsWith('https://')) return [];
        urls.push(url);
      }
    } catch {
      return [];
    }
    return urls;
  }

  function fileName(url) {
    try {
      return decodeURIComponent(new URL(url).pathname.split('/').pop());
    } catch {
      return 'the file';
    }
  }

  // The viewer follows its thumbnails; GitHub can draw it again
  const viewerOf = (strip) => (strip.nextElementSibling?.matches(VIEWER) ? strip.nextElementSibling : null);

  // Thumbnails shown, or GitHub's viewer
  function showNative(strip, button, native) {
    strip.toggleAttribute(NATIVE, native);
    viewerOf(strip)?.toggleAttribute(REPLACED, !native);
    button.textContent = native ? 'Show thumbnails' : 'Compare in GitHub’s viewer';
  }

  function replace(viewer, frame, urls) {
    const strip = document.createElement('div');
    strip.className = THUMBS;
    strip.dataset.ghzFor = frame.src;
    const versions = document.createElement('div');
    versions.className = 'ghz-versions';
    strip.appendChild(versions);
    // Before and after, as GitHub's viewer orders them
    const labels = urls.length === 2 ? ['Before', 'After'] : [''];
    urls.forEach((url, i) => {
      const version = document.createElement('figure');
      version.className = 'ghz-version';
      const link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.setAttribute('aria-label', `Open ${labels[i].toLowerCase() || 'the'} image of ${fileName(url)}`);
      const img = document.createElement('img');
      img.className = THUMB;
      img.alt = '';
      img.src = url;
      // Back to GitHub's viewer, for good
      img.addEventListener('error', () => {
        const current = viewerOf(strip);
        if (current) {
          current.dataset.ghzFailed = frame.src;
          current.removeAttribute(REPLACED);
        }
        strip.remove();
      });
      link.appendChild(img);
      version.appendChild(link);
      if (labels[i]) {
        const caption = document.createElement('figcaption');
        caption.textContent = labels[i];
        version.appendChild(caption);
      }
      versions.appendChild(version);
    });
    viewer.before(strip);
    viewer.setAttribute(REPLACED, '');
    if (urls.length < 2) return;
    // A changed image: GitHub's viewer compares the two (2-up, Swipe, Onion Skin)
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn btn-sm';
    button.addEventListener('click', () => showNative(strip, button, !strip.hasAttribute(NATIVE)));
    strip.appendChild(button);
    showNative(strip, button, false);
  }

  function run() {
    for (const frame of document.querySelectorAll(`${VIEWER} ${VIEWER_FRAME}`)) {
      const viewer = frame.closest(VIEWER);
      if (viewer.dataset.ghzFailed === frame.src) continue;
      const strip = viewer.previousElementSibling?.classList.contains(THUMBS) ? viewer.previousElementSibling : null;
      // A viewer drawn again by GitHub keeps its thumbnails, or stays shown
      if (strip?.dataset.ghzFor === frame.src) {
        viewer.toggleAttribute(REPLACED, !strip.hasAttribute(NATIVE));
        continue;
      }
      strip?.remove();
      const urls = imageUrls(frame);
      if (urls.length) replace(viewer, frame, urls);
    }
  }

  let queued = false;
  new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      if (PR_PAGE.test(location.pathname)) run();
    });
  }).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] });

  // ---------- Preview ----------
  let hovered = null; // the image under the pointer
  let timer = 0;
  let load = 0; // id of the latest load: an older one finishing late is ignored

  function hide() {
    clearTimeout(timer);
    load++;
    preview.classList.remove(SHOWN);
  }

  // Shown no larger than its own size and the window: only when that is clearly bigger than on the page
  function zoom(src, width) {
    const id = ++load;
    const img = new Image();
    img.onload = () => {
      const html = document.documentElement;
      const w = img.naturalWidth;
      const scale = Math.min(
        1,
        (html.clientWidth - 2 * MARGIN) / w,
        (html.clientHeight - 2 * MARGIN) / img.naturalHeight,
      );
      if (id !== load || scale < (width / w) * 1.2) return;
      preview.src = src;
      preview.classList.add(SHOWN);
    };
    img.src = src;
  }

  document.addEventListener(
    'mouseover',
    (e) => {
      const img =
        PR_PAGE.test(location.pathname) && e.target instanceof Element
          ? e.target.closest(`${MARKDOWN_IMG}, .${THUMB}`)
          : null;
      if (img === hovered) return;
      hovered = img;
      hide();
      if (img) timer = setTimeout(() => zoom(img.currentSrc || img.src, img.getBoundingClientRect().width), DELAY_MS);
    },
    true,
  );
  document.documentElement.addEventListener('mouseleave', () => {
    hovered = null;
    hide();
  });
  // Closed until the pointer leaves the picture
  document.addEventListener('keydown', (e) => e.key === 'Escape' && hide(), true);
  document.addEventListener('mousedown', hide, true);
})();
