// Ranking store - players register themselves
let ranking = [];

export default function handler(req, res) {
  if (req.method === 'GET') {
    const sorted = [...ranking].sort((a, b) => b.kills - a.kills).slice(0, 50);
    return res.status(200).json({ ranking: sorted });
  }

  if (req.method === 'POST') {
    // Called when a user loads their profile, upserts their entry
    const { steamid, username, avatar, kills, deaths, wins, hours, kdr, hsPercent } = req.body;
    if (!steamid || !username) return res.status(400).json({ error: 'Missing fields' });
    const existing = ranking.findIndex(r => r.steamid === steamid);
    const entry = { steamid, username, avatar, kills: kills || 0, deaths: deaths || 0, wins: wins || 0, hours: hours || 0, kdr: kdr || '0.00', hsPercent: hsPercent || '0.0', updatedAt: Date.now() };
    if (existing >= 0) ranking[existing] = entry;
    else ranking.push(entry);
    return res.status(200).json({ ok: true });
  }

  return res.status(405).end();
}
