// ranking.js

let allPlayers = [];
let sortKey = 'hours';
let sortDir = 'desc';

async function initRanking() {
  setupSearch();
  setupColumnHeaders();
  await loadRanking('hours');
}

async function loadRanking(orderBy) {
  const tbody = document.getElementById('ranking-tbody');
  const wrap  = document.getElementById('ranking-wrap');
  if (!tbody) return;

  tbody.innerHTML = '';
  if (wrap) wrap.classList.add('hidden');
  document.getElementById('ranking-loading')?.classList.remove('hidden');

  try {
    const res  = await fetch(`/ranking-api?sort=${orderBy}`);
    const data = await res.json();
    allPlayers = data.players || [];

    document.getElementById('ranking-loading')?.classList.add('hidden');
    if (wrap) wrap.classList.remove('hidden');

    const totalEl = document.getElementById('total-players');
    if (totalEl) totalEl.textContent = FMT.number(data.total || allPlayers.length);

    renderTable(allPlayers);
  } catch (err) {
    document.getElementById('ranking-loading')?.classList.add('hidden');
    if (wrap) wrap.classList.remove('hidden');
    tbody.innerHTML = `<tr><td colspan="8"><div class="alert alert-error mt-2">⚠ Erro ao carregar ranking: ${escHtml(err.message)}</div></td></tr>`;
  }
}

function renderTable(players) {
  const tbody = document.getElementById('ranking-tbody');
  if (!tbody) return;

  if (!players.length) {
    tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><div class="empty-icon">🎯</div><p>Nenhum jogador encontrado.</p></div></td></tr>`;
    return;
  }

  tbody.innerHTML = players.map((p, i) => {
    const rank    = p.rank || i + 1;
    const rowCls  = rank === 1 ? 'top-1' : rank === 2 ? 'top-2' : rank === 3 ? 'top-3' : '';
    const badgeCls= rank === 1 ? 'gold'  : rank === 2 ? 'silver': rank === 3 ? 'bronze': 'normal';
    const kd      = p.kd || '—';
    const kdCls   = FMT.kdClass(kd);

    return `<tr class="${rowCls}">
      <td><span class="rank-badge ${badgeCls}">${rank}</span></td>
      <td>
        <a href="/jogador.html?id=${escHtml(p.steam_id)}" class="player-cell" style="text-decoration:none">
          <img class="player-avatar" src="${escHtml(p.avatar||'')}" alt=""
               onerror="this.src='https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_medium.jpg'">
          <div>
            <div class="player-name">${escHtml(p.nick)}</div>
            <div class="player-id">#${escHtml(p.steam_id)}</div>
          </div>
        </a>
      </td>
      <td><span class="stat-val">${p.elo || '—'}</span></td>
      <td><span class="stat-val">${p.hours || 0}h</span></td>
      <td><span class="stat-val">${p.steam_level ?? '—'}</span></td>
      <td>
        <span class="stat-val highlight">${FMT.usd(p.inventory_value)}</span>
        <span class="text-dim" style="font-size:.78rem;display:block">${FMT.brl(p.inventory_value)}</span>
      </td>
      <td><span class="stat-val ${kdCls}">${kd}</span></td>
      <td><span class="stat-val">${FMT.number(p.wins)}</span></td>
    </tr>`;
  }).join('');
}

function setupSearch() {
  const input = document.getElementById('ranking-search');
  if (!input) return;
  input.addEventListener('input', () => {
    const q = input.value.toLowerCase().trim();
    const filtered = q ? allPlayers.filter(p => p.nick?.toLowerCase().includes(q)) : allPlayers;
    renderTable(filtered);
  });
}

function setupColumnHeaders() {
  document.querySelectorAll('thead th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
      const key = th.dataset.sort;
      if (sortKey === key) {
        sortDir = sortDir === 'desc' ? 'asc' : 'desc';
      } else {
        sortKey = key;
        sortDir = 'desc';
      }
      document.querySelectorAll('thead th[data-sort]').forEach(t => {
        t.classList.remove('sorted');
        t.querySelector('.sort-icon').textContent = '⇅';
      });
      th.classList.add('sorted');
      th.querySelector('.sort-icon').textContent = sortDir === 'desc' ? '↓' : '↑';

      const sorted = [...allPlayers].sort((a, b) => {
        let va = getSortValue(a, key);
        let vb = getSortValue(b, key);
        if (typeof va === 'string') va = va.toLowerCase();
        if (typeof vb === 'string') vb = vb.toLowerCase();
        if (va < vb) return sortDir === 'desc' ? 1 : -1;
        if (va > vb) return sortDir === 'desc' ? -1 : 1;
        return 0;
      });

      const q = document.getElementById('ranking-search')?.value.toLowerCase().trim();
      const filtered = q ? sorted.filter(p => p.nick?.toLowerCase().includes(q)) : sorted;
      renderTable(filtered);
    });
  });
}

function getSortValue(player, key) {
  switch (key) {
    case 'hours':     return player.hours || 0;
    case 'elo':       return player.elo || 0;
    case 'level':     return player.steam_level || 0;
    case 'inv_value': return player.inventory_value || 0;
    case 'kd':        return parseFloat(player.kd) || 0;
    case 'matches':   return player.wins || 0;
    case 'name':      return player.nick || '';
    default: return 0;
  }
}

if (document.getElementById('ranking-page')) {
  document.addEventListener('DOMContentLoaded', initRanking);
}
