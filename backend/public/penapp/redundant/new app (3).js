// ============================================================
//  Proctopen — app.js  v5
//  Changes from v4:
//  - Seats NOT saved/restored across sessions (fresh every time)
//  - Student name/photo still persists across sessions
//  - Dragging unit onto occupied cell swaps the two units
//  - Drag occupied cell back to tray to unassign
//  - ↕ Move button on each cell for click-to-move workflow
//  - Units marked inactive on disconnect (not removed)
// ============================================================

const BLE_SVC = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
const BLE_RX  = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';
const BLE_TX  = '6e400003-b5a3-f393-e0a9-e50e24dcca9e';

// ── Dummy student database (Fixed Wemos mode) ────────────────
const STUDENT_DB = [
  { mac: 'AA:BB:CC:DD:EE:01', name: 'Alek Rahman',   id: 'STU-001', photo: 'https://i.pravatar.cc/150?img=1' },
  { mac: 'AA:BB:CC:DD:EE:02', name: 'Sara Ahmed',    id: 'STU-002', photo: 'https://i.pravatar.cc/150?img=5' },
  { mac: 'AA:BB:CC:DD:EE:03', name: 'Karim Hossain', id: 'STU-003', photo: 'https://i.pravatar.cc/150?img=8' },
];

// ── App state ────────────────────────────────────────────────
const S = {
  connMode:    null,
  examMode:    'roll',
  connected:   false,
  remainingMs: 0,
  running:     false,
  paused:      false,
  gridRows:    3,
  gridCols:    4,
  units:       {},   // mac → { id, mac, status, via, seatNumber, studentName, studentId, studentPhoto }
  seats:       {},   // seatNumber → mac
  activeUnit:  null, // mac of unit in modal
  dragMac:     null, // mac being dragged
  moveMac:     null, // mac in click-to-move mode
};

// ── Storage keys (only student info persists, not seats) ─────
const STORAGE_STUDENTS = 'proctopen-students';

// ── Transport ────────────────────────────────────────────────
let ws           = null;
let ble          = { device: null, rx: null, tx: null };
let serialPort   = null;
let serialReader = null;
let serialWriter = null;

// ── Timer ────────────────────────────────────────────────────
let ticker   = null;
let lastTick = 0;

// ── DOM ──────────────────────────────────────────────────────
const $ = id => document.getElementById(id);

const E = {
  pageLanding:   $('page-landing'),
  pageSetup:     $('page-setup'),
  pageDash:      $('page-dash'),
  modeCards:     document.querySelectorAll('.mode-card'),
  backBtn:       $('back-btn'),
  secBle:        $('sec-ble'),
  secAp:         $('sec-ap'),
  secSta:        $('sec-sta'),
  secUsb:        $('sec-usb'),
  secExamConfig: $('sec-exam-config'),
  bleBtn:        $('ble-btn'),
  apBtn:         $('ap-btn'),
  staBtn:        $('sta-btn'),
  usbBtn:        $('usb-btn'),
  modeToggle:    $('mode-toggle'),
  gridRows:      $('grid-rows'),
  gridCols:      $('grid-cols'),
  setupDot:      $('setup-dot'),
  setupStatus:   $('setup-status-text'),
  modeChip:      $('mode-chip'),
  staChip:       $('sta-chip'),
  examModeChip:  $('exam-mode-chip'),
  hdrDot:        $('hdr-dot'),
  disconnBtn:    $('disconnect-btn'),
  inpH:          $('inp-h'),
  inpM:          $('inp-m'),
  inpS:          $('inp-s'),
  setTimerBtn:   $('set-timer-btn'),
  bigTimer:      $('big-timer'),
  startBtn:      $('start-btn'),
  pauseBtn:      $('pause-btn'),
  endBtn:        $('end-btn'),
  resetBtn:      $('reset-btn'),
  unitCount:     $('unit-count'),
  trayUnits:     $('tray-units'),
  seatGrid:      $('seat-grid'),
  gridHint:      $('grid-hint'),
  rawInp:        $('raw-inp'),
  rawBtn:        $('raw-btn'),
  log:           $('log'),
  clearLogBtn:   $('clear-log-btn'),
  modalBg:       $('modal-bg'),
  modalTitle:    $('modal-title'),
  modalSubtitle: $('modal-subtitle'),
  modalClose:    $('modal-close'),
  modalStudentInfo:      $('modal-student-info'),
  modalFixedInfo:        $('modal-fixed-info'),
  modalPhoto:            $('modal-photo'),
  modalPhotoPlaceholder: $('modal-photo-placeholder'),
  modalName:             $('modal-name'),
  modalStudentId:        $('modal-student-id'),
  modalSaveStudent:      $('modal-save-student'),
  modalFixedPhoto:       $('modal-fixed-photo'),
  modalFixedName:        $('modal-fixed-name'),
  modalFixedId:          $('modal-fixed-id'),
  mBeepBtn:    $('m-beep-btn'),
  mWarnBtn:    $('m-warn-btn'),
  mDisableBtn: $('m-disable-btn'),
  mEnableBtn:  $('m-enable-btn'),
  mDeductBtn:  $('m-deduct-btn'),
  mPunish:     $('m-punish'),
  mDeduct:     $('m-deduct'),
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
//  Student info persistence (seats are NOT persisted)
// ============================================================
function loadStudentInfo() {
  try {
    const raw = localStorage.getItem(STORAGE_STUDENTS);
    if (!raw) return;
    const saved = JSON.parse(raw);
    Object.keys(saved).forEach(mac => {
      if (!S.units[mac]) S.units[mac] = { mac, status: 'offline' };
      S.units[mac].studentName  = saved[mac].name;
      S.units[mac].studentId    = saved[mac].id;
      S.units[mac].studentPhoto = saved[mac].photo;
    });
  } catch(e) {}
}

function saveStudentInfo(mac, name, id, photo) {
  try {
    const raw  = localStorage.getItem(STORAGE_STUDENTS);
    const data = raw ? JSON.parse(raw) : {};
    data[mac]  = { name, id, photo: photo || '' };
    localStorage.setItem(STORAGE_STUDENTS, JSON.stringify(data));
  } catch(e) {}
}

// ============================================================
//  Page navigation
// ============================================================
function showPage(name) {
  [E.pageLanding, E.pageSetup, E.pageDash].forEach(p =>
    p.classList.add('hidden'));
  ({ landing: E.pageLanding, setup: E.pageSetup, dash: E.pageDash })[name]
    .classList.remove('hidden');
}

E.modeCards.forEach(card => {
  card.addEventListener('click', () => {
    S.connMode = card.dataset.pick;
    [E.secBle, E.secAp, E.secSta, E.secUsb].forEach(s => s.classList.add('hidden'));
    ({ ble: E.secBle, ap: E.secAp, sta: E.secSta, usb: E.secUsb })[S.connMode]
      ?.classList.remove('hidden');
    E.secExamConfig.classList.remove('hidden');
    setSetupStatus('', 'Not connected');
    showPage('setup');
  });
});

E.backBtn.addEventListener('click', () => { disconnect(); showPage('landing'); });

// ============================================================
//  Connect buttons
// ============================================================
E.bleBtn.addEventListener('click', connectBLE);
E.apBtn.addEventListener('click',  () => connectWS('proctopen.local'));
E.staBtn.addEventListener('click', () => connectWS('proctopen.local'));
E.usbBtn.addEventListener('click', connectUSB);

// ============================================================
//  WebSocket
// ============================================================
function connectWS(host) {
  setSetupStatus('connecting', `Connecting to ${host}…`);
  try {
    ws = new WebSocket(`ws://${host}/ws`);
    ws.onopen    = () => { send({ cmd: 'set_mode', mode: S.connMode }); onConnected(); };
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
    log('err', 'Web Bluetooth not supported. Use Chrome or Edge.'); return;
  }
  try {
    setSetupStatus('connecting', 'Scanning for Proctopen…');
    ble.device = await navigator.bluetooth.requestDevice({
      filters: [{ name: 'Proctopen' }], optionalServices: [BLE_SVC],
    });
    ble.device.addEventListener('gattserverdisconnected', () => {
      log('sys', 'BLE disconnected'); disconnect();
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
//  USB Serial
// ============================================================
async function connectUSB() {
  if (!navigator.serial) {
    log('err', 'Web Serial not supported. Use Chrome or Edge.'); return;
  }
  try {
    setSetupStatus('connecting', 'Selecting serial port…');
    serialPort = await navigator.serial.requestPort();
    await serialPort.open({ baudRate: 115200 });
    serialWriter = serialPort.writable.getWriter();

    const decoder = new TextDecoderStream();
    serialPort.readable.pipeTo(decoder.writable);
    serialReader = decoder.readable.getReader();

    (async () => {
      let buf = '';
      try {
        while (true) {
          const { value, done } = await serialReader.read();
          if (done) break;
          buf += value;
          let nl;
          while ((nl = buf.indexOf('\n')) !== -1) {
            const line = buf.slice(0, nl).trim();
            buf = buf.slice(nl + 1);
            if (line) onMessage(line);
          }
        }
      } catch(e) {
        if (S.connected) { log('sys', 'USB disconnected'); disconnect(); }
      }
    })();

    onConnected();
  } catch(e) {
    log('err', 'USB Serial failed: ' + e.message);
    setSetupStatus('', 'Connection failed');
  }
}

// ============================================================
//  Connected / Disconnected
// ============================================================
function onConnected() {
  S.connected = true;
  S.examMode  = E.modeToggle.checked ? 'fixed' : 'roll';
  S.gridRows  = parseInt(E.gridRows.value) || 3;
  S.gridCols  = parseInt(E.gridCols.value) || 4;

  // Fresh session — no seat assignments, no unit state
  S.seats   = {};
  S.units   = {};
  S.dragMac = null;
  S.moveMac = null;

  // Load only student name/photo info (not seats)
  loadStudentInfo();
  buildGrid();





  const labels = { ble: 'Bluetooth', ap: 'WiFi AP', sta: 'WiFi STA', usb: 'USB' };
  E.modeChip.textContent     = labels[S.connMode] || S.connMode;
  E.examModeChip.textContent = S.examMode === 'fixed' ? 'Fixed' : 'Roll Call';
  log('sys', `Connected — ${labels[S.connMode]} — ${S.examMode === 'fixed' ? 'Fixed Wemos' : 'Roll Call'}`);
  showPage('dash');


}

function disconnect() {
  S.connected = false;
  S.running   = false;
  stopTicker();

  if (ws) { try { ws.close(); } catch(e) {} ws = null; }
  if (ble.device?.gatt?.connected) {
    try { ble.device.gatt.disconnect(); } catch(e) {}
  }
  ble = { device: null, rx: null, tx: null };

  if (serialReader) { try { serialReader.cancel(); } catch(e) {} serialReader = null; }
  if (serialWriter) { try { serialWriter.releaseLock(); } catch(e) {} serialWriter = null; }
  if (serialPort)   { try { serialPort.close(); } catch(e) {} serialPort = null; }

  E.modeChip.textContent  = '—';
  E.staChip.style.display = 'none';
  showPage('setup');
  setSetupStatus('', 'Disconnected');
}

E.disconnBtn.addEventListener('click', () => { disconnect(); showPage('landing'); });

// ============================================================
//  Send JSON
// ============================================================
async function send(obj) {
  if (!S.connected) { log('err', 'Not connected'); return false; }
  const json = JSON.stringify(obj);
  try {
    if (S.connMode === 'usb' && serialWriter) {
      await serialWriter.write(new TextEncoder().encode(json + '\n'));
    } else if (S.connMode !== 'ble' && ws?.readyState === WebSocket.OPEN) {
      ws.send(json);
    } else if (S.connMode === 'ble' && ble.rx) {
      ble.rx.writeValueWithoutResponse(new TextEncoder().encode(json));
    } else {
      log('err', 'Transport not ready'); return false;
    }
    log('out', json);
    return true;
  } catch(e) {
    log('err', 'Send error: ' + e.message); return false;
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
      if (Array.isArray(msg.units)) {
        const liveMacs = msg.units.map(u => u.mac).filter(Boolean);
        
        msg.units.forEach(u => {
          if (!u.mac) return;
          if (!S.units[u.mac]) S.units[u.mac] = { mac: u.mac };
          if (u.id) S.units[u.mac].id = u.id;
          S.units[u.mac].status = 'active';
        });

        Object.keys(S.units).forEach(mac => {
          if (!liveMacs.includes(mac) && S.units[mac].status === 'active')
            S.units[mac].status = 'inactive';
        });
        
        // Only re-render if the user isn't moving something
        if (!S.dragMac && !S.moveMac) {
            renderGrid();
        }
      }
      break;

    case 'wemos_connected': {
      const mac = msg.mac;
      if (!mac) break;
      if (!S.units[mac]) S.units[mac] = { mac };
      S.units[mac].id     = msg.id;
      S.units[mac].via    = msg.via;
      S.units[mac].status = 'active';
      maybeAutoPlace(mac);
      renderGrid();
      log('sys', `Unit #${msg.id} (${mac}) connected via ${msg.via}`);
      break;
    }

    case 'wemos_disconnected': {
      const mac = msg.mac;
      if (mac && S.units[mac]) {
        S.units[mac].status = 'inactive';
        renderGrid();
      }
      log('sys', `Unit #${msg.id} (${mac || '?'}) disconnected`);
      break;
    }

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
//  Auto-place (fixed mode only — roll call is always manual)
// ============================================================
function maybeAutoPlace(mac) {
  if (S.units[mac]?.seatNumber) return; // already seated

  if (S.examMode === 'fixed') {
    const student = STUDENT_DB.find(s => s.mac === mac);
    if (student) {
      S.units[mac].studentName  = student.name;
      S.units[mac].studentId    = student.id;
      S.units[mac].studentPhoto = student.photo;
      const total = S.gridRows * S.gridCols;
      for (let seat = 1; seat <= total; seat++) {
        if (!S.seats[seat]) { assignSeat(mac, seat); break; }
      }
    }
  }
}

// ============================================================
//  Seat assignment — supports swap
//  If targetSeat is already occupied, the two units swap.
// ============================================================
function assignSeat(mac, targetSeat) {
  const existingMac = S.seats[targetSeat] || null;

  // Find where mac currently sits (if anywhere)
  const currentSeat = S.units[mac]?.seatNumber || null;

  if (existingMac && existingMac !== mac) {
    // Swap: put existing unit into mac's old seat (or unassign if mac had none)
    if (currentSeat) {
      S.seats[currentSeat]              = existingMac;
      S.units[existingMac].seatNumber   = currentSeat;
      // Tell Wemos its new seat
      if (S.units[existingMac].id && S.units[existingMac].status === 'active')
        send({ cmd: 'seat', device_id: S.units[existingMac].id, number: currentSeat });
    } else {
      // Mac was unassigned — existing unit becomes unassigned
      // delete S.seats[currentSeat];
      S.units[existingMac].seatNumber = null;
    }
  } else if (currentSeat) {
    // Just moving — clear old seat
    delete S.seats[currentSeat];
  }

  // Place mac in target seat
  S.seats[targetSeat]      = mac;
  S.units[mac].seatNumber  = targetSeat;

  // Tell Wemos its seat number
  if (S.units[mac].id && S.units[mac].status === 'active')
    send({ cmd: 'seat', device_id: S.units[mac].id, number: targetSeat });
}

function unassignSeat(mac) {
  const unit = S.units[mac];
  if (!unit) return;
  if (unit.seatNumber) {
    delete S.seats[unit.seatNumber];
  }
  unit.seatNumber = null;
}

// ============================================================
//  Cancel move mode
// ============================================================
function cancelMoveMode() {
  S.moveMac = null;
  E.seatGrid.querySelectorAll('.seat-cell')
    .forEach(c => c.classList.remove('move-target'));
  E.trayUnits.classList.remove('move-target');
}

// ============================================================
//  Build grid (called once on connect)
// ============================================================
function buildGrid() {
  const grid = E.seatGrid;
  grid.style.gridTemplateColumns = `repeat(${S.gridCols}, 1fr)`;
  grid.innerHTML = '';

  // Rows rendered high→low so row 1 appears at bottom (closest to proctor)
  for (let row = S.gridRows; row >= 1; row--) {
    for (let col = 1; col <= S.gridCols; col++) {
      const seatNum = (row - 1) * S.gridCols + col;
      const cell    = document.createElement('div');
      cell.className    = 'seat-cell';
      cell.dataset.seat = seatNum;
      cell.innerHTML    = `<span class="seat-number">S${seatNum}</span>
                           <span class="seat-empty-label">Empty</span>`;

      // ── Drag-over / drop ────────────────────────────────
      cell.addEventListener('dragover', e => {
        e.preventDefault();
        cell.classList.add('drag-over');
      });
      cell.addEventListener('dragleave', () => cell.classList.remove('drag-over'));
      cell.addEventListener('drop', e => {
        e.preventDefault();
        cell.classList.remove('drag-over');
        if (S.dragMac) {
          assignSeat(S.dragMac, seatNum);
          S.dragMac = null;
          renderGrid();
        }
      });

      // ── Click ───────────────────────────────────────────
      // cell.addEventListener('click', () => {
      //   if (S.moveMac) {
      //     // Complete the move
      //     assignSeat(S.moveMac, seatNum);
      //     cancelMoveMode();
      //     renderGrid();
      //     return;
      //   }
      //   const mac = S.seats[seatNum];
      //   if (mac && S.units[mac]) openModal(mac);
      // });

      cell.addEventListener('dragstart', e => {
        if (e.target.classList.contains('move-btn')) { e.preventDefault(); return; }
        const occupantMac = S.seats[parseInt(cell.dataset.seat)];
        if (!occupantMac) return;
        
        // 🔴 Add e.dataTransfer
        e.dataTransfer.setData('text/plain', occupantMac); 
        
        S.dragMac = occupantMac;
        cell.style.opacity = '0.5';
      });
      cell.addEventListener('dragend', () => {
        cell.style.opacity = '1';
        S.dragMac = null;
      });
      

      grid.appendChild(cell);
    }
  }

  // ── Tray drag-over / drop (unassign by dropping here) ──
  E.trayUnits.addEventListener('dragover', e => {
    e.preventDefault();
    E.trayUnits.classList.add('drag-over');
  });
  E.trayUnits.addEventListener('dragleave', () =>
    E.trayUnits.classList.remove('drag-over'));
  E.trayUnits.addEventListener('drop', e => {
    e.preventDefault();
    E.trayUnits.classList.remove('drag-over');
    if (S.dragMac) {
      unassignSeat(S.dragMac);
      S.dragMac = null;
      renderGrid();
    }
  });

  // ── Tray click (complete move-mode unassign) ────────────
  // E.trayUnits.addEventListener('click', () => {
  //   if (S.moveMac) {
  //     unassignSeat(S.moveMac);
  //     cancelMoveMode();
  //     renderGrid();
  //   }
  // });

  renderGrid();
}

// ============================================================
//  Render grid and tray (called on every state change)
// ============================================================
function renderGrid() {
  // Active unit count badge
  const activeCount = Object.values(S.units)
    .filter(u => u.status === 'active').length;
  E.unitCount.textContent = activeCount;

  // ── Tray — unassigned units ──────────────────────────────
  E.trayUnits.innerHTML = '';

  // Show hint in move mode
  if (S.moveMac) {
    E.trayUnits.classList.add('move-target');
    const hint = document.createElement('span');
    hint.className   = 'tray-label';
    hint.textContent = 'Drop here to unassign';
    E.trayUnits.appendChild(hint);
  } else {
    E.trayUnits.classList.remove('move-target');
  }

  Object.values(S.units).forEach(u => {
    if (u.seatNumber) return; // placed in grid

    const chip       = document.createElement('div');
    chip.className   = 'tray-unit' + (u.status === 'inactive' ? ' inactive' : '');
    chip.textContent = u.id ? `#${u.id}` : u.mac.slice(-5);
    chip.title       = u.mac;

    if (u.status === 'active') {
      chip.draggable = true;
      // 🔴 Add 'e' and e.dataTransfer
      chip.addEventListener('dragstart', (e) => { 
        e.dataTransfer.setData('text/plain', u.mac); 
        S.dragMac = u.mac;
        chip.classList.add('dragging');
      });
      chip.addEventListener('dragend', () => chip.classList.remove('dragging'));
    }
    E.trayUnits.appendChild(chip);
  });

  // ── Grid cells ───────────────────────────────────────────
  E.seatGrid.querySelectorAll('.seat-cell').forEach(cell => {
    const seatNum    = parseInt(cell.dataset.seat);
    const mac        = S.seats[seatNum];
    const unit       = mac ? S.units[mac] : null;
    const seatNumEl  = cell.querySelector('.seat-number');

    cell.innerHTML = '';
    cell.appendChild(seatNumEl);

    // Highlight if in move mode
    if (S.moveMac) {
      cell.classList.add('move-target');
    } else {
      cell.classList.remove('move-target');
    }

    if (!unit) {
      cell.classList.remove('occupied');
      cell.draggable = false;
      const empty = document.createElement('span');
      empty.className   = 'seat-empty-label';
      empty.textContent = 'Empty';
      cell.appendChild(empty);
      return;
    }

    cell.classList.add('occupied');

    // Make occupied cells draggable for rearranging
    cell.draggable = true;

    // Status dot
    const dot       = document.createElement('span');
    dot.className   = 'seat-status-dot ' + (unit.status || 'inactive');
    cell.appendChild(dot);

    // Unit info
    const unitDiv   = document.createElement('div');
    unitDiv.className = 'seat-unit';

    const idSpan    = document.createElement('span');
    idSpan.className   = 'seat-unit-id' + (unit.status === 'inactive' ? ' inactive' : '');
    idSpan.textContent = unit.id ? `Unit #${unit.id}` : `(${unit.mac.slice(-5)})`;
    unitDiv.appendChild(idSpan);

    if (unit.studentName) {
      const nameSpan      = document.createElement('span');
      nameSpan.className   = 'seat-student-name';
      nameSpan.textContent = unit.studentName;
      unitDiv.appendChild(nameSpan);
    }
    if (unit.studentId) {
      const idLabel       = document.createElement('span');
      idLabel.className   = 'seat-student-id';
      idLabel.textContent = unit.studentId;
      unitDiv.appendChild(idLabel);
    }

    // ↕ Move button — click-to-move alternative to drag
    const moveBtn       = document.createElement('button');
    moveBtn.className   = 'btn-ghost small move-btn';
    moveBtn.textContent = S.moveMac === mac ? '✕ Cancel' : '↕';
    moveBtn.title       = 'Move to another seat';
    moveBtn.addEventListener('click', e => {
      e.stopPropagation();
      if (S.moveMac === mac) {
        cancelMoveMode();
        renderGrid();
      } else {
        S.moveMac = mac;
        renderGrid();
        log('sys', `Click a seat to move Unit #${unit.id || mac.slice(-5)}`);
      }
    });
    unitDiv.appendChild(moveBtn);

    cell.appendChild(unitDiv);

    // // Right-click to unassign
    // cell.addEventListener('contextmenu', e => {
    //   e.preventDefault();
    //   if (confirm(`Remove Unit #${unit.id || ''} from seat ${seatNum}?`)) {
    //     unassignSeat(mac);
    //     cancelMoveMode();
    //     renderGrid();
    //   }
    // });
  });
}


// ============================================================
//  Grid Interaction Listeners (Run once on load)
// ============================================================
E.seatGrid.addEventListener('click', e => {
  const cell = e.target.closest('.seat-cell');
  if (!cell) return;
  const seatNum = parseInt(cell.dataset.seat);

  if (S.moveMac) {
    assignSeat(S.moveMac, seatNum);
    cancelMoveMode();
    renderGrid();
    return;
  }

  const mac = S.seats[seatNum];
  if (mac && S.units[mac]) openModal(mac);
});

E.seatGrid.addEventListener('contextmenu', e => {
  e.preventDefault();
  const cell = e.target.closest('.seat-cell');
  if (!cell) return;
  
  const seatNum = parseInt(cell.dataset.seat);
  const mac = S.seats[seatNum];
  const unit = mac ? S.units[mac] : null;

  if (unit) {
    const identifier = unit.id ? unit.id : unit.mac.slice(-5);
    if (confirm(`Remove Unit #${identifier} from seat ${seatNum}?`)) {
      unassignSeat(mac);
      cancelMoveMode();
      renderGrid();
    }
  }
});

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
E.rawInp.addEventListener('keydown', e => { if (e.key === 'Enter') E.rawBtn.click(); });

// ============================================================
//  Timer
// ============================================================
function startTicker() {
  stopTicker();
  lastTick = Date.now();
  ticker   = setInterval(() => {
    const now     = Date.now();
    const elapsed = now - lastTick;
    lastTick      = now;
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
  const s  = Math.floor((ms % 60000) / 1000);
  E.bigTimer.textContent = h > 0
    ? `${pad(h)}:${pad(m)}:${pad(s)}`
    : `${pad(m)}:${pad(s)}`;
}

function pad(n) { return String(n).padStart(2, '0'); }

// ============================================================
//  Modal
// ============================================================
function openModal(mac) {
  const unit = S.units[mac];
  if (!unit) return;
  S.activeUnit = mac;

  E.modalTitle.textContent    = unit.id ? `Unit #${unit.id}` : `Unit (${mac.slice(-5)})`;
  E.modalSubtitle.textContent = `MAC: ${mac} — Seat: ${unit.seatNumber || 'Unassigned'}`;
  E.mPunish.value = '';
  E.mDeduct.value = '';

  E.modalStudentInfo.classList.add('hidden');
  E.modalFixedInfo.classList.add('hidden');

  if (S.examMode === 'roll') {
    E.modalStudentInfo.classList.remove('hidden');
    E.modalName.value      = unit.studentName || '';
    E.modalStudentId.value = unit.studentId   || '';
    if (unit.studentPhoto) {
      E.modalPhoto.src = unit.studentPhoto;
      E.modalPhoto.classList.remove('hidden');
      E.modalPhotoPlaceholder.classList.add('hidden');
    } else {
      E.modalPhoto.classList.add('hidden');
      E.modalPhotoPlaceholder.classList.remove('hidden');
    }
  } else {
    E.modalFixedInfo.classList.remove('hidden');
    E.modalFixedName.textContent = unit.studentName || '—';
    E.modalFixedId.textContent   = unit.studentId   || '—';
    if (unit.studentPhoto) E.modalFixedPhoto.src = unit.studentPhoto;
  }

  E.modalBg.classList.remove('hidden');
}

function closeModal() {
  E.modalBg.classList.add('hidden');
  S.activeUnit = null;
}

E.modalClose.addEventListener('click', closeModal);
E.modalBg.addEventListener('click', e => { if (e.target === E.modalBg) closeModal(); });

E.modalSaveStudent?.addEventListener('click', () => {
  const mac = S.activeUnit;
  if (!mac || !S.units[mac]) return;
  const name = E.modalName.value.trim();
  const id   = E.modalStudentId.value.trim();
  S.units[mac].studentName = name;
  S.units[mac].studentId   = id;
  saveStudentInfo(mac, name, id, S.units[mac].studentPhoto);
  renderGrid();
  log('sys', `Saved student info for Unit #${S.units[mac].id}: ${name} (${id})`);
});

E.mBeepBtn.addEventListener('click', () => {
  const u = S.units[S.activeUnit];
  if (u?.id) send({ cmd: 'beep', device_id: u.id });
});

E.mWarnBtn.addEventListener('click', () => {
  const u = S.units[S.activeUnit];
  if (u?.id) send({ cmd: 'warn', device_id: u.id });
});

E.mDisableBtn.addEventListener('click', () => {
  const u = S.units[S.activeUnit];
  if (!u?.id) return;
  const obj = { cmd: 'disable', device_id: u.id };
  const p   = parseInt(E.mPunish.value) || 0;
  if (p > 0) obj.punish_ms = p * 1000;
  send(obj);
  u.status = 'disabled';
  renderGrid();
});

E.mEnableBtn.addEventListener('click', () => {
  const u = S.units[S.activeUnit];
  if (!u?.id) return;
  send({ cmd: 'enable', device_id: u.id });
  u.status = 'active';
  renderGrid();
});

E.mDeductBtn.addEventListener('click', () => {
  const u = S.units[S.activeUnit];
  if (!u?.id) return;
  const s = parseInt(E.mDeduct.value);
  if (!s || s <= 0) { log('err', 'Enter seconds to deduct'); return; }
  send({ cmd: 'deduct', device_id: u.id, time_ms: s * 1000 });
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
showPage('landing');

$('btn-mock')?.addEventListener('click', () => {
  // Mock the send function
  window.send = async (obj) => {
    log('out', '[MOCK] ' + JSON.stringify(obj));
    return true;
  };

  S.connMode = 'mock';
  onConnected(); // Jumps straight to dashboard

  // Feed fake units to the app
  const fakeUnits = [
    { event: 'wemos_connected', mac: 'AA:BB:CC:DD:EE:01', id: 1, via: 'mock' },
    { event: 'wemos_connected', mac: 'AA:BB:CC:DD:EE:02', id: 2, via: 'mock' },
    { event: 'wemos_connected', mac: 'AA:BB:CC:DD:EE:03', id: 3, via: 'mock' },
    { event: 'wemos_connected', mac: 'AA:BB:CC:DD:EE:04', id: 4, via: 'mock' }
  ];

  fakeUnits.forEach((u, i) => {
    setTimeout(() => onMessage(JSON.stringify(u)), i * 300);
  });

  // Keep them alive
  setInterval(() => {
    if (S.connected) {
      onMessage(JSON.stringify({
        event: 'heartbeat',
        units: fakeUnits.map(u => ({ mac: u.mac, id: u.id }))
      }));
    }
  }, 3000);
});