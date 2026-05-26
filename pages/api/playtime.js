export default async function handler(req, res) {
  const { steamid } = req.query;
  const API_KEY = process.env.STEAM_API_KEY;
  if (!steamid) return res.status(400).json({ error: 'steamid required' });
  try {
    const r = await fetch(`https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${API_KEY}&steamid=${steamid}&include_appinfo=true&appids_filter[0]=730`);
    const d = await r.json();
    return res.status(200).json(d);
  } catch { return res.status(500).json({ error: 'Failed' }); }
}
