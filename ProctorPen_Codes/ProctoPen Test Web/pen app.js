// ============================================================
//  Proctopen — app.js  v3
//  Fixes:
//  - Units cleared when reconnecting to ESP32
//  - Disconnected units show as 'inactive' not removed
//  - Inactive units have a dismiss button to remove manually
//  - Unit count badge only counts active units
// ============================================================

const BLE_SVC = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
const BLE_RX  = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';
const BLE_TX  = '6e400003-b5a3-f393-e0a9-e50e24dcca9e';

// ── App state ────────────────────────────────────────────────
const S = {
  mode:        null,
  connected:   false,
  remainingMs: 0,
  running:     false,
  paused:      false,
  units:       {},      // id → { id, status, via }
  activeUnit:  null,
};

// ── Transport ────────────────────────────────────────────────
let ws  = null;
let ble = { device: null, rx: null, tx: null };

// ── Timer ────────────────────────────────────────────────────
let ticker   = null;
let lastTick = 0;

// ── DOM ──────────────────────────────────────────────────────
const $  = id => document.getElementById(id);

const E = {
  pageLanding: $('page-landing'),
  pageSetup:   $('page-setup'),
  pageDash:    $('page-dash'),
  modeCards:   document.querySelectorAll('.mode-card'),
  backBtn:     $('back-btn'),
  secBle:      $('sec-ble'),
  secAp:       $('sec-ap'),
  secSta:      $('sec-sta'),
  bleBtn:      $('ble-btn'),
  apBtn:       $('ap-btn'),
  staBtn:      $('sta-btn'),
  setupDot:    $('setup-dot'),
  setupStatus: $('setup-status-text'),
  modeChip:    $('mode-chip'),
  staChip:     $('sta-chip'),
  hdrDot:      $('hdr-dot'),
  disconnBtn:  $('disconnect-btn'),
  inpH:        $('inp-h'),
  inpM:        $('inp-m'),
  inpS:        $('inp-s'),
  setTimerBtn: $('set-timer-btn'),
  bigTimer:    $('big-timer'),
  startBtn:    $('start-btn'),
  pauseBtn:    $('pause-btn'),
  endBtn:      $('end-btn'),
  resetBtn:    $('reset-btn'),
  unitCount:   $('unit-count'),
  unitsList:   $('units-list'),
  rawInp:      $('raw-inp'),
  rawBtn:      $('raw-btn'),
  log:         $('log'),
  clearLogBtn: $('clear-log-btn'),
  modalBg:       $('modal-bg'),
  modalTitle:    $('modal-title'),
  modalClose:    $('modal-close'),
  mWarnBtn:      $('m-warn-btn'),
  mDisableBtn:   $('m-disable-btn'),
  mEnableBtn:    $('m-enable-btn'),
  mDeductBtn:    $('m-deduct-btn'),
  mPunish:       $('m-punish'),
  mDeduct:       $('m-deduct'),
};

// ============================================================
//  Theme
// ============================================================
function toggleTheme() {
  const html = document.documentElement;
  html.setAttribute('data-theme',
    html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
}
['theme-btn-1','theme-btn-2','theme-btn-3'].forEach(id => {
  $(id)?.addEventListener('click', toggleTheme);
});

// ============================================================
//  Page navigation
// ============================================================
function showPage(name) {
  [E.pageLanding, E.pageSetup, E.pageDash].forEach(p =>
    p.classList.add('hidden'));
  ({ landing: E.pageLanding, setup: E.pageSetup, dash: E.pageDash }
  )[name].classList.remove('hidden');
}

E.modeCards.forEach(card => {
  card.addEventListener('click', () => {
    S.mode = card.dataset.pick;
    [E.secBle, E.secAp, E.secSta].forEach(s => s.classList.add('hidden'));
    ({ ble: E.secBle, ap: E.secAp, sta: E.secSta })[S.mode]
      .classList.remove('hidden');
    setSetupStatus('', 'Not connected');
    showPage('setup');
  });
});

E.backBtn.addEventListener('click', () => {
  disconnect();
  showPage('landing');
});

// ============================================================
//  Connect buttons
// ============================================================
E.bleBtn.addEventListener('click', connectBLE);
E.apBtn.addEventListener('click',  () => connectWS('proctopen.local'));
E.staBtn.addEventListener('click', () => connectWS('proctopen.local'));

// ============================================================
//  WebSocket
// ============================================================
function connectWS(host) {
  setSetupStatus('connecting', `Connecting to ${host}…`);
  try {
    ws = new WebSocket(`ws://${host}/ws`);
    ws.onopen    = () => { send({ cmd: 'set_mode', mode: S.mode }); onConnected(); };
    ws.onmessage = e => onMessage(e.data);
    ws.onerror   = () => { log('err', 'WebSocket error'); disconnect(); };
    ws.onclose   = () => { if (S.connected) { disconnect(); log('sys', 'Connection closed'); } };
  } catch(e) {
    log('err', 'WebSocket failed: ' + e.message);
    setSetupStatus('', 'Connection failed');
  }
}

// ============================================================
//  BLE
// ============================================================
async function connectBLE() {
  if (!navigator.bluetooth) {
    log('err', 'Web Bluetooth not supported. Use Chrome or Edge.');
    return;
  }
  try {
    setSetupStatus('connecting', 'Scanning for Proctopen…');
    ble.device = await navigator.bluetooth.requestDevice({
      filters: [{ name: 'Proctopen' }],
      optionalServices: [BLE_SVC],
    });
    ble.device.addEventListener('gattserverdisconnected', () => {
      log('sys', 'BLE disconnected');
      disconnect();
    });
    const server  = await ble.device.gatt.connect();
    const service = await server.getPrimaryService(BLE_SVC);
    ble.rx = await service.getCharacteristic(BLE_RX);
    ble.tx = await service.getCharacteristic(BLE_TX);
    await ble.tx.startNotifications();
    ble.tx.addEventListener('characteristicvaluechanged', e =>
      onMessage(new TextDecoder().decode(e.target.value)));
    onConnected();
  } catch(e) {
    log('err', 'BLE error: ' + e.message);
    setSetupStatus('', 'Bluetooth failed');
  }
}

// ============================================================
//  Connected / Disconnected
// ============================================================
function onConnected() {
  S.connected = true;

  // Clear any stale units from a previous session
  S.units = {};
  renderUnits();

  const labels = { ble: 'Bluetooth', ap: 'WiFi AP', sta: 'WiFi STA' };
  E.modeChip.textContent = labels[S.mode] || S.mode;
  log('sys', `Connected — ${labels[S.mode]}`);
  showPage('dash');
}

function disconnect() {
  S.connected  = false;
  S.running    = false;
  stopTicker();

  if (ws)  { try { ws.close(); } catch(e) {} ws = null; }
  if (ble.device?.gatt?.connected) {
    try { ble.device.gatt.disconnect(); } catch(e) {}
  }
  ble = { device: null, rx: null, tx: null };

  E.modeChip.textContent  = '—';
  E.staChip.style.display = 'none';
  showPage('setup');
  setSetupStatus('', 'Disconnected');
}

E.disconnBtn.addEventListener('click', () => {
  disconnect();
  showPage('landing');
});

// ============================================================
//  Send JSON
// ============================================================
function send(obj) {
  if (!S.connected) { log('err', 'Not connected'); return false; }
  const json = JSON.stringify(obj);
  try {
    if (S.mode !== 'ble' && ws?.readyState === WebSocket.OPEN) {
      ws.send(json);
    } else if (S.mode === 'ble' && ble.rx) {
      ble.rx.writeValueWithoutResponse(new TextEncoder().encode(json));
    } else {
      log('err', 'Transport not ready'); return false;
    }
    log('out', json);
    return true;
  } catch(e) {
    log('err', 'Send error: ' + e.message);
    return false;
  }
}

// ============================================================
//  Receive message from ESP32
// ============================================================
function onMessage(raw) {
  raw = raw.trim();
  if (!raw) return;
  log('in', raw);

  let msg;
  try { msg = JSON.parse(raw); } catch(e) { return; }

  switch (msg.event) {

  case 'heartbeat':
    if (msg.mode) E.modeChip.textContent = msg.mode;
    if (msg.sta_connected === true) E.staChip.style.display = '';
    if (S.running && typeof msg.remaining_ms === 'number') {
      if (Math.abs(msg.remaining_ms - S.remainingMs) > 1000)
        S.remainingMs = msg.remaining_ms;
    }
    // Sync unit list — handles units connected before web app joined
    if (Array.isArray(msg.units)) {
      const liveIds = msg.units.map(u => String(u.id));
      // Add any units we don't know about yet
      msg.units.forEach(u => {
        if (!S.units[u.id]) {
          S.units[u.id] = { id: u.id, status: 'active', via: u.via };
        } else if (S.units[u.id].status === 'inactive') {
          S.units[u.id].status = 'active';
          S.units[u.id].via    = u.via;
        }
      });
      // Mark units no longer in ESP32 list as inactive
      Object.keys(S.units).forEach(id => {
        if (!liveIds.includes(id) && S.units[id].status === 'active') {
          S.units[id].status = 'inactive';
        }
      });
      renderUnits();
    }
    break;

    case 'wemos_connected':
      // If a unit with this ID was inactive, bring it back active
      if (S.units[msg.id]) {
        S.units[msg.id].status = 'active';
        S.units[msg.id].via    = msg.via || 'ap';
      } else {
        S.units[msg.id] = { id: msg.id, status: 'active', via: msg.via || 'ap' };
      }
      renderUnits();
      log('sys', `Unit #${msg.id} connected via ${msg.via}`);
      break;

    case 'wemos_disconnected':
      // Mark as inactive instead of removing
      if (S.units[msg.id]) {
        S.units[msg.id].status = 'inactive';
        renderUnits();
      }
      log('sys', `Unit #${msg.id} disconnected`);
      break;

    case 'started':
      S.running = true; S.paused = false;
      E.bigTimer.classList.remove('warning', 'ended');
      startTicker();
      break;

    case 'paused':
      S.running = false; S.paused = true;
      stopTicker();
      break;

    case 'ended':
    case 'timeup':
      S.running = false; S.paused = false;
      S.remainingMs = 0;
      stopTicker(); renderTimer();
      E.bigTimer.classList.add('ended');
      break;

    case 'reset':
      S.running = false; S.paused = false;
      S.remainingMs = 0;
      stopTicker(); renderTimer();
      E.bigTimer.classList.remove('warning', 'ended');
      break;

    case 'wifi_forgotten':
      log('sys', 'WiFi credentials cleared on ESP32');
      E.staChip.style.display = 'none';
      break;
  }
}

// ============================================================
//  Exam controls
// ============================================================
E.setTimerBtn.addEventListener('click', () => {
  const h  = parseInt(E.inpH.value) || 0;
  const m  = parseInt(E.inpM.value) || 0;
  const s  = parseInt(E.inpS.value) || 0;
  const ms = (h * 3600 + m * 60 + s) * 1000;
  if (ms <= 0) { log('err', 'Duration must be greater than 0'); return; }
  S.remainingMs = ms;
  E.bigTimer.classList.remove('warning', 'ended');
  renderTimer();
  send({ cmd: 'timer', duration_ms: ms });
});

E.startBtn.addEventListener('click', () => {
  if (!S.remainingMs) { log('err', 'Set a timer first'); return; }
  send({ cmd: 'start' });
  S.running = true; S.paused = false;
  E.bigTimer.classList.remove('warning', 'ended');
  startTicker();
});

E.pauseBtn.addEventListener('click', () => {
  send({ cmd: 'pause' });
  S.running = false; S.paused = true;
  stopTicker();
});

E.endBtn.addEventListener('click', () => {
  if (!confirm('End the exam for all units?')) return;
  send({ cmd: 'end' });
  S.running = false; S.remainingMs = 0;
  stopTicker(); renderTimer();
  E.bigTimer.classList.add('ended');
});

E.resetBtn.addEventListener('click', () => {
  send({ cmd: 'reset' });
  S.running = false; S.paused = false;
  S.remainingMs = 0;
  stopTicker(); renderTimer();
  E.bigTimer.classList.remove('warning', 'ended');
});

// ============================================================
//  Raw JSON
// ============================================================
E.rawBtn.addEventListener('click', () => {
  const raw = E.rawInp.value.trim();
  if (!raw) return;
  try { send(JSON.parse(raw)); E.rawInp.value = ''; }
  catch(e) { log('err', 'Invalid JSON: ' + e.message); }
});
E.rawInp.addEventListener('keydown', e => {
  if (e.key === 'Enter') E.rawBtn.click();
});

// ============================================================
//  Local countdown ticker
// ============================================================
function startTicker() {
  stopTicker();
  lastTick = Date.now();
  ticker   = setInterval(() => {
    const now     = Date.now();
    const elapsed = now - lastTick;
    lastTick = now;
    S.remainingMs = Math.max(0, S.remainingMs - elapsed);
    renderTimer();
    if (S.remainingMs <= 0) {
      stopTicker();
      E.bigTimer.classList.add('ended');
    } else if (S.remainingMs < 5 * 60 * 1000) {
      E.bigTimer.classList.add('warning');
    }
  }, 250);
}

function stopTicker() {
  if (ticker) { clearInterval(ticker); ticker = null; }
}

function renderTimer() {
  const ms = S.remainingMs;
  const h  = Math.floor(ms / 3600000);
  const m  = Math.floor((ms % 3600000) / 60000);
  const s  = Math.floor((ms % 60000)   / 1000);
  E.bigTimer.textContent = h > 0
    ? `${pad(h)}:${pad(m)}:${pad(s)}`
    : `${pad(m)}:${pad(s)}`;
}

function pad(n) { return String(n).padStart(2, '0'); }

// ============================================================
//  Unit cards
// ============================================================
function renderUnits() {
  const ids = Object.keys(S.units);

  // Badge shows only active units
  const activeCount = ids.filter(id => S.units[id].status === 'active').length;
  E.unitCount.textContent = activeCount;

  if (!ids.length) {
    E.unitsList.innerHTML = '<p class="empty-note">No units connected yet.</p>';
    return;
  }

  E.unitsList.innerHTML = '';
  ids.forEach(id => {
    const u   = S.units[id];
    const row = document.createElement('div');
    row.className = 'unit-row';

    const isInactive = u.status === 'inactive' || u.status === 'disabled';

    row.innerHTML = `
      <span class="unit-id">Unit #${u.id}</span>
      <span class="unit-via">${u.via || 'ap'}</span>
      <span class="unit-status ${u.status}">${u.status}</span>
      <div class="unit-actions">
        ${u.status !== 'inactive'
          ? `<button class="btn-ghost small" data-uid="${u.id}" data-action="actions">Actions</button>`
          : ''}
        ${u.status === 'inactive'
          ? `<button class="btn-ghost small" data-uid="${u.id}" data-action="dismiss">Dismiss</button>`
          : ''}
      </div>`;

    row.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.dataset.action === 'actions') openModal(u.id);
        if (btn.dataset.action === 'dismiss') dismissUnit(u.id);
      });
    });

    E.unitsList.appendChild(row);
  });
}

function dismissUnit(id) {
  delete S.units[id];
  renderUnits();
  log('sys', `Unit #${id} dismissed`);
}

// ============================================================
//  Modal
// ============================================================
function openModal(id) {
  S.activeUnit = id;
  E.modalTitle.textContent = `Unit #${id} — actions`;
  E.mPunish.value = '';
  E.mDeduct.value = '';
  E.modalBg.classList.remove('hidden');
}

function closeModal() {
  E.modalBg.classList.add('hidden');
  S.activeUnit = null;
}

E.modalClose.addEventListener('click', closeModal);
E.modalBg.addEventListener('click', e => {
  if (e.target === E.modalBg) closeModal();
});

E.mWarnBtn.addEventListener('click', () => {
  send({ cmd: 'warn', device_id: S.activeUnit });
});

E.mDisableBtn.addEventListener('click', () => {
  const obj = { cmd: 'disable', device_id: S.activeUnit };
  const p   = parseInt(E.mPunish.value) || 0;
  if (p > 0) obj.punish_ms = p * 1000;
  send(obj);
  if (S.units[S.activeUnit]) {
    S.units[S.activeUnit].status = 'disabled';
    renderUnits();
  }
});

E.mEnableBtn.addEventListener('click', () => {
  send({ cmd: 'enable', device_id: S.activeUnit });
  if (S.units[S.activeUnit]) {
    S.units[S.activeUnit].status = 'active';
    renderUnits();
  }
});

E.mDeductBtn.addEventListener('click', () => {
  const s = parseInt(E.mDeduct.value);
  if (!s || s <= 0) { log('err', 'Enter seconds to deduct'); return; }
  send({ cmd: 'deduct', device_id: S.activeUnit, time_ms: s * 1000 });
});

// ============================================================
//  Log
// ============================================================
function log(tag, msg) {
  const now  = new Date();
  const t    = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  const line = document.createElement('div');
  line.className = 'log-line';
  line.innerHTML =
    `<span class="log-t">${t}</span>` +
    `<span class="log-tag ${tag}">${tag.toUpperCase()}</span>` +
    `<span class="log-msg">${esc(msg)}</span>`;
  E.log.appendChild(line);
  E.log.scrollTop = E.log.scrollHeight;
}

function esc(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

E.clearLogBtn.addEventListener('click', () => { E.log.innerHTML = ''; });

// ============================================================
//  Setup status helper
// ============================================================
function setSetupStatus(dotClass, text) {
  E.setupDot.className      = 'dot' + (dotClass ? ' ' + dotClass : '');
  E.setupStatus.textContent = text;
}

// ============================================================
//  Init
// ============================================================
renderTimer();
renderUnits();
showPage('landing');
