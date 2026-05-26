export default async function handler(req, res) {
  const { steamid } = req.query;
  const API_KEY = process.env.STEAM_API_KEY;
  if (!steamid) return res.status(400).json({ error: 'steamid required' });
  try {
    const fr = await fetch(`https://api.steampowered.com/ISteamUser/GetFriendList/v1/?key=${API_KEY}&steamid=${steamid}&relationship=friend`);
    if (!fr.ok) return res.status(200).json({ friends: [], error: 'Lista de amigos privada' });
    const fd = await fr.json();
    const ids = (fd.friendslist?.friends || []).slice(0, 20).map(f => f.steamid);
    if (!ids.length) return res.status(200).json({ friends: [] });
    const sr = await fetch(`https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${API_KEY}&steamids=${ids.join(',')}`);
    const sd = await sr.json();
    const friends = (sd.response?.players || []).map(p => ({ steamid: p.steamid, username: p.personaname, avatar: p.avatarmedium, profileurl: p.profileurl, status: p.personastate, gameextrainfo: p.gameextrainfo || null }));
    return res.status(200).json({ friends });
  } catch { return res.status(500).json({ error: 'Falha' }); }
}
