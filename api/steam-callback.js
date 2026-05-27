import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  try {
    const fullUrl = `https://${req.headers.host}${req.url}`;
    const params  = new URLSearchParams(new URL(fullUrl).search);
    const claimed = params.get("openid.claimed_id") || "";
    const steamId = claimed.match(/\/id\/(\d+)$/)?.[1];

    if (!steamId) return res.redirect("/?error=no_steamid");

    params.set("openid.mode", "check_authentication");
    const verify = await fetch("https://steamcommunity.com/openid/login", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    if (!(await verify.text()).includes("is_valid:true")) return res.redirect("/?error=invalid");

    const key = process.env.STEAM_API_KEY;

    // Buscar tudo em paralelo
    const [pRes, lvlRes, sRes, hRes] = await Promise.all([
      fetch(`https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${key}&steamids=${steamId}`),
      fetch(`https://api.steampowered.com/IPlayerService/GetSteamLevel/v1/?key=${key}&steamid=${steamId}`),
      fetch(`https://api.steampowered.com/ISteamUserStats/GetUserStatsForGame/v2/?key=${key}&steamid=${steamId}&appid=730`),
      fetch(`https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${key}&steamid=${steamId}&include_played_free_games=1`),
    ]);

    const pData   = await pRes.json();
    const lvlData = await lvlRes.json();
    const sData   = sRes.ok ? await sRes.json() : null;
    const hData   = await hRes.json();

    const player = pData?.response?.players?.[0];
    if (!player) return res.redirect("/?error=no_profile");

    const steamLevel = lvlData?.response?.player_level ?? 0;
    const stats      = sData?.playerstats?.stats ?? [];
    const g          = (n) => stats.find(s => s.name === n)?.value ?? 0;
    const kills      = g("total_kills");
    const deaths     = g("total_deaths");
    const hs         = g("total_kills_headshot");
    const kd         = deaths > 0 ? (kills / deaths).toFixed(2) : "0.00";
    const hsPercent  = kills > 0 ? ((hs / kills) * 100).toFixed(1) : "0.0";
    const games      = hData?.response?.games ?? [];
    const cs2        = games.find(g => g.appid === 730);
    const hours      = cs2 ? Math.round(cs2.playtime_forever / 60) : 0;

    const favWeapon = (() => {
      const weapons = ["ak47","m4a1","awp","deagle","glock","usp_silencer","p250","famas","galil","sg556","aug","ssg08"];
      let best = { name: "N/D", kills: 0 };
      for (const w of weapons) { const k = g(`total_kills_${w}`); if (k > best.kills) best = { name: w.toUpperCase(), kills: k }; }
      return best.name;
    })();

    const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
    await db.from("players").upsert({
      steam_id:    steamId,
      nick:        player.personaname,
      avatar:      player.avatarfull,
      profile_url: player.profileurl,
      steam_level: steamLevel,
      kills, deaths, kd,
      hs_percent:  hsPercent,
      mvps:        g("total_mvps"),
      wins:        g("total_wins"),
      fav_weapon:  favWeapon,
      hours,
      elo:         0,
      last_login:  Date.now(),
    }, { onConflict: "steam_id" });

    const userData = encodeURIComponent(JSON.stringify({
      steam_id: steamId,
      nick:     player.personaname,
      avatar:   player.avatarfull,
    }));
    return res.redirect(`/?login=${userData}`);
  } catch (err) {
    console.error(err);
    return res.redirect("/?error=server_error");
  }
}
