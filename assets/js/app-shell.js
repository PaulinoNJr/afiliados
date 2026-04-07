(() => {
  const DESKTOP_BREAKPOINT = 992;

  const FIXED_ROLE_BY_PAGE = {
    'dashboard-admin.html': 'admin',
    'dashboard-anunciante.html': 'advertiser',
    'users.html': 'admin'
  };

  const MENUS = {
    admin: [
      { href: 'dashboard-admin.html', label: 'Painel' },
      { href: 'users.html', label: 'Usuarios' },
      { href: 'loja.html', label: 'Loja' },
      { href: 'perfil.html', label: 'Perfil' },
      { href: 'produtos.html', label: 'Produtos' },
      { href: 'categorias.html', label: 'Categorias' }
    ],
    advertiser: [
      { href: 'dashboard-anunciante.html', label: 'Painel' },
      { href: 'loja.html', label: 'Loja' },
      { href: 'perfil.html', label: 'Perfil' },
      { href: 'produtos.html', label: 'Produtos' },
      { href: 'categorias.html', label: 'Categorias' }
    ]
  };

  function getCurrentPage() {
    const pathname = window.location.pathname || '';
    const page = pathname.split('/').pop();
    return page || 'index.html';
  }

  function getHrefPage(link) {
    try {
      return new URL(link.href, window.location.href).pathname.split('/').pop() || '';
    } catch {
      return '';
    }
  }

  function normalizeLabel(value) {
    return String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  function syncWorkspaceOffsets() {
    const root = document.documentElement;
    const topbar = document.querySelector('.navbar.sticky-top');
    const menu = document.querySelector('.workspace-menu');
    const menuShell = document.querySelector('.workspace-menu-shell');

    if (topbar) {
      root.style.setProperty('--app-topbar-height', `${Math.ceil(topbar.offsetHeight)}px`);
    }

    const shouldReserveMenuSpace = window.innerWidth >= DESKTOP_BREAKPOINT
      && menu
      && menuShell
      && window.getComputedStyle(menu).display !== 'none';

    root.style.setProperty(
      '--workspace-menu-height',
      shouldReserveMenuSpace ? `${Math.ceil(menuShell.offsetHeight + 16)}px` : '0px'
    );
  }

  function inferRole(profile) {
    const explicitRole = document.body?.dataset?.navRole || document.body?.dataset?.dashboardRole;
    if (explicitRole) {
      return window.Auth.normalizeRole(explicitRole);
    }

    const currentPage = getCurrentPage();
    if (FIXED_ROLE_BY_PAGE[currentPage]) {
      return FIXED_ROLE_BY_PAGE[currentPage];
    }

    return window.Auth.normalizeRole(profile?.role);
  }

  function buildExistingLinkMap(shell) {
    const map = new Map();
    const links = shell.querySelectorAll('.workspace-menu-link');

    links.forEach((link) => {
      const hrefPage = getHrefPage(link);
      const labelKey = normalizeLabel(link.textContent);

      if (hrefPage) map.set(`href:${hrefPage}`, link);
      if (labelKey) map.set(`label:${labelKey}`, link);
      if (link.dataset.adminOnly === 'true') map.set('admin-only', link);
    });

    return map;
  }

  function updateLinkState(link, item, currentPage, role) {
    const isActive = item.href === currentPage;
    link.href = item.label === 'Painel' ? window.Auth.getDashboardRoute(role) : item.href;
    link.textContent = item.label;
    link.classList.add('workspace-menu-link');
    link.classList.toggle('is-active', isActive);

    if (isActive) {
      link.setAttribute('aria-current', 'page');
    } else {
      link.removeAttribute('aria-current');
    }

    if (item.href === 'users.html') {
      link.dataset.adminOnly = 'true';
      link.classList.toggle('d-none', role !== 'admin');
    } else {
      delete link.dataset.adminOnly;
      link.classList.remove('d-none');
    }
  }

  function syncDesktopMenu(profile) {
    const shell = document.querySelector('.workspace-menu-shell');
    if (!shell || !window.Auth) return null;

    const role = inferRole(profile);
    const currentPage = getCurrentPage();
    const menuItems = MENUS[role] || MENUS.advertiser;
    const existingMap = buildExistingLinkMap(shell);

    menuItems.forEach((item) => {
      const labelKey = normalizeLabel(item.label);
      const link = existingMap.get(`href:${item.href}`)
        || existingMap.get(`label:${labelKey}`)
        || (item.href === 'users.html' ? existingMap.get('admin-only') : null);

      if (!link) return;

      updateLinkState(link, item, currentPage, role);
      shell.appendChild(link);
    });

    shell.querySelectorAll('.workspace-menu-link').forEach((link) => {
      const hrefPage = getHrefPage(link);
      const shouldHide = role !== 'admin' && hrefPage === 'users.html';
      link.classList.toggle('d-none', shouldHide);
    });

    return shell;
  }

  function syncMobileMenuFromDesktop(desktopShell) {
    const mobileShell = document.querySelector('.mobile-workspace-menu');
    if (!desktopShell || !mobileShell) return;

    mobileShell.innerHTML = '';
    desktopShell.querySelectorAll('.workspace-menu-link:not(.d-none)').forEach((link) => {
      mobileShell.appendChild(link.cloneNode(true));
    });
  }

  function syncWorkspaceMenu(profile) {
    const desktopShell = syncDesktopMenu(profile);
    syncMobileMenuFromDesktop(desktopShell);
    syncWorkspaceOffsets();
  }

  function updateDashboardLinks(profile) {
    const role = inferRole(profile);
    const dashboardHref = window.Auth.getDashboardRoute(role);
    const candidates = document.querySelectorAll('a.page-header-action, .page-header-actions a, #backToDashboardBtn');

    candidates.forEach((link) => {
      const text = String(link.textContent || '').trim().toLowerCase();
      if (!text.includes('painel') && link.id !== 'backToDashboardBtn') {
        return;
      }

      link.href = dashboardHref;
    });
  }

  async function initAppShell() {
    if (!window.Auth || !document.querySelector('.workspace-menu-shell')) {
      return;
    }

    try {
      const session = await window.Auth.getSession();
      if (!session) {
        syncWorkspaceOffsets();
        return;
      }

      const profile = await window.Auth.getProfile();
      syncWorkspaceMenu(profile);
      updateDashboardLinks(profile);
    } catch (error) {
      console.error('Falha ao padronizar a navegacao interna:', error);
      syncWorkspaceOffsets();
    }
  }

  document.addEventListener('DOMContentLoaded', initAppShell);
  window.addEventListener('resize', syncWorkspaceOffsets);
})();
