// functions/steam-profile.js
// Returns full player profile + CS2 stats

const CACHE_TTL = 3600; // 1 hour in seconds

export async function onRequest(context) {
  const { request, env } = context;
  const url     = new URL(request.url);
  const steamId = url.searchParams.get('steamid');
  const refresh = url.searchParams.get('refresh') === '1';

  if (!steamId || !/^\d{17}$/.test(steamId)) {
    return jsonError('SteamID inválido', 400);
  }

  const headers = corsHeaders();

  // ── Try KV cache first (unless refresh=1) ────────────────
  if (env.PLAYERS_DB && !refresh) {
    const cached = await env.PLAYERS_DB.get(`player:${steamId}`);
    if (cached) {
      const data = JSON.parse(cached);
      const age  = (Date.now() - (data.last_updated || 0)) / 1000;
      if (age < CACHE_TTL) {
        return new Response(cached, { headers: { ...headers, 'Content-Type': 'application/json', 'X-Cache': 'HIT' } });
      }
    }
  }

  const apiKey = env.STEAM_API_KEY;
  if (!apiKey) return jsonError('STEAM_API_KEY não configurada', 500);

  let playerData = { steamid: steamId };

  try {
    // ── Parallel requests ─────────────────────────────────
    const [summaryRes, levelRes, statsRes] = await Promise.allSettled([
      fetch(`https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${apiKey}&steamids=${steamId}`),
      fetch(`https://api.steampowered.com/IPlayerService/GetSteamLevel/v1/?key=${apiKey}&steamid=${steamId}`),
      fetch(`https://api.steampowered.com/ISteamUserStats/GetUserStatsForGame/v2/?key=${apiKey}&steamid=${steamId}&appid=730`),
    ]);

    // Profile summary
    if (summaryRes.status === 'fulfilled' && summaryRes.value.ok) {
      const json   = await summaryRes.value.json();
      const player = json?.response?.players?.[0] || {};
      Object.assign(playerData, player);
    }

    // Steam level
    if (levelRes.status === 'fulfilled' && levelRes.value.ok) {
      const json = await levelRes.value.json();
      playerData.steam_level = json?.response?.player_level ?? null;
    }

    // CS2 stats
    if (statsRes.status === 'fulfilled' && statsRes.value.ok) {
      const json     = await statsRes.value.json();
      const rawStats = json?.playerstats?.stats || [];
      const statsMap = {};
      rawStats.forEach(s => { statsMap[s.name] = s.value; });
      playerData.stats = statsMap;
    } else {
      playerData.stats = {};
      playerData.stats_unavailable = true;
    }

    playerData.last_updated = Date.now();

    // Save/update in KV
    if (env.PLAYERS_DB) {
      await env.PLAYERS_DB.put(`player:${steamId}`, JSON.stringify(playerData));
      let indexRaw = await env.PLAYERS_DB.get('index:steamids');
      let ids = indexRaw ? JSON.parse(indexRaw) : [];
      if (!ids.includes(steamId)) {
        ids.push(steamId);
        await env.PLAYERS_DB.put('index:steamids', JSON.stringify(ids));
      }
    }

    return new Response(JSON.stringify(playerData), {
      headers: { ...headers, 'Content-Type': 'application/json' }
    });

  } catch (e) {
    return jsonError('Erro interno: ' + e.message, 500);
  }
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
  };
}

function jsonError(msg, status = 400) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { ...corsHeaders(), 'Content-Type': 'application/json' }
  });
}
