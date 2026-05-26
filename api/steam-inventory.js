// api/steam-inventory.js
import { createClient } from "@supabase/supabase-js";

const supabase = () => createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const { steamid } = req.query;
  if (!steamid) return res.status(400).json({ error: "steamid required" });

  // Cache na tabela inventory_cache
  const db = supabase();
  const { data: cached } = await db.from("inventory_cache").select("*").eq("steam_id", steamid).single();
  if (cached && Date.now() - cached.updated_at < 3600000) {
    return res.status(200).json({ items: cached.items, totalUSD: cached.total_usd, totalBRL: cached.total_brl });
  }

  const invRes = await fetch(`https://steamcommunity.com/inventory/${steamid}/730/2?l=english&count=100`);
  if (!invRes.ok) return res.status(200).json({ items: [], totalUSD: 0, totalBRL: 0 });

  const invData = await invRes.json();
  const assets = invData?.assets ?? [];
  const descriptions = invData?.descriptions ?? [];

  const descMap = {};
  for (const d of descriptions) descMap[`${d.classid}_${d.instanceid}`] = d;

  const itemNames = [];
  for (const asset of assets.slice(0, 50)) {
    const desc = descMap[`${asset.classid}_${asset.instanceid}`];
    if (desc && desc.marketable) itemNames.push(desc.market_hash_name);
  }

  const USD_TO_BRL = 5.0;
  const prices = {};
  const chunks = [];
  for (let i = 0; i < itemNames.length; i += 10) chunks.push(itemNames.slice(i, i + 10));
  for (const chunk of chunks) {
    await Promise.all(chunk.map(async (name) => {
      try {
        const r = await fetch(`https://steamcommunity.com/market/priceoverview/?appid=730&currency=1&market_hash_name=${encodeURIComponent(name)}`);
        const d = await r.json();
        prices[name] = parseFloat((d?.lowest_price ?? "$0").replace(/[^0-9.]/g, "")) || 0;
      } catch (_) { prices[name] = 0; }
    }));
  }

  const items = itemNames.map((name) => ({ name, priceUSD: prices[name] ?? 0, priceBRL: ((prices[name] ?? 0) * USD_TO_BRL).toFixed(2) }));
  const totalUSD = items.reduce((s, i) => s + i.priceUSD, 0).toFixed(2);
  const totalBRL = (parseFloat(totalUSD) * USD_TO_BRL).toFixed(2);

  // Salvar cache
  await db.from("inventory_cache").upsert({ steam_id: steamid, items, total_usd: totalUSD, total_brl: totalBRL, updated_at: Date.now() }, { onConflict: "steam_id" });

  // Atualizar valor no perfil
  await db.from("players").update({ inventory_value: parseFloat(totalUSD) }).eq("steam_id", steamid);

  return res.status(200).json({ items, totalUSD, totalBRL });
}
