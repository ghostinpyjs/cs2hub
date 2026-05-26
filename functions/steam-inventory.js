// functions/steam-inventory.js
// Fetches CS2 inventory + Steam Market prices

const PRICE_CACHE_TTL = 3600 * 1000; // 1 hour in ms
const MAX_PRICE_REQUESTS = 40; // limit per inventory call

export async function onRequest(context) {
  const { request, env } = context;
  const url     = new URL(request.url);
  const steamId = url.searchParams.get('steamid');

  if (!steamId || !/^\d{17}$/.test(steamId)) {
    return jsonResponse({ error: 'SteamID inválido' }, 400);
  }

  // ── Check KV cache ─────────────────────────────────────
  const cacheKey = `inventory:${steamId}`;
  if (env.PLAYERS_DB) {
    const cached = await env.PLAYERS_DB.get(cacheKey);
    if (cached) {
      const data = JSON.parse(cached);
      if (Date.now() - (data.cached_at || 0) < PRICE_CACHE_TTL) {
        return jsonResponse({ ...data, cache: 'hit' });
      }
    }
  }

  try {
    // ── Fetch inventory ────────────────────────────────────
    const invRes = await fetch(
      `https://steamcommunity.com/inventory/${steamId}/730/2?l=english&count=500`,
      { headers: { 'Accept-Language': 'en-US,en;q=0.9' } }
    );

    if (invRes.status === 403) {
      return jsonResponse({ error: 'Inventário privado. O jogador precisa tornar o inventário público.' });
    }
    if (!invRes.ok) {
      return jsonResponse({ error: `Erro ao acessar inventário (HTTP ${invRes.status})` });
    }

    const invData = await invRes.json();
    if (!invData || invData.success === 0) {
      return jsonResponse({ error: 'Inventário indisponível ou vazio.' });
    }

    const assets      = invData.assets      || [];
    const descriptions= invData.descriptions|| [];

    // ── Build items list ─────────────────────────────────
    const descMap = {};
    descriptions.forEach(d => { descMap[`${d.classid}_${d.instanceid}`] = d; });

    const items = assets.map(asset => {
      const desc = descMap[`${asset.classid}_${asset.instanceid}`] || {};
      return {
        assetid:     asset.assetid,
        classid:     asset.classid,
        instanceid:  asset.instanceid,
        amount:      asset.amount,
        name:        desc.name,
        market_name: desc.market_name || desc.market_hash_name || desc.name,
        market_hash_name: desc.market_hash_name,
        icon_url:    desc.icon_url,
        tags:        desc.tags || [],
        tradable:    desc.tradable === 1,
        marketable:  desc.marketable === 1,
        price_usd:   null,
      };
    }).filter(it => it.market_hash_name); // only marketable items with a name

    // ── Fetch prices (batched, with KV micro-cache) ───────
    const priceableItems = items.filter(it => it.marketable).slice(0, MAX_PRICE_REQUESTS);
    await fetchPrices(priceableItems, env);

    // Merge prices into full list
    const priceMap = {};
    priceableItems.forEach(it => { priceMap[it.market_hash_name] = it.price_usd; });
    items.forEach(it => {
      if (it.market_hash_name && priceMap[it.market_hash_name] !== undefined) {
        it.price_usd = priceMap[it.market_hash_name];
      }
    });

    // ── Sort by price desc ────────────────────────────────
    items.sort((a, b) => (b.price_usd || 0) - (a.price_usd || 0));

    const totalUsd = items.reduce((s, it) => s + (it.price_usd || 0), 0);

    const result = {
      steamid:           steamId,
      items,
      total_items:       items.length,
      total_value_usd:   totalUsd,
      cached_at:         Date.now(),
    };

    // Save to KV
    if (env.PLAYERS_DB) {
      await env.PLAYERS_DB.put(cacheKey, JSON.stringify(result), { expirationTtl: PRICE_CACHE_TTL / 1000 });
      // Also update player record with inventory value
      const playerRaw = await env.PLAYERS_DB.get(`player:${steamId}`);
      if (playerRaw) {
        const player = JSON.parse(playerRaw);
        player.inventory_value_usd = totalUsd;
        player.inventory_count     = items.length;
        await env.PLAYERS_DB.put(`player:${steamId}`, JSON.stringify(player));
      }
    }

    return jsonResponse(result);

  } catch (e) {
    return jsonResponse({ error: 'Erro interno: ' + e.message }, 500);
  }
}

async function fetchPrices(items, env) {
  // Group by market_hash_name (avoid duplicate requests)
  const unique = [...new Set(items.map(it => it.market_hash_name))];

  await Promise.all(unique.map(async hashName => {
    // Check per-item price cache in KV
    const cacheKey = `price:${hashName}`;
    if (env.PLAYERS_DB) {
      try {
        const cached = await env.PLAYERS_DB.get(cacheKey);
        if (cached) {
          const price = parseFloat(cached);
          items.filter(it => it.market_hash_name === hashName).forEach(it => { it.price_usd = price; });
          return;
        }
      } catch {}
    }

    // Fetch from Steam Market
    try {
      const res = await fetch(
        `https://steamcommunity.com/market/priceoverview/?appid=730&currency=1&market_hash_name=${encodeURIComponent(hashName)}`,
        { headers: { 'Accept': 'application/json' } }
      );
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.median_price) {
          // Parse "$12.34" → 12.34
          const price = parseFloat(data.median_price.replace(/[^0-9.]/g, '')) || 0;
          items.filter(it => it.market_hash_name === hashName).forEach(it => { it.price_usd = price; });
          // Cache in KV for 1h
          if (env.PLAYERS_DB && price > 0) {
            await env.PLAYERS_DB.put(cacheKey, String(price), { expirationTtl: 3600 }).catch(() => {});
          }
        }
      }
    } catch {}
  }));
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    }
  });
}
