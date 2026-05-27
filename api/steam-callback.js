// api/steam-callback.js
import { createClient } from "@supabase/supabase-js";

const supabase = () => createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  const rawUrl = req.url.includes("?") ? req.url : "/?";
  const params = new URLSearchParams(rawUrl.split("?")[1] || "");
  const claimed_id = params.get("openid.claimed_id") || "";
  const steamId = claimed_id.match(/\/id\/(\d+)$/)?.[1];

  if (!steamId) return res.redirect("/?error=invalid_openid");

  const verifyParams = new URLSearchParams(params);
  verifyParams.set("openid.mode", "check_authentication");
  const verifyRes = await fetch("https://steamcommunity.com/openid/login", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: verifyParams.toString(),
  });
  const verifyText = await verifyRes.text();
  if (!verifyText.includes("is_valid:true")) return res.redirect("/?error=openid_failed");

  const profileRes = await fetch(
    `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${process.env.STEAM_API_KEY}&steamids=${steamId}`
  );
  const profileData = await profileRes.json();
  const player = profileData?.response?.players?.[0];
  if (!player) return res.redirect("/?error=profile_not_found");

  const db = supabase();
  const { data: existing } = await db.from("players").select("*").eq("steam_id", steamId).single();

  const playerData = {
    steam_id: steamId,
    nick: player.personaname,
    avatar: player.avatarfull,
    profile_url: player.profileurl,
    last_login: Date.now(),
    ...(existing ? {} : {
      elo: 0, kills: 0, deaths: 0, kd: "0.00", hs_percent: "0.0",
      mvps: 0, hours: 0, steam_level: 0, inventory_value: 0,
      fav_weapon: "N/D", wins: 0, created_at: Date.now()
    }),
  };

  await db.from("players").upsert(playerData, { onConflict: "steam_id" });

  return res.redirect(`/perfil.html?steamid=${steamId}`);
}
