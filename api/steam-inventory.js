import { createClient } from "@supabase/supabase-js";
const db = () => createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  try {
    const { steamid } = req.query;
    if (!steamid) return res.status(400).json({ error: "steamid required" });
    const s = db();
    const { data: cached } = await s.from("inventory_cache").select("*").eq("steam_id", steamid).single();
    if (cached && Date.now() - cached.updated_at < 3600000) {
      return res.status(200).json({ items: cached.items, totalUSD: cached.total_usd, totalBRL: cached.total_brl });
    }
    const invRes = await fetch(`https://steamcommunity.com/inventory/${steamid}/730/2?l=english&count=100`);
    if (!invRes.ok) return res.status(200).json({ items: [], totalUSD: "0.00", totalBRL: "0.00" });
    const invData = await invRes.json();
    const assets = invData?.assets ?? [];
    const descs  = invData?.descriptions ?? [];
    const descMap = {};
    for (const d of descs) descMap[`${d.classid}_${d.instanceid}`] = d;
    const items = [];
    for (const asset of assets.slice(0, 50)) {
      const desc = descMap[`${asset.classid}_${asset.instanceid}`];
      if (!desc || !desc.marketable) continue;
      let priceUSD = 0;
      try {
        const pRes = await fetch(`https://steamcommunity.com/market/priceoverview/?appid=730&currency=1&market_hash_name=${encodeURIComponent(desc.market_hash_name)}`);
        if (pRes.ok) {
          const pData = await pRes.json();
          priceUSD = parseFloat((pData?.lowest_price ?? "$0").replace(/[^0-9.]/g, "")) || 0;
        }
      } catch (_) {}
      items.push({ name: desc.market_hash_name, icon_url: desc.icon_url, tags: desc.tags ?? [], price_usd: priceUSD, price_brl: (priceUSD * 5.0).toFixed(2) });
    }
    const totalUSD = items.reduce((s, i) => s + i.price_usd, 0).toFixed(2);
    const totalBRL = (parseFloat(totalUSD) * 5.0).toFixed(2);
    await s.from("inventory_cache").upsert({ steam_id: steamid, items, total_usd: totalUSD, total_brl: totalBRL, updated_at: Date.now() }, { onConflict: "steam_id" });
    await s.from("players").update({ inventory_value: parseFloat(totalUSD) }).eq("steam_id", steamid);
    return res.status(200).json({ items, totalUSD, totalBRL });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
