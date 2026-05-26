// auth.js — Steam OpenID authentication handling

const AUTH = {
  STORAGE_KEY: 'cs2hub_user',

  getUser() {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  },

  setUser(userData) {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(userData));
  },

  logout() {
    localStorage.removeItem(this.STORAGE_KEY);
    window.location.href = '/';
  },

  loginWithSteam() {
    const siteUrl = window.location.origin;
    const returnTo = encodeURIComponent(`${siteUrl}/steam-callback`);
    const realm    = encodeURIComponent(siteUrl);
    const steamUrl =
      `https://steamcommunity.com/openid/login` +
      `?openid.ns=http://specs.openid.net/auth/2.0` +
      `&openid.mode=checkid_setup` +
      `&openid.return_to=${returnTo}` +
      `&openid.realm=${realm}` +
      `&openid.identity=http://specs.openid.net/auth/2.0/identifier_select` +
      `&openid.claimed_id=http://specs.openid.net/auth/2.0/identifier_select`;
    window.location.href = steamUrl;
  },

  // Chamado ao carregar a página — verifica se voltou do callback com ?steamid=
  async handleCallback() {
    const params  = new URLSearchParams(window.location.search);
    const steamId = params.get('steamid');
    if (!steamId) return;

    try {
      UI.showGlobalLoading('Carregando perfil Steam...');
      const res  = await fetch(`/steam-profile?steamid=${steamId}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      AUTH.setUser(data);
      // Limpar ?steamid= da URL sem recarregar a página
      window.history.replaceState({}, '', window.location.pathname);
    } catch (err) {
      console.error('Callback error:', err);
    } finally {
      UI.hideGlobalLoading();
    }
  },

  renderNav() {
    const user = this.getUser();
    const loginArea = document.getElementById('nav-login-area');
    if (!loginArea) return;

    if (user) {
      loginArea.innerHTML = `
        <div class="nav-user">
          <a href="/perfil.html" style="display:flex;align-items:center;gap:.6rem;text-decoration:none">
            <img class="nav-avatar" src="${user.avatar}" alt="${user.nick || user.personaname}"
                 onerror="this.src='https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_medium.jpg'">
            <span class="nav-username">${user.nick || user.personaname}</span>
          </a>
          <button class="btn btn-outline btn-sm" onclick="AUTH.logout()">Sair</button>
        </div>`;
    } else {
      loginArea.innerHTML = `
        <button class="btn btn-steam" onclick="AUTH.loginWithSteam()">
          <img src="https://community.cloudflare.steamstatic.com/public/images/signinthroughsteam/sits_01.png" alt="Steam" style="height:18px;width:auto">
          Entrar com Steam
        </button>`;
    }
  }
};

const UI = {
  showGlobalLoading(msg = 'Carregando...') {
    let el = document.getElementById('global-loading');
    if (!el) {
      el = document.createElement('div');
      el.id = 'global-loading';
      el.style.cssText = `position:fixed;inset:0;background:rgba(10,11,13,.85);z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1rem;font-family:'Rajdhani',sans-serif;color:#9aa3b8`;
      el.innerHTML = `<div class="spinner"></div><span class="loading-text" id="global-loading-msg">${msg}</span>`;
      document.body.appendChild(el);
    } else {
      document.getElementById('global-loading-msg').textContent = msg;
      el.style.display = 'flex';
    }
  },
  hideGlobalLoading() {
    const el = document.getElementById('global-loading');
    if (el) el.style.display = 'none';
  }
};

document.addEventListener('DOMContentLoaded', async () => {
  AUTH.renderNav();
  await AUTH.handleCallback();
  AUTH.renderNav(); // re-renderiza após callback para mostrar o usuário logado

  const path = window.location.pathname.replace(/\/$/, '') || '/';
  document.querySelectorAll('.nav-links a').forEach(a => {
    const href = new URL(a.href, location.origin).pathname.replace(/\/$/, '') || '/';
    if (href === path) a.classList.add('active');
  });

  const navSearchForm = document.getElementById('nav-search-form');
  if (navSearchForm) {
    navSearchForm.addEventListener('submit', e => {
      e.preventDefault();
      const q = document.getElementById('nav-search-input')?.value.trim();
      if (q) window.location.href = `/jogador.html?nick=${encodeURIComponent(q)}`;
    });
  }
});
