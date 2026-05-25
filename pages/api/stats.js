export default async function handler(req, res) {
  const { steamid } = req.query;
  const API_KEY = process.env.STEAM_API_KEY;
  if (!steamid) return res.status(400).json({ error: 'steamid required' });
  try {
    const [sR, aR] = await Promise.allSettled([
      fetch(`https://api.steampowered.com/ISteamUserStats/GetUserStatsForGame/v2/?appid=730&key=${API_KEY}&steamid=${steamid}`),
      fetch(`https://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v1/?appid=730&key=${API_KEY}&steamid=${steamid}`)
    ]);
    const stats = sR.status === 'fulfilled' && sR.value.ok ? await sR.value.json() : null;
    const achievements = aR.status === 'fulfilled' && aR.value.ok ? await aR.value.json() : null;
    return res.status(200).json({ stats, achievements });
  } catch {
    return res.status(500).json({ error: 'Failed to fetch stats' });
  }
}
