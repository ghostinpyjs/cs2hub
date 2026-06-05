const ADMIN_ID = "76561199851942884";
let allPlayers  = [];
let allListings = [];

function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function showTab(name) {
  document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('tab-' + name)?.classList.add('active');
  document.querySelectorAll('.admin-tab').forEach(t => {
    if (t.getAttribute('onclick') === `showTab('${name}')`) t.classList.add('active');
  });
}

async function initAdmin() {
  // Aguarda o auth.js estar pronto (até 3s)
  let attempts = 0;
  while (typeof AUTH === 'undefined' && attempts < 30) {
    await new Promise(r => setTimeout(r, 100));
    attempts++;
  }

  const user = typeof AUTH !== 'undefined' ? AUTH.getUser() : null;
  const id   = user?.steam_id || user?.steamid;

  document.getElementById('admin-loading')?.classList.add('hidden');

  if (!user || id !== ADMIN_ID) {
    document.getElementById('admin-denied')?.classList.remove('hidden');
    return;
  }

  document.getElementById('admin-content')?.classList.remove('hidden');
  await Promise.all([loadStats(), loadPlayers(), loadListings()]);

  document.getElementById('admin-search')?.addEventListener('input', e => {
    const q = e.target.value.toLowerCase();
    renderPlayers(q ? allPlayers.filter(p => p.nick?.toLowerCase().includes(q)) : allPlayers);
  });
}

async function loadStats() {
  try {
    const [pRes, mRes] = await Promise.all([
      fetch('/ranking-api?limit=1000'),
      fetch('/api/market-list'),
    ]);
    const pData = await pRes.json();
    const mData = mRes.ok ? await mRes.json() : { listings: [] };
    const players  = pData.players  || [];
    const listings = mData.listings || [];
    const active   = listings.filter(l => l.status === 'active').length;
    const totalVal = players.reduce((s, p) => s + (p.inventory_value || 0), 0);
    const banned   = players.filter(p => p.banned).length;
    const avgHours = players.length ? Math.round(players.reduce((s,p) => s + (p.hours||0), 0) / players.length) : 0;
    const topKD    = [...players].sort((a,b) => parseFloat(b.kd||0) - parseFloat(a.kd||0))[0];

    document.getElementById('admin-stats').innerHTML = `
      <div class="stat-box"><div class="stat-box-num">${players.length}</div><div class="stat-box-label">Jogadores</div></div>
      <div class="stat-box"><div class="stat-box-num" style="color:var(--red)">${banned}</div><div class="stat-box-label">Banidos</div></div>
      <div class="stat-box"><div class="stat-box-num">${listings.length}</div><div class="stat-box-label">Anúncios Total</div></div>
      <div class="stat-box"><div class="stat-box-num" style="color:var(--green)">${active}</div><div class="stat-box-label">Anúncios Ativos</div></div>
      <div class="stat-box"><div class="stat-box-num">$${totalVal.toFixed(0)}</div><div class="stat-box-label">Val. Inventários</div></div>
      <div class="stat-box"><div class="stat-box-num">${avgHours}h</div><div class="stat-box-label">Média de Horas</div></div>
      ${topKD ? `<div class="stat-box"><div class="stat-box-num" style="font-size:1rem">${escHtml(topKD.nick)}</div><div class="stat-box-label">Melhor K/D (${topKD.kd})</div></div>` : ''}
    `;
  } catch (e) { console.error(e); }
}

async function loadPlayers() {
  try {
    const res  = await fetch('/ranking-api?limit=1000');
    const data = await res.json();
    allPlayers = data.players || [];
    renderPlayers(allPlayers);
  } catch (e) { console.error(e); }
}

function renderPlayers(players) {
  const tbody = document.getElementById('admin-players-tbody');
  if (!tbody) return;
  if (!players.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-dim);padding:2rem">Nenhum jogador.</td></tr>';
    return;
  }
  tbody.innerHTML = players.map(p => `
    <tr style="${p.banned ? 'opacity:.5' : ''}">
      <td>
        <div style="display:flex;align-items:center;gap:.6rem">
          <img src="${p.avatar||''}" style="width:32px;height:32px;border-radius:4px;flex-shrink:0"
               onerror="this.src='https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_medium.jpg'">
          <div>
            <a href="/jogador.html?id=${p.steam_id}" style="color:var(--text-primary);font-weight:600">${escHtml(p.nick)}</a>
            <div style="font-size:.72rem;color:var(--text-dim);font-family:monospace">${p.steam_id}</div>
          </div>
        </div>
      </td>
      <td>${p.hours || 0}h</td>
      <td style="color:${parseFloat(p.kd||0)>=1.2?'var(--green)':parseFloat(p.kd||0)<=0.85?'var(--red)':'var(--text-primary)'}">${p.kd || '—'}</td>
      <td>$${(p.inventory_value||0).toFixed(2)}</td>
      <td style="font-size:.8rem;color:var(--text-dim)">${p.last_login ? new Date(p.last_login).toLocaleDateString('pt-BR') : '—'}</td>
      <td><span class="${p.banned ? 'badge-banned' : 'badge-active'}">${p.banned ? '⛔ BANIDO' : '✓ ATIVO'}</span></td>
      <td style="display:flex;gap:.4rem;flex-wrap:wrap">
        ${p.steam_id !== ADMIN_ID ? `
          <button class="${p.banned ? 'btn-success' : 'btn-danger'}" onclick="toggleBan('${p.steam_id}',${!p.banned})">
            ${p.banned ? 'Desbanir' : 'Banir'}
          </button>
          <button class="btn-danger" onclick="deletePlayer('${p.steam_id}')">Deletar</button>
        ` : '<span style="color:var(--orange);font-size:.8rem">👑 Admin</span>'}
      </td>
    </tr>
  `).join('');
}

async function loadListings() {
  try {
    const res  = await fetch('/api/market-list');
    if (!res.ok) return;
    const data = await res.json();
    allListings = data.listings || [];
    renderListings(allListings);
  } catch (e) { console.error(e); }
}

function renderListings(listings) {
  const tbody = document.getElementById('admin-market-tbody');
  if (!tbody) return;
  if (!listings.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-dim);padding:2rem">Nenhum anúncio.</td></tr>';
    return;
  }
  tbody.innerHTML = listings.map(l => `
    <tr>
      <td>
        <div style="display:flex;align-items:center;gap:.6rem">
          ${l.item_icon ? `<img src="https://community.cloudflare.steamstatic.com/economy/image/${l.item_icon}/60fx45f" style="height:36px">` : '🔫'}
          <span style="font-size:.85rem">${escHtml(l.item_name)}</span>
        </div>
      </td>
      <td style="font-size:.8rem">${escHtml(l.nick || l.steam_id)}</td>
      <td style="font-size:.8rem;color:#5865F2">${l.discord_tag ? escHtml(l.discord_tag) : '<span style="color:var(--text-dim)">—</span>'}</td>
      <td><span style="color:var(--orange);font-weight:700">$${parseFloat(l.price_usd||0).toFixed(2)}</span></td>
      <td><span class="${l.status==='active'?'badge-active':'badge-banned'}">${l.status==='active'?'✓ Ativo':'✕ Removido'}</span></td>
      <td style="font-size:.8rem;color:var(--text-dim)">${l.created_at ? new Date(l.created_at).toLocaleDateString('pt-BR') : '—'}</td>
      <td>
        ${l.status === 'active' ? `<button class="btn-danger" onclick="removeListingAdmin('${l.id}')">Remover</button>` : '—'}
      </td>
    </tr>
  `).join('');
}

async function toggleBan(steamId, ban) {
  if (!confirm(`${ban ? 'Banir' : 'Desbanir'} este jogador?`)) return;
  try {
    const res = await fetch('/api/admin-ban', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ steam_id: steamId, banned: ban, admin_id: ADMIN_ID }),
    });
    if (!res.ok) throw new Error('Falha');
    await loadPlayers();
    await loadStats();
  } catch (e) { alert('Erro ao atualizar: ' + e.message); }
}

async function deletePlayer(steamId) {
  if (!confirm('Deletar permanentemente este jogador?')) return;
  try {
    const res = await fetch('/api/admin-delete-player', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ steam_id: steamId, admin_id: ADMIN_ID }),
    });
    if (!res.ok) throw new Error('Falha');
    await loadPlayers();
    await loadStats();
  } catch (e) { alert('Erro ao deletar: ' + e.message); }
}

async function removeListingAdmin(listingId) {
  if (!confirm('Remover este anúncio?')) return;
  try {
    const res = await fetch('/api/market-remove', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listing_id: listingId, admin_id: ADMIN_ID }),
    });
    if (!res.ok) throw new Error('Falha');
    await loadListings();
    await loadStats();
  } catch (e) { alert('Erro ao remover: ' + e.message); }
}

document.addEventListener('DOMContentLoaded', initAdmin);
