// search.js — player search + profile page logic

async function initPlayerPage() {
  const params   = new URLSearchParams(window.location.search);
  const steamId  = params.get('id');
  const nick     = params.get('nick');

  if (steamId) {
    await loadPlayerById(steamId);
  } else if (nick) {
    await searchAndLoad(nick);
  } else {
    showError('Nenhum jogador especificado. Use ?id=STEAMID ou ?nick=nome');
  }
}

async function searchAndLoad(nick) {
  showLoading(`Pesquisando "${nick}"...`);
  try {
    const res  = await fetch(`/functions/search?nick=${encodeURIComponent(nick)}`);
    const data = await res.json();

    if (data.results && data.results.length === 1) {
      // Exactly one result → load directly
      await loadPlayerById(data.results[0].steamid);
    } else if (data.results && data.results.length > 1) {
      showSearchResults(data.results, nick);
    } else {
      showError(`Nenhum jogador encontrado com o nick "${nick}". O jogador precisa ter feito login no site.`);
    }
  } catch (err) {
    showError('Erro ao pesquisar: ' + err.message);
  }
}

function showSearchResults(results, query) {
  hideLoading();
  const main = document.getElementById('player-main');
  if (!main) return;
  main.classList.remove('hidden');

  document.getElementById('player-content').innerHTML = `
    <div class="card fade-in">
      <div class="section-title" style="margin-bottom:1.5rem">
        <small>RESULTADOS</small>
        Pesquisa: <span class="accent">${escHtml(query)}</span>
      </div>
      <div class="top5-grid stagger">
        ${results.map(p => `
          <a href="/jogador.html?id=${escHtml(p.steamid)}" class="top5-card">
            <img class="top5-avatar" src="${escHtml(p.avatar||'')}" alt="${escHtml(p.personaname)}"
                 onerror="this.src='https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_medium.jpg'">
            <div>
              <div class="top5-name">${escHtml(p.personaname)}</div>
              <div class="top5-score mono" style="font-size:.75rem;color:var(--text-dim)">#${escHtml(p.steamid)}</div>
            </div>
          </a>`).join('')}
      </div>
    </div>`;
}

async function loadPlayerById(steamId) {
  showLoading('Carregando perfil...');
  try {
    // Load profile + stats
    const profRes  = await fetch(`/functions/steam-profile?steamid=${encodeURIComponent(steamId)}`);
    const profData = await profRes.json();
    if (profData.error) throw new Error(profData.error);

    hideLoading();
    renderProfile(profData);

    // Load inventory async
    loadInventory(steamId);
  } catch (err) {
    showError('Erro ao carregar perfil: ' + err.message);
  }
}

function renderProfile(data) {
  const main = document.getElementById('player-main');
  if (!main) return;
  main.classList.remove('hidden');

  const s = data.stats || {};
  const kills  = s.total_kills  || 0;
  const deaths = s.total_deaths || 0;
  const kd     = FMT.kd(kills, deaths);
  const kdCls  = FMT.kdClass(kd);

  // Page title
  document.title = `${data.personaname} — CS2HUB`;

  // Update breadcrumb / page heading if present
  const pageTitle = document.getElementById('page-player-name');
  if (pageTitle) pageTitle.textContent = data.personaname;

  // Favorite weapon
  const weaponKills = Object.entries(s)
    .filter(([k]) => k.startsWith('total_kills_') && !k.includes('headshot'))
    .map(([k, v]) => ({ weapon: k.replace('total_kills_', ''), kills: v }))
    .sort((a, b) => b.kills - a.kills);
  const favWeapon = weaponKills[0]?.weapon?.replace(/_/g, ' ') || '—';

  // Headshot %
  const hsPercent = deaths > 0 || kills > 0
    ? FMT.percent(s.total_kills_headshot || 0, kills)
    : '—';

  const isOnline = data.personastate === 1;

  document.getElementById('player-content').innerHTML = `
    <div class="fade-in">
      <!-- Profile Header -->
      <div class="profile-header">
        <div class="profile-avatar-wrap">
          <img class="profile-avatar" src="${escHtml(data.avatarfull||data.avatar||'')}" alt="${escHtml(data.personaname)}"
               onerror="this.src='https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_medium.jpg'">
          <span class="${isOnline ? 'online-badge' : 'online-badge offline-badge'}"></span>
        </div>
        <div class="profile-info">
          <div class="profile-name">${escHtml(data.personaname)}</div>
          <div class="profile-steam-link">
            <span>SteamID64: ${escHtml(data.steamid)}</span>
            ${data.profileurl ? `· <a href="${escHtml(data.profileurl)}" target="_blank" rel="noopener">Ver perfil Steam ↗</a>` : ''}
            <span>· ${FMT.onlineStatus(data.personastate)}</span>
          </div>
          <div class="profile-meta">
            <div class="profile-meta-item">
              <span class="profile-meta-label">Nível Steam</span>
              <span class="profile-meta-value orange">${data.steam_level != null ? data.steam_level : '—'}</span>
            </div>
            <div class="profile-meta-item">
              <span class="profile-meta-label">Horas no CS2</span>
              <span class="profile-meta-value">${FMT.hours(s.total_time_played)}</span>
            </div>
            <div class="profile-meta-item">
              <span class="profile-meta-label">ELO Premier</span>
              <span class="profile-meta-value ${data.premier_rating ? 'orange' : ''}">${data.premier_rating ? FMT.number(data.premier_rating) : 'N/D'}</span>
            </div>
            <div class="profile-meta-item">
              <span class="profile-meta-label">K/D Ratio</span>
              <span class="profile-meta-value ${kdCls}">${kd}</span>
            </div>
          </div>
        </div>
        <div style="margin-left:auto;flex-shrink:0">
          <a href="${escHtml(data.profileurl||'#')}" target="_blank" rel="noopener" class="btn btn-steam btn-sm">Steam ↗</a>
        </div>
      </div>

      ${!data.stats || Object.keys(data.stats).length === 0
        ? `<div class="alert alert-warning">⚠ Estatísticas de CS2 não disponíveis. O perfil pode estar privado.</div>`
        : ''}

      <!-- Stats Grid -->
      <div class="section-title mt-3"><small>ESTATÍSTICAS</small> CS2 Stats</div>
      <div class="stats-grid mt-2 stagger">
        <div class="stat-card">
          <div class="stat-card-label">Total de Kills</div>
          <div class="stat-card-value accent">${FMT.number(kills)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-label">Total de Mortes</div>
          <div class="stat-card-value">${FMT.number(deaths)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-label">K/D Ratio</div>
          <div class="stat-card-value ${kdCls}">${kd}</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-label">Headshot %</div>
          <div class="stat-card-value">${hsPercent}</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-label">Partidas</div>
          <div class="stat-card-value">${FMT.number(s.total_matches_played)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-label">Vitórias</div>
          <div class="stat-card-value accent">${FMT.number(s.total_wins)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-label">MVPs</div>
          <div class="stat-card-value">${FMT.number(s.total_mvps)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-label">Bombas Plantadas</div>
          <div class="stat-card-value">${FMT.number(s.total_planted_bombs)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-label">Bombas Desarmadas</div>
          <div class="stat-card-value">${FMT.number(s.total_defused_bombs)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-label">Arma Favorita</div>
          <div class="stat-card-value" style="font-size:1.1rem;text-transform:capitalize">${escHtml(favWeapon)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-label">Win Rate</div>
          <div class="stat-card-value">${FMT.percent(s.total_wins||0, s.total_matches_played||0)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-label">Tiros Acertados</div>
          <div class="stat-card-value">${FMT.number(s.total_shots_hit)}</div>
          <div class="stat-card-sub">de ${FMT.number(s.total_shots_fired)} disparados</div>
        </div>
      </div>

      <!-- Inventory Section -->
      <div class="section-title mt-4"><small>INVENTÁRIO</small> CS2 Items</div>
      <div id="inv-loading" class="loading-wrap">
        <div class="spinner"></div>
        <span class="loading-text">Carregando inventário...</span>
      </div>
      <div id="inv-area" class="hidden">
        <div class="inventory-header">
          <div class="inventory-total">
            <div class="inventory-total-label">Valor total do inventário</div>
            <div class="inventory-total-value" id="inv-total-brl">—</div>
            <div class="inventory-total-usd" id="inv-total-usd"></div>
            <div style="font-size:.78rem;color:var(--text-dim);margin-top:.2rem" id="inv-count"></div>
          </div>
          <div style="font-size:.78rem;color:var(--text-dim);max-width:280px;text-align:right">
            Preços via Steam Market. Inventário deve ser público para exibição.
          </div>
        </div>
        <div id="inv-filters" class="inventory-filters"></div>
        <div id="inventory-grid" class="inventory-grid"></div>
      </div>
    </div>`;
}

async function loadInventory(steamId) {
  try {
    const res  = await fetch(`/functions/steam-inventory?steamid=${encodeURIComponent(steamId)}`);
    const data = await res.json();

    document.getElementById('inv-loading')?.classList.add('hidden');
    document.getElementById('inv-area')?.classList.remove('hidden');

    if (data.error || !data.items) {
      document.getElementById('inventory-grid').innerHTML =
        `<div class="alert alert-warning">⚠ ${escHtml(data.error || 'Inventário indisponível. Perfil pode estar privado.')}</div>`;
      return;
    }

    renderInventory(data.items, 'inventory-grid', 'inv-total-brl', 'inv-total-usd');
  } catch (err) {
    document.getElementById('inv-loading')?.classList.add('hidden');
    document.getElementById('inv-area')?.classList.remove('hidden');
    document.getElementById('inventory-grid').innerHTML =
      `<div class="alert alert-error">⚠ Erro ao carregar inventário: ${escHtml(err.message)}</div>`;
  }
}

function showLoading(msg) {
  const loading = document.getElementById('player-loading');
  const main    = document.getElementById('player-main');
  if (loading) {
    loading.classList.remove('hidden');
    const txt = loading.querySelector('.loading-text');
    if (txt) txt.textContent = msg;
  }
  if (main) main.classList.add('hidden');
}

function hideLoading() {
  document.getElementById('player-loading')?.classList.add('hidden');
}

function showError(msg) {
  hideLoading();
  const errEl = document.getElementById('player-error');
  if (errEl) {
    errEl.classList.remove('hidden');
    errEl.innerHTML = `<div class="alert alert-error">⚠ ${escHtml(msg)}</div>`;
  }
  document.getElementById('player-main')?.classList.remove('hidden');
}

// ─── My Profile page ─────────────────────────────────────

async function initMyProfile() {
  const user = AUTH.getUser();
  if (!user) {
    window.location.href = '/';
    return;
  }
  await loadPlayerById(user.steamid);

  const refreshBtn = document.getElementById('btn-refresh');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', async () => {
      refreshBtn.disabled = true;
      refreshBtn.textContent = 'Atualizando...';
      try {
        const res  = await fetch(`/functions/steam-profile?steamid=${user.steamid}&refresh=1`);
        const data = await res.json();
        if (!data.error) AUTH.setUser(data);
        window.location.reload();
      } catch { window.location.reload(); }
    });
  }
}

if (document.getElementById('player-page')) {
  document.addEventListener('DOMContentLoaded', initPlayerPage);
}
if (document.getElementById('profile-page')) {
  document.addEventListener('DOMContentLoaded', initMyProfile);
}
