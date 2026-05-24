export default async function handler(req, res) {
  const { steamid } = req.query;
  const API_KEY = process.env.STEAM_API_KEY;
  const CS2_APP_ID = 730;

  if (!steamid) {
    return res.status(400).json({ error: 'steamid required' });
  }

  try {
    const response = await fetch(
      `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${API_KEY}&steamid=${steamid}&include_appinfo=true&appids_filter[0]=${CS2_APP_ID}`
    );
    const data = await response.json();
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch playtime' });
  }
}
