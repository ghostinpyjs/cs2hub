export default async function handler(req, res) {
  const { steamid } = req.query;
  const API_KEY = process.env.STEAM_API_KEY;

  if (!steamid) {
    return res.status(400).json({ error: 'steamid required' });
  }

  try {
    const response = await fetch(
      `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${API_KEY}&steamids=${steamid}`
    );
    const data = await response.json();
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch player summary' });
  }
}
