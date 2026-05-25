// pages/api/auth/steam/index.js
// Inicia o fluxo de login Steam via OpenID 2.0
export default function handler(req, res) {
  const base = process.env.NEXT_PUBLIC_BASE_URL;

  if (!base) {
    return res.status(500).json({ error: 'NEXT_PUBLIC_BASE_URL não configurado' });
  }

  const returnUrl = `${base}/api/auth/steam/callback`;

  // URLSearchParams codifica os ':' e '/' das URLs de identidade OpenID,
  // o que faz a Steam rejeitar o pedido com "Invalid OpenID".
  // Por isso montamos a query string manualmente com encodeURIComponent
  // apenas nos valores que precisam (URLs de callback e realm).
  const params = [
    ['openid.ns',         'http://specs.openid.net/auth/2.0'],
    ['openid.mode',       'checkid_setup'],
    ['openid.return_to',  returnUrl],
    ['openid.realm',      base],
    ['openid.identity',   'http://specs.openid.net/auth/2.0/identifier_select'],
    ['openid.claimed_id', 'http://specs.openid.net/auth/2.0/identifier_select'],
  ]
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&');

  return res.redirect(`https://steamcommunity.com/openid/login?${params}`);
}
