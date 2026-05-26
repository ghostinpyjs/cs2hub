export default async function handler(req, res) {
  const { q } = req.query;
  const API_KEY = process.env.STEAM_API_KEY;
  if (!q) return res.status(400).json({ error: 'Query obrigatória' });

  const query = q.trim();

  // SteamID64 direto
  if (/^\d{17}$/.test(query)) {
    try {
      const r = await fetch(`https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${API_KEY}&steamids=${query}`);
      const d = await r.json();
      const p = d?.response?.players?.[0];
      if (p) return res.status(200).json({ results: [{ steamid: p.steamid, username: p.personaname, avatar: p.avatarmedium }] });
    } catch {}
    return res.status(404).json({ error: 'SteamID não encontrado' });
  }

  // URL completa /profiles/ID
  const profilesMatch = query.match(/steamcommunity\.com\/profiles\/(\d{17})/);
  if (profilesMatch) {
    const sid = profilesMatch[1];
    const r = await fetch(`https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${API_KEY}&steamids=${sid}`);
    const d = await r.json();
    const p = d?.response?.players?.[0];
    if (p) return res.status(200).json({ results: [{ steamid: p.steamid, username: p.personaname, avatar: p.avatarmedium }] });
    return res.status(404).json({ error: 'Perfil não encontrado' });
  }

  // URL /id/vanity
  let vanity = query;
  const idMatch = query.match(/steamcommunity\.com\/id\/([^/?]+)/);
  if (idMatch) vanity = idMatch[1];
  vanity = vanity.replace(/\/$/, '').split('/').pop();

  try {
    // 1. Tenta como vanity URL
    const r1 = await fetch(`https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1/?key=${API_KEY}&vanityurl=${encodeURIComponent(vanity)}`);
    const d1 = await r1.json();
    if (d1.response?.success === 1) {
      const sid = d1.response.steamid;
      const pr = await fetch(`https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${API_KEY}&steamids=${sid}`);
      const pd = await pr.json();
      const p = pd?.response?.players?.[0];
      if (p) return res.status(200).json({ results: [{ steamid: p.steamid, username: p.personaname, avatar: p.avatarmedium }] });
    }

    // 2. Busca por nome na comunidade Steam
    const searchRes = await fetch(
      `https://steamcommunity.com/search/SearchCommunityAjax?text=${encodeURIComponent(vanity)}&filter=users&sessionid=&steamid_user=false&page=1`,
      { headers: { 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest' } }
    );

    if (searchRes.ok) {
      const searchData = await searchRes.json();
      if (searchData?.success === 1 && searchData?.search_result_count > 0) {
        const html = searchData.html || '';

        // Extrai todos os steamids encontrados
        const sidMatches = [...html.matchAll(/steamcommunity\.com\/profiles\/(\d{17})/g)].map(m => m[1]);
        const vanityMatches = [...html.matchAll(/steamcommunity\.com\/id\/([^/"\\]+)/g)].map(m => m[1]);

        const steamids = [...new Set(sidMatches)].slice(0, 5);

        // Resolve vanity matches extras
        for (const v of vanityMatches.slice(0, 3)) {
          try {
            const rv = await fetch(`https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1/?key=${API_KEY}&vanityurl=${encodeURIComponent(v)}`);
            const dv = await rv.json();
            if (dv.response?.success === 1) steamids.push(dv.response.steamid);
          } catch {}
        }

        const uniqueIds = [...new Set(steamids)].slice(0, 6);
        if (uniqueIds.length > 0) {
          const bulkRes = await fetch(`https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${API_KEY}&steamids=${uniqueIds.join(',')}`);
          const bulkData = await bulkRes.json();
          const players = bulkData?.response?.players || [];
          if (players.length > 0) {
            return res.status(200).json({
              results: players.map(p => ({ steamid: p.steamid, username: p.personaname, avatar: p.avatarmedium }))
            });
          }
        }
      }
    }

    return res.status(404).json({ error: `Nenhum jogador encontrado com o nome "${vanity}". Tente a URL personalizada do seu perfil Steam.` });
  } catch (e) {
    return res.status(500).json({ error: 'Erro ao buscar perfil Steam' });
  }
}
