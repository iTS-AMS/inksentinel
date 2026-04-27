// ============================================================
//  public/penapp/penapp-ext.js  (v2)
//
//  Extension layer for the Proctopen app.
//  v2 changes: end button now also calls PUT /api/sessions/:id/end
//  Loaded AFTER app.js in index.html via:
//    <script type="module" src="/penapp/penapp-ext.js"></script>
//
//  HOW THIS WORKS WITHOUT TOUCHING app.js:
//  ─────────────────────────────────────────────────────────
//  app.js is a plain (non-module) script. Every top-level
//  const/let/function it declares lives in the shared page
//  scope — readable by any other script on the same page.
//
//  We can therefore:
//    • Read S.activeUnit, S.units, S.seats etc.
//    • Call send(), renderGrid(), log(), closeModal() directly.
//    • Add extra event listeners to buttons (they stack —
//      app.js listener still fires, ours also fires).
//    • Observe DOM changes via MutationObserver to detect
//      when the modal opens without touching openModal().
//
//  We CANNOT:
//    • Reassign a const (send, S, E ...).
//    • Change what the existing listeners do.
//
//  This file adds:
//    1. Student search + assignment in modal (left column)
//    2. Camera ID input + live feed in modal (right column)
//    3. Alert border polling on grid cells
//    4. Dashboard WS connection for live camera frames
//    5. DB signal logging via stmng.js (piggybacks on buttons)
//    6. Sidebar collapse persistence
//    7. Session + attendance loading on connect
// ============================================================

import * as DB from './stmng.js';

// ── Wait for DOM ready ────────────────────────────────────────
// app.js runs synchronously after DOM is parsed.
// This module runs after DOMContentLoaded regardless of position.

// ════════════════════════════════════════════════════════════
//  1. SIDEBAR COLLAPSE
// ════════════════════════════════════════════════════════════
(function initSidebar() {
  const sidebar = document.getElementById('ink-sidebar');
  const toggle  = document.getElementById('ink-toggle');
  if (!sidebar || !toggle) return;

  // Restore saved state
  if (localStorage.getItem('ink-collapsed') === '1') {
    sidebar.classList.add('collapsed');
    toggle.textContent = '▶';
  }

  window.toggleSidebar = function () {
    const collapsed = sidebar.classList.toggle('collapsed');
    toggle.textContent = collapsed ? '▶' : '◀';
    localStorage.setItem('ink-collapsed', collapsed ? '1' : '0');
  };
})();

window.doLogout = async function () {
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
  window.location.href = '/login';
};


// ════════════════════════════════════════════════════════════
//  2. DB STATE
//  Loaded once when the dashboard connects.
// ════════════════════════════════════════════════════════════
let activeSessionId  = null;
let activeSfIdMap    = {};    // feed_label → { sfId, feedId }
let dashWs           = null;
let modalFeedId      = null;  // feed_id shown in modal
let alertFeedMap     = new Map();  // feed_id → max confidence
let alertPollTimer   = null;

// Watch for page-dash becoming visible (fires when app.js calls showPage('dash'))
const dashObserver = new MutationObserver(async (mutations) => {
  for (const m of mutations) {
    if (m.target.id === 'page-dash' && !m.target.classList.contains('hidden')) {
      await onDashConnected();
      dashObserver.disconnect(); // Only need this once
    }
  }
});
const pageDash = document.getElementById('page-dash');
if (pageDash) dashObserver.observe(pageDash, { attributes: true, attributeFilter: ['class'] });

async function onDashConnected() {
  // Load active session + attendance
  try {
    const data = await DB.getActiveSession();
    if (data?.session) {
      activeSessionId = data.session.id;
      document.getElementById('db-chip')?.style && (document.getElementById('db-chip').style.display = '');

      const att = await DB.getAttendance(activeSessionId);
      activeSfIdMap = {};
      (att.attendance || []).forEach(row => {
        activeSfIdMap[row.feed_label] = { sfId: row.id, feedId: row.feed_id };
      });
    }
  } catch (_) {
    // Backend unreachable — OK, pen features still work via serial
  }

  // Open dashboard WS for live camera frames
  connectDashWS();

  // Start alert polling
  alertPollTimer = setInterval(pollAndRenderAlerts, 5000);
  pollAndRenderAlerts(); // immediate first poll
}

// Also connect WS immediately on module load — don't wait for observer.
// The observer may miss the class change if page-dash is shown synchronously
// before MutationObserver has a chance to fire.
connectDashWS();
// Load session state immediately too
onDashConnected().catch(() => {});


// ════════════════════════════════════════════════════════════
//  3. ALERT BORDER POLLING
//  Every 5s: fetch recent detections for the session,
//  apply amber/red border + flag badge to grid cells.
// ════════════════════════════════════════════════════════════
async function pollAndRenderAlerts() {
  if (!activeSessionId) return;
  try {
    alertFeedMap = await DB.pollAlerts(activeSessionId, 30000);
    applyAlertBorders();
  } catch (_) {}
}

function applyAlertBorders() {
  const cells    = document.querySelectorAll('.seat-cell');
  let totalAlerts = 0;

  cells.forEach(cell => {
    // feed_id is stored on the cell as data-feed-id when camera is linked
    const feedId = parseInt(cell.dataset.feedId) || 0;
    const conf   = feedId ? (alertFeedMap.get(feedId) || 0) : 0;

    // Remove old states
    cell.classList.remove('alert-moderate', 'alert-high');
    cell.querySelectorAll('.seat-flag').forEach(f => f.remove());

    if (conf >= 0.85) {
      cell.classList.add('alert-high');
      appendFlagBadge(cell, 'ALERT', 'high');
      totalAlerts++;
    } else if (conf >= 0.65) {
      cell.classList.add('alert-moderate');
      appendFlagBadge(cell, 'FLAG', 'moderate');
      totalAlerts++;
    }
  });

  // Update alert chip in header
  const chip  = document.getElementById('alert-chip');
  const count = document.getElementById('alert-count');
  if (chip && count) {
    chip.style.display    = totalAlerts > 0 ? '' : 'none';
    count.textContent     = totalAlerts;
  }
}

function appendFlagBadge(cell, text, level) {
  const badge       = document.createElement('span');
  badge.className   = `seat-flag ${level}`;
  badge.textContent = text;
  cell.appendChild(badge);
}


// ════════════════════════════════════════════════════════════
//  4. DASHBOARD WS — live camera frames
//  Only used to pipe frames into the modal video box.
// ════════════════════════════════════════════════════════════
function connectDashWS() {
  if (dashWs && dashWs.readyState < 2) return; // already open or connecting
  dashWs = DB.openDashboardWS();

  dashWs.onmessage = (event) => {
    if (event.data instanceof ArrayBuffer) {
      const view   = new DataView(event.data);
      // Fix: Number() cast on both sides — modalFeedId could be string from dataset
      const feedId = view.getUint32(0);
      if (Number(feedId) !== Number(modalFeedId)) return;

      const blob = new Blob([event.data.slice(4)], { type: 'image/jpeg' });
      const url  = URL.createObjectURL(blob);
      const img  = document.getElementById('modal-live-img');
      if (!img) return;
      const old = img.src;
      img.src   = url;
      if (old && old.startsWith('blob:')) URL.revokeObjectURL(old);
      img.style.display = 'block';

      const placeholder = document.getElementById('modal-video-placeholder');
      const badge       = document.getElementById('modal-live-badge');
      if (placeholder) placeholder.style.display = 'none';
      if (badge)       badge.style.display = '';
      return;
    }

    if (typeof event.data === 'string') {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'detection' && msg.feed_id) {
          const feedId = Number(msg.feed_id);
          if (msg.detection_count > 0 || msg.cheating_active) {
            alertFeedMap.set(feedId, Math.max(alertFeedMap.get(feedId) || 0, 1));
          }
          applyAlertBorders();
        }
      } catch (err) {
        // ignore malformed JSON
      }
    }
  };

  dashWs.onclose = () => {
    // Reconnect in 3s if page is still loaded
    setTimeout(() => {
      if (document.getElementById('modal-video-box')) connectDashWS();
    }, 3000);
  };

  dashWs.onerror = () => {
    // Silent — will retry on close
  };
}


// ════════════════════════════════════════════════════════════
//  5. MODAL — inject extended UI, detect open via MutationObserver
// ════════════════════════════════════════════════════════════

// State for current modal
let modalSfId        = null;
let selectedStudent  = null;
let studentSearchTimer = null;

// Watch for modal-bg losing 'hidden' class — fires when app.js calls openModal()
const modalObserver = new MutationObserver((mutations) => {
  for (const m of mutations) {
    if (m.attributeName === 'class') {
      const isOpen = !m.target.classList.contains('hidden');
      if (isOpen) onModalOpen();
      else        onModalClose();
    }
  }
});
const modalBg = document.getElementById('modal-bg');
if (modalBg) modalObserver.observe(modalBg, { attributes: true });

// Called every time the modal opens
async function onModalOpen() {
  const S = window.S;
  if (!S) { console.error('[penapp-ext] window.S not ready'); return; }
  const mac  = S.activeUnit;
  const unit = mac ? S.units[mac] : null;

  // Capture feedId from cell BEFORE resetExtModal clears modalFeedId,
  // so WS frames keep routing during the async DB calls below.
  let earlyFeedId = null;
  if (unit?.seatNumber) {
    const c = document.querySelector(`.seat-cell[data-seat="${unit.seatNumber}"]`);
    if (c?.dataset.feedId) earlyFeedId = Number(c.dataset.feedId);
  }

  resetExtModal();
  if (earlyFeedId) modalFeedId = earlyFeedId; // restore immediately after reset

  const seatLabel = unit
    ? `Seat ${String(unit.seatNumber || 0).padStart(2, '0')}`
    : null;

  if (!unit) { await populateFeedDropdown(null, null); return; }

  const sfEntry = activeSfIdMap[seatLabel] || null;
  modalSfId = sfEntry?.sfId || null;

  if (unit.studentName) showAssignedPanel(unit.studentName, unit.studentId || '');

  // Fetch persisted link from DB BEFORE populating dropdown
  // so we can pass ownFeedId and prevent it being disabled
  const link = await DB.getCameraLink(seatLabel);
  const ownFeedId = link?.feed_id ? Number(link.feed_id) : null;
  if (ownFeedId) modalFeedId = ownFeedId; // update with authoritative DB value

  await populateFeedDropdown(seatLabel, ownFeedId);

  if (ownFeedId) {
    const sel = document.getElementById('modal-feed-select');
    if (sel) {
      for (const opt of sel.options) {
        if (Number(opt.dataset.feedId) === ownFeedId) {
          opt.selected = true;
          break;
        }
      }
    }
    const dispLabel = link.feed_label || `Feed #${ownFeedId}`;
    const dispCam   = link.camera_id  || '';
    updateCamStatus(
      `● Linked: ${dispLabel}${dispCam ? ' · ' + dispCam : ''}`
    );
    const cell = document.querySelector(`.seat-cell[data-seat="${unit.seatNumber}"]`);
    if (cell) cell.dataset.feedId = ownFeedId;
    if (window.S && unit?.seatNumber) {
      window.S.seatLinks = window.S.seatLinks || {};
      window.S.seatLinks[unit.seatNumber] = ownFeedId;
    }
  }
}
function onModalClose() {
  // Clear modal video when closed to release frame rendering
  const img = document.getElementById('modal-live-img');
  if (img) img.style.display = 'none';
  const placeholder = document.getElementById('modal-video-placeholder');
  if (placeholder) placeholder.style.display = 'flex';
  const closeBadge = document.getElementById('modal-live-badge');
  if (closeBadge) closeBadge.style.display = 'none';
  modalFeedId = null;
}

function resetExtModal() {
  // Student search
  const searchInput = document.getElementById('student-search');
  if (searchInput) searchInput.value = '';
  closeDropdown();

  // Panels
  const selectedPanel  = document.getElementById('selected-panel');
  const assignedPanel  = document.getElementById('assigned-student-panel');
  if (selectedPanel) selectedPanel.style.display = 'none';
  if (assignedPanel) assignedPanel.style.display = 'none';

  // Camera dropdown
  const feedSel = document.getElementById('modal-feed-select');
  if (feedSel) feedSel.value = '';
  updateCamStatus('');

  // Reset video box
  const img = document.getElementById('modal-live-img');
  if (img) img.style.display = 'none';
  const placeholder = document.getElementById('modal-video-placeholder');
  if (placeholder) placeholder.style.display = 'flex';
  const badge = document.getElementById('modal-live-badge');
  if (badge) badge.style.display = 'none';

  selectedStudent = null;
  modalFeedId     = null;
}


// ════════════════════════════════════════════════════════════
//  6. STUDENT SEARCH
// ════════════════════════════════════════════════════════════

// Wire up the student search input (injected by index.html)
const studentSearchInput = document.getElementById('student-search');
if (studentSearchInput) {
  studentSearchInput.addEventListener('input', (e) => {
    clearTimeout(studentSearchTimer);
    const q = e.target.value.trim();
    if (!q) { closeDropdown(); return; }
    studentSearchTimer = setTimeout(() => doStudentSearch(q), 300);
  });
}

async function doStudentSearch(q) {
  try {
    const data = await DB.searchStudents(q, 1, 8);
    renderDropdown(data.students || []);
  } catch (_) {
    closeDropdown();
  }
}

function renderDropdown(students) {
  const dd = document.getElementById('student-dropdown');
  if (!dd) return;

  if (students.length === 0) {
    dd.innerHTML = `<div class="student-option" style="color:#445566;cursor:default">
      No results for that query
    </div>`;
  } else {
    dd.innerHTML = students.map(s => `
      <div class="student-option" onclick="extSelectStudent('${s.student_id}')">
        <span class="student-option-name">${s.name}</span>
        <span class="student-option-id">${s.student_id}</span>
      </div>`).join('');
  }
  dd.classList.add('open');
}

function closeDropdown() {
  document.getElementById('student-dropdown')?.classList.remove('open');
}
document.addEventListener('click', (e) => {
  if (!e.target.closest?.('.student-search-wrap')) closeDropdown();
});

// Exposed as global so inline onclick in the dropdown can call it
window.extSelectStudent = async function(studentId) {
  closeDropdown();
  if (document.getElementById('student-search'))
    document.getElementById('student-search').value = '';

  try {
    const data      = await DB.getStudent(studentId);
    selectedStudent = data.student;

    // Fix: autofill the modal-name and modal-student-id inputs that app.js reads.
    // Without this, the Save button in roll-call mode has no data to save.
    const nameInp = document.getElementById('modal-name');
    const idInp   = document.getElementById('modal-student-id');
    if (nameInp) nameInp.value = data.student.name       || '';
    if (idInp)   idInp.value   = data.student.student_id || '';

    showSelectedPanel(data.student, data.enrollments);
  } catch (err) {
    log('err', 'Student lookup failed: ' + err.message);
  }
};

function showSelectedPanel(s, enrollments) {
  const panel = document.getElementById('selected-panel');
  if (!panel) return;
  panel.style.display = 'block';

  // Fill ext autofill inputs (penapp-ext search section)
  const nameExt = document.getElementById('modal-name-ext');
  const idExt   = document.getElementById('modal-student-id-ext');
  if (nameExt) nameExt.value = s.name       || '';
  if (idExt)   idExt.value   = s.student_id || '';

  // Sync into app.js roll-call inputs so the Save button still works
  const nameRc = document.getElementById('modal-name');
  const idRc   = document.getElementById('modal-student-id');
  if (nameRc) nameRc.value = s.name       || '';
  if (idRc)   idRc.value   = s.student_id || '';

  // Hidden mirrors kept for legacy sel-name/sel-id reads
  const selName = document.getElementById('sel-name');
  const selId   = document.getElementById('sel-id');
  if (selName) selName.textContent = s.name       || '';
  if (selId)   selId.textContent   = s.student_id || '';

  const courses = (enrollments || [])
    .map(e => `${e.course_code}/${e.section_name}`)
    .join(', ');
  const metaStr = [courses, s.email, s.pen_unit_id ? `Unit #${s.pen_unit_id}` : null]
    .filter(Boolean).join(' · ');
  const meta = document.getElementById('sel-meta');
  if (meta) meta.textContent = metaStr || '';
}
function showAssignedPanel(name, id) {
  const panel   = document.getElementById('assigned-student-panel');
  const nameEl  = document.getElementById('assigned-name');
  const idEl    = document.getElementById('assigned-id');
  if (!panel) return;
  panel.style.display = 'block';
  if (nameEl) nameEl.textContent = name;
  if (idEl)   idEl.textContent   = id;
}

// Assign selected student to seat
document.getElementById('assign-student-btn')
  ?.addEventListener('click', async () => {
    if (!selectedStudent || !activeSessionId || !modalSfId) {
      log('err', 'Cannot assign: no student selected, or no active session');
      return;
    }
    try {
      await DB.assignStudentToSeat(
        activeSessionId, modalSfId,
        selectedStudent.name, selectedStudent.student_id
      );

      // ── Autofill modal-student-info ───────────────────────
      // Fill the Name / ID inputs that app.js reads for Save,
      // then make the section visible so the proctor can confirm.
      const nameInp = document.getElementById('modal-name');
      const idInp   = document.getElementById('modal-student-id');
      if (nameInp) nameInp.value = selectedStudent.name       || '';
      if (idInp)   idInp.value   = selectedStudent.student_id || '';

      // Unhide the student-info section (app.js hides it in fixed
      // mode; we want it visible after a successful roll-call assign)
      const infoDiv = document.getElementById('modal-student-info');
      if (infoDiv) {
        infoDiv.classList.remove('hidden');
        infoDiv.style.display = '';   // override any inline hide
      }

      // Update local unit state so grid re-renders with the name
      const mac = window.S?.activeUnit;
      if (mac && window.S?.units[mac]) {
        window.S.units[mac].studentName = selectedStudent.name;
        window.S.units[mac].studentId   = selectedStudent.student_id;
      }
      renderGrid();
      showAssignedPanel(selectedStudent.name, selectedStudent.student_id);
      document.getElementById('selected-panel').style.display = 'none';
      log('sys', `Assigned ${selectedStudent.name} to seat`);
      selectedStudent = null;
    } catch (err) {
      log('err', 'Assign failed: ' + err.message);
    }
  });

document.getElementById('clear-student-btn')
  ?.addEventListener('click', () => {
    selectedStudent = null;
    const p = document.getElementById('selected-panel');
    if (p) p.style.display = 'none';
    if (document.getElementById('student-search'))
      document.getElementById('student-search').value = '';
  });

document.getElementById('remove-student-btn')
  ?.addEventListener('click', async () => {
    if (!activeSessionId || !modalSfId) return;
    try {
      await DB.removeStudentFromSeat(activeSessionId, modalSfId);
      const mac = window.S?.activeUnit;
      if (mac && window.S?.units[mac]) {
        window.S.units[mac].studentName = '';
        window.S.units[mac].studentId   = '';
      }
      renderGrid();

      // Clear modal-student-info fields and hide the section
      const nameInp = document.getElementById('modal-name');
      const idInp   = document.getElementById('modal-student-id');
      if (nameInp) nameInp.value = '';
      if (idInp)   idInp.value   = '';
      const infoDiv = document.getElementById('modal-student-info');
      if (infoDiv) infoDiv.classList.add('hidden');

      const p = document.getElementById('assigned-student-panel');
      if (p) p.style.display = 'none';
      log('sys', 'Student removed from seat');
    } catch (err) {
      log('err', 'Remove failed: ' + err.message);
    }
  });


// ════════════════════════════════════════════════════════════
//  7. CAMERA FEED DROPDOWN IN MODAL
//  Populates modal-feed-select from /api/feeds on modal open.
//  Shows status: ● connected, ○ available, — disconnected
// ════════════════════════════════════════════════════════════

async function populateFeedDropdown(seatLabel, ownFeedId) {
  const sel = document.getElementById('modal-feed-select');
  if (!sel) return;

  sel.innerHTML = '<option value="">Loading cameras…</option>';

  try {
    const feeds = await DB.getFeeds(seatLabel);
    const list  = Array.isArray(feeds) ? feeds : (feeds.feeds || []);

    if (!list.length) {
      sel.innerHTML = '<option value="">No cameras registered</option>';
      return;
    }

    sel.innerHTML = '<option value="">— select camera —</option>';

    list.forEach(f => {
      const avail = f.availability ||
        (f.connected ? 'available' : 'disconnected');

      // ownFeedId = this seat's already-linked feed.
      // Never disable it regardless of what the API says --
      // it must stay selectable so opt.selected = true works.
      const isOwn = ownFeedId && Number(f.id) === Number(ownFeedId);

      const effectiveAvail = isOwn ? 'available' : avail;

      const statusIcon =
        effectiveAvail === 'available'    ? '● Available'
        : effectiveAvail === 'linked'     ? '🔗 Linked'
        :                                  '○ Disconnected';

      const linkedNote = (effectiveAvail === 'linked' && f.linked_seat && !isOwn)
        ? `  [→ ${f.linked_seat}]` : '';

      const opt             = document.createElement('option');
      opt.value             = f.id;
      opt.dataset.feedId    = f.id;
      opt.dataset.camId     = f.camera_id || '';
      opt.dataset.connected = f.connected ? '1' : '0';
      opt.dataset.avail     = effectiveAvail;
      opt.textContent = `${statusIcon}  ${f.label}  ${f.camera_id || ''}${linkedNote}`.trim();

      // Only disable if linked to ANOTHER seat (not this seat's own camera)
      if (effectiveAvail === 'linked' && !isOwn) opt.disabled = true;

      sel.appendChild(opt);
    });
  } catch (err) {
    console.error('[penapp-ext] populateFeedDropdown failed:', err);
    sel.innerHTML = '<option value="">Failed to load cameras</option>';
  }
}
// Link button: set modalFeedId from selected dropdown option
document.getElementById('modal-link-cam-btn')
  ?.addEventListener('click', () => {
    const sel = document.getElementById('modal-feed-select');
    if (!sel?.value) {
      updateCamStatus('Select a camera first.');
      return;
    }

    const opt       = sel.options[sel.selectedIndex];
    const feedId    = Number(opt.dataset.feedId);
    const isLive    = opt.dataset.connected === '1';
    const camId     = opt.dataset.camId || '';
    // Strip status prefix to get the clean feed label
    const label = opt.text
      .replace(/^(● Available|🔗 Linked|○ Disconnected)\s+/, '')
      .replace(/\s+\→.*$/, '')
      .trim();

    modalFeedId = feedId;

    // Store feed_id on the seat cell so alert polling works
    const mac     = window.S?.activeUnit;
    const seatNum = window.S?.units[mac]?.seatNumber;
    if (seatNum) {
      const cell = document.querySelector(`.seat-cell[data-seat="${seatNum}"]`);
      if (cell) cell.dataset.feedId = feedId;
      if (window.S) {
        window.S.seatLinks = window.S.seatLinks || {};
        window.S.seatLinks[seatNum] = feedId;
      }

      // Persist link to camera_links table so it survives page refresh
      const seatLabel = `Seat ${String(seatNum).padStart(2,'0')}`;
      DB.setCameraLink(seatLabel, feedId, camId, label).catch(err =>
        console.warn('[penapp-ext] camera_links write failed:', err.message)
      );
    }

    updateCamStatus(`● Linked: ${label}${camId ? ' · ' + camId : ''}`);
  });

function updateCamStatus(text) {
  const el = document.getElementById('modal-cam-status');
  if (el) el.textContent = text;
}


// ════════════════════════════════════════════════════════════
//  8. PIGGYBACK DB LOGGING ON ACTION BUTTONS
//  We add a SECOND click listener to each button.
//  app.js listener fires first (sends via serial/BLE/WS).
//  Our listener fires second (logs to DB via stmng.js).
//  No app.js modification required.
// ════════════════════════════════════════════════════════════

function addSignalLogger(buttonId, getPayload) {
  document.getElementById(buttonId)?.addEventListener('click', () => {
    const unit = window.S?.units[window.S?.activeUnit];
    if (!unit?.id) return;
    const { cmd, ...params } = getPayload(unit);
    // Fire-and-forget — if backend is down, we don't block the UI
    DB.logSignal(cmd, params).catch(() => {});
  });
}

// Wire loggers after DOM is ready
addSignalLogger('m-warn-btn',    (u) => ({ cmd: 'warn',    device_id: u.id }));
addSignalLogger('m-enable-btn',  (u) => ({ cmd: 'enable',  device_id: u.id }));
addSignalLogger('m-beep-btn',    (u) => ({ cmd: 'beep',    device_id: u.id }));
addSignalLogger('m-disable-btn', (u) => {
  const p = parseInt(document.getElementById('m-punish')?.value) || 0;
  return { cmd: 'disable', device_id: u.id, ...(p > 0 ? { punish_ms: p * 1000 } : {}) };
});
addSignalLogger('m-deduct-btn',  (u) => {
  const s = parseInt(document.getElementById('m-deduct')?.value) || 0;
  return { cmd: 'deduct', device_id: u.id, time_ms: s * 1000 };
});

// Also log global exam control buttons
function addGlobalSignalLogger(buttonId, getPayload) {
  document.getElementById(buttonId)?.addEventListener('click', () => {
    const { cmd, ...params } = getPayload();
    DB.logSignal(cmd, params).catch(() => {});
  });
}
addGlobalSignalLogger('start-btn',     () => ({ cmd: 'start' }));
addGlobalSignalLogger('pause-btn',     () => ({ cmd: 'pause' }));
addGlobalSignalLogger('end-btn', () => ({ cmd: 'end' }));

// ── Pause button → PATCH session status: paused ──────────────
// Fires AFTER app.js sends the ESP32 command.
// Non-fatal: if backend is unreachable the pen still pauses.
document.getElementById('pause-btn')?.addEventListener('click', async () => {
  if (!activeSessionId || !window.S?.connected) return;
  try {
    await fetch(`/api/sessions/${activeSessionId}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'paused' }),
    });
    log('sys', 'DB session status → paused');
  } catch (_) {}
});

// ── Start button → PATCH session status: active (resume) ─────
// app.js uses start-btn for both initial start and resume.
// We check if the session is currently paused before patching.
let _sessionWasPaused = false;
document.getElementById('pause-btn')?.addEventListener('click', () => {
  _sessionWasPaused = true;
});
document.getElementById('start-btn')?.addEventListener('click', async () => {
  if (!activeSessionId || !window.S?.connected) return;
  if (!_sessionWasPaused) return; // initial start, not a resume
  _sessionWasPaused = false;
  try {
    await fetch(`/api/sessions/${activeSessionId}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'active' }),
    });
    log('sys', 'DB session status → active (resumed)');
  } catch (_) {}
});

// ── End button also ends the DB session ──────────────────────
// The 'end' command stops pens via serial/BLE.
// We also need to mark the DB session as ended so the dashboard
// shows it as ENDED and future sessions don't see it as active.
document.getElementById('end-btn')?.addEventListener('click', async () => {
  if (!activeSessionId) return;
  if (!window.S?.connected) return; // only act when actually in a session
  _sessionWasPaused = false;
  try {
    const res = await fetch(`/api/sessions/${activeSessionId}/end`, {
      method: 'PUT', credentials: 'include'
    });
    if (res.ok) {
      activeSessionId = null;
      activeSfIdMap   = {};
      log('sys', 'DB session marked as ended');
    }
  } catch (_) {
    // Non-fatal — ESP32 command still went through
  }
});
addGlobalSignalLogger('reset-btn',     () => ({ cmd: 'reset' }));
addGlobalSignalLogger('set-timer-btn', () => {
  const h  = parseInt(document.getElementById('inp-h')?.value) || 0;
  const m  = parseInt(document.getElementById('inp-m')?.value) || 0;
  const s  = parseInt(document.getElementById('inp-s')?.value) || 0;
  return { cmd: 'timer', duration_ms: (h * 3600 + m * 60 + s) * 1000 };
});