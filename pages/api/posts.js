// In-memory store for demo (resets on redeploy)
// For production persistence, connect a database like PlanetScale or Supabase
let posts = [
  {
    id: '1',
    steamid: '',
    username: 'Sistema COMYCS',
    avatar: null,
    content: '🎉 Bem-vindo ao COMYCS! Conecte seu perfil Steam e compartilhe suas stats com a comunidade.',
    likes: 12,
    likedBy: [],
    createdAt: Date.now() - 1000 * 60 * 60 * 2,
  }
];

export default function handler(req, res) {
  if (req.method === 'GET') {
    const sorted = [...posts].sort((a, b) => b.createdAt - a.createdAt);
    return res.status(200).json({ posts: sorted });
  }

  if (req.method === 'POST') {
    const { steamid, username, avatar, content } = req.body;
    if (!content || content.trim().length < 2) return res.status(400).json({ error: 'Post muito curto' });
    if (content.length > 280) return res.status(400).json({ error: 'Máximo 280 caracteres' });
    const post = {
      id: Date.now().toString(),
      steamid: steamid || '',
      username: username || 'Anônimo',
      avatar: avatar || null,
      content: content.trim(),
      likes: 0,
      likedBy: [],
      createdAt: Date.now(),
    };
    posts.unshift(post);
    if (posts.length > 100) posts = posts.slice(0, 100);
    return res.status(201).json({ post });
  }

  if (req.method === 'PATCH') {
    const { id, steamid } = req.body;
    const post = posts.find(p => p.id === id);
    if (!post) return res.status(404).json({ error: 'Post não encontrado' });
    const sid = steamid || 'anon';
    if (post.likedBy.includes(sid)) {
      post.likes--;
      post.likedBy = post.likedBy.filter(s => s !== sid);
    } else {
      post.likes++;
      post.likedBy.push(sid);
    }
    return res.status(200).json({ post });
  }

  return res.status(405).end();
}
