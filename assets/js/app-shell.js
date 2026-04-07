(() => {
  const FIXED_ROLE_BY_PAGE = {
    'dashboard-admin.html': 'admin',
    'dashboard-anunciante.html': 'advertiser',
    'users.html': 'admin'
  };

  const MENUS = {
    admin: [
      { href: 'dashboard-admin.html', label: 'Painel' },
      { href: 'users.html', label: 'Usuários' },
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

  function syncWorkspaceOffsets() {
    const root = document.documentElement;
    const topbar = document.querySelector('.navbar.sticky-top');
    const menuShell = document.querySelector('.workspace-menu-shell');

    if (topbar) {
      root.style.setProperty('--app-topbar-height', `${Math.ceil(topbar.offsetHeight)}px`);
    }

    root.style.setProperty(
      '--workspace-menu-height',
      menuShell ? `${Math.ceil(menuShell.offsetHeight + 16)}px` : '0px'
    );
  }

  function inferRole(profile) {
    const explicitRole = document.body?.dataset?.navRole;
    if (explicitRole) {
      return window.Auth.normalizeRole(explicitRole);
    }

    const currentPage = getCurrentPage();
    if (FIXED_ROLE_BY_PAGE[currentPage]) {
      return FIXED_ROLE_BY_PAGE[currentPage];
    }

    return window.Auth.normalizeRole(profile?.role);
  }

  function buildMenuItem(item, isActive) {
    const link = document.createElement('a');
    link.href = item.href;
    link.className = `workspace-menu-link${isActive ? ' is-active' : ''}`;
    link.textContent = item.label;

    if (isActive) {
      link.setAttribute('aria-current', 'page');
    }

    return link;
  }

  function renderWorkspaceMenu(profile) {
    const shell = document.querySelector('.workspace-menu-shell');
    if (!shell || !window.Auth) return;

    const role = inferRole(profile);
    const menuItems = MENUS[role] || MENUS.advertiser;
    const currentPage = getCurrentPage();

    shell.innerHTML = '';
    menuItems.forEach((item) => {
      shell.appendChild(buildMenuItem(item, item.href === currentPage));
    });

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
      renderWorkspaceMenu(profile);
      updateDashboardLinks(profile);
    } catch (error) {
      console.error('Falha ao padronizar a navegacao interna:', error);
      syncWorkspaceOffsets();
    }
  }

  document.addEventListener('DOMContentLoaded', initAppShell);
  window.addEventListener('resize', syncWorkspaceOffsets);
})();
