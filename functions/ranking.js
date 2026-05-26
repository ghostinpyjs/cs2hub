// functions/ranking.js
// Returns all players from KV, sorted by chosen criterion

export async function onRequest(context) {
  const { request, env } = context;
  const url     = new URL(request.url);
  const orderBy = url.searchParams.get('orderBy') || 'hours';
  const limit   = parseInt(url.searchParams.get('limit') || '0');

  if (!env.PLAYERS_DB) {
    return jsonResponse({ players: [], total: 0, error: 'KV não configurado' });
  }

  try {
    // Get all steam IDs
    const indexRaw = await env.PLAYERS_DB.get('index:steamids');
    if (!indexRaw) {
      return jsonResponse({ players: [], total: 0 });
    }
    const ids = JSON.parse(indexRaw);

    // Fetch all player records in parallel (batched)
    const BATCH = 20;
    const players = [];
    for (let i = 0; i < ids.length; i += BATCH) {
      const batch = ids.slice(i, i + BATCH);
      const results = await Promise.all(batch.map(id => env.PLAYERS_DB.get(`player:${id}`)));
      results.forEach((raw, j) => {
        if (raw) {
          try {
            const p = JSON.parse(raw);
            // Attach inventory value if stored
            players.push(p);
          } catch {}
        }
      });
    }

    // Sort
    const sorted = sortPlayers(players, orderBy);
    const result = limit > 0 ? sorted.slice(0, limit) : sorted;

    return jsonResponse({ players: result, total: players.length, orderBy });

  } catch (e) {
    return jsonResponse({ players: [], total: 0, error: e.message }, 500);
  }
}

function sortPlayers(players, orderBy) {
  return [...players].sort((a, b) => {
    const sa = a.stats || {};
    const sb = b.stats || {};

    switch (orderBy) {
      case 'elo':
        return (b.premier_rating || 0) - (a.premier_rating || 0);
      case 'level':
        return (b.steam_level || 0) - (a.steam_level || 0);
      case 'inv_value':
        return (b.inventory_value_usd || 0) - (a.inventory_value_usd || 0);
      case 'kd': {
        const kdA = sa.total_deaths ? sa.total_kills / sa.total_deaths : 0;
        const kdB = sb.total_deaths ? sb.total_kills / sb.total_deaths : 0;
        return kdB - kdA;
      }
      case 'matches':
        return (sb.total_matches_played || 0) - (sa.total_matches_played || 0);
      case 'hours':
      default:
        return (sb.total_time_played || 0) - (sa.total_time_played || 0);
    }
  });
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    }
  });
}
