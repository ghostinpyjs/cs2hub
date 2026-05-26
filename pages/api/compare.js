export default async function handler(req, res) {
  const { steamid1, steamid2 } = req.query;
  const API_KEY = process.env.STEAM_API_KEY;
  if (!steamid1 || !steamid2) return res.status(400).json({ error: 'steamid1 e steamid2 obrigatórios' });

  try {
    const [p1Res, p2Res, s1Res, s2Res, h1Res, h2Res] = await Promise.allSettled([
      fetch(`https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${API_KEY}&steamids=${steamid1}`).then(r => r.json()),
      fetch(`https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${API_KEY}&steamids=${steamid2}`).then(r => r.json()),
      fetch(`https://api.steampowered.com/ISteamUserStats/GetUserStatsForGame/v2/?appid=730&key=${API_KEY}&steamid=${steamid1}`).then(r => r.ok ? r.json() : null),
      fetch(`https://api.steampowered.com/ISteamUserStats/GetUserStatsForGame/v2/?appid=730&key=${API_KEY}&steamid=${steamid2}`).then(r => r.ok ? r.json() : null),
      fetch(`https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${API_KEY}&steamid=${steamid1}&appids_filter[0]=730`).then(r => r.json()),
      fetch(`https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${API_KEY}&steamid=${steamid2}&appids_filter[0]=730`).then(r => r.json()),
    ]);

    return res.status(200).json({
      player1: p1Res.status === 'fulfilled' ? p1Res.value?.response?.players?.[0] || null : null,
      player2: p2Res.status === 'fulfilled' ? p2Res.value?.response?.players?.[0] || null : null,
      stats1: s1Res.status === 'fulfilled' ? s1Res.value : null,
      stats2: s2Res.status === 'fulfilled' ? s2Res.value : null,
      hours1: h1Res.status === 'fulfilled' ? Math.round((h1Res.value?.response?.games?.[0]?.playtime_forever || 0) / 60) : 0,
      hours2: h2Res.status === 'fulfilled' ? Math.round((h2Res.value?.response?.games?.[0]?.playtime_forever || 0) / 60) : 0,
    });
  } catch {
    return res.status(500).json({ error: 'Falha ao comparar jogadores' });
  }
}
