// inventory.js — inventory display logic

const RARITY_CLASS = {
  'Consumer Grade':    'rarity-consumer',
  'Industrial Grade':  'rarity-industrial',
  'Mil-Spec Grade':    'rarity-milspec',
  'Mil-Spec':          'rarity-milspec',
  'Restricted':        'rarity-restricted',
  'Classified':        'rarity-classified',
  'Covert':            'rarity-covert',
  'Contraband':        'rarity-contraband',
  '★':                'rarity-knife',
  'Extraordinary':     'rarity-knife',
};

function getRarityClass(tags) {
  if (!Array.isArray(tags)) return '';
  const rarityTag = tags.find(t => t.category === 'Rarity');
  if (!rarityTag) return '';
  return RARITY_CLASS[rarityTag.localized_tag_name] || '';
}

function getExterior(tags) {
  if (!Array.isArray(tags)) return '';
  const ex = tags.find(t => t.category === 'Exterior');
  return ex ? ex.localized_tag_name : '';
}

function getCategory(tags) {
  if (!Array.isArray(tags)) return 'Other';
  const cat = tags.find(t => t.category === 'Type');
  return cat ? cat.localized_tag_name : 'Other';
}

function isStatTrak(name) { return name?.includes('StatTrak'); }
function isSouvenir(name)  { return name?.includes('Souvenir'); }
function isCovert(tags)    { return getRarityClass(tags) === 'rarity-covert'; }

function renderInventory(items, containerId, totalBrlId, totalUsdId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (!items || items.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">📦</div><p>Inventário vazio ou privado.</p></div>`;
    return;
  }

  // Calculate totals
  const totalUsd = items.reduce((sum, it) => sum + (it.price_usd || 0), 0);
  if (totalBrlId) {
    const el = document.getElementById(totalBrlId);
    if (el) el.textContent = FMT.brl(totalUsd);
  }
  if (totalUsdId) {
    const el = document.getElementById(totalUsdId);
    if (el) el.textContent = FMT.usd(totalUsd);
  }
  const countEl = document.getElementById('inv-count');
  if (countEl) countEl.textContent = items.length + ' itens';

  // Render grid
  renderItems(container, items);

  // Setup filters
  const categories = [...new Set(items.map(it => getCategory(it.tags)))].sort();
  setupInventoryFilters(categories, items, container);
}

function renderItems(container, items) {
  container.innerHTML = items.map(item => {
    const exterior   = getExterior(item.tags);
    const rarityClass= getRarityClass(item.tags);
    const stattrak   = isStatTrak(item.market_name || item.name);
    const souvenir   = isSouvenir(item.market_name || item.name);
    const covert     = isCovert(item.tags);
    const imgUrl     = item.icon_url
      ? `https://community.cloudflare.steamstatic.com/economy/image/${item.icon_url}/160fx120f`
      : null;

    return `
    <div class="item-card stagger" data-category="${escHtml(getCategory(item.tags))}">
      <div class="item-img-wrap">
        ${imgUrl
          ? `<img src="${escHtml(imgUrl)}" alt="${escHtml(item.market_name||item.name)}" loading="lazy">`
          : `<span class="item-img-placeholder">🔫</span>`}
        <div class="item-rarity-bar ${rarityClass}"></div>
        <div class="item-badges">
          ${stattrak ? '<span class="item-badge badge-stattrak">ST™</span>' : ''}
          ${souvenir ? '<span class="item-badge badge-souvenir">SV</span>' : ''}
          ${covert   ? '<span class="item-badge badge-covert">★</span>' : ''}
        </div>
      </div>
      <div class="item-info">
        <div class="item-name" title="${escHtml(item.market_name||item.name)}">${escHtml(item.market_name||item.name)}</div>
        <div class="item-exterior">${escHtml(exterior) || '&nbsp;'}</div>
        <div class="item-price">
          <span class="item-price-usd">${item.price_usd ? FMT.usd(item.price_usd) : '—'}</span>
          <span class="item-price-brl">${item.price_usd ? FMT.brl(item.price_usd) : ''}</span>
        </div>
      </div>
    </div>`;
  }).join('');
}

function setupInventoryFilters(categories, allItems, container) {
  const filtersEl = document.getElementById('inv-filters');
  if (!filtersEl) return;

  const catMap = {
    'Rifle':   '🔫 Rifles',
    'Pistol':  '🔫 Pistolas',
    'Knife':   '🔪 Facas',
    'Gloves':  '🧤 Luvas',
    'SMG':     '🔫 SMGs',
    'Shotgun': '🔫 Espingardas',
    'Sniper Rifle': '🎯 Snipers',
    'Sticker': '🏷 Stickers',
    'Agent':   '👤 Agentes',
    'Other':   '📦 Outros',
  };

  filtersEl.innerHTML = `
    <button class="filter-btn active" data-cat="all">Todos (${allItems.length})</button>
    ${categories.map(cat => {
      const count = allItems.filter(it => getCategory(it.tags) === cat).length;
      const label = catMap[cat] || cat;
      return `<button class="filter-btn" data-cat="${escHtml(cat)}">${escHtml(label)} (${count})</button>`;
    }).join('')}`;

  filtersEl.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      filtersEl.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const cat = btn.dataset.cat;
      const filtered = cat === 'all' ? allItems : allItems.filter(it => getCategory(it.tags) === cat);
      renderItems(container, filtered);
    });
  });
}
