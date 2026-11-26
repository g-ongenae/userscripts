// ==UserScript==
// @name         Jinka — Transports et autoroutes
// @namespace    https://github.com/g-ongenae/userscripts
// @author       g-ongenae
// @version      1.0.0
// @description  Affichez les lignes de transport et les autoroutes sur la carte Jinka. Estimez les trajets depuis les annonces.
// @license      MIT
// @homepageURL  https://github.com/g-ongenae/userscripts/blob/main/userscripts/jinka/transport-map.user.js
// @supportURL   https://github.com/g-ongenae/userscripts/issues
// @match        https://www.jinka.fr/*
// @match        https://jinka.fr/*
// @run-at       document-idle
// @noframes
// @grant        unsafeWindow
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @connect      data.iledefrance-mobilites.fr
// @connect      data.geopf.fr
// @connect      prim.iledefrance-mobilites.fr
// ==/UserScript==

/* global unsafeWindow, GM_getValue, GM_setValue, GM_xmlhttpRequest */

(() => {
  'use strict';

  const PIN = '.leaflet-marker-pane .leaflet-marker-icon';
  const PRICE = /[\d\s,.]+\s*[KM]?\s*€/i;
  const CENTER = [2.34703, 48.86138]; // Châtelet–Les Halles
  const COVERAGE = [1.44, 48.11, 3.56, 49.25];
  const PRIM = 'https://prim.iledefrance-mobilites.fr';
  const GTFS = 'traces-des-lignes-de-transport-en-commun-idfm';
  const MODES = {
    metro: 'Métro',
    rer: 'RER',
    train: 'Transilien',
    tram: 'Tramway',
    other: 'Autres trains et lignes',
  };
  const ROAD_COLOR = '#d65819';
  const prefs = GM_getValue('layers', {});
  prefs.modes ??= { metro: true, rer: true, train: true, tram: false, other: false };
  prefs.hidden ??= [];
  prefs.highways ??= true;
  prefs.hiddenRoads ??= [];
  let token = GM_getValue('prim-token', '');

  const mounted = new Map();
  const resources = new Map();
  const routes = new Map();
  let routeQueue = Promise.resolve();
  let nextIgnRequest = 0;

  const urlWith = (url, params) => `${url}?${new URLSearchParams(params)}`;
  const coord = (point, separator = ',') => point.map((value) => value.toFixed(5)).join(separator);
  const minutes = (seconds) => `${Math.max(1, Math.round(seconds / 60))} min`;
  const inside = ([x, y], [west, south, east, north]) => x >= west && x <= east && y >= south && y <= north;
  const intersects = (a, b) => a[0] <= b[2] && a[1] <= b[3] && a[2] >= b[0] && a[3] >= b[1];
  const covers = (a, b) => inside(b.slice(0, 2), a) && inside(b.slice(2), a);
  const overlapsRegion = (bounds) => intersects(bounds, COVERAGE);

  function request(url, headers = {}) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'GET',
        url,
        headers: { Accept: 'application/json', ...headers },
        anonymous: true,
        timeout: 20000,
        onload(response) {
          let body;
          try {
            body = JSON.parse(response.responseText);
          } catch {
            reject(new Error(`Réponse inattendue (HTTP ${response.status})`));
            return;
          }
          if (response.status >= 200 && response.status < 300) resolve(body);
          else reject(Object.assign(new Error(`HTTP ${response.status}`), { status: response.status, body }));
        },
        onerror: () => reject(new Error('Connexion indisponible')),
        ontimeout: () => reject(new Error('Délai dépassé')),
      });
    });
  }

  function cached(cache, key, load, ttl, limit) {
    const now = Date.now();
    const entry = cache.get(key);
    if (entry?.expires > now) return entry.promise;
    cache.delete(key);
    const promise = load().catch((error) => {
      if (cache.get(key)?.promise === promise) cache.delete(key);
      throw error;
    });
    cache.set(key, { promise, expires: now + ttl });
    if (cache.size > limit) cache.delete(cache.keys().next().value);
    return promise;
  }

  function exportData(dataset, params) {
    const api = 'https://data.iledefrance-mobilites.fr/api/explore/v2.1/catalog/datasets';
    return request(urlWith(`${api}/${dataset}/exports/json`, params));
  }

  // Use longitude/latitude throughout. Precompute the path bounds for viewport culling.
  function mapPath(coordinates) {
    const bounds = [Infinity, Infinity, -Infinity, -Infinity];
    const points = [];
    for (const [lon, lat] of coordinates) {
      bounds[0] = Math.min(bounds[0], lon);
      bounds[1] = Math.min(bounds[1], lat);
      bounds[2] = Math.max(bounds[2], lon);
      bounds[3] = Math.max(bounds[3], lat);
      const previous = points.at(-1);
      if (!previous || Math.abs(lon - previous[0]) + Math.abs(lat - previous[1]) > 0.00005) {
        points.push([lon, lat]);
      }
    }
    if (coordinates.length > 1) points.push(coordinates.at(-1));
    return { bounds, points };
  }

  function railData() {
    return cached(
      resources,
      'rail',
      async () => {
        const [shapes, stations] = await Promise.all([
          exportData(GTFS, {
            where: 'route_type != "Bus"',
            select: 'route_id,route_short_name,route_long_name,route_type,route_color,shape',
          }),
          exportData('emplacement-des-gares-idf', { select: 'idrefligc,nom_gares,geo_point_2d' }),
        ]);
        const lines = new Map();
        for (const row of shapes) {
          const { route_type: type, route_short_name: code, route_id: id } = row;
          let mode = 'other';
          if (type === 'Subway') mode = 'metro';
          if (type === 'Rail' && /^[A-E]$/.test(code)) mode = 'rer';
          if (type === 'Rail' && /^[A-Z]$/.test(code) && mode !== 'rer') mode = 'train';
          if (type === 'Tram' && /^T\d/i.test(code)) mode = 'tram';
          const name = mode === 'other' ? row.route_long_name : code.replace(/^([37])B$/, '$1bis');
          const color = /^[a-f\d]{6}$/i.test(row.route_color) ? `#${row.route_color}` : '#616885';
          const geometry = row.shape?.geometry;
          if (!geometry || !name) continue;
          const paths = geometry.type === 'MultiLineString' ? geometry.coordinates : [geometry.coordinates];
          lines.set(id, { id, mode, name, color, paths: paths.map(mapPath) });
        }
        const stops = [];
        for (const { idrefligc, nom_gares: name, geo_point_2d: point } of stations) {
          const line = lines.get(`IDFM:${idrefligc}`);
          if (line && name && point) stops.push({ name, point: [point.lon, point.lat], line });
        }
        return {
          lines: [...lines.values()].sort((a, b) => a.name.localeCompare(b.name, 'fr', { numeric: true })),
          stops,
        };
      },
      3600000,
      24,
    );
  }

  function roadData(bounds) {
    return cached(
      resources,
      `roads:${bounds}`,
      async () => {
        const query = [
          `BBOX(geometrie,${bounds},'CRS:84')`,
          "nature IN ('Type autoroutier','Bretelle')",
          "etat_de_l_objet='En service'",
          'prive=false',
        ].join(' AND ');
        const data = await request(
          urlWith('https://data.geopf.fr/wfs/ows', {
            service: 'WFS',
            version: '2.0.0',
            request: 'GetFeature',
            typeNames: 'BDTOPO_V3:troncon_de_route',
            outputFormat: 'application/json',
            propertyName: 'geometrie,nature,cpx_numero,cpx_toponyme_route_nommee,sens_de_circulation',
            CQL_FILTER: query,
          }),
        );
        if (data.numberMatched > data.numberReturned) throw new Error('Données routières partielles');
        const roads = [];
        const ramps = [];
        for (const { geometry, properties } of data.features) {
          if (geometry?.type !== 'LineString' || geometry.coordinates.length < 2) continue;
          const points = geometry.coordinates;
          if (properties.nature === 'Bretelle') {
            const direction = properties.sens_de_circulation;
            if (direction === 'Sens direct' || direction === 'Double sens') ramps.push(points);
            if (direction === 'Sens inverse' || direction === 'Double sens') ramps.push([...points].reverse());
          } else {
            const name = /^Boulevard Périphérique/i.test(properties.cpx_toponyme_route_nommee ?? '')
              ? 'Périphérique'
              : properties.cpx_numero || properties.cpx_toponyme_route_nommee || 'Voie rapide';
            roads.push({ name, points, path: mapPath(points) });
          }
        }
        return { roads, entrances: roadEntrances(roads, ramps) };
      },
      3600000,
      24,
    );
  }

  function metres(a, b) {
    const longitudeScale = 111320 * Math.cos(((a[1] + b[1]) * Math.PI) / 360);
    return Math.hypot((a[0] - b[0]) * longitudeScale, (a[1] - b[1]) * 111320);
  }

  function rampTarget(points) {
    // Aim inside the ramp so the car router follows its direction of travel.
    let remaining = 24;
    for (let i = 1; i < points.length; i++) {
      const distance = metres(points[i - 1], points[i]);
      if (distance >= remaining) {
        const fraction = remaining / distance;
        return [
          points[i - 1][0] + fraction * (points[i][0] - points[i - 1][0]),
          points[i - 1][1] + fraction * (points[i][1] - points[i - 1][1]),
        ];
      }
      remaining -= distance;
    }
    return points.at(-1).slice(0, 2);
  }

  function roadEntrances(roads, ramps) {
    // Walk backwards from motorway vertices along the directed approach ramps.
    const node = (point) => coord(point.slice(0, 2));
    const motorway = new Map();
    for (const road of roads) {
      for (const point of road.points) motorway.set(node(point), road.name);
    }
    const incoming = new Map();
    const edges = ramps.map((points) => {
      const edge = { points, start: node(points[0]), end: node(points.at(-1)), name: null };
      const previous = incoming.get(edge.end) ?? [];
      previous.push(edge);
      incoming.set(edge.end, previous);
      return edge;
    });
    const pending = edges.filter((edge) => motorway.has(edge.end) && edge.start !== edge.end);
    for (const edge of pending) edge.name = motorway.get(edge.end);
    for (const edge of pending) {
      if (motorway.has(edge.start)) continue;
      for (const previous of incoming.get(edge.start) ?? []) {
        if (previous.name || previous.start === edge.end) continue;
        previous.name = edge.name;
        pending.push(previous);
      }
    }
    return pending
      .filter(
        (edge) =>
          !motorway.has(edge.start) &&
          !(incoming.get(edge.start) ?? []).some((previous) => previous.name && previous.start !== edge.end),
      )
      .map((edge) => ({ name: edge.name, point: rampTarget(edge.points) }));
  }

  function closest(point, candidates, count, maxDistance) {
    const ranked = candidates
      .map((candidate) => ({ candidate, distance: metres(point, candidate.point) }))
      .filter(({ distance }) => distance <= maxDistance)
      .sort((a, b) => a.distance - b.distance);
    const unique = [];
    for (const { candidate } of ranked) {
      if (unique.some((other) => metres(other.point, candidate.point) < 45)) continue;
      unique.push(candidate);
      if (unique.length === count) break;
    }
    return unique;
  }

  function requestIgnRoute(url, active) {
    const existing = routes.get(url);
    if (existing?.expires > Date.now()) return existing.promise;
    // IGN allows five route requests per second. Skip queued work for superseded pins.
    const scheduled = routeQueue.then(async () => {
      if (!active()) return null;
      const wait = nextIgnRequest - performance.now();
      if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
      if (!active()) return null;
      nextIgnRequest = performance.now() + 250;
      return { response: cached(routes, url, () => request(url), 600000, 200) };
    });
    routeQueue = scheduled.then(
      () => undefined,
      () => undefined,
    );
    return scheduled.then((slot) => slot?.response);
  }

  async function routeTime(from, to, profile, active) {
    const url = urlWith('https://data.geopf.fr/navigation/itineraire', {
      resource: 'bdtopo-valhalla',
      start: coord(from),
      end: coord(to),
      optimization: 'fastest',
      timeUnit: 'second',
      profile,
    });
    const result = await requestIgnRoute(url, active);
    const snapped = result?.end?.split(',').map(Number);
    if (
      !Number.isFinite(result?.duration) ||
      snapped?.length !== 2 ||
      !snapped.every(Number.isFinite) ||
      metres(to, snapped) > 70
    ) {
      throw new Error('Point inaccessible');
    }
    return result.duration;
  }

  async function fastestNearby(from, candidates, profile, active) {
    const results = await Promise.allSettled(
      candidates.map(async (candidate) => ({
        ...candidate,
        duration: await routeTime(from, candidate.point, profile, active),
      })),
    );
    return results
      .filter((result) => result.status === 'fulfilled')
      .map((result) => result.value)
      .sort((a, b) => a.duration - b.duration)[0];
  }

  async function parisJourney(from, lines) {
    const params = new URLSearchParams({
      from: coord(from, ';'),
      to: coord(CENTER, ';'),
      data_freshness: 'base_schedule',
    });
    for (const line of lines) params.append('allowed_id[]', `line:${line.id}`);
    const url = `${PRIM}/marketplace/v2/navitia/journeys?${params}`;
    try {
      const data = await cached(routes, `transit:${url}`, () => request(url, { apikey: token }), 300000, 200);
      const trips = (data.journeys ?? []).filter(
        (journey) =>
          Number.isFinite(journey.duration) && journey.sections?.some((section) => section.type === 'public_transport'),
      );
      const trip = trips.sort((a, b) => a.arrival_date_time.localeCompare(b.arrival_date_time))[0];
      if (trip) {
        const labels = trip.sections
          .filter((section) => section.type === 'public_transport')
          .map((section) => section.display_informations?.label)
          .filter(Boolean);
        return [minutes(trip.duration), [...new Set(labels)].join(' → ')].filter(Boolean).join(' · ');
      }
      return 'Aucun itinéraire avec les lignes affichées';
    } catch (error) {
      if (error.status === 401 || error.status === 403) return 'Jeton PRIM refusé';
      if (error.body?.error?.id === 'no_solution') return 'Aucun itinéraire avec les lignes affichées';
      return 'Calculateur PRIM indisponible';
    }
  }

  function liveObject(element) {
    return element?.wrappedJSObject ?? element;
  }

  function findMap(container) {
    const element = liveObject(container);
    const isMap = (map) =>
      map &&
      typeof map.containerPointToLayerPoint === 'function' &&
      typeof map.eachLayer === 'function' &&
      map.getContainer() === element;
    const key = Object.keys(element).find((name) => name.startsWith('__reactFiber$'));
    const host = element[key];
    // React Leaflet exposes the map through context. Imperative integrations often keep it in a hook ref.
    for (const fiber of [host, host?.alternate]) {
      for (let child = fiber?.child; child; child = child.sibling) {
        const value = child.memoizedProps?.value;
        if (isMap(value?.map)) return value.map;
        if (isMap(value)) return value;
      }
      for (let parent = fiber?.return, depth = 0; parent && depth < 10; parent = parent.return, depth++) {
        for (let hook = parent.memoizedState; hook; hook = hook.next) {
          const value = hook.memoizedState;
          const map = [value, value?.current, value?.map].find(isMap);
          if (map) return map;
        }
      }
    }
    return null;
  }

  function pinPoint(map, marker) {
    const icon = liveObject(marker);
    // Leaflet keeps its DOM event targets by stamped element ID.
    const layer = map._targets?.[icon._leaflet_id];
    if (typeof layer?.getLatLng !== 'function' || layer.getChildCount?.() > 1) return null;
    const { lat, lng } = layer.getLatLng();
    return Number.isFinite(lat) && Number.isFinite(lng) ? [lng, lat] : null;
  }

  function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text) node.textContent = text;
    if (className) node.className = className;
    return node;
  }

  function link(text, url) {
    const anchor = element('a', text);
    anchor.href = url;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    return anchor;
  }

  function makePanel(container) {
    const host = element('div');
    host.setAttribute('data-jinka-transports', '');
    host.style.cssText = 'position:absolute;inset:0;z-index:1001;pointer-events:none';
    container.append(host);
    const shadow = host.attachShadow({ mode: 'closed' });
    const style = element(
      'style',
      `
      :host { color:#25223c; font:13px/1.35 system-ui,sans-serif; }
      details, article {
        position:absolute; pointer-events:auto; background:#fff; color:#25223c;
        border:1px solid #dcdae5; border-radius:10px; box-shadow:0 2px 12px #25223c30;
        max-height:calc(100% - 24px); overflow:auto; box-sizing:border-box;
      }
      details { inset:11px auto auto 52px; max-width:calc(100% - 110px); z-index:1; }
      summary { cursor:pointer; padding:7px 10px; font-weight:700; }
      .settings { width:min(290px, 61vw); padding:0 10px 9px; }
      fieldset { border:0; border-top:1px solid #eeedf2; margin:4px 0 0; padding:6px 0 2px; }
      legend { padding:0 4px 0 0; }
      label { display:inline-flex; align-items:center; gap:4px; cursor:pointer; }
      .lines { display:flex; gap:4px 8px; flex-wrap:wrap; margin:2px 0 4px; }
      .lines label { border:1px solid #e8e5ef; border-left:3px solid var(--line); border-radius:4px; padding-right:5px; }
      .road-toggle { border-left:3px solid var(--line); padding-left:3px; }
      input[type=checkbox] { margin:0 2px; accent-color:#7142a2; }
      form { display:flex; flex-wrap:wrap; gap:6px; margin:7px 0; }
      input[type=password] { flex:1; min-width:110px; width:8em; }
      :is(input[type=password], button) { font:inherit; border:1px solid #c4bdd0; border-radius:5px; padding:3px 6px; }
      button { cursor:pointer; background:#f5effb; color:#312440; }
      a { color:#552880; }
      .fine { font-size:11px; color:#595369; }
      .status { color:#70410e; font-size:12px; margin:4px 0; }
      article { inset:82px auto auto 11px; width:min(315px, calc(100% - 22px)); max-height:calc(100% - 94px); padding:10px 12px; }
      article[hidden], .lines[hidden] { display:none; }
      h2 { margin:0 24px 5px 0; font-size:14px; }
      dl { margin:0 0 6px; }
      dl div { display:grid; grid-template-columns:108px 1fr; gap:6px; border-top:1px solid #eeedf2; padding:4px 0; }
      dt { color:#595369; }
      dd { margin:0; font-weight:600; }
      .close { position:absolute; top:5px; right:7px; padding:0 5px; }
      details:has(summary:focus-visible), :is(button, a, input):focus-visible { outline:2px solid #7142a2; outline-offset:2px; }
    `,
    );
    const settings = element('details');
    settings.append(element('summary', 'Transports'));
    const body = element('div', '', 'settings');
    const status = element('div', '', 'status');
    status.setAttribute('role', 'status');
    const fields = element('div');
    const roadToggle = element('label', 'Autoroutes, voies rapides et périphérique');
    const highway = element('input');
    highway.type = 'checkbox';
    highway.checked = prefs.highways;
    roadToggle.prepend(highway);
    roadToggle.style.setProperty('--line', ROAD_COLOR);
    roadToggle.className = 'road-toggle';
    const roadChoices = element('div', '', 'lines');
    roadChoices.hidden = !prefs.highways;
    const form = element('form');
    const apiKey = element('input');
    apiKey.type = 'password';
    apiKey.placeholder = token ? 'Jeton PRIM enregistré' : 'Jeton PRIM (API)';
    apiKey.setAttribute('aria-label', 'Jeton API PRIM');
    apiKey.autocomplete = 'off';
    const save = element('button', 'Enregistrer');
    form.append(apiKey, save);
    const credits = element('div', '', 'fine');
    credits.append(
      link('Île-de-France Mobilités', 'https://data.iledefrance-mobilites.fr/explore/dataset/' + GTFS + '/'),
      ' · ',
      link('IGN', 'https://geoservices.ign.fr/bdtopo'),
      ' · ',
      link('Obtenir un jeton PRIM', `${PRIM}/fr/apis/idfm-navitia-general-v2`),
    );
    body.append(fields, roadToggle, roadChoices, status, form, credits);
    settings.append(body);
    const result = element('article');
    result.hidden = true;
    result.setAttribute('aria-label', 'Temps de trajet');
    const close = element('button', '×', 'close');
    close.setAttribute('aria-label', 'Masquer les estimations');
    const title = element('h2');
    const list = element('dl');
    list.setAttribute('aria-live', 'polite');
    const values = ['À pied', 'Châtelet–Les Halles', 'En voiture'].map((label) => {
      const row = element('div');
      const value = element('dd');
      row.append(element('dt', label), value);
      list.append(row);
      return value;
    });
    const note = element('div', 'Estimations depuis le point Jinka · voiture hors trafic', 'fine');
    const directions = link('Voir un trajet dans Google Maps', 'https://www.google.com/maps/');
    result.append(close, title, list, directions, note);
    shadow.append(style, settings, result);
    for (const type of ['mousedown', 'pointerdown', 'touchstart', 'click', 'dblclick', 'wheel', 'keydown']) {
      host.addEventListener(type, (event) => event.stopPropagation());
    }
    return {
      host,
      settings,
      fields,
      status,
      highway,
      roadChoices,
      form,
      apiKey,
      result,
      close,
      title,
      values,
      directions,
    };
  }

  function visible(line) {
    return prefs.modes[line.mode] && !prefs.hidden.includes(line.id);
  }

  function visibilityChoice(name, color, selected, change) {
    const choice = element('label', name);
    choice.style.setProperty('--line', color);
    const checkbox = element('input');
    checkbox.type = 'checkbox';
    checkbox.checked = selected;
    checkbox.addEventListener('change', () => change(checkbox.checked));
    choice.prepend(checkbox);
    return choice;
  }

  function setVisibility(hidden, id, enabled) {
    const updated = hidden.filter((item) => item !== id);
    if (!enabled) updated.push(id);
    return updated;
  }

  function linePicker(fields, lines, changed) {
    fields.replaceChildren();
    for (const [mode, name] of Object.entries(MODES)) {
      const group = element('fieldset');
      const toggle = element('label', name);
      const input = element('input');
      input.type = 'checkbox';
      input.checked = Boolean(prefs.modes[mode]);
      toggle.prepend(input);
      const legend = element('legend');
      legend.append(toggle);
      const list = element('div', '', 'lines');
      list.hidden = !input.checked;
      for (const line of lines.filter((item) => item.mode === mode)) {
        list.append(
          visibilityChoice(line.name, line.color, !prefs.hidden.includes(line.id), (enabled) => {
            prefs.hidden = setVisibility(prefs.hidden, line.id, enabled);
            changed();
          }),
        );
      }
      input.addEventListener('change', () => {
        prefs.modes[mode] = input.checked;
        list.hidden = !input.checked;
        changed();
      });
      group.append(legend, list);
      fields.append(group);
    }
  }

  function mapBounds(map) {
    const bounds = map.getBounds();
    return [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()];
  }

  function roadBounds(bounds, padX, padY) {
    const requested = [bounds[0] - padX, bounds[1] - padY, bounds[2] + padX, bounds[3] + padY];
    return requested.map((value, index) => {
      const round = index < 2 ? Math.floor : Math.ceil;
      const quantized = round(value * 50) / 50;
      return index < 2 ? Math.max(quantized, COVERAGE[index]) : Math.min(quantized, COVERAGE[index]);
    });
  }

  function drawOverlay(map, canvas, context, rail, road) {
    const { x: width, y: height } = map.getSize();
    if (!width || !height) return;
    const position = map.containerPointToLayerPoint(new unsafeWindow.Array(0, 0));
    const zoom = map.getZoom();
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const pixelWidth = Math.round(width * ratio);
    const pixelHeight = Math.round(height * ratio);
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    }
    canvas.style.transform = `translate(${position.x}px, ${position.y}px)`;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);
    context.lineJoin = 'round';
    context.lineCap = 'round';
    const bounds = mapBounds(map);
    const origin = map.getPixelOrigin();
    const scale = 256 * 2 ** zoom;
    // Leaflet's EPSG:3857 projection, using the same pixel origin as Jinka's markers.
    function project([lon, lat]) {
      const sine = Math.sin((lat * Math.PI) / 180);
      return [
        (lon / 360 + 0.5) * scale - origin.x - position.x,
        (0.5 - Math.log((1 + sine) / (1 - sine)) / (4 * Math.PI)) * scale - origin.y - position.y,
      ];
    }
    function stroke(paths, color, weight) {
      context.beginPath();
      for (const path of paths) {
        if (!intersects(path.bounds, bounds) || path.points.length < 2) continue;
        context.moveTo(...project(path.points[0]));
        for (let i = 1; i < path.points.length; i++) context.lineTo(...project(path.points[i]));
      }
      context.lineWidth = weight + 2;
      context.strokeStyle = '#fffdf4d9';
      context.stroke();
      context.lineWidth = weight;
      context.strokeStyle = color;
      context.stroke();
    }
    if (prefs.highways && road) {
      const paths = road.roads.filter((item) => !prefs.hiddenRoads.includes(item.name)).map((item) => item.path);
      stroke(paths, ROAD_COLOR, 3);
    }
    for (const line of rail?.lines ?? []) {
      if (visible(line)) stroke(line.paths, line.color, 3);
    }
    if (zoom < 12) return;
    for (const stop of rail?.stops ?? []) {
      if (!visible(stop.line) || !inside(stop.point, bounds)) continue;
      context.beginPath();
      context.arc(...project(stop.point), 3, 0, 2 * Math.PI);
      context.fillStyle = '#fff';
      context.fill();
      context.strokeStyle = stop.line.color;
      context.lineWidth = 1.5;
      context.stroke();
    }
  }

  function mount(container, map) {
    const pane = container.querySelector('.leaflet-overlay-pane');
    const canvas = element('canvas');
    const context = canvas.getContext('2d');
    if (!pane || !context) return null;
    canvas.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none';
    canvas.setAttribute('data-jinka-transport-overlay', '');
    canvas.setAttribute('aria-hidden', 'true');
    pane.append(canvas);
    const panel = makePanel(container);
    const events = new AbortController();
    const options = { signal: events.signal };
    let rail;
    let railError = false;
    let roads;
    let roadWindow;
    let roadPromise;
    let roadMessage = '';
    let showRoads = false;
    let frame = 0;
    let hoverTimer;
    let selected;
    let revision = 0;

    function draw() {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        drawOverlay(map, canvas, context, rail, showRoads ? roads : null);
      });
    }
    function status() {
      panel.status.textContent = [railError ? 'Lignes indisponibles. Rouvrez ce menu pour réessayer.' : '', roadMessage]
        .filter(Boolean)
        .join(' ');
    }
    async function loadRails() {
      try {
        rail = await railData();
        if (events.signal.aborted) return;
        railError = false;
        linePicker(panel.fields, rail.lines, changed);
        draw();
      } catch {
        railError = true;
      }
      status();
    }
    function updateRoads() {
      const bounds = mapBounds(map);
      showRoads = false;
      if (!prefs.highways || !overlapsRegion(bounds)) {
        roadMessage = '';
      } else if (map.getZoom() < 10 || bounds[2] - bounds[0] > 1 || bounds[3] - bounds[1] > 0.65) {
        roadMessage = 'Zoomez pour afficher les autoroutes.';
      } else if (roadWindow && covers(roadWindow, roadBounds(bounds, 0, 0))) {
        showRoads = true;
        roadMessage = roads ? '' : 'Chargement des autoroutes…';
      } else {
        showRoads = true;
        roadWindow = roadBounds(bounds, 0.045, 0.03);
        roads = null;
        roadMessage = 'Chargement des autoroutes…';
        const pending = roadData(roadWindow);
        roadPromise = pending;
        pending
          .then((data) => {
            if (roadPromise !== pending || events.signal.aborted) return;
            roads = data;
            const names = [...new Set(data.roads.map((road) => road.name))].sort((a, b) =>
              a.localeCompare(b, 'fr', { numeric: true }),
            );
            panel.roadChoices.replaceChildren(
              ...names.map((name) =>
                visibilityChoice(name, ROAD_COLOR, !prefs.hiddenRoads.includes(name), (enabled) => {
                  prefs.hiddenRoads = setVisibility(prefs.hiddenRoads, name, enabled);
                  changed();
                }),
              ),
            );
            roadMessage = '';
            status();
            draw();
          })
          .catch(() => {
            if (roadPromise !== pending || events.signal.aborted) return;
            roadWindow = null;
            roadMessage = 'Autoroutes indisponibles. Déplacez la carte ou rouvrez le menu pour réessayer.';
            status();
          });
      }
      status();
      draw();
    }
    function changed() {
      GM_setValue('layers', prefs);
      updateRoads();
      if (selected) estimate(selected);
    }
    async function estimate(selection) {
      selected = selection;
      const { point, label } = selection;
      const current = ++revision;
      const [walking, transit, driving] = panel.values;
      const active = () => current === revision && !events.signal.aborted;
      const show = (target, text) => {
        if (active()) target.textContent = text;
      };
      panel.result.hidden = false;
      panel.title.textContent = `Trajets · ${label}`;
      panel.directions.href = urlWith('https://www.google.com/maps/dir/', {
        api: 1,
        origin: coord([...point].reverse()),
        destination: 'Châtelet - Les Halles, Paris',
        travelmode: 'transit',
      });
      if (!inside(point, COVERAGE)) {
        for (const value of panel.values) show(value, 'Hors Île-de-France');
        return;
      }
      for (const value of panel.values) show(value, 'Calcul en cours…');

      const walkingAndTransit = async () => {
        let data;
        try {
          data = await railData();
        } catch {
          show(walking, 'Stations indisponibles');
          show(transit, 'Lignes indisponibles');
          return;
        }
        if (!active()) return;
        const lines = data.lines.filter(visible);
        if (!lines.length) {
          show(walking, 'Affichez une ligne');
          show(transit, 'Affichez une ligne');
          return;
        }
        if (token) {
          parisJourney(point, lines).then((text) => show(transit, text));
        } else {
          show(transit, 'Ajoutez un jeton PRIM dans Transports');
        }

        const stops = closest(
          point,
          data.stops.filter((stop) => visible(stop.line)),
          3,
          12000,
        );
        const best = await fastestNearby(point, stops, 'pedestrian', active);
        if (!best) {
          show(walking, stops.length ? 'Itinéraire indisponible' : 'Aucune station affichée à proximité');
          return;
        }
        const linesAtStation = data.stops
          .filter((stop) => visible(stop.line) && stop.name === best.name && metres(stop.point, best.point) < 350)
          .map(({ line }) => `${MODES[line.mode]} ${line.name}`);
        show(walking, `${minutes(best.duration)} · ${best.name} (${[...new Set(linesAtStation)].join(', ')})`);
      };
      const drivingEstimate = async () => {
        if (!prefs.highways) {
          show(driving, 'Affichez les autoroutes');
          return;
        }
        const nearby = roadBounds([...point, ...point], 0.12, 0.08);
        try {
          const data = roadWindow && covers(roadWindow, nearby) ? await roadPromise : await roadData(nearby);
          if (!active()) return;
          const entrances = closest(
            point,
            data.entrances.filter((entry) => !prefs.hiddenRoads.includes(entry.name)),
            4,
            12000,
          );
          const best = await fastestNearby(point, entrances, 'car', active);
          show(
            driving,
            best
              ? `${minutes(best.duration)} · accès ${best.name}`
              : entrances.length
                ? 'Itinéraire indisponible'
                : 'Aucune bretelle à proximité',
          );
        } catch {
          show(driving, 'Données routières indisponibles');
        }
      };
      await Promise.all([walkingAndTransit(), drivingEstimate()]);
    }

    function activate(marker) {
      const point = pinPoint(map, marker);
      if (!point) return;
      const label = marker.textContent.match(PRICE)?.[0].trim();
      if (!label) return;
      if (selected?.marker === marker && selected.point.every((value, index) => value === point[index])) return;
      estimate({ marker, point, label });
    }
    function onPin(event) {
      const marker = event.target.closest?.(PIN);
      if (!marker || marker === event.relatedTarget?.closest?.(PIN)) return;
      clearTimeout(hoverTimer);
      if (event.type === 'click') activate(marker);
      else hoverTimer = setTimeout(() => activate(marker), 450);
    }
    function leavePin(event) {
      const marker = event.target.closest?.(PIN);
      if (marker && marker !== event.relatedTarget?.closest?.(PIN)) clearTimeout(hoverTimer);
    }
    function hide() {
      clearTimeout(hoverTimer);
      selected = null;
      revision++;
      panel.result.hidden = true;
    }

    panel.close.addEventListener('click', hide, options);
    panel.highway.addEventListener(
      'change',
      () => {
        prefs.highways = panel.highway.checked;
        panel.roadChoices.hidden = !prefs.highways;
        changed();
      },
      options,
    );
    panel.form.addEventListener(
      'submit',
      (event) => {
        event.preventDefault();
        token = panel.apiKey.value.trim();
        GM_setValue('prim-token', token);
        for (const key of routes.keys()) {
          if (key.startsWith('transit:')) routes.delete(key);
        }
        panel.apiKey.value = '';
        panel.apiKey.placeholder = token ? 'Jeton PRIM enregistré' : 'Jeton PRIM (API)';
        if (selected) estimate(selected);
      },
      options,
    );
    panel.settings.addEventListener(
      'toggle',
      () => {
        if (!panel.settings.open) return;
        if (railError) loadRails();
        updateRoads();
      },
      options,
    );
    for (const type of ['pointerover', 'focusin', 'click']) {
      container.addEventListener(type, onPin, { ...options, capture: true });
    }
    for (const type of ['pointerout', 'focusout']) container.addEventListener(type, leavePin, options);

    const onZoom = () => {
      canvas.hidden = true;
    };
    const onZoomEnd = () => {
      canvas.hidden = false;
      draw();
    };
    // Firefox userscript sandboxes need an explicit callable in the page's realm.
    const handlers = { move: draw, moveend: updateRoads, resize: updateRoads, zoomstart: onZoom, zoomend: onZoomEnd };
    const listeners = Object.entries(handlers).map(([event, handler]) => [
      event,
      typeof exportFunction === 'function' ? exportFunction(handler, unsafeWindow) : handler,
    ]);
    for (const [event, listener] of listeners) map.on(event, listener);
    linePicker(panel.fields, [], changed);
    loadRails();
    updateRoads();
    return () => {
      events.abort();
      hide();
      cancelAnimationFrame(frame);
      for (const [event, listener] of listeners) map.off(event, listener);
      canvas.remove();
      panel.host.remove();
    };
  }

  let scanFrame = 0;
  function scan() {
    scanFrame = 0;
    for (const [container, destroy] of mounted) {
      if (!container.isConnected || !container.querySelector('[data-jinka-transport-overlay]')) {
        destroy();
        mounted.delete(container);
      }
    }
    for (const container of document.querySelectorAll('.leaflet-container')) {
      if (mounted.has(container) || !container.getClientRects().length) continue;
      if (![...container.querySelectorAll(PIN)].some((marker) => PRICE.test(marker.textContent))) continue;
      const map = findMap(container);
      if (!map) continue;
      const destroy = mount(container, map);
      if (destroy) mounted.set(container, destroy);
    }
  }
  new MutationObserver(() => {
    if (!scanFrame) scanFrame = requestAnimationFrame(scan);
  }).observe(document.body, { childList: true, subtree: true });
  scan();
})();
