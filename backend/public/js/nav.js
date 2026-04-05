// shared across all pages
// builds the sidebar and provides the api() helper function

const PAGES = [
  { href: '/dashboard', label: 'Dashboard', icon: '⊞' },
  { href: '/session',   label: 'Session',   icon: '◎' },
  { href: '/incidents', label: 'Incidents', icon: '△' },
];

function buildSidebar() {
  const current = window.location.pathname;

  const nav = PAGES.map(p => `
    <a href="${p.href}" class="${current.startsWith(p.href) ? 'active' : ''}">
      <span>${p.icon}</span>
      <span>${p.label}</span>
    </a>`
  ).join('');

  return `
    <aside class="sidebar">
      <div class="logo">
        <span class="logo-icon">◈</span>
        <span class="logo-text">PROCTOR</span>
      </div>
      <nav class="nav">${nav}</nav>
      <div class="sidebar-footer">
        <button class="logout-btn" onclick="logout()">⇤ Sign out</button>
      </div>
    </aside>`;
}

async function logout() {
  await fetch('/api/auth/logout', { method: 'POST' });
  window.location.href = '/login';
}

// fetch wrapper — redirects to login on 401
async function api(url, options = {}) {
  const res = await fetch(url, options);
  if (res.status === 401) {
    window.location.href = '/login';
    return null;
  }
  return res.json();
}