// pages/api/auth/steam.js
// Inicia o fluxo de login Steam via OpenID 2.0
export default function handler(req, res) {
  const returnUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/steam/callback`;
  const realm = process.env.NEXT_PUBLIC_BASE_URL;

  const params = new URLSearchParams({
    'openid.ns': 'http://specs.openid.net/auth/2.0',
    'openid.mode': 'checkid_setup',
    'openid.return_to': returnUrl,
    'openid.realm': realm,
    'openid.identity': 'http://specs.openid.net/auth/2.0/identifier_select',
    'openid.claimed_id': 'http://specs.openid.net/auth/2.0/identifier_select',
  });

  return res.redirect(`https://steamcommunity.com/openid/login?${params.toString()}`);
}
