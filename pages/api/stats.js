export default async function handler(req, res) {
  const { steamid } = req.query;
  const API_KEY = process.env.STEAM_API_KEY;
  if (!steamid) return res.status(400).json({ error: 'steamid required' });
  try {
    const r = await fetch(`https://api.steampowered.com/ISteamUserStats/GetUserStatsForGame/v2/?appid=730&key=${API_KEY}&steamid=${steamid}`);
    const stats = r.ok ? await r.json() : null;
    return res.status(200).json({ stats });
  } catch { return res.status(500).json({ error: 'Failed' }); }
}
