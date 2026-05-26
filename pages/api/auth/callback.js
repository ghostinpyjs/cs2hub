import { RelyingParty } from 'openid';

function getParty(req) {
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const base = `${proto}://${host}`;
  return new RelyingParty(`${base}/api/auth/callback`, base, true, false, []);
}

export default function handler(req, res) {
  const party = getParty(req);
  const fullUrl = `https://${req.headers.host}${req.url}`;

  party.verifyAssertion(fullUrl, async (err, result) => {
    if (err || !result?.authenticated) return res.redirect('/?error=auth_failed');

    const match = result.claimedIdentifier?.match(/\/id\/(\d+)$/);
    if (!match) return res.redirect('/?error=no_steamid');

    const steamid = match[1];
    res.redirect(`/?login=success&steamid=${steamid}`);
  });
}
