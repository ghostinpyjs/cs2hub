export default async function handler(req, res) {
  const { vanity } = req.query;
  const API_KEY = process.env.STEAM_API_KEY;

  if (!vanity) {
    return res.status(400).json({ error: 'vanity required' });
  }

  // If already a steamid (17 digit number)
  if (/^\d{17}$/.test(vanity)) {
    return res.status(200).json({ steamid: vanity });
  }

  try {
    const response = await fetch(
      `https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1/?key=${API_KEY}&vanityurl=${vanity}`
    );
    const data = await response.json();

    if (data.response?.success === 1) {
      return res.status(200).json({ steamid: data.response.steamid });
    } else {
      return res.status(404).json({ error: 'Perfil Steam não encontrado' });
    }
  } catch (err) {
    return res.status(500).json({ error: 'Falha ao resolver URL' });
  }
}
