// api/steam-callback.js
// Valida retorno OpenID 2.0 da Steam e salva jogador no Vercel KV

import { createClient } from "@vercel/kv";

export default async function handler(req, res) {
  const params = new URLSearchParams(req.url.split("?")[1] || "");
  const claimed_id = params.get("openid.claimed_id") || "";
  const steamId = claimed_id.match(/\/id\/(\d+)$/)?.[1];

  if (!steamId) {
    return res.redirect("/?error=invalid_openid");
  }

  // Validar com Steam
  const verifyParams = new URLSearchParams(params);
  verifyParams.set("openid.mode", "check_authentication");

  const verifyRes = await fetch("https://steamcommunity.com/openid/login", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: verifyParams.toString(),
  });
  const verifyText = await verifyRes.text();

  if (!verifyText.includes("is_valid:true")) {
    return res.redirect("/?error=openid_failed");
  }

  // Buscar perfil básico da Steam
  const profileRes = await fetch(
    `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${process.env.STEAM_API_KEY}&steamids=${steamId}`
  );
  const profileData = await profileRes.json();
  const player = profileData?.response?.players?.[0];

  if (!player) {
    return res.redirect("/?error=profile_not_found");
  }

  // Salvar no Vercel KV
  const kv = createClient({
    url: process.env.KV_REST_API_URL,
    token: process.env.KV_REST_API_TOKEN,
  });

  const existing = await kv.get(`player:${steamId}`);
  const playerData = existing
    ? { ...existing, avatar: player.avatarfull, nick: player.personaname, lastLogin: Date.now() }
    : {
        steamId,
        nick: player.personaname,
        avatar: player.avatarfull,
        profileUrl: player.profileurl,
        elo: 0,
        kills: 0,
        deaths: 0,
        kd: 0,
        hsPercent: 0,
        mvps: 0,
        hours: 0,
        steamLevel: 0,
        inventoryValue: 0,
        createdAt: Date.now(),
        lastLogin: Date.now(),
      };

  await kv.set(`player:${steamId}`, playerData);

  // Adicionar ao índice de todos os jogadores
  await kv.sadd("players:all", steamId);

  // Redirecionar com cookie de sessão simples
  res.setHeader(
    "Set-Cookie",
    `steamId=${steamId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`
  );
  return res.redirect("/perfil.html");
}
