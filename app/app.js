/* Home Assistant TV dashboard - TizenBrew application module
 * Compatível com Tizen 5.0 (Chromium M63): ES2017, sem optional chaining.
 */
(function () {
  'use strict';

  var DEFAULT_SERVER = 'http://10.0.0.16:8077';
  var LS_SERVER = 'tvsam.server';
  var LS_COLS = 'tvsam.cols';
  var IDLE_MS = 120000;

  /* Quando o dashboard é servido pelo próprio proxy (navegador da TV),
   * usa a origem atual. Sob o TizenBrew a página vem de 127.0.0.1:8081,
   * então cai no DEFAULT_SERVER. */
  function initialServer() {
    try {
      var o = location.origin || '';
      if (/^https?:\/\//.test(o) && o.indexOf('127.0.0.1') === -1 && o.indexOf('localhost') === -1) return o;
    } catch (e) {}
    return DEFAULT_SERVER;
  }

  var S = {
    server: (localStorage.getItem(LS_SERVER) || initialServer()).replace(/\/+$/, ''),
    cols: parseInt(localStorage.getItem(LS_COLS) || '4', 10) || 4,
    config: null,
    entities: {},
    order: [],
    pages: [],
    pageIndex: 0,
    focus: 0,
    entityFocus: null,
    conn: false,
    lastUpdate: 0,
    timer: null,
    idleTimer: null,
    idleOn: false,
    screen: 'boot',
    detailId: null,
    detailFocus: 0,
    pageFocus: 0,
    busy: {}
  };

  S.listCols = S.cols;

  var $ = function (id) { return document.getElementById(id); };
  var el = {
    setup: $('setup'), dashboard: $('dashboard'), detail: $('detail'),
    pages: $('pages'), settings: $('settings'), idle: $('idle'),
    clock: $('clock'), date: $('date'), pageName: $('page-name'),
    pageDots: $('page-dots'), conn: $('conn'), connTxt: $('conn-txt'),
    updated: $('updated'), grid: $('grid'), footPage: $('foot-page'),
    inpServer: $('inp-server'), setupStatus: $('setup-status'),
    detailIcon: $('detail-icon'), detailName: $('detail-name'),
    detailState: $('detail-state'), detailControls: $('detail-controls'),
    detailAttrs: $('detail-attrs'), pagesList: $('pages-list'),
    setServer: $('set-server'), setCols: $('set-cols'), setStatus: $('set-status'),
    idleTime: $('idle-time'), idleDate: $('idle-date'), idleWeather: $('idle-weather'),
    carTitle: $('car-title'), carSub: $('car-sub'), carCards: $('car-cards'), carDetails: $('car-details'),
    toast: $('toast')
  };

  /* ------------------------------------------------------------------ */
  /* ícones                                                            */
  /* ------------------------------------------------------------------ */
  var ICONS = {
    light: 'M9 21h6v-1H9v1zm3-19a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2zm2.9 11.3-.9.6V15h-4v-1.1l-.9-.6a5 5 0 1 1 5.8 0z',
    switch: 'M13 3h-2v10h2V3zm4.8 2.2-1.4 1.4A7 7 0 1 1 7.6 6.6L6.2 5.2A9 9 0 1 0 19 5.2z',
    scene: 'M12 2 9 9H2l5.5 4.5L5 21l7-4.5L19 21l-2.5-7.5L22 9h-7z',
    script: 'M6 2h9l5 5v15H6V2zm8 1.5V8h4.5L14 3.5zM8 12h8v2H8v-2zm0 4h8v2H8v-2zm0-8h4v2H8V8z',
    climate: 'M12 2a3 3 0 0 1 3 3v7.2a5.5 5.5 0 1 1-6 0V5a3 3 0 0 1 3-3zm0 2a1 1 0 0 0-1 1v8.1l-.5.3a3.5 3.5 0 1 0 3 0l-.5-.3V5a1 1 0 0 0-1-1z',
    media_player: 'M8 5v14l11-7z',
    cover: 'M4 3h16v18H4V3zm2 2v14h12V5H6zm2 2h8v2H8V7zm0 4h8v2H8v-2z',
    lock: 'M17 9V7a5 5 0 0 0-10 0v2H5v12h14V9h-2zM9 7a3 3 0 0 1 6 0v2H9V7zm3 6a2 2 0 0 1 1 3.7V19h-2v-2.3A2 2 0 0 1 12 13z',
    fan: 'M12 11a3 3 0 1 0 0 6 3 3 0 0 0 0-6zm0-9c2.5 0 4 2 4 4.5S14.5 11 12 11 8 9 8 6.5 9.5 2 12 2zM2 12c0-2.5 2-4 4.5-4S11 9.5 11 12s-2 4-4.5 4S2 14.5 2 12zm20 0c0 2.5-2 4-4.5 4S13 14.5 13 12s2-4 4.5-4 4.5 1.5 4.5 4zM12 22c-2.5 0-4-2-4-4.5S9.5 13 12 13s4 2 4 4.5-1.5 4.5-4 4.5z',
    input_boolean: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 3a7 7 0 1 1 0 14 7 7 0 0 1 0-14zm0 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
    automation: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 15.9V19h-2v-1.1a6 6 0 0 1-3.8-3.8L6 15l-1-1.7 1.1-.7a6 6 0 0 1 0-4.2L5 7.7 6 6l1.1.7A6 6 0 0 1 11 3.9V3h2v.9a6 6 0 0 1 3.9 2.8l1.1-.7 1 1.7-1.1.7a6 6 0 0 1 0 4.2l1.1.7-1 1.7-1.1-.7a6 6 0 0 1-3.9 2.8z',
    sensor: 'M3 13h4l3-8 4 14 3-6h4v2h-3l-4 8-4-14-2 6H3z',
    binary_sensor: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-1 15-4-4 1.4-1.4L11 14.2l4.6-4.6L17 11l-6 6z',
    default: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z'
  };
  function iconFor(domain) { return ICONS[domain] || ICONS['default']; }

  function svg(domain) {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + iconFor(domain) + '"/></svg>';
  }

  /* ------------------------------------------------------------------ */
  /* utilidades                                                        */
  /* ------------------------------------------------------------------ */
  function apiUrl(path) { return S.server + path; }

  function request(path, opts) {
    var o = opts || {};
    o.headers = o.headers || {};
    if (o.body && !o.headers['Content-Type']) o.headers['Content-Type'] = 'application/json';
    return fetch(apiUrl(path), o).then(function (r) {
      if (!r.ok) {
        return r.text().then(function (t) {
          throw new Error('HTTP ' + r.status + (t ? ' - ' + t.slice(0, 120) : ''));
        });
      }
      return r.json();
    });
  }

  function toast(msg, ms) {
    el.toast.textContent = msg;
    el.toast.classList.remove('hidden');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { el.toast.classList.add('hidden'); }, ms || 2500);
  }

  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  function fmtTime(d) { return pad(d.getHours()) + ':' + pad(d.getMinutes()); }

  var DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
  var MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  function fmtDate(d) {
    return DIAS[d.getDay()] + ', ' + d.getDate() + ' ' + MESES[d.getMonth()];
  }

  function closeAll() {
    ['setup', 'dashboard', 'detail', 'pages', 'settings', 'idle'].forEach(function (k) {
      el[k].classList.add('hidden');
    });
  }

  function show(name) {
    closeAll();
    el[name].classList.remove('hidden');
    S.screen = name;
  }

  /* ------------------------------------------------------------------ */
  /* relógio                                                           */
  /* ------------------------------------------------------------------ */
  function tickClock() {
    var d = new Date();
    el.clock.textContent = fmtTime(d);
    el.date.textContent = fmtDate(d);
    el.idleTime.textContent = fmtTime(d);
    el.idleDate.textContent = fmtDate(d);
  }
  setInterval(tickClock, 1000);
  tickClock();

  /* ------------------------------------------------------------------ */
  /* ociosidade -> relógio                                             */
  /* ------------------------------------------------------------------ */
  function resetIdle() {
    clearTimeout(S.idleTimer);
    if (S.idleOn) {
      S.idleOn = false;
      closeAll();
      show(S.screen === 'idle' ? 'dashboard' : S.screen);
      render();
    }
    S.idleTimer = setTimeout(function () {
      if (S.screen === 'dashboard' || S.screen === 'detail' || S.screen === 'pages') {
        S.idleOn = true;
        show('idle');
        updateIdleWeather();
      }
    }, IDLE_MS);
  }

  function updateIdleWeather() {
    var w = S.config && S.config.weatherEntity ? S.entities[S.config.weatherEntity] : null;
    if (!w) { el.idleWeather.textContent = ''; return; }
    var a = w.attributes || {};
    var t = a.temperature != null ? Math.round(a.temperature) + '°' : '';
    el.idleWeather.textContent = (w.state ? w.state + ' ' : '') + t;
  }

  /* ------------------------------------------------------------------ */
  /* dados                                                             */
  /* ------------------------------------------------------------------ */
  var DOMAIN_ORDER = ['light', 'switch', 'scene', 'script', 'climate', 'media_player',
    'cover', 'lock', 'fan', 'input_boolean', 'automation', 'sensor', 'binary_sensor'];

  var AREA_RULES = [
    ['Varanda', /varanda/],
    ['Suíte', /su[ií]te|suite/],
    ['Quarto', /quarto/],
    ['Cozinha', /cozinha|pia|lavanderia|kitchen/],
    ['Sala', /\bsala\b/],
    ['Banheiro', /banheiro/],
    ['Hall', /\bhall\b/],
    ['Carro', /carro|song.?plus|\bbyd\b|renegade|\btita\b/],
    ['Energia', /solar/],
    ['Limpeza', /alfred|terezinha|aspirador|\brobo\b/],
    ['Rede', /roteador|router|tp.?link|pi.?hole|pihole|\bwifi\b|starlink/]
  ];

  function normArea(s) {
    return String(s || '').toLowerCase()
      .replace(/[áàãâä]/g, 'a').replace(/[éèêë]/g, 'e').replace(/[íìîï]/g, 'i')
      .replace(/[óòõôö]/g, 'o').replace(/[úùûü]/g, 'u').replace(/ç/g, 'c');
  }

  function areaOfEntity(e) {
    var text = normArea(e.entity_id + ' ' + ((e.attributes && e.attributes.friendly_name) || ''));
    for (var i = 0; i < AREA_RULES.length; i++) {
      if (AREA_RULES[i][1].test(text)) return AREA_RULES[i][0];
    }
    return 'Outros';
  }

  function isUsable(e) {
    if (!e || !e.entity_id) return false;
    var a = e.attributes || {};
    if (a.hidden === true) return false;
    if (e.state === 'unavailable' && S.config && S.config.hideUnavailable) return false;
    return true;
  }

  function matchGlob(id, pattern) {
    if (pattern === id) return true;
    if (pattern.indexOf('*') === -1) return false;
    var re = new RegExp('^' + pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');
    return re.test(id);
  }

  function buildAllEntities(states) {
    S.entities = {};
    S.order = [];
    states.forEach(function (e) {
      if (!e || !e.entity_id) return;
      S.entities[e.entity_id] = e;
    });
    S.order = Object.keys(S.entities).sort();
  }

  function pageSize() { return S.cols * 7; }

  function autoPages() {
    var includeSensors = !!(S.config && S.config.includeSensors);
    var allowed = {};
    DOMAIN_ORDER.forEach(function (d) {
      if ((d === 'sensor' || d === 'binary_sensor') && !includeSensors) return;
      allowed[d] = true;
    });
    var groups = {};
    S.order.forEach(function (id) {
      var d = id.split('.')[0];
      if (!allowed[d]) return;
      var e = S.entities[id];
      if (!isUsable(e)) return;
      var area = areaOfEntity(e);
      if (!groups[area]) groups[area] = [];
      groups[area].push(id);
    });

    var areaOrder = ['Sala', 'Cozinha', 'Suíte', 'Quarto', 'Banheiro', 'Varanda', 'Hall', 'Carro', 'Limpeza', 'Energia', 'Rede', 'Outros'];
    var names = Object.keys(groups).sort(function (a, b) {
      var ia = areaOrder.indexOf(a), ib = areaOrder.indexOf(b);
      if (ia === -1) ia = 999; if (ib === -1) ib = 999;
      if (ia !== ib) return ia - ib;
      return a.localeCompare(b, 'pt-BR');
    });

    var pages = [];
    var max = pageSize();
    names.forEach(function (name) {
      var ids = groups[name];
      if (!ids || !ids.length) return;
      var chunks = Math.ceil(ids.length / max);
      for (var i = 0; i < chunks; i++) {
        pages.push({
          name: name + (chunks > 1 ? ' ' + (i + 1) : ''),
          entities: ids.slice(i * max, (i + 1) * max)
        });
      }
    });
    return pages;
  }

  function configPages() {
    var cfg = S.config || {};
    if (!cfg.pages || !cfg.pages.length) return autoPages();
    var out = [];
    cfg.pages.forEach(function (p) {
      var ids = [];
      (p.entities || []).forEach(function (pat) {
        S.order.forEach(function (id) {
          if (matchGlob(id, pat) && ids.indexOf(id) === -1 && isUsable(S.entities[id])) ids.push(id);
        });
      });
      if (ids.length) out.push({ name: p.name || 'Página', entities: ids });
    });
    return out.length ? out : autoPages();
  }

  function rebuildPages() {
    var prevName = S.pages[S.pageIndex] ? S.pages[S.pageIndex].name : null;
    S.pages = configPages();
    if (!S.pages.length) { S.pageIndex = 0; S.focus = 0; return; }
    var idx = 0;
    if (prevName) {
      for (var i = 0; i < S.pages.length; i++) if (S.pages[i].name === prevName) { idx = i; break; }
    }
    S.pageIndex = Math.min(idx, S.pages.length - 1);
    S.focus = Math.min(S.focus, S.pages[S.pageIndex].entities.length - 1);
    if (S.focus < 0) S.focus = 0;
  }

  function refreshStates(silent) {
    return request('/api/ha/states').then(function (states) {
      buildAllEntities(states || []);
      rebuildPages();
      S.conn = true;
      S.lastUpdate = Date.now();
      if (S.screen === 'dashboard') render();
      if (S.screen === 'setup') {
        show('dashboard');
        render();
      }
      return true;
    }).catch(function (err) {
      S.conn = false;
      updateConn();
      if (!silent) {
        if (S.screen === 'boot' || S.screen === 'setup') {
          show('setup');
          el.inpServer.value = S.server;
          if (String(err.message).indexOf('401') !== -1) {
            el.setupStatus.textContent = 'Falta o token do Home Assistant. Abra ' + S.server + '/ num navegador, cole o token e clique em Salvar.';
          } else {
            el.setupStatus.textContent = 'Não consegui falar com ' + S.server + ' — ' + err.message;
          }
          el.setupStatus.className = 'status bad';
        } else {
          toast('Sem conexão com o servidor');
        }
      }
      return false;
    });
  }

  function updateConn() {
    if (S.conn) {
      el.conn.className = 'conn ok';
      el.connTxt.textContent = 'online';
      var secs = Math.round((Date.now() - S.lastUpdate) / 1000);
      el.updated.textContent = 'atualizado ' + (secs < 2 ? 'agora' : 'há ' + secs + 's');
    } else {
      el.conn.className = 'conn bad';
      el.connTxt.textContent = 'offline';
      el.updated.textContent = '';
    }
  }
  setInterval(updateConn, 1000);

  function getConfig() {
    return request('/config.json').then(function (cfg) {
      S.config = cfg || {};
      if (cfg && cfg.columns) {
        S.cols = cfg.columns;
        localStorage.setItem(LS_COLS, String(cfg.columns));
      }
      if (cfg && cfg.title) document.title = cfg.title + ' · Home Assistant';
      return cfg;
    }).catch(function () {
      S.config = {};
      return {};
    });
  }

  /* ------------------------------------------------------------------ */
  /* ações                                                             */
  /* ------------------------------------------------------------------ */
  function callService(domain, service, data) {
    var key = domain + '.' + service;
    if (S.busy[key]) return Promise.resolve();
    S.busy[key] = true;
    return request('/api/ha/services/' + domain + '/' + service, {
      method: 'POST',
      body: JSON.stringify(data || {})
    }).then(function () {
      delete S.busy[key];
      setTimeout(function () { refreshStates(true); }, 500);
    }).catch(function (e) {
      delete S.busy[key];
      toast('Falha: ' + e.message);
    });
  }

  function toggleEntity(e) {
    var d = e.entity_id.split('.')[0];
    var st = e.state;
    var map = {
      light: st === 'on' ? 'turn_off' : 'turn_on',
      switch: st === 'on' ? 'turn_off' : 'turn_on',
      fan: st === 'on' ? 'turn_off' : 'turn_on',
      input_boolean: st === 'on' ? 'turn_off' : 'turn_on',
      automation: st === 'on' ? 'turn_off' : 'turn_on'
    };
    if (map[d]) return callService(d, map[d], { entity_id: e.entity_id });
    if (d === 'scene') return callService('scene', 'turn_on', { entity_id: e.entity_id });
    if (d === 'script') return callService('script', 'turn_on', { entity_id: e.entity_id });
    if (d === 'media_player') return callService('media_player', 'media_play_pause', { entity_id: e.entity_id });
    if (d === 'cover') {
      return callService('cover', (st === 'closed' ? 'open_cover' : 'close_cover'), { entity_id: e.entity_id });
    }
    if (d === 'lock') {
      return callService('lock', (st === 'locked' ? 'unlock' : 'lock'), { entity_id: e.entity_id });
    }
    openDetail(e.entity_id);
    return Promise.resolve();
  }

  /* ------------------------------------------------------------------ */
  /* painel do carro (BYD Song Plus)                                   */
  /* ------------------------------------------------------------------ */
  function findE(id) { return S.entities[id] || null; }
  function findAny(ids) { for (var i = 0; i < ids.length; i++) { var e = findE(ids[i]); if (e) return e; } return null; }
  function eNum(e) { if (!e) return null; var n = parseFloat(e.state); return isNaN(n) ? null : n; }
  function fmtVal(e, suffix) {
    if (!e) return '—';
    if (e.state === 'unavailable' || e.state === 'unknown') return '—';
    var u = (e.attributes && e.attributes.unit_of_measurement) || suffix || '';
    return e.state + (u ? (' ' + u) : '');
  }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  function renderCar() {
    if (!el.carCards || !el.carDetails) return;
    var lock = findE('lock.carro_song_plus_lock');
    var doors = findAny(['binary_sensor.carro_song_plus_doors', 'binary_sensor.linus_dashboard_door_area_carroa']);
    var windows = findAny(['binary_sensor.carro_song_plus_windows', 'binary_sensor.linus_dashboard_window_area_carroa']);
    var trunk = findE('binary_sensor.song_plus_trunk');
    var batt = findAny(['sensor.carro_song_plus_battery_level', 'sensor.byd_soc', 'sensor.linus_dashboard_battery_area_carroa']);
    var charging = findE('binary_sensor.carro_song_plus_charging');
    var fuel = findE('sensor.carro_song_plus_fuel_level');
    var evRange = findAny(['sensor.byd_autonomia_ev', 'sensor.carro_song_plus_ev_endurance', 'sensor.song_plus_ev_endurance']);
    var fuelRange = findAny(['sensor.byd_autonomia_combustivel', 'sensor.carro_song_plus_fuel_range']);
    var totalRange = findAny(['sensor.byd_autonomia_total', 'sensor.carro_song_plus_range', 'sensor.song_plus_range_v2']);
    var odo = findAny(['sensor.byd_odometro', 'sensor.carro_song_plus_odometer', 'sensor.song_plus_cumulative_total_mileage']);
    var online = findE('binary_sensor.carro_song_plus_online');
    var loc = findE('device_tracker.carro_song_plus_location');
    var vehOn = findE('binary_sensor.song_plus_vehicle_on');

    var parts = [];
    if (online) parts.push(online.state === 'on' ? 'online' : 'offline');
    if (loc && loc.state && loc.state !== 'unknown' && loc.state !== 'unavailable' && loc.state !== 'not_home') parts.push(loc.state);
    if (loc && loc.state === 'not_home') parts.push('fora de casa');
    if (vehOn) parts.push(vehOn.state === 'on' ? 'ligado' : 'desligado');
    if (el.carSub) el.carSub.textContent = parts.length ? parts.join(' · ') : 'BYD Song Plus';

    function card(label, value, sub, cls) {
      return '<div class="car-card ' + (cls || '') + '"><div class="label">' + esc(label) +
        '</div><div class="value">' + esc(value) + '</div><div class="sub">' + (sub || '&nbsp;') + '</div></div>';
    }

    var lockTxt = '—', lockSub = '&nbsp;', lockCls = '';
    if (lock) {
      if (lock.state === 'locked') { lockTxt = 'Travado'; lockCls = 'good'; }
      else if (lock.state === 'unlocked') { lockTxt = 'Destravado'; lockCls = 'bad'; }
      else { lockTxt = lock.state; }
    }
    var doorBits = [];
    if (doors) doorBits.push(doors.state === 'on' ? 'portas abertas' : 'portas fechadas');
    if (windows) doorBits.push(windows.state === 'on' ? 'janelas abertas' : 'janelas fechadas');
    if (trunk) doorBits.push(trunk.state === 'on' ? 'porta-malas aberto' : 'porta-malas fechado');
    if (doorBits.length) lockSub = esc(doorBits.join(' · '));
    if (doors && doors.state === 'on') lockCls = 'bad';

    var battVal = fmtVal(batt, '%'), battSub = '&nbsp;', battCls = 'accent';
    var bn = eNum(batt);
    if (bn != null) {
      if (bn <= 20) battCls = 'bad'; else if (bn <= 40) battCls = 'warn'; else battCls = 'good';
    }
    if (charging) battSub = charging.state === 'on' ? 'carregando' : 'não carregando';

    var fuelVal = fmtVal(fuel, '%'), fuelSub = '&nbsp;', fuelCls = 'warn';
    var fn = eNum(fuel);
    if (fn != null) {
      if (fn <= 15) fuelCls = 'bad'; else if (fn <= 30) fuelCls = 'warn'; else fuelCls = 'good';
    }

    el.carCards.innerHTML = card('Travamento', lockTxt, lockSub, lockCls) +
      card('Bateria', battVal, battSub, battCls) +
      card('Combustível', fuelVal, fuelSub, fuelCls);

    function row(k, v, cls) {
      return '<div class="row"><span class="k">' + esc(k) + '</span><span class="v ' + (cls || '') + '">' + esc(v) + '</span></div>';
    }
    var html = '';
    function addRow(label, e, opts) {
      opts = opts || {};
      if (!e) return;
      var v = fmtVal(e, opts.suffix);
      var cls = opts.cls || '';
      if (opts.binary) {
        if (e.state === 'on') { v = opts.on || 'Sim'; cls = opts.onCls || 'warn'; }
        else if (e.state === 'off') { v = opts.off || 'Não'; cls = opts.offCls || 'off'; }
        else if (e.state === 'unavailable' || e.state === 'unknown') { return; }
      }
      if ((v === '—' || v === '') && !opts.showEmpty) return;
      html += row(label, v, cls);
    }

    addRow('Portas', doors, { binary: true, on: 'Abertas', off: 'Fechadas', onCls: 'bad', offCls: 'on' });
    addRow('Janelas', windows, { binary: true, on: 'Abertas', off: 'Fechadas', onCls: 'bad', offCls: 'on' });
    addRow('Porta-malas', trunk, { binary: true, on: 'Aberto', off: 'Fechado', onCls: 'bad', offCls: 'on' });
    addRow('Autonomia EV', evRange);
    addRow('Autonomia combustível', fuelRange);
    addRow('Autonomia total', totalRange);
    addRow('Odômetro', odo);
    if (loc && loc.state && loc.state !== 'unknown' && loc.state !== 'unavailable') {
      html += row('Localização', loc.state === 'not_home' ? 'Fora de casa' : loc.state, '');
    }

    if (!html) html = '<div class="car-empty">Nenhum dado do carro encontrado.</div>';
    el.carDetails.innerHTML = html;
  }

  /* ------------------------------------------------------------------ */
  /* render                                                            */
  /* ------------------------------------------------------------------ */
  function stateText(e) {
    var d = e.entity_id.split('.')[0];
    var a = e.attributes || {};
    if (e.state === 'unavailable') return 'indisponível';
    if (d === 'light') {
      if (e.state !== 'on') return 'apagada';
      if (a.brightness != null) return Math.round(a.brightness / 2.55) + '%';
      return 'acesa';
    }
    if (d === 'media_player') {
      if (e.state === 'playing') return 'tocando';
      if (e.state === 'paused') return 'pausado';
      if (e.state === 'off') return 'desligado';
      return e.state;
    }
    if (d === 'climate') {
      var t = a.current_temperature != null ? Math.round(a.current_temperature) + '°' : '';
      var tt = a.temperature != null ? ' → ' + a.temperature + '°' : '';
      return (e.state === 'off' ? 'desligado' : (t + tt)) || e.state;
    }
    if (d === 'cover') {
      if (e.state === 'open') return 'aberta';
      if (e.state === 'closed') return 'fechada';
      return e.state;
    }
    if (d === 'lock') return e.state === 'locked' ? 'trancada' : 'destrancada';
    if (d === 'sensor' || d === 'binary_sensor') {
      var u = a.unit_of_measurement ? ' ' + a.unit_of_measurement : '';
      return e.state + u;
    }
    if (d === 'scene' || d === 'script') return '';
    if (e.state === 'on') return 'ligado';
    if (e.state === 'off') return 'desligado';
    return e.state;
  }

  function isOn(e) {
    return e.state === 'on' || e.state === 'open' || e.state === 'unlocked' ||
      e.state === 'playing' || (e.entity_id.indexOf('light.') === 0 && e.state === 'on');
  }

  function render() {
    renderCar();
    if (!S.pages.length) {
      el.grid.innerHTML = '';
      if (el.pageDots) el.pageDots.innerHTML = '';
      el.pageName.textContent = 'Nenhuma entidade';
      el.footPage.textContent = '';
      return;
    }
    var page = S.pages[S.pageIndex];
    el.pageName.textContent = (S.config && S.config.title ? S.config.title + ' · ' : '') + page.name;

    el.pageDots.innerHTML = '';
    S.pages.forEach(function (p, i) {
      var d = document.createElement('i');
      if (i === S.pageIndex) d.className = 'on';
      el.pageDots.appendChild(d);
    });

    el.grid.style.gridTemplateColumns = 'repeat(' + S.cols + ',1fr)';
    el.grid.innerHTML = '';

    page.entities.forEach(function (id, i) {
      var e = S.entities[id];
      if (!e) return;
      var d = id.split('.')[0];
      var tile = document.createElement('div');
      tile.className = 'tile ' + d + (isOn(e) ? ' on' : '') +
        (e.state === 'unavailable' ? ' unavailable' : '') +
        (i === S.focus ? ' focused' : '');
      tile.setAttribute('data-id', id);

      var ic = document.createElement('div');
      ic.className = 'icon';
      ic.innerHTML = svg(d);
      tile.appendChild(ic);

      var box = document.createElement('div');
      var nm = document.createElement('div');
      nm.className = 'name';
      nm.textContent = (e.attributes && e.attributes.friendly_name) || id;
      var st = document.createElement('div');
      st.className = 'state';
      st.textContent = stateText(e);
      box.appendChild(nm);
      box.appendChild(st);
      tile.appendChild(box);

      tile.addEventListener('click', function () {
        S.focus = i;
        activate();
      });

      el.grid.appendChild(tile);
    });

    var total = S.pages.length;
    el.footPage.textContent = 'página ' + (S.pageIndex + 1) + ' de ' + total;
  }

  function setFocus(i) {
    var page = S.pages[S.pageIndex];
    if (!page) return;
    var max = page.entities.length - 1;
    if (i < 0) i = 0;
    if (i > max) i = max;
    S.focus = i;
    var tiles = el.grid.children;
    for (var k = 0; k < tiles.length; k++) tiles[k].classList.toggle('focused', k === i);
  }

  function activate() {
    resetIdle();
    var page = S.pages[S.pageIndex];
    if (!page) return;
    var id = page.entities[S.focus];
    var e = S.entities[id];
    if (!e) return;
    if (e.state === 'unavailable') { toast('Entidade indisponível'); return; }
    toggleEntity(e);
  }

  /* ------------------------------------------------------------------ */
  /* páginas                                                           */
  /* ------------------------------------------------------------------ */
  function openPages() {
    resetIdle();
    S.pageFocus = S.pageIndex;
    renderPagesList();
    show('pages');
  }

  function renderPagesList() {
    el.pagesList.innerHTML = '';
    S.pages.forEach(function (p, i) {
      var d = document.createElement('div');
      d.className = 'page-item' + (i === S.pageFocus ? ' focused' : '');
      d.textContent = p.name + '  (' + p.entities.length + ')';
      d.addEventListener('click', function () { S.pageFocus = i; pickPage(); });
      el.pagesList.appendChild(d);
    });
  }

  function pickPage() {
    S.pageIndex = S.pageFocus;
    S.focus = 0;
    show('dashboard');
    render();
  }

  function moveFocusPageList(delta) {
    if (!S.pages.length) return;
    var next = S.pageFocus + delta;
    if (next < 0) next = 0;
    if (next > S.pages.length - 1) next = S.pages.length - 1;
    S.pageFocus = next;
    renderPagesList();
  }

  /* ------------------------------------------------------------------ */
  /* detalhe                                                           */
  /* ------------------------------------------------------------------ */
  function openDetail(id) {
    resetIdle();
    S.detailId = id;
    S.detailFocus = 0;
    renderDetail();
    show('detail');
  }

  function detailEntity() { return S.entities[S.detailId]; }

  function controlBtn(label, sub, action) {
    var d = document.createElement('div');
    d.className = 'ctrl';
    var b = document.createElement('div');
    b.className = 'big';
    b.textContent = label;
    var l = document.createElement('div');
    l.className = 'lbl';
    l.textContent = sub || '';
    d.appendChild(b);
    d.appendChild(l);
    d.addEventListener('click', action);
    return d;
  }

  function renderDetail() {
    var e = detailEntity();
    if (!e) { show('dashboard'); return; }
    var dom = e.entity_id.split('.')[0];
    el.detailIcon.innerHTML = svg(dom);
    el.detailName.textContent = (e.attributes && e.attributes.friendly_name) || e.entity_id;
    el.detailState.textContent = e.entity_id + '  ·  ' + stateText(e);

    var c = el.detailControls;
    c.innerHTML = '';
    var a = e.attributes || {};
    var id = e.entity_id;

    if (dom === 'light') {
      c.appendChild(controlBtn('−', 'brilho', function () {
        callService('light', 'turn_on', { entity_id: id, brightness_pct: Math.max(1, (Math.round((a.brightness || 255) / 2.55)) - 10) });
      }));
      c.appendChild(controlBtn(e.state === 'on' ? 'Apagar' : 'Acender', 'alternar', function () { toggleEntity(e); }));
      c.appendChild(controlBtn('+', 'brilho', function () {
        callService('light', 'turn_on', { entity_id: id, brightness_pct: Math.min(100, (Math.round((a.brightness || 255) / 2.55)) + 10) });
      }));
    } else if (dom === 'climate') {
      var tgt = a.temperature != null ? a.temperature : 21;
      c.appendChild(controlBtn('−', Math.round((tgt - 0.5) * 10) / 10 + '°', function () {
        callService('climate', 'set_temperature', { entity_id: id, temperature: tgt - 0.5 });
      }));
      c.appendChild(controlBtn(e.state === 'off' ? 'Ligar' : 'Desligar', 'modo', function () {
        callService('climate', e.state === 'off' ? 'turn_on' : 'turn_off', { entity_id: id });
      }));
      c.appendChild(controlBtn('+', Math.round((tgt + 0.5) * 10) / 10 + '°', function () {
        callService('climate', 'set_temperature', { entity_id: id, temperature: tgt + 0.5 });
      }));
    } else if (dom === 'media_player') {
      c.appendChild(controlBtn('⏮', 'anterior', function () { callService('media_player', 'media_previous_track', { entity_id: id }); }));
      c.appendChild(controlBtn(e.state === 'playing' ? '⏸' : '▶', 'play/pause', function () { toggleEntity(e); }));
      c.appendChild(controlBtn('⏭', 'próxima', function () { callService('media_player', 'media_next_track', { entity_id: id }); }));
      c.appendChild(controlBtn('−', 'volume', function () { callService('media_player', 'volume_down', { entity_id: id }); }));
      c.appendChild(controlBtn('Mudo', a.is_volume_muted ? 'ativado' : 'desativado', function () { callService('media_player', 'volume_mute', { entity_id: id, is_volume_muted: !a.is_volume_muted }); }));
      c.appendChild(controlBtn('+', 'volume', function () { callService('media_player', 'volume_up', { entity_id: id }); }));
    } else if (dom === 'cover') {
      c.appendChild(controlBtn('▲', 'abrir', function () { callService('cover', 'open_cover', { entity_id: id }); }));
      c.appendChild(controlBtn('■', 'parar', function () { callService('cover', 'stop_cover', { entity_id: id }); }));
      c.appendChild(controlBtn('▼', 'fechar', function () { callService('cover', 'close_cover', { entity_id: id }); }));
    } else if (dom === 'lock') {
      c.appendChild(controlBtn(e.state === 'locked' ? 'Destrancar' : 'Trancar', 'alternar', function () { toggleEntity(e); }));
    } else {
      c.appendChild(controlBtn(e.state === 'on' ? 'Desligar' : 'Ligar', 'alternar', function () { toggleEntity(e); }));
    }

    var interesting = ['brightness', 'color_temp', 'temperature', 'current_temperature',
      'hvac_mode', 'hvac_action', 'media_title', 'media_artist', 'app_name',
      'current_position', 'battery_level', 'unit_of_measurement', 'friendly_name'];
    var attrs = [];
    interesting.forEach(function (k) {
      if (a[k] != null && a[k] !== '') attrs.push([k, String(a[k])]);
    });
    el.detailAttrs.innerHTML = '';
    attrs.forEach(function (pair) {
      var row = document.createElement('div');
      var b = document.createElement('b');
      b.textContent = pair[0];
      var s = document.createElement('span');
      s.textContent = pair[1];
      row.appendChild(b);
      row.appendChild(s);
      el.detailAttrs.appendChild(row);
    });

    if (el.detailControls.children.length) {
      S.detailFocus = 0;
      highlightDetail();
    }
  }

  /* ------------------------------------------------------------------ */
  /* ajustes                                                           */
  /* ------------------------------------------------------------------ */
  function openSettings() {
    resetIdle();
    el.setServer.value = S.server;
    el.setCols.value = String(S.cols);
    el.setStatus.textContent = '';
    el.setStatus.className = 'status';
    show('settings');
  }

  function saveSettings() {
    var url = el.setServer.value.trim().replace(/\/+$/, '');
    if (!/^https?:\/\//.test(url)) url = 'http://' + url;
    S.server = url;
    S.cols = Math.max(2, Math.min(6, parseInt(el.setCols.value, 10) || 4));
    localStorage.setItem(LS_SERVER, S.server);
    localStorage.setItem(LS_COLS, String(S.cols));
    el.setStatus.textContent = 'salvo, recarregando...';
    el.setStatus.className = 'status ok';
    setTimeout(function () { location.reload(); }, 600);
  }

  function testSettings() {
    var url = el.setServer.value.trim().replace(/\/+$/, '');
    if (!/^https?:\/\//.test(url)) url = 'http://' + url;
    el.setStatus.textContent = 'testando...';
    el.setStatus.className = 'status';
    fetch(url + '/health').then(function (r) { return r.json(); }).then(function (j) {
      if (j && j.ok) {
        el.setStatus.textContent = 'ok · HA ' + (j.ha && j.ha.version ? j.ha.version : '');
        el.setStatus.className = 'status ok';
      } else {
        el.setStatus.textContent = 'resposta inesperada';
        el.setStatus.className = 'status bad';
      }
    }).catch(function (e) {
      el.setStatus.textContent = 'falhou: ' + e.message;
      el.setStatus.className = 'status bad';
    });
  }

  /* ------------------------------------------------------------------ */
  /* teclado                                                           */
  /* ------------------------------------------------------------------ */
  var KEY = { LEFT: 37, UP: 38, RIGHT: 39, DOWN: 40, ENTER: 13, BACK: 10009, BACK2: 461,
    RED: 403, GREEN: 404, YELLOW: 405, BLUE: 406, PLAY: 415, PAUSE: 19, PLAYPAUSE: 179,
    CH_UP: 427, CH_DOWN: 428 };

  function onKey(ev) {
    var k = ev.keyCode;
    var isCh = (k === 427 || k === 428 || ev.key === 'ChannelUp' || ev.key === 'ChannelDown');
    if ([37, 38, 39, 40, 13, 10009, 461, 403, 404, 405, 406, 415, 19, 179, 427, 428].indexOf(k) === -1 && !isCh) return;
    ev.preventDefault();
    resetIdle();

    if (S.screen === 'idle') { show('dashboard'); render(); return; }

    if (S.screen === 'setup') {
      if (k === KEY.ENTER) tryConnectFromSetup();
      return;
    }

    if (S.screen === 'settings') {
      if (k === KEY.BACK || k === KEY.BACK2 || k === KEY.GREEN) { show('dashboard'); render(); }
      return;
    }

    if (S.screen === 'pages') {
      if (k === KEY.BACK || k === KEY.BACK2 || k === KEY.RED) { show('dashboard'); render(); return; }
      if (k === KEY.LEFT || k === KEY.UP) moveFocusPageList(-1);
      if (k === KEY.RIGHT || k === KEY.DOWN) moveFocusPageList(1);
      if (k === KEY.ENTER) pickPage();
      return;
    }

    if (S.screen === 'detail') {
      if (k === KEY.BACK || k === KEY.BACK2) { show('dashboard'); render(); return; }
      if (k === KEY.LEFT) { S.detailFocus = Math.max(0, S.detailFocus - 1); highlightDetail(); }
      if (k === KEY.RIGHT) { S.detailFocus = Math.min(el.detailControls.children.length - 1, S.detailFocus + 1); highlightDetail(); }
      if (k === KEY.ENTER) {
        var c = el.detailControls.children[S.detailFocus];
        if (c) c.click();
      }
      return;
    }

    /* dashboard */
    if (k === KEY.LEFT) { moveGrid(-1); return; }
    if (k === KEY.RIGHT) { moveGrid(1); return; }
    if (k === KEY.UP) { moveGrid(-S.cols); return; }
    if (k === KEY.DOWN) { moveGrid(S.cols); return; }
    if (k === KEY.ENTER || k === KEY.PLAYPAUSE) { activate(); return; }
    if (k === KEY.BACK || k === KEY.BACK2) { openPages(); return; }
    if (k === KEY.RED) { openPages(); return; }
    if (k === KEY.GREEN) { openSettings(); return; }
    if (k === KEY.YELLOW) { refreshStates(); toast('Atualizando...'); return; }
    if (k === KEY.BLUE) { nextPage(); return; }
    if (k === KEY.CH_UP || ev.key === 'ChannelUp') { nextPage(); return; }
    if (k === KEY.CH_DOWN || ev.key === 'ChannelDown') { prevPage(); return; }
  }

  function moveGrid(delta) {
    var page = S.pages[S.pageIndex];
    if (!page) return;
    var next = S.focus + delta;
    if (next < 0) {
      if (delta < 0) { prevPage(); return; }
      next = 0;
    }
    if (next > page.entities.length - 1) {
      if (delta > 0) { nextPage(); return; }
      next = page.entities.length - 1;
    }
    setFocus(next);
  }

  function nextPage() {
    if (!S.pages.length) return;
    S.pageIndex = (S.pageIndex + 1) % S.pages.length;
    S.focus = 0;
    render();
  }

  function prevPage() {
    if (!S.pages.length) return;
    S.pageIndex = (S.pageIndex - 1 + S.pages.length) % S.pages.length;
    S.focus = 0;
    render();
  }

  function highlightDetail() {
    var kids = el.detailControls.children;
    for (var i = 0; i < kids.length; i++) kids[i].classList.toggle('focused', i === S.detailFocus);
  }

  /* ------------------------------------------------------------------ */
  /* setup                                                             */
  /* ------------------------------------------------------------------ */
  function tryConnectFromSetup() {
    var url = el.inpServer.value.trim().replace(/\/+$/, '');
    if (!url) { el.setupStatus.textContent = 'Informe o endereço do servidor.'; el.setupStatus.className = 'status bad'; return; }
    if (!/^https?:\/\//.test(url)) url = 'http://' + url;
    S.server = url;
    localStorage.setItem(LS_SERVER, url);
    el.setupStatus.textContent = 'conectando em ' + url + ' ...';
    el.setupStatus.className = 'status';
    getConfig().then(function () { return refreshStates(false); }).then(function (ok) {
      if (ok) { show('dashboard'); render(); }
    });
  }

  /* ------------------------------------------------------------------ */
  /* boot                                                              */
  /* ------------------------------------------------------------------ */
  function boot() {
    el.inpServer.value = S.server;
    show('setup');
    el.setupStatus.textContent = 'conectando em ' + S.server + ' ...';
    el.setupStatus.className = 'status';

    getConfig().then(function () {
      return refreshStates(false);
    }).then(function (ok) {
      if (!ok) return;
      show('dashboard');
      render();
      resetIdle();
      S.timer = setInterval(function () {
        if (S.screen === 'dashboard' || S.screen === 'pages') refreshStates(true);
      }, (S.config && S.config.pollMs) || 4000);
    });
  }

  document.addEventListener('keydown', onKey);
  $('btn-save').addEventListener('click', tryConnectFromSetup);
  $('btn-retry').addEventListener('click', tryConnectFromSetup);
  $('inp-server').addEventListener('keydown', function (ev) {
    if (ev.keyCode === 13) { ev.stopPropagation(); tryConnectFromSetup(); }
  });
  $('set-save').addEventListener('click', saveSettings);
  $('set-test').addEventListener('click', testSettings);

  try {
    if (window.tizen && tizen.tvinputdevice) {
      ['MediaPlayPause', 'MediaPlay', 'MediaPause', 'ColorF0Red', 'ColorF1Green', 'ColorF2Yellow', 'ColorF3Blue', 'ChannelUp', 'ChannelDown']
        .forEach(function (k) { try { tizen.tvinputdevice.registerKey(k); } catch (e) {} });
    }
  } catch (e) {}

  boot();
})();
