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

import * as DB from '/penapp/stmng.js';

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
    if (!(event.data instanceof ArrayBuffer)) return;

    const view   = new DataView(event.data);
    const feedId = view.getUint32(0);

    // Only render if this is the feed linked to the currently open modal
    if (feedId !== modalFeedId) return;

    const blob = new Blob([event.data.slice(4)], { type: 'image/jpeg' });
    const url  = URL.createObjectURL(blob);
    const img  = document.getElementById('modal-live-img');
    if (!img) return;
    const old = img.src;
    img.src   = url;
    if (old.startsWith('blob:')) URL.revokeObjectURL(old);
    img.style.display = 'block';

    const placeholder = document.getElementById('modal-video-placeholder');
    const badge       = document.getElementById('modal-live-badge');
    if (placeholder) placeholder.style.display = 'none';
    if (badge)       badge.style.display = '';
  };

  dashWs.onclose = () => {
    // Reconnect in 3s if still on dashboard
    setTimeout(() => {
      if (S.connected) connectDashWS();
    }, 3000);
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
function onModalOpen() {
  // S.activeUnit is set by app.js before removing 'hidden'
  const mac  = S.activeUnit;
  const unit = mac ? S.units[mac] : null;

  // Reset extended fields
  resetExtModal();

  if (!unit) return;

  // Resolve session_feeds row for this seat
  const seatLabel = `Seat ${String(unit.seatNumber || 0).padStart(2, '0')}`;
  const sfEntry   = activeSfIdMap[seatLabel] || null;
  modalSfId = sfEntry?.sfId || null;

  // Show already-assigned student if any
  if (unit.studentName) {
    showAssignedPanel(unit.studentName, unit.studentId || '');
  }

  // Restore linked camera if stored on cell
  const seatNum = unit.seatNumber;
  if (seatNum) {
    const cell = document.querySelector(`.seat-cell[data-seat="${seatNum}"]`);
    if (cell?.dataset.feedId) {
      modalFeedId = parseInt(cell.dataset.feedId);
      updateCamStatus(`Linked to feed #${modalFeedId}`);
    }
  }
}

function onModalClose() {
  // Clear modal video when closed to release frame rendering
  const img = document.getElementById('modal-live-img');
  if (img) img.style.display = 'none';
  const placeholder = document.getElementById('modal-video-placeholder');
  if (placeholder) placeholder.style.display = 'flex';
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

  // Camera
  const camInput = document.getElementById('modal-cam-id');
  if (camInput) camInput.value = '';
  updateCamStatus('');

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
    showSelectedPanel(data.student, data.enrollments);
  } catch (err) {
    log('err', 'Student lookup failed: ' + err.message);
  }
};

function showSelectedPanel(s, enrollments) {
  const panel = document.getElementById('selected-panel');
  if (!panel) return;
  panel.style.display = 'block';

  const name = document.getElementById('sel-name');
  const id   = document.getElementById('sel-id');
  const meta = document.getElementById('sel-meta');
  if (name) name.textContent = s.name;
  if (id)   id.textContent   = s.student_id;

  const courses = (enrollments || [])
    .map(e => `${e.course_code}/${e.section_name}`)
    .join(', ');
  const metaStr = [courses, s.email, s.pen_unit_id ? `Unit #${s.pen_unit_id}` : null]
    .filter(Boolean).join(' · ');
  if (meta) meta.textContent = metaStr;
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
      // Update local unit state so grid re-renders with the name
      const mac = S.activeUnit;
      if (mac && S.units[mac]) {
        S.units[mac].studentName = selectedStudent.name;
        S.units[mac].studentId   = selectedStudent.student_id;
      }
      renderGrid();
      showAssignedPanel(selectedStudent.name, selectedStudent.student_id);
      document.getElementById('selected-panel').style.display = 'none';
      selectedStudent = null;
      log('sys', `Assigned ${S.units[S.activeUnit]?.studentName} to seat`);
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
      const mac = S.activeUnit;
      if (mac && S.units[mac]) {
        S.units[mac].studentName = '';
        S.units[mac].studentId   = '';
      }
      renderGrid();
      const p = document.getElementById('assigned-student-panel');
      if (p) p.style.display = 'none';
      log('sys', 'Student removed from seat');
    } catch (err) {
      log('err', 'Remove failed: ' + err.message);
    }
  });


// ════════════════════════════════════════════════════════════
//  7. CAMERA LINKING IN MODAL
// ════════════════════════════════════════════════════════════

document.getElementById('modal-link-cam-btn')
  ?.addEventListener('click', async () => {
    const rawId = document.getElementById('modal-cam-id')?.value
      .trim().toUpperCase();
    if (!rawId) return;

    updateCamStatus('Looking up camera...');

    try {
      const { feed } = await DB.getFeedByCameraId(rawId);
      if (!feed) {
        updateCamStatus(`⚠ No camera found with ID "${rawId}"`);
        return;
      }

      // Link this feed to the modal WS stream
      modalFeedId = feed.id;
      updateCamStatus(`● Linked: ${feed.label} (feed #${feed.id})`);

      // Store feed_id on the seat cell so alert polling works
      const mac     = S.activeUnit;
      const seatNum = S.units[mac]?.seatNumber;
      if (seatNum) {
        const cell = document.querySelector(`.seat-cell[data-seat="${seatNum}"]`);
        if (cell) cell.dataset.feedId = feed.id;
      }
    } catch (err) {
      updateCamStatus('✗ Error: ' + err.message);
    }
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
    const unit = S.units[S.activeUnit];
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
  if (!activeSessionId || !S.connected) return;
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
  if (!activeSessionId || !S.connected) return;
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
  if (!S.connected) return; // only act when actually in a session
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