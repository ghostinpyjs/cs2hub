// api/steam-profile.js
// Busca perfil completo + stats CS2 + salva/atualiza no KV

import { createClient } from "@vercel/kv";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const { steamid } = req.query;
  if (!steamid) {
    return res.status(400).json({ error: "steamid required" });
  }

  const key = process.env.STEAM_API_KEY;

  // Buscar perfil + nível Steam + stats CS2 em paralelo
  const [profileRes, levelRes, statsRes] = await Promise.all([
    fetch(`https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${key}&steamids=${steamid}`),
    fetch(`https://api.steampowered.com/IPlayerService/GetSteamLevel/v1/?key=${key}&steamid=${steamid}`),
    fetch(`https://api.steampowered.com/ISteamUserStats/GetUserStatsForGame/v2/?key=${key}&steamid=${steamid}&appid=730`),
  ]);

  const [profileData, levelData, statsData] = await Promise.all([
    profileRes.json(),
    levelRes.json(),
    statsRes.ok ? statsRes.json() : Promise.resolve(null),
  ]);

  const player = profileData?.response?.players?.[0];
  if (!player) return res.status(404).json({ error: "Player not found" });

  const steamLevel = levelData?.response?.player_level ?? 0;
  const stats = statsData?.playerstats?.stats ?? [];

  const getStat = (name) => stats.find((s) => s.name === name)?.value ?? 0;

  const kills    = getStat("total_kills");
  const deaths   = getStat("total_deaths");
  const hs       = getStat("total_kills_headshot");
  const mvps     = getStat("total_mvps");
  const wins     = getStat("total_wins");
  const roundsPlayed = getStat("total_rounds_played");
  const bombsPlanted = getStat("total_planted_bombs");
  const favWeapon = (() => {
    const weapons = ["ak47","m4a1","awp","deagle","glock","usp_silencer","p250","famas","galil","sg556","aug","ssg08"];
    let best = { name: "N/D", kills: 0 };
    for (const w of weapons) {
      const k = getStat(`total_kills_${w}`);
      if (k > best.kills) best = { name: w.toUpperCase(), kills: k };
    }
    return best.name;
  })();

  const kd = deaths > 0 ? (kills / deaths).toFixed(2) : kills.toFixed(2);
  const hsPercent = kills > 0 ? ((hs / kills) * 100).toFixed(1) : "0.0";

  // Buscar horas jogadas no CS2
  const hoursRes = await fetch(
    `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${key}&steamid=${steamid}&appids_filter[0]=730&include_appinfo=false`
  );
  const hoursData = await hoursRes.json();
  const hours = Math.round((hoursData?.response?.games?.[0]?.playtime_forever ?? 0) / 60);

  // ELO Premier — não disponível na API pública
  const elo = 0;

  const result = {
    steamId: steamid,
    nick: player.personaname,
    avatar: player.avatarfull,
    profileUrl: player.profileurl,
    steamLevel,
    kills,
    deaths,
    kd,
    hsPercent,
    mvps,
    wins,
    roundsPlayed,
    bombsPlanted,
    favWeapon,
    hours,
    elo,
  };

  // Atualizar no KV
  try {
    const kv = createClient({
      url: process.env.KV_REST_API_URL,
      token: process.env.KV_REST_API_TOKEN,
    });
    const existing = await kv.get(`player:${steamid}`);
    await kv.set(`player:${steamid}`, { ...(existing ?? {}), ...result, lastUpdated: Date.now() });
    await kv.sadd("players:all", steamid);
  } catch (_) {}

  return res.status(200).json(result);
}
