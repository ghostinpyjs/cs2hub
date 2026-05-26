// functions/steam-callback.js
// Validates Steam OpenID return and fetches player data

export async function onRequest(context) {
  const { request, env } = context;
  const url    = new URL(request.url);
  const params = url.searchParams;

  // ── 1. Validate OpenID response ─────────────────────────
  const mode = params.get('openid.mode');
  if (mode !== 'id_res') {
    return redirect(env, '/?error=login_cancelled');
  }

  const claimedId = params.get('openid.claimed_id') || '';
  const steamIdMatch = claimedId.match(/\/openid\/id\/(\d+)$/);
  if (!steamIdMatch) {
    return redirect(env, '/?error=invalid_steamid');
  }
  const steamId = steamIdMatch[1];

  // ── 2. Verify with Steam (OpenID check_authentication) ──
  const verifyParams = new URLSearchParams(params);
  verifyParams.set('openid.mode', 'check_authentication');
  try {
    const verifyRes = await fetch('https://steamcommunity.com/openid/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: verifyParams.toString(),
    });
    const verifyText = await verifyRes.text();
    if (!verifyText.includes('is_valid:true')) {
      return redirect(env, '/?error=openid_verify_failed');
    }
  } catch (e) {
    return redirect(env, '/?error=openid_error');
  }

  // ── 3. Fetch player data from Steam API ─────────────────
  const apiKey = env.STEAM_API_KEY;
  let playerData = { steamid: steamId };

  try {
    // Profile summary
    const summaryRes = await fetch(
      `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${apiKey}&steamids=${steamId}`
    );
    const summaryJson = await summaryRes.json();
    const player = summaryJson?.response?.players?.[0] || {};
    Object.assign(playerData, player);

    // Steam level
    const levelRes = await fetch(
      `https://api.steampowered.com/IPlayerService/GetSteamLevel/v1/?key=${apiKey}&steamid=${steamId}`
    );
    const levelJson = await levelRes.json();
    playerData.steam_level = levelJson?.response?.player_level ?? null;

    // CS2 stats (appid 730)
    const statsRes = await fetch(
      `https://api.steampowered.com/ISteamUserStats/GetUserStatsForGame/v2/?key=${apiKey}&steamid=${steamId}&appid=730`
    );
    if (statsRes.ok) {
      const statsJson = await statsRes.json();
      const rawStats  = statsJson?.playerstats?.stats || [];
      const statsMap  = {};
      rawStats.forEach(s => { statsMap[s.name] = s.value; });
      playerData.stats = statsMap;
    }

    playerData.last_updated = Date.now();

    // ── 4. Save to KV ──────────────────────────────────────
    if (env.PLAYERS_DB) {
      await env.PLAYERS_DB.put(`player:${steamId}`, JSON.stringify(playerData));
      // Also maintain an index list
      let indexRaw = await env.PLAYERS_DB.get('index:steamids');
      let ids = indexRaw ? JSON.parse(indexRaw) : [];
      if (!ids.includes(steamId)) {
        ids.push(steamId);
        await env.PLAYERS_DB.put('index:steamids', JSON.stringify(ids));
      }
    }

  } catch (e) {
    console.error('Steam API error:', e);
  }

  // ── 5. Redirect to site with steamid in URL ────────────
  const siteUrl = env.SITE_URL || new URL(request.url).origin;
  return Response.redirect(`${siteUrl}/?steamid=${steamId}`, 302);
}

function redirect(env, path) {
  const siteUrl = env?.SITE_URL || '/';
  return Response.redirect(`${siteUrl}${path}`, 302);
}
