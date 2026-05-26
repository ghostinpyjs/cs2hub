// api/steam-inventory.js
// Busca inventário CS2 + preços do Steam Market (cache 1h no KV)

import { createClient } from "@vercel/kv";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const { steamid } = req.query;
  if (!steamid) return res.status(400).json({ error: "steamid required" });

  const kv = createClient({
    url: process.env.KV_REST_API_URL,
    token: process.env.KV_REST_API_TOKEN,
  });

  // Cache de 1 hora
  const cacheKey = `inventory:${steamid}`;
  const cached = await kv.get(cacheKey);
  if (cached) return res.status(200).json(cached);

  // Buscar inventário CS2 (appid 730, contextid 2)
  const invRes = await fetch(
    `https://steamcommunity.com/inventory/${steamid}/730/2?l=english&count=100`
  );

  if (!invRes.ok) {
    return res.status(200).json({ items: [], totalUSD: 0, totalBRL: 0 });
  }

  const invData = await invRes.json();
  const assets = invData?.assets ?? [];
  const descriptions = invData?.descriptions ?? [];

  // Montar lista de itens com nomes
  const descMap = {};
  for (const d of descriptions) {
    descMap[`${d.classid}_${d.instanceid}`] = d;
  }

  const itemNames = [];
  for (const asset of assets.slice(0, 50)) {
    const desc = descMap[`${asset.classid}_${asset.instanceid}`];
    if (desc && desc.marketable) {
      itemNames.push(desc.market_hash_name);
    }
  }

  // Buscar preços em paralelo (máx 10 por vez para não causar rate limit)
  const USD_TO_BRL = 5.0;
  const prices = {};
  const chunks = [];
  for (let i = 0; i < itemNames.length; i += 10) chunks.push(itemNames.slice(i, i + 10));

  for (const chunk of chunks) {
    await Promise.all(
      chunk.map(async (name) => {
        try {
          const priceRes = await fetch(
            `https://steamcommunity.com/market/priceoverview/?appid=730&currency=1&market_hash_name=${encodeURIComponent(name)}`
          );
          const priceData = await priceRes.json();
          const raw = priceData?.lowest_price ?? "$0.00";
          prices[name] = parseFloat(raw.replace(/[^0-9.]/g, "")) || 0;
        } catch (_) {
          prices[name] = 0;
        }
      })
    );
  }

  // Montar resultado
  const items = itemNames.map((name) => ({
    name,
    priceUSD: prices[name] ?? 0,
    priceBRL: ((prices[name] ?? 0) * USD_TO_BRL).toFixed(2),
  }));

  const totalUSD = items.reduce((s, i) => s + i.priceUSD, 0).toFixed(2);
  const totalBRL = (parseFloat(totalUSD) * USD_TO_BRL).toFixed(2);

  const result = { items, totalUSD, totalBRL };

  // Salvar cache por 1h
  await kv.set(cacheKey, result, { ex: 3600 });

  // Atualizar valor do inventário no perfil
  try {
    const player = await kv.get(`player:${steamid}`);
    if (player) {
      await kv.set(`player:${steamid}`, { ...player, inventoryValue: parseFloat(totalUSD) });
    }
  } catch (_) {}

  return res.status(200).json(result);
}
