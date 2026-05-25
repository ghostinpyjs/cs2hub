// pages/api/auth/steam/callback.js
// Valida a resposta OpenID do Steam e retorna o SteamID64
export default async function handler(req, res) {
  const params = new URLSearchParams(req.query);
  params.set('openid.mode', 'check_authentication');

  try {
    const verifyRes = await fetch('https://steamcommunity.com/openid/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    const text = await verifyRes.text();

    if (!text.includes('is_valid:true')) {
      return res.redirect('/?error=auth_failed');
    }

    // Extrai o SteamID64 da claimed_id
    const claimedId = req.query['openid.claimed_id'] || '';
    const match = claimedId.match(/(\d{17})$/);

    if (!match) {
      return res.redirect('/?error=invalid_steamid');
    }

    const steamid = match[1];

    // Redireciona para o frontend com o steamid na URL
    // O frontend lê o parâmetro e salva no localStorage/sessionStorage
    return res.redirect(`/?steamid=${steamid}&login=success`);
  } catch (err) {
    console.error('Steam auth callback error:', err);
    return res.redirect('/?error=server_error');
  }
}
