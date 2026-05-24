export default async function handler(req, res) {
  const { steamid } = req.query;
  const API_KEY = process.env.STEAM_API_KEY;
  const CS2_APP_ID = 730;

  if (!steamid) {
    return res.status(400).json({ error: 'steamid required' });
  }

  try {
    const [statsRes, achievRes] = await Promise.allSettled([
      fetch(`https://api.steampowered.com/ISteamUserStats/GetUserStatsForGame/v2/?appid=${CS2_APP_ID}&key=${API_KEY}&steamid=${steamid}`),
      fetch(`https://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v1/?appid=${CS2_APP_ID}&key=${API_KEY}&steamid=${steamid}`)
    ]);

    let statsData = null;
    let achievData = null;

    if (statsRes.status === 'fulfilled') {
      const r = statsRes.value;
      if (r.ok) statsData = await r.json();
    }

    if (achievRes.status === 'fulfilled') {
      const r = achievRes.value;
      if (r.ok) achievData = await r.json();
    }

    return res.status(200).json({ stats: statsData, achievements: achievData });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch CS2 stats' });
  }
}
