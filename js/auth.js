const AUTH = {
  STORAGE_KEY: "cs2hub_user",

  getUser() {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  },

  setUser(data) {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
  },

  logout() {
    localStorage.removeItem(this.STORAGE_KEY);
    window.location.href = "/";
  },

  loginWithSteam() {
    const origin = window.location.origin;
    const returnTo = encodeURIComponent(`${origin}/api/steam-callback`);
    const realm = encodeURIComponent(origin);
    window.location.href =
      "https://steamcommunity.com/openid/login" +
      "?openid.ns=http://specs.openid.net/auth/2.0" +
      "&openid.mode=checkid_setup" +
      `&openid.return_to=${returnTo}` +
      `&openid.realm=${realm}` +
      "&openid.identity=http://specs.openid.net/auth/2.0/identifier_select" +
      "&openid.claimed_id=http://specs.openid.net/auth/2.0/identifier_select";
  },

  // Checa se voltou do login com ?login=...
  handleCallback() {
    const params = new URLSearchParams(window.location.search);
    const loginData = params.get("login");
    if (!loginData) return;
    try {
      const user = JSON.parse(decodeURIComponent(loginData));
      this.setUser(user);
      // Limpar URL
      window.history.replaceState({}, "", "/");
    } catch (e) {
      console.error("Erro ao processar login:", e);
    }
  },

  renderNav() {
    const area = document.getElementById("nav-login-area");
    if (!area) return;
    const user = this.getUser();
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
          <img src="https://community.cloudflare.steamstatic.com/public/images/signinthroughsteam/sits_01.png"
               alt="Steam" style="height:18px;width:auto">
          Entrar com Steam
        </button>`;
    }
  }
};

document.addEventListener("DOMContentLoaded", () => {
  AUTH.handleCallback(); // Primeiro processa o callback se vier da Steam
  AUTH.renderNav();      // Depois renderiza o nav com o usuário

  // Nav links ativos
  const path = window.location.pathname.replace(/\/$/, "") || "/";
  document.querySelectorAll(".nav-links a").forEach(a => {
    const href = new URL(a.href, location.origin).pathname.replace(/\/$/, "") || "/";
    if (href === path) a.classList.add("active");
  });

  // Busca global no nav
  const form = document.getElementById("nav-search-form");
  if (form) {
    form.addEventListener("submit", e => {
      e.preventDefault();
      const q = document.getElementById("nav-search-input")?.value.trim();
      if (q) window.location.href = `/jogador.html?nick=${encodeURIComponent(q)}`;
    });
  }
});
