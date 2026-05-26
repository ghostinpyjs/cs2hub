// api/ranking.js
// Lista todos os jogadores ordenados por critério

import { createClient } from "@vercel/kv";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const { sort = "elo", page = "1", limit = "50" } = req.query;
  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit)));

  const kv = createClient({
    url: process.env.KV_REST_API_URL,
    token: process.env.KV_REST_API_TOKEN,
  });

  // Buscar todos os IDs
  const steamIds = await kv.smembers("players:all");
  if (!steamIds || steamIds.length === 0) {
    return res.status(200).json({ players: [], total: 0 });
  }

  // Buscar todos os perfis em paralelo
  const playerKeys = steamIds.map((id) => `player:${id}`);
  const players = await kv.mget(...playerKeys);

  const validPlayers = players.filter(Boolean);

  // Ordenar
  const sortFns = {
    elo:            (a, b) => (b.elo ?? 0)            - (a.elo ?? 0),
    kd:             (a, b) => (b.kd ?? 0)             - (a.kd ?? 0),
    kills:          (a, b) => (b.kills ?? 0)           - (a.kills ?? 0),
    hours:          (a, b) => (b.hours ?? 0)           - (a.hours ?? 0),
    steamLevel:     (a, b) => (b.steamLevel ?? 0)      - (a.steamLevel ?? 0),
    inventoryValue: (a, b) => (b.inventoryValue ?? 0)  - (a.inventoryValue ?? 0),
  };

  validPlayers.sort(sortFns[sort] ?? sortFns.elo);

  // Adicionar posição
  const ranked = validPlayers.map((p, i) => ({ ...p, rank: i + 1 }));

  // Paginação
  const start = (pageNum - 1) * limitNum;
  const paginated = ranked.slice(start, start + limitNum);

  return res.status(200).json({ players: paginated, total: validPlayers.length });
}
