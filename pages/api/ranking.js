let ranking = [];
export default function handler(req, res) {
  if (req.method === 'GET') return res.status(200).json({ ranking: [...ranking].sort((a,b) => b.kills - a.kills).slice(0,50) });
  if (req.method === 'POST') {
    const { steamid, username, avatar, kills, deaths, wins, hours, kdr, hsPercent } = req.body;
    if (!steamid || !username) return res.status(400).json({ error: 'Missing fields' });
    const entry = { steamid, username, avatar, kills:kills||0, deaths:deaths||0, wins:wins||0, hours:hours||0, kdr:kdr||'0.00', hsPercent:hsPercent||'0.0', updatedAt:Date.now() };
    const idx = ranking.findIndex(r => r.steamid === steamid);
    if (idx >= 0) ranking[idx] = entry; else ranking.push(entry);
    return res.status(200).json({ ok: true });
  }
  return res.status(405).end();
}
