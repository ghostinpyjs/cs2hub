// search.js

async function initPlayerPage() {
  const params  = new URLSearchParams(window.location.search);
  const steamId = params.get('id');
  const nick    = params.get('nick');

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
    const res  = await fetch(`/search-api?q=${encodeURIComponent(nick)}`);
    const data = await res.json();
    const results = data.players || [];

    if (results.length === 1) {
      await loadPlayerById(results[0].steam_id);
    } else if (results.length > 1) {
      showSearchResults(results, nick);
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
          <a href="/jogador.html?id=${escHtml(p.steam_id)}" class="top5-card">
            <img class="top5-avatar" src="${escHtml(p.avatar||'')}" alt="${escHtml(p.nick||'')}"
                 onerror="this.src='https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_medium.jpg'">
            <div>
              <div class="top5-name">${escHtml(p.nick)}</div>
              <div class="top5-score mono" style="font-size:.75rem;color:var(--text-dim)">#${escHtml(p.steam_id)}</div>
            </div>
          </a>`).join('')}
      </div>
    </div>`;
}

async function loadPlayerById(steamId) {
  showLoading('Carregando perfil...');
  try {
    const profRes  = await fetch(`/steam-profile?steamid=${encodeURIComponent(steamId)}`);
    const profData = await profRes.json();
    if (profData.error) throw new Error(profData.error);
    hideLoading();
    renderProfile(profData);
    loadInventory(steamId);
  } catch (err) {
    showError('Erro ao carregar perfil: ' + err.message);
  }
}

function renderProfile(data) {
  const main = document.getElementById('player-main');
  if (!main) return;
  main.classList.remove('hidden');

  // Campos compatíveis com snake_case (Supabase) e camelCase
  const nick       = data.nick || data.personaname || '—';
  const avatar     = data.avatar || data.avatarfull || '';
  const profileUrl = data.profile_url || data.profileurl || '#';
  const steamId    = data.steam_id || data.steamid || '';
  const steamLevel = data.steam_level ?? '—';
  const hours      = data.hours ?? 0;
  const kills      = data.kills ?? 0;
  const deaths     = data.deaths ?? 0;
  const kd         = data.kd || FMT.kd(kills, deaths);
  const kdCls      = FMT.kdClass(kd);
  const hsPercent  = data.hs_percent || '0.0';
  const mvps       = data.mvps ?? 0;
  const wins       = data.wins ?? 0;
  const favWeapon  = data.fav_weapon || '—';

  document.title = `${nick} — CS2HUB`;
  const pageTitle = document.getElementById('page-player-name');
  if (pageTitle) pageTitle.textContent = nick;

  document.getElementById('player-content').innerHTML = `
    <div class="fade-in">
      <div class="profile-header">
        <div class="profile-avatar-wrap">
          <img class="profile-avatar" src="${escHtml(avatar)}" alt="${escHtml(nick)}"
               onerror="this.src='https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_medium.jpg'">
        </div>
        <div class="profile-info">
          <div class="profile-name">${escHtml(nick)}</div>
          <div class="profile-steam-link">
            <span>SteamID64: ${escHtml(steamId)}</span>
            ${profileUrl !== '#' ? `· <a href="${escHtml(profileUrl)}" target="_blank" rel="noopener">Ver perfil Steam ↗</a>` : ''}
          </div>
          <div class="profile-meta">
            <div class="profile-meta-item">
              <span class="profile-meta-label">Nível Steam</span>
              <span class="profile-meta-value orange">${steamLevel}</span>
            </div>
            <div class="profile-meta-item">
              <span class="profile-meta-label">Horas no CS2</span>
              <span class="profile-meta-value">${hours}h</span>
            </div>
            <div class="profile-meta-item">
              <span class="profile-meta-label">ELO Premier</span>
              <span class="profile-meta-value">${data.elo || 'N/D'}</span>
            </div>
            <div class="profile-meta-item">
              <span class="profile-meta-label">K/D Ratio</span>
              <span class="profile-meta-value ${kdCls}">${kd}</span>
            </div>
          </div>
        </div>
        <div style="margin-left:auto;flex-shrink:0">
          <a href="${escHtml(profileUrl)}" target="_blank" rel="noopener" class="btn btn-steam btn-sm">Steam ↗</a>
        </div>
      </div>

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
          <div class="stat-card-value">${hsPercent}%</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-label">Vitórias</div>
          <div class="stat-card-value accent">${FMT.number(wins)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-label">MVPs</div>
          <div class="stat-card-value">${FMT.number(mvps)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-label">Horas no CS2</div>
          <div class="stat-card-value">${hours}h</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-label">Arma Favorita</div>
          <div class="stat-card-value" style="font-size:1.1rem">${escHtml(favWeapon)}</div>
        </div>
      </div>

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
        </div>
        <div id="inv-filters" class="inventory-filters"></div>
        <div id="inventory-grid" class="inventory-grid"></div>
      </div>
    </div>`;
}

async function loadInventory(steamId) {
  try {
    const res  = await fetch(`/steam-inventory?steamid=${encodeURIComponent(steamId)}`);
    const data = await res.json();
    document.getElementById('inv-loading')?.classList.add('hidden');
    document.getElementById('inv-area')?.classList.remove('hidden');
    if (data.error || !data.items) {
      document.getElementById('inventory-grid').innerHTML =
        `<div class="alert alert-warning">⚠ ${escHtml(data.error || 'Inventário indisponível ou privado.')}</div>`;
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

async function initMyProfile() {
  const user = AUTH.getUser();
  if (!user) { window.location.href = '/'; return; }

  // Compatível com steam_id e steamid
  const id = user.steam_id || user.steamid;
  await loadPlayerById(id);

  const refreshBtn = document.getElementById('btn-refresh');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', async () => {
      refreshBtn.disabled = true;
      refreshBtn.textContent = 'Atualizando...';
      try {
        const res  = await fetch(`/steam-profile?steamid=${id}`);
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
