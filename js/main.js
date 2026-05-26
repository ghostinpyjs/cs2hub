// main.js — shared utilities + home page

// ─── Steam helpers ────────────────────────────────────────

const STEAM = {
  async getProfile(steamId) {
    const res = await fetch(`/functions/steam-profile?steamid=${steamId}`);
    return res.json();
  },
  async getInventory(steamId) {
    const res = await fetch(`/functions/steam-inventory?steamid=${steamId}`);
    return res.json();
  }
};

// ─── Formatting helpers ───────────────────────────────────

const FMT = {
  number(n) {
    if (n == null || isNaN(n)) return '—';
    return Number(n).toLocaleString('pt-BR');
  },
  kd(kills, deaths) {
    if (!deaths || deaths === 0) return kills ? '∞' : '—';
    return (kills / deaths).toFixed(2);
  },
  kdClass(kd) {
    const v = parseFloat(kd);
    if (isNaN(v)) return 'kd-neutral';
    if (v >= 1.2) return 'kd-good';
    if (v <= 0.85) return 'kd-bad';
    return 'kd-neutral';
  },
  hours(secs) {
    if (!secs) return '0h';
    return Math.round(secs / 3600) + 'h';
  },
  brl(usd) {
    if (!usd || isNaN(usd)) return '—';
    const brl = usd * 5.0; // approximate rate
    return 'R$ ' + brl.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  },
  usd(val) {
    if (!val || isNaN(val)) return '—';
    return '$' + Number(val).toFixed(2);
  },
  onlineStatus(state) {
    const map = { 0: 'Offline', 1: 'Online', 2: 'Ocupado', 3: 'Ausente', 4: 'Dormindo', 5: 'Trocar', 6: 'Jogar' };
    return map[state] || 'Desconhecido';
  },
  percent(val, total) {
    if (!total) return '0%';
    return ((val / total) * 100).toFixed(1) + '%';
  }
};

// ─── HOME PAGE ────────────────────────────────────────────

async function initHome() {
  const user = AUTH.getUser();

  // Hero section personalization
  const heroWelcome = document.getElementById('hero-welcome');
  const heroDefault = document.getElementById('hero-default');
  if (user && heroWelcome) {
    heroWelcome.classList.remove('hidden');
    if (heroDefault) heroDefault.classList.add('hidden');
    heroWelcome.querySelector('.welcome-avatar').src = user.avatar;
    heroWelcome.querySelector('.welcome-name').textContent = user.personaname;
  }

  // Load top 5 ranking preview
  loadTop5();

  // Home search form
  const homeSearch = document.getElementById('home-search-form');
  if (homeSearch) {
    homeSearch.addEventListener('submit', e => {
      e.preventDefault();
      const q = document.getElementById('home-search-input')?.value.trim();
      if (q) window.location.href = `/jogador.html?nick=${encodeURIComponent(q)}`;
    });
  }
}

async function loadTop5() {
  const container = document.getElementById('top5-container');
  if (!container) return;
  container.innerHTML = `<div class="loading-wrap"><div class="spinner"></div><span class="loading-text">Carregando ranking...</span></div>`;

  try {
    const res  = await fetch('/functions/ranking?limit=5');
    const data = await res.json();
    const players = data.players || [];

    if (!players.length) {
      container.innerHTML = `<div class="empty-state"><div class="empty-icon">🎯</div><p>Nenhum jogador ainda. Seja o primeiro!</p></div>`;
      return;
    }

    const rankClasses = ['gold', 'silver', 'bronze', '', ''];
    container.innerHTML = `<div class="top5-grid stagger">
      ${players.map((p, i) => `
        <a href="/jogador.html?id=${p.steamid}" class="top5-card rank-${i+1}">
          <span class="top5-rank ${rankClasses[i]}">${i+1}</span>
          <img class="top5-avatar" src="${p.avatar || ''}" alt="${p.personaname}"
               onerror="this.src='https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_medium.jpg'">
          <div>
            <div class="top5-name">${escHtml(p.personaname)}</div>
            <div class="top5-score">${FMT.hours(p.stats?.total_time_played)} · KD ${FMT.kd(p.stats?.total_kills, p.stats?.total_deaths)}</div>
          </div>
        </a>
      `).join('')}
    </div>`;

    // Update counter
    const countEl = document.getElementById('stat-players-count');
    if (countEl && data.total) countEl.textContent = FMT.number(data.total) + '+';

  } catch (err) {
    container.innerHTML = `<div class="alert alert-error">⚠ Erro ao carregar ranking</div>`;
  }
}

// ─── XSS guard ───────────────────────────────────────────

function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Run on home page
if (document.getElementById('home-page')) {
  document.addEventListener('DOMContentLoaded', initHome);
}
