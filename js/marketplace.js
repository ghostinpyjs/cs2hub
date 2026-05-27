// marketplace.js
let inventoryItems = [];

async function initMarketplace() {
  const user = AUTH.getUser();
  if (user) {
    document.getElementById('btn-anunciar').style.display = 'block';
    await carregarInventario(user.steam_id || user.steamid);
  }
  await carregarAnuncios();

  document.getElementById('market-search')?.addEventListener('input', e => {
    const q = e.target.value.toLowerCase();
    const cards = document.querySelectorAll('.market-card');
    cards.forEach(c => {
      c.style.display = c.dataset.name?.toLowerCase().includes(q) ? '' : 'none';
    });
  });
}

async function carregarInventario(steamId) {
  try {
    const res  = await fetch(`/steam-inventory?steamid=${steamId}`);
    const data = await res.json();
    inventoryItems = data.items || [];
    const sel = document.getElementById('select-item');
    if (!sel) return;
    if (!inventoryItems.length) {
      sel.innerHTML = '<option value="">Inventário vazio ou privado</option>';
      return;
    }
    sel.innerHTML = '<option value="">Selecione um item...</option>' +
      inventoryItems.map((item, i) =>
        `<option value="${i}">${escHtml(item.name)} — $${item.price_usd?.toFixed(2) || '0.00'}</option>`
      ).join('');
  } catch (e) { console.error(e); }
}

async function carregarAnuncios() {
  document.getElementById('market-loading')?.classList.remove('hidden');
  try {
    const res  = await fetch('/api/market-list');
    const data = await res.json();
    const listings = (data.listings || []).filter(l => l.status === 'active');

    document.getElementById('market-loading')?.classList.add('hidden');

    if (!listings.length) {
      document.getElementById('market-empty')?.classList.remove('hidden');
      return;
    }

    document.getElementById('market-grid').innerHTML = listings.map(l => `
      <div class="market-card" data-name="${escHtml(l.item_name)}">
        <div class="market-img">
          ${l.item_icon
            ? `<img src="https://community.cloudflare.steamstatic.com/economy/image/${l.item_icon}/200fx150f" alt="${escHtml(l.item_name)}">`
            : '<span style="font-size:2rem">🔫</span>'}
        </div>
        <div class="market-info">
          <div class="market-name" title="${escHtml(l.item_name)}">${escHtml(l.item_name)}</div>
          <div class="market-seller">
            ${l.avatar ? `<img src="${l.avatar}" onerror="this.style.display='none'">` : ''}
            ${escHtml(l.nick || 'Jogador')}
          </div>
          ${l.description ? `<div style="font-size:.78rem;color:var(--text-dim);margin-bottom:.5rem">${escHtml(l.description)}</div>` : ''}
          <div class="market-price">$${parseFloat(l.price_usd).toFixed(2)}</div>
          <div class="market-price-brl">R$ ${parseFloat(l.price_brl || l.price_usd * 5).toFixed(2)}</div>
        </div>
      </div>
    `).join('');
  } catch (e) {
    document.getElementById('market-loading')?.classList.add('hidden');
    document.getElementById('market-empty')?.classList.remove('hidden');
  }
}

function abrirModal() {
  const user = AUTH.getUser();
  if (!user) { alert('Faça login primeiro!'); return; }
  document.getElementById('modal-anunciar').classList.add('open');
}

function fecharModal() {
  document.getElementById('modal-anunciar').classList.remove('open');
  document.getElementById('modal-error').classList.add('hidden');
}

async function publicarAnuncio() {
  const user  = AUTH.getUser();
  const idx   = document.getElementById('select-item').value;
  const price = parseFloat(document.getElementById('input-price').value);
  const desc  = document.getElementById('input-desc').value.trim();
  const errEl = document.getElementById('modal-error');

  if (!user)            { errEl.textContent = 'Faça login primeiro.'; errEl.classList.remove('hidden'); return; }
  if (idx === '')       { errEl.textContent = 'Selecione um item.';   errEl.classList.remove('hidden'); return; }
  if (!price || price <= 0) { errEl.textContent = 'Informe um preço válido.'; errEl.classList.remove('hidden'); return; }

  errEl.classList.add('hidden');
  const item = inventoryItems[parseInt(idx)];

  const res = await fetch('/api/market-post', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      steam_id:  user.steam_id || user.steamid,
      item_name: item.name,
      item_icon: item.icon_url,
      price_usd: price,
      price_brl: (price * 5.0).toFixed(2),
      description: desc,
    }),
  });

  if (res.ok) {
    fecharModal();
    await carregarAnuncios();
  } else {
    errEl.textContent = 'Erro ao publicar. Tente novamente.';
    errEl.classList.remove('hidden');
  }
}

if (document.querySelector('.section')) {
  document.addEventListener('DOMContentLoaded', initMarketplace);
}
