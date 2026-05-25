export default async function handler(req, res) {
  const { vanity } = req.query;
  const API_KEY = process.env.STEAM_API_KEY;
  if (!vanity) return res.status(400).json({ error: 'vanity required' });

  // Já é SteamID64
  if (/^\d{17}$/.test(vanity)) return res.status(200).json({ steamid: vanity });

  // Extrai parte final de URLs do Steam
  // ex: https://steamcommunity.com/id/gaben/ → gaben
  // ex: https://steamcommunity.com/profiles/76561197960287930 → steamid direto
  let query = vanity.trim();

  const profilesMatch = query.match(/steamcommunity\.com\/profiles\/(\d{17})/);
  if (profilesMatch) return res.status(200).json({ steamid: profilesMatch[1] });

  const idMatch = query.match(/steamcommunity\.com\/id\/([^/]+)/);
  if (idMatch) query = idMatch[1];

  // Remove barras extras
  query = query.replace(/\/$/, '').split('/').pop();

  try {
    // Tenta ResolveVanityURL com o nome como está
    const r1 = await fetch(`https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1/?key=${API_KEY}&vanityurl=${encodeURIComponent(query)}`);
    const d1 = await r1.json();
    if (d1.response?.success === 1) return res.status(200).json({ steamid: d1.response.steamid });

    // Tenta com o tipo 2 (grupo) e tipo 3 (jogo oficial) — cobre mais casos
    const r2 = await fetch(`https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1/?key=${API_KEY}&vanityurl=${encodeURIComponent(query)}&url_type=2`);
    const d2 = await r2.json();
    if (d2.response?.success === 1) return res.status(200).json({ steamid: d2.response.steamid });

    return res.status(404).json({
      error: `Perfil "${query}" não encontrado. Use a URL personalizada do Steam (ex: steamcommunity.com/id/seunome) ou o SteamID64 (número de 17 dígitos).`
    });
  } catch {
    return res.status(500).json({ error: 'Falha ao resolver URL do Steam' });
  }
}
