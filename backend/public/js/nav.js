// public/js/nav.js
const PAGES = [
  { href: '/dashboard',   label: 'Dashboard',    icon: '⊞' },
  { href: '/session',     label: 'Session',      icon: '◎' },
  { href: '/allsessions', label: 'All Sessions', icon: '☰' },
  { href: '/incidents',   label: 'Incidents',    icon: '△' },
  { href: '/history',     label: 'Sig. History', icon: '◷' },
  { href: '/pen',         label: 'Pen Control',  icon: '✒' },
];

function buildSidebar() {
  const current = window.location.pathname;

  const nav = PAGES.map(p => {
    // /session must match exactly — otherwise /allsessions also highlights it
    const isActive = p.href === '/session'
      ? current === '/session'
      : current.startsWith(p.href);
    return `
    <a href="${p.href}" class="${isActive ? 'active' : ''}" title="${p.label}">
      <span class="nav-icon">${p.icon}</span>
      <span class="nav-label">${p.label}</span>
    </a>`;
  }).join('');

  return `
    <aside class="sidebar" id="ink-sidebar">
      <div class="logo">
        <span class="logo-icon">◈</span>
        <span class="logo-text">PROCTOR</span>
      </div>
      <nav class="nav">${nav}</nav>
      <div class="sidebar-footer">
        <button class="logout-btn" onclick="logout()">
          <span class="nav-icon">⇤</span>
          <span class="nav-label">Sign out</span>
        </button>
        <button class="sidebar-toggle-btn" onclick="toggleSidebar()"
          id="sidebar-toggle" title="Collapse sidebar">◀</button>
      </div>
    </aside>`;
}

function toggleSidebar() {
  const sidebar = document.getElementById('ink-sidebar');
  const btn     = document.getElementById('sidebar-toggle');
  if (!sidebar) return;
  const collapsed = sidebar.classList.toggle('collapsed');
  btn.textContent = collapsed ? '▶' : '◀';
  btn.title       = collapsed ? 'Expand sidebar' : 'Collapse sidebar';
  localStorage.setItem('sidebar-collapsed', collapsed ? '1' : '0');
}

function applySidebarState() {
  if (localStorage.getItem('sidebar-collapsed') !== '1') return;
  const sidebar = document.getElementById('ink-sidebar');
  const btn     = document.getElementById('sidebar-toggle');
  if (!sidebar || !btn) return;
  sidebar.classList.add('collapsed');
  btn.textContent = '▶';
  btn.title       = 'Expand sidebar';
}

function initSidebar() {
  requestAnimationFrame(applySidebarState);
}

async function logout() {
  await fetch('/api/auth/logout', { method: 'POST' });
  window.location.href = '/login';
}

async function api(url, options = {}) {
  const res = await fetch(url, options);
  if (res.status === 401) { window.location.href = '/login'; return null; }
  return res.json();
}
