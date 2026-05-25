// pages/api/search.js
// Busca jogadores da Steam por nome de usuário (personaname)
// Estratégia: resolve como vanity URL primeiro; se falhar, busca nos jogadores
// já registrados no ranking local pelo username.
export default async function handler(req, res) {
  const { q } = req.query;
  const API_KEY = process.env.STEAM_API_KEY;

  if (!q || q.trim().length < 2) {
    return res.status(400).json({ error: 'Query muito curta' });
  }

  const query = q.trim();

  // 1. Tenta resolver como vanity URL (ex: "gaben" → SteamID64)
  try {
    const vanityRes = await fetch(
      `https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1/?key=${API_KEY}&vanityurl=${encodeURIComponent(query)}`
    );
    const vanityData = await vanityRes.json();

    if (vanityData.response?.success === 1) {
      const steamid = vanityData.response.steamid;

      // Busca o perfil completo
      const profileRes = await fetch(
        `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${API_KEY}&steamids=${steamid}`
      );
      const profileData = await profileRes.json();
      const players = profileData.response?.players || [];

      if (players.length > 0) {
        return res.status(200).json({
          results: players.map(p => ({
            steamid: p.steamid,
            username: p.personaname,
            avatar: p.avatarmedium || p.avatar,
            profileUrl: p.profileurl,
            source: 'vanity',
          })),
        });
      }
    }
  } catch {
    // Ignora erros da vanity URL e tenta o próximo método
  }

  // 2. Se é um SteamID64 direto
  if (/^\d{17}$/.test(query)) {
    try {
      const profileRes = await fetch(
        `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${API_KEY}&steamids=${query}`
      );
      const profileData = await profileRes.json();
      const players = profileData.response?.players || [];

      if (players.length > 0) {
        return res.status(200).json({
          results: players.map(p => ({
            steamid: p.steamid,
            username: p.personaname,
            avatar: p.avatarmedium || p.avatar,
            profileUrl: p.profileurl,
            source: 'steamid',
          })),
        });
      }
    } catch {
      // Segue em frente
    }
  }

  // 3. Nenhum resultado encontrado
  // Nota: A Steam Web API pública não oferece busca por nome de usuário diretamente.
  // Para isso seria necessário uma base de dados própria (ex: ranking local)
  // ou uma API de terceiros. O frontend deve lidar com esse caso.
  return res.status(404).json({
    error: `Nenhum jogador encontrado para "${query}". Tente a URL personalizada do Steam (ex: gaben) ou o SteamID64.`,
    results: [],
  });
}
