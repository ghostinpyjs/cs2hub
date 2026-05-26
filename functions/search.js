// functions/search.js
// Searches players by nick in KV

export async function onRequest(context) {
  const { request, env } = context;
  const url  = new URL(request.url);
  const nick = (url.searchParams.get('nick') || '').trim().toLowerCase();

  if (!nick || nick.length < 2) {
    return jsonResponse({ results: [], error: 'Pesquisa muito curta (mínimo 2 caracteres)' }, 400);
  }

  if (!env.PLAYERS_DB) {
    return jsonResponse({ results: [], error: 'KV não configurado' });
  }

  try {
    const indexRaw = await env.PLAYERS_DB.get('index:steamids');
    if (!indexRaw) return jsonResponse({ results: [] });

    const ids = JSON.parse(indexRaw);

    // Fetch all and filter (could be optimised with a nick index for large datasets)
    const BATCH = 20;
    const results = [];
    for (let i = 0; i < ids.length; i += BATCH) {
      const batch = ids.slice(i, i + BATCH);
      const raws  = await Promise.all(batch.map(id => env.PLAYERS_DB.get(`player:${id}`)));
      raws.forEach(raw => {
        if (!raw) return;
        try {
          const p = JSON.parse(raw);
          if ((p.personaname || '').toLowerCase().includes(nick)) {
            results.push({
              steamid:     p.steamid,
              personaname: p.personaname,
              avatar:      p.avatar,
              steam_level: p.steam_level,
            });
          }
        } catch {}
      });
      if (results.length >= 20) break; // max 20 results
    }

    return jsonResponse({ results, query: nick });

  } catch (e) {
    return jsonResponse({ results: [], error: e.message }, 500);
  }
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
