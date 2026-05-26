import { RelyingParty } from 'openid';

function getParty(req) {
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const base = `${proto}://${host}`;
  return new RelyingParty(`${base}/api/auth/callback`, base, true, false, []);
}

export default function handler(req, res) {
  const party = getParty(req);
  party.authenticate('https://steamcommunity.com/openid', false, (err, url) => {
    if (err || !url) return res.status(500).json({ error: 'Falha ao iniciar login Steam' });
    res.redirect(url);
  });
}
