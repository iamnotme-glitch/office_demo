const THEME_KEY = 'invoice-app-theme';

function applyTheme(theme) {
  const nextTheme = theme === 'dark' ? 'dark' : 'light';
  
  // Apply to both html and body for maximum CSS selector compatibility
  document.documentElement.setAttribute('data-theme', nextTheme);
  document.body.setAttribute('data-theme', nextTheme);
  
  const button = document.getElementById('theme-toggle');
  if (button) {
    // Using simple icons for better reliability
    button.innerHTML = nextTheme === 'dark' 
      ? '<i class="fa-solid fa-sun"></i>' 
      : '<i class="fa-solid fa-moon"></i>';
  }
}

function getStoredTheme() {
  return window.localStorage.getItem(THEME_KEY);
}

function detectTheme() {
  const stored = getStoredTheme();
  if (stored === 'light' || stored === 'dark') {
    return stored;
  }

  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const nextTheme = current === 'dark' ? 'light' : 'dark';
  applyTheme(nextTheme);
  window.localStorage.setItem(THEME_KEY, nextTheme);
}

document.addEventListener('DOMContentLoaded', () => {
  // Initialize
  applyTheme(detectTheme());

  const toggle = document.getElementById('theme-toggle');
  if (toggle) {
    toggle.addEventListener('click', (e) => {
      e.preventDefault();
      toggleTheme();
    });
  }

  const sidebar = document.getElementById('sidebar');
  const sidebarToggle = document.getElementById('sidebar-toggle');

  const closeSidebar = () => {
    if (!sidebar) return;
    sidebar.classList.add('collapsed');
    document.body.classList.add('sidebar-collapsed');
  };

  const openSidebar = () => {
    if (!sidebar) return;
    sidebar.classList.remove('collapsed');
    document.body.classList.remove('sidebar-collapsed');
  };

  if (sidebarToggle) {
    sidebarToggle.addEventListener('click', (e) => {
      e.preventDefault();
      if (sidebar && sidebar.classList.contains('collapsed')) {
        openSidebar();
      } else {
        closeSidebar();
      }
    });
  }

  document.addEventListener('click', (event) => {
    if (!sidebar || !sidebarToggle) return;
    const target = event.target;
    if (sidebar.contains(target) || sidebarToggle.contains(target)) return;
    if (!sidebar.classList.contains('collapsed')) {
      closeSidebar();
    }
  });
});
