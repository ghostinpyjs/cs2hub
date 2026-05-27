const ADMIN_ID = "76561199851942884";

const AUTH = {
  STORAGE_KEY: "cs2hub_user",

  getUser() {
    try { return JSON.parse(localStorage.getItem(this.STORAGE_KEY)); } catch { return null; }
  },

  setUser(data) {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
  },

  logout() {
    localStorage.removeItem(this.STORAGE_KEY);
    window.location.href = "/";
  },

  loginWithSteam() {
    const origin   = window.location.origin;
    const returnTo = encodeURIComponent(`${origin}/api/steam-callback`);
    const realm    = encodeURIComponent(origin);
    window.location.href =
      "https://steamcommunity.com/openid/login" +
      "?openid.ns=http://specs.openid.net/auth/2.0" +
      "&openid.mode=checkid_setup" +
      `&openid.return_to=${returnTo}` +
      `&openid.realm=${realm}` +
      "&openid.identity=http://specs.openid.net/auth/2.0/identifier_select" +
      "&openid.claimed_id=http://specs.openid.net/auth/2.0/identifier_select";
  },

  handleCallback() {
    const params    = new URLSearchParams(window.location.search);
    const loginData = params.get("login");
    if (!loginData) return;
    try {
      this.setUser(JSON.parse(decodeURIComponent(loginData)));
      window.history.replaceState({}, "", "/");
    } catch (e) { console.error(e); }
  },

  renderNav() {
    const area = document.getElementById("nav-login-area");
    if (!area) return;
    const user    = this.getUser();
    const id      = user?.steam_id || user?.steamid;
    const isAdmin = id === ADMIN_ID;

    // Adicionar link Marketplace se não existir
    const navLinks = document.querySelector('.nav-links');
    if (navLinks) {
      if (!document.getElementById('nav-market-link')) {
        const li = document.createElement('li');
        li.id = 'nav-market-link';
        li.innerHTML = `<a href="/marketplace.html">Marketplace</a>`;
        navLinks.appendChild(li);
      }
      // Adicionar link Admin SOMENTE se for admin e ainda não existir
      if (isAdmin && !document.getElementById('nav-admin-link')) {
        const li = document.createElement('li');
        li.id = 'nav-admin-link';
        li.innerHTML = `<a href="/admin.html" style="color:var(--orange)">⚙ Admin</a>`;
        navLinks.appendChild(li);
      }
    }

    // Highlight link ativo
    const path = window.location.pathname.replace(/\/$/, "") || "/";
    document.querySelectorAll(".nav-links a").forEach(a => {
      const href = new URL(a.href, location.origin).pathname.replace(/\/$/, "") || "/";
      a.classList.toggle("active", href === path);
    });

    if (user) {
      area.innerHTML = `
        <div class="nav-user">
          <a href="/perfil.html" style="display:flex;align-items:center;gap:.6rem;text-decoration:none">
            <img class="nav-avatar" src="${user.avatar}" alt="${user.nick}"
                 onerror="this.src='https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_medium.jpg'">
            <span class="nav-username">${user.nick}</span>
          </a>
          <button class="btn btn-outline btn-sm" onclick="AUTH.logout()">Sair</button>
        </div>`;
    } else {
      area.innerHTML = `
        <button class="btn btn-steam" onclick="AUTH.loginWithSteam()">
          <img src="https://community.cloudflare.steamstatic.com/public/images/signinthroughsteam/sits_01.png" alt="Steam" style="height:18px;width:auto">
          Entrar com Steam
        </button>`;
    }
  }
};

const UI = {
  showGlobalLoading(msg = "Carregando...") {
    let el = document.getElementById("global-loading");
    if (!el) {
      el = document.createElement("div");
      el.id = "global-loading";
      el.style.cssText = `position:fixed;inset:0;background:rgba(10,11,13,.85);z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1rem;font-family:'Rajdhani',sans-serif;color:#9aa3b8`;
      el.innerHTML = `<div class="spinner"></div><span class="loading-text" id="global-loading-msg">${msg}</span>`;
      document.body.appendChild(el);
    } else {
      document.getElementById("global-loading-msg").textContent = msg;
      el.style.display = "flex";
    }
  },
  hideGlobalLoading() {
    const el = document.getElementById("global-loading");
    if (el) el.style.display = "none";
  }
};

document.addEventListener("DOMContentLoaded", () => {
  AUTH.handleCallback();
  AUTH.renderNav();

  const form = document.getElementById("nav-search-form");
  if (form) {
    form.addEventListener("submit", e => {
      e.preventDefault();
      const q = document.getElementById("nav-search-input")?.value.trim();
      if (q) window.location.href = `/jogador.html?nick=${encodeURIComponent(q)}`;
    });
  }
});
