import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  try {
    const { steamid } = req.query;
    if (!steamid) return res.status(400).json({ error: "steamid required" });

    const key = process.env.STEAM_API_KEY;

    const [profileRes, levelRes, statsRes, hoursRes] = await Promise.all([
      fetch(`https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${key}&steamids=${steamid}`),
      fetch(`https://api.steampowered.com/IPlayerService/GetSteamLevel/v1/?key=${key}&steamid=${steamid}`),
      fetch(`https://api.steampowered.com/ISteamUserStats/GetUserStatsForGame/v2/?key=${key}&steamid=${steamid}&appid=730`),
      fetch(`https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${key}&steamid=${steamid}&include_played_free_games=1&format=json`),
    ]);

    const profileData = await profileRes.json();
    const levelData   = await levelRes.json();
    const statsData   = statsRes.ok ? await statsRes.json() : null;
    const hoursData   = await hoursRes.json();

    const player = profileData?.response?.players?.[0];
    if (!player) return res.status(404).json({ error: "Player not found" });

    const steamLevel = levelData?.response?.player_level ?? 0;
    const stats = statsData?.playerstats?.stats ?? [];
    const getStat = (name) => stats.find((s) => s.name === name)?.value ?? 0;

    const kills  = getStat("total_kills");
    const deaths = getStat("total_deaths");
    const hs     = getStat("total_kills_headshot");
    const mvps   = getStat("total_mvps");
    const wins   = getStat("total_wins");

    const favWeapon = (() => {
      const weapons = ["ak47","m4a1","awp","deagle","glock","usp_silencer","p250","famas","galil","sg556","aug","ssg08"];
      let best = { name: "N/D", kills: 0 };
      for (const w of weapons) {
        const k = getStat(`total_kills_${w}`);
        if (k > best.kills) best = { name: w.toUpperCase(), kills: k };
      }
      return best.name;
    })();

    const kd        = deaths > 0 ? (kills / deaths).toFixed(2) : kills.toFixed(2);
    const hsPercent = kills > 0 ? ((hs / kills) * 100).toFixed(1) : "0.0";

    // Horas do CS2 (appid 730)
    const games = hoursData?.response?.games ?? [];
    const cs2   = games.find(g => g.appid === 730);
    const hours = cs2 ? Math.round(cs2.playtime_forever / 60) : 0;

    const result = {
      steam_id:     steamid,
      nick:         player.personaname,
      avatar:       player.avatarfull,
      profile_url:  player.profileurl,
      steam_level:  steamLevel,
      kills, deaths, kd,
      hs_percent:   hsPercent,
      mvps, wins,
      fav_weapon:   favWeapon,
      hours,
      elo:          0,
      last_updated: Date.now(),
    };

    try {
      const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
      await db.from("players").upsert(result, { onConflict: "steam_id" });
    } catch (dbErr) {
      console.error("DB error:", dbErr);
    }

    return res.status(200).json(result);
  } catch (err) {
    console.error("steam-profile error:", err);
    return res.status(500).json({ error: err.message });
  }
}
