// api/search.js
// Pesquisa jogador por nick ou steamid no KV

import { createClient } from "@vercel/kv";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const { q } = req.query;
  if (!q || q.trim().length < 2) {
    return res.status(400).json({ error: "Query must have at least 2 characters" });
  }

  const query = q.trim().toLowerCase();

  const kv = createClient({
    url: process.env.KV_REST_API_URL,
    token: process.env.KV_REST_API_TOKEN,
  });

  // Se parece com SteamID (17 dígitos numéricos)
  if (/^\d{17}$/.test(query)) {
    const player = await kv.get(`player:${query}`);
    if (player) return res.status(200).json({ players: [player] });
    return res.status(200).json({ players: [] });
  }

  // Buscar todos e filtrar por nick
  const steamIds = await kv.smembers("players:all");
  if (!steamIds || steamIds.length === 0) {
    return res.status(200).json({ players: [] });
  }

  const playerKeys = steamIds.map((id) => `player:${id}`);
  const players = await kv.mget(...playerKeys);

  const results = players
    .filter((p) => p && p.nick && p.nick.toLowerCase().includes(query))
    .slice(0, 20);

  return res.status(200).json({ players: results });
}
