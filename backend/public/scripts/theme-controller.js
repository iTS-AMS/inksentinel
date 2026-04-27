// public/scripts/theme-controller.js  v2
// ─────────────────────────────────────────────────────────────
//  Two-layer theme persistence:
//
//  Layer 1 — localStorage  (synchronous, instant, no flash)
//    Applied immediately when this script loads, before any
//    HTML is painted. This is the source of truth for the
//    current tab/device.
//
//  Layer 2 — DB via /api/settings  (async, cross-device sync)
//    After DOMContentLoaded, we fetch the server's stored
//    theme. If it differs from localStorage we apply and update
//    localStorage to stay in sync. This means if the user
//    changes theme on another device it propagates on next load.
//
//  On save (called by settings-page.html):
//    setTheme() writes to BOTH layers simultaneously.
//    The DB write is fire-and-forget — localStorage is the
//    actual paint source so a slow network doesn't block UI.
//
//  Font scale is also applied here so it takes effect on every
//  page, not just settings-page.html.
// ─────────────────────────────────────────────────────────────

const THEME_KEY      = 'examnexus-theme';
const FONT_SCALE_KEY = 'examnexus-font-scale';

// ── Internal: apply theme class to <html> ────────────────────
function _applyTheme(theme) {
  const root      = document.documentElement;
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const useDark   = theme === 'dark' || (theme === 'system' && prefersDark);

  // Tailwind class-based dark mode (darkMode: 'class')
  root.classList.toggle('dark', useDark);

  // data-theme attribute — required by style.css CSS variable selectors
  // [data-theme="dark"] / [data-theme="light"] drive --border, --bg2, --bg3 etc.
  root.setAttribute('data-theme', useDark ? 'dark' : 'light');
}

// ── Internal: apply font scale to <html> ────────────────────
function _applyFontScale(scale) {
  const pct = Math.max(70, Math.min(150, Number(scale) || 100));
  document.documentElement.style.fontSize = `${pct}%`;
}

// ── Public: set theme (called by settings-page.html) ─────────
// Writes to localStorage immediately, then persists to DB.
function setTheme(theme) {
  localStorage.setItem(THEME_KEY, theme);
  _applyTheme(theme);
  _persistToDB({ theme });
}

// ── Public: set font scale (called by settings-page.html) ────
function setFontScale(scale) {
  localStorage.setItem(FONT_SCALE_KEY, scale);
  _applyFontScale(scale);
  _persistToDB({ font_scale: scale });
}

// ── Public: save all settings at once (settings-page Save btn) ─
// Writes all fields to localStorage and DB in one call.
async function saveAllSettings(settings) {
  // Apply immediately
  if (settings.theme      !== undefined) {
    localStorage.setItem(THEME_KEY, settings.theme);
    _applyTheme(settings.theme);
  }
  if (settings.font_scale !== undefined) {
    localStorage.setItem(FONT_SCALE_KEY, settings.font_scale);
    _applyFontScale(settings.font_scale);
  }

  // Persist to DB — await so the page can show success/error
  return _persistToDB(settings);
}

// ── Public: load settings from DB ────────────────────────────
// Returns the settings object or null on failure.
// Used by settings-page.html to populate form values on load.
async function loadSettingsFromDB() {
  try {
    const res = await fetch('/api/settings', { credentials: 'include' });
    if (!res.ok) return null;
    const data = await res.json();
    return data.settings || null;
  } catch {
    return null;
  }
}

// ── Internal: PATCH /api/settings ───────────────────────────
async function _persistToDB(fields) {
  try {
    const res = await fetch('/api/settings', {
      method:      'PATCH',
      credentials: 'include',
      headers:     { 'Content-Type': 'application/json' },
      body:        JSON.stringify(fields),
    });
    if (!res.ok) {
      console.warn('[theme-controller] DB save failed:', res.status);
      return null;
    }
    return (await res.json()).settings;
  } catch (err) {
    // Non-fatal — localStorage already has the value
    console.warn('[theme-controller] DB save error:', err.message);
    return null;
  }
}

// ── React to OS preference changes ──────────────────────────
window.matchMedia('(prefers-color-scheme: dark)')
  .addEventListener('change', () => {
    if ((localStorage.getItem(THEME_KEY) || 'system') === 'system') {
      _applyTheme('system');
    }
  });

// ════════════════════════════════════════════════════════════
//  STEP 1 — Apply from localStorage immediately (no flash)
// ════════════════════════════════════════════════════════════
_applyTheme(localStorage.getItem(THEME_KEY) || 'system');
_applyFontScale(localStorage.getItem(FONT_SCALE_KEY) || 100);

// ════════════════════════════════════════════════════════════
//  STEP 2 — Sync from DB after page loads (cross-device)
// ════════════════════════════════════════════════════════════
// Runs after DOM is ready so it doesn't block first paint.
// Only updates if the DB value differs from localStorage.
document.addEventListener('DOMContentLoaded', async () => {
  // Skip DB sync on the login page (user not authenticated yet)
  if (window.location.pathname === '/login') return;

  const settings = await loadSettingsFromDB();
  if (!settings) return;

  // Sync theme
  const dbTheme    = settings.theme || 'system';
  const localTheme = localStorage.getItem(THEME_KEY);
  if (dbTheme !== localTheme) {
    localStorage.setItem(THEME_KEY, dbTheme);
    _applyTheme(dbTheme);
  }

  // Sync font scale
  const dbScale    = settings.font_scale || 100;
  const localScale = localStorage.getItem(FONT_SCALE_KEY);
  if (String(dbScale) !== String(localScale)) {
    localStorage.setItem(FONT_SCALE_KEY, dbScale);
    _applyFontScale(dbScale);
  }
});