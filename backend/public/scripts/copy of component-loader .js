// public/scripts/component-loader.js
// Fetches HTML components and injects them into placeholder divs.
// Uses createContextualFragment so inline <script> tags in the
// component actually execute (unlike outerHTML / innerHTML which
// silently skip script execution).

async function loadComponent(elementId, componentPath) {
  try {
    const response = await fetch(componentPath);
    if (!response.ok) throw new Error(`Failed to load ${componentPath}`);

    const htmlContent = await response.text();
    const placeholder = document.getElementById(elementId);
    if (!placeholder) return;

    // createContextualFragment needs a range anchored to an existing
    // node — anchoring to body gives it the right parse context.
    const range    = document.createRange();
    range.selectNodeContents(document.body);
    const fragment = range.createContextualFragment(htmlContent);
    placeholder.replaceWith(fragment);

    // Active nav highlight — runs after sidebar is fully in the DOM
    if (componentPath.includes('sidebar.html')) {
      // Pathname examples: '/dashboard', '/allsession', '/camera'
      // Strip leading slash + .html extension to get bare page name.
      const currentPage = window.location.pathname
        .split('/').pop()
        .replace(/\.html$/, '')
        || 'dashboard';

      document.querySelectorAll('aside nav .nav-link').forEach(link => {
        const href = (link.getAttribute('href') || '')
          .replace(/^\//, '')       // strip leading slash
          .replace(/\.html$/, '');  // strip extension

        if (href && href === currentPage) {
          link.className =
            'nav-link flex items-center gap-3 px-4 py-3 ' +
            'bg-orange-50 dark:bg-orange-900/20 text-primary ' +
            'font-bold rounded-xl group transition-colors';
          // Handle both icon font classes used across the app
          const icon = link.querySelector(
            '.material-icons-outlined, .material-symbols-outlined'
          );
          if (icon) {
            icon.classList.remove('text-gray-400');
            icon.classList.add('text-primary');
          }
        }
      });
    }
  } catch (error) {
    console.error('Error loading component:', error);
  }
}

// Boot — inject sidebar and header when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('sidebar-placeholder')) {
    loadComponent('sidebar-placeholder', '../components/sidebar.html');
  }
  if (document.getElementById('header-placeholder')) {
    loadComponent('header-placeholder', '../components/header.html');
  }
});