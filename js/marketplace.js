// marketplace.js
let inventoryItems = [];
let currentDiscordTag = '';

async function initMarketplace() {
  const user = AUTH.getUser();
  if (user) {
    document.getElementById('btn-anunciar').style.display = 'block';
    await carregarInventario(user.steam_id || user.steamid);
  }
  await carregarAnuncios();

  document.getElementById('market-search')?.addEventListener('input', e => {
    const q = e.target.value.toLowerCase();
    document.querySelectorAll('.market-card').forEach(c => {
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
            ${l.avatar ? `<img src="${l.avatar}" style="width:16px;height:16px;border-radius:2px" onerror="this.style.display='none'">` : ''}
            ${escHtml(l.nick || 'Jogador')}
          </div>
          ${l.description ? `<div style="font-size:.78rem;color:var(--text-dim);margin-bottom:.5rem">${escHtml(l.description)}</div>` : ''}
          <div class="market-price">$${parseFloat(l.price_usd).toFixed(2)}</div>
          <div class="market-price-brl">R$ ${parseFloat(l.price_brl || l.price_usd * 5).toFixed(2)}</div>
          ${l.discord_tag ? `
            <button class="btn-discord" onclick="abrirModalDiscord('${escHtml(l.discord_tag)}')">
              <svg viewBox="0 0 24 24"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/></svg>
              Contatar via Discord
            </button>
          ` : ''}
        </div>
      </div>
    `).join('');
  } catch (e) {
    document.getElementById('market-loading')?.classList.add('hidden');
    document.getElementById('market-empty')?.classList.remove('hidden');
  }
}

// ── Modal anunciar ──────────────────────────────────────────────
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
  const user    = AUTH.getUser();
  const idx     = document.getElementById('select-item').value;
  const price   = parseFloat(document.getElementById('input-price').value);
  const discord = document.getElementById('input-discord').value.trim();
  const desc    = document.getElementById('input-desc').value.trim();
  const errEl   = document.getElementById('modal-error');

  errEl.classList.add('hidden');

  if (!user)                { errEl.textContent = 'Faça login primeiro.';       errEl.classList.remove('hidden'); return; }
  if (idx === '')           { errEl.textContent = 'Selecione um item.';         errEl.classList.remove('hidden'); return; }
  if (!price || price <= 0) { errEl.textContent = 'Informe um preço válido.';   errEl.classList.remove('hidden'); return; }
  if (!discord)             { errEl.textContent = 'Informe seu Discord para contato.'; errEl.classList.remove('hidden'); return; }

  const item = inventoryItems[parseInt(idx)];

  try {
    const res = await fetch('/api/market-post', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        steam_id:    user.steam_id || user.steamid,
        item_name:   item.name,
        item_icon:   item.icon_url || '',
        price_usd:   price,
        price_brl:   (price * 5.0).toFixed(2),
        discord_tag: discord,
        description: desc,
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro desconhecido');

    fecharModal();
    await carregarAnuncios();
  } catch (e) {
    errEl.textContent = 'Erro: ' + e.message;
    errEl.classList.remove('hidden');
  }
}

// ── Modal Discord ───────────────────────────────────────────────
function abrirModalDiscord(discordTag) {
  currentDiscordTag = discordTag;
  document.getElementById('discord-tag-display').textContent = discordTag;
  document.getElementById('discord-copy-ok').style.display = 'none';
  document.getElementById('modal-discord').classList.add('open');
}

function fecharModalDiscord() {
  document.getElementById('modal-discord').classList.remove('open');
}

function copiarDiscord() {
  if (!currentDiscordTag) return;
  navigator.clipboard.writeText(currentDiscordTag).then(() => {
    document.getElementById('discord-copy-ok').style.display = 'block';
    setTimeout(() => { document.getElementById('discord-copy-ok').style.display = 'none'; }, 2000);
  }).catch(() => {
    // fallback para navegadores sem clipboard API
    const el = document.createElement('textarea');
    el.value = currentDiscordTag;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    document.getElementById('discord-copy-ok').style.display = 'block';
    setTimeout(() => { document.getElementById('discord-copy-ok').style.display = 'none'; }, 2000);
  });
}

// Fecha modais ao clicar no overlay
document.addEventListener('click', e => {
  if (e.target.id === 'modal-anunciar') fecharModal();
  if (e.target.id === 'modal-discord')  fecharModalDiscord();
});

document.addEventListener('DOMContentLoaded', initMarketplace);
