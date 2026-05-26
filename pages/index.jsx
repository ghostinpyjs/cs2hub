// pages/index.jsx
import { useState, useEffect, useCallback, useRef } from 'react';
import Head from 'next/head';
import SteamAuth from '../components/SteamAuth';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n) {
  if (n == null || isNaN(n)) return '0';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K';
  return Number(n).toLocaleString('pt-BR');
}

function getStat(stats, name) {
  return Number(stats?.find(s => s.name === name)?.value || 0);
}

function parseStats(raw) {
  const s      = raw?.playerstats?.stats || [];
  const kills  = getStat(s, 'total_kills');
  const deaths = getStat(s, 'total_deaths');
  const wins   = getStat(s, 'total_wins');
  const rounds = getStat(s, 'total_rounds_played');
  const hs     = getStat(s, 'total_kills_headshot');
  const shots  = getStat(s, 'total_shots_fired');
  const hits   = getStat(s, 'total_shots_hit');
  const mvps   = getStat(s, 'total_mvps');
  const damage = getStat(s, 'total_damage_done');
  const bp     = getStat(s, 'total_planted_bombs');
  const bd     = getStat(s, 'total_defused_bombs');
  const knifeK = getStat(s, 'total_kills_knife');
  const awpK   = getStat(s, 'total_kills_awp');
  const matches = getStat(s, 'total_matches_played') || Math.round(rounds / 25) || 0;
  return {
    kills, deaths, wins, rounds, hs, shots, hits, mvps, damage, bp, bd, knifeK, awpK, matches,
    kdr: deaths > 0 ? (kills / deaths).toFixed(2) : kills > 0 ? '∞' : '0.00',
    hsP: kills  > 0 ? ((hs / kills) * 100).toFixed(1) : '0.0',
    acc: shots  > 0 ? ((hits / shots) * 100).toFixed(1) : '0.0',
    wr:  matches > 0 ? ((wins / matches) * 100).toFixed(1) : '0.0',
  };
}

function statusInfo(state) {
  if (state === 1) return { label: 'Online',  cls: 's-online',  dot: 'dot-online'  };
  if (state === 6) return { label: 'In-Game', cls: 's-ingame',  dot: 'dot-ingame'  };
  if ([2,3,4,5].includes(state)) return { label: 'Away', cls: 's-offline', dot: 'dot-offline' };
  return { label: 'Offline', cls: 's-offline', dot: 'dot-offline' };
}

function rarityColor(rarity, hex) {
  if (hex) return `#${hex}`;
  const m = {
    Contraband: '#e4ae39', Covert: '#eb4b4b', Classified: '#d32ce6',
    Restricted: '#8847ff', 'Mil-Spec Grade': '#4b69ff',
    'Industrial Grade': '#5e98d9', 'Consumer Grade': '#b0c3d9', 'Base Grade': '#b0c3d9',
  };
  return m[rarity] || '#b0c3d9';
}

function timeAgo(ts) {
  const d = Date.now() - ts;
  if (d < 60000)    return 'agora';
  if (d < 3600000)  return `${Math.floor(d / 60000)}m atrás`;
  if (d < 86400000) return `${Math.floor(d / 3600000)}h atrás`;
  return `${Math.floor(d / 86400000)}d atrás`;
}

// ─── Atoms ────────────────────────────────────────────────────────────────────

function Spinner({ text }) {
  return (
    <div className="spinner-wrap">
      <div className="spinner" />
      {text && <p className="spinner-txt">{text}</p>}
    </div>
  );
}

function ErrBox({ msg }) {
  return (
    <div className="err-box" role="alert">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      {msg}
    </div>
  );
}

function Empty({ icon, title, text }) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon}</div>
      <div className="empty-title">{title}</div>
      <p className="empty-txt">{text}</p>
    </div>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ state }) {
  const st = statusInfo(state);
  return (
    <span className={`status-badge ${st.cls}`}>
      <span className={`status-dot ${st.dot}`} />
      {st.label}
    </span>
  );
}

// ─── Item Modal ───────────────────────────────────────────────────────────────

function ItemModal({ item, onClose }) {
  const rc     = rarityColor(item.rarity, item.rarity_color);
  const mktUrl = `https://steamcommunity.com/market/listings/730/${encodeURIComponent(item.market_hash_name || item.name)}`;

  // Fechar com Escape
  useEffect(() => {
    const fn = e => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [onClose]);

  return (
    <div className="overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true">
        <div className="modal-accent-bar" style={{ background: rc }} />
        <div className="modal-body">
          <button className="modal-close" onClick={onClose} aria-label="Fechar">✕</button>
          <div className="modal-img-area">
            {item.icon_url
              ? <img src={item.icon_url} alt={item.name} className="modal-img" />
              : <span style={{ fontSize: 56 }}>🔫</span>}
          </div>
          <p className="modal-name">{item.name}</p>
          <p className="modal-type">{item.type}</p>
          <dl className="modal-dl">
            {item.rarity     && <><dt>Raridade</dt>    <dd style={{ color: rc }}>{item.rarity}</dd></>}
            {item.exterior   && <><dt>Exterior</dt>    <dd>{item.exterior}</dd></>}
            {item.weapon_type && <><dt>Arma</dt>       <dd>{item.weapon_type}</dd></>}
            <dt>Comercializável</dt>
            <dd style={{ color: item.tradable ? 'var(--green)' : 'var(--red)' }}>{item.tradable ? '✓ Sim' : '✗ Não'}</dd>
            <dt>Mercado Steam</dt>
            <dd style={{ color: item.marketable ? 'var(--green)' : 'var(--red)' }}>{item.marketable ? '✓ Disponível' : '✗ Indisponível'}</dd>
          </dl>
          {item.marketable && (
            <a href={mktUrl} target="_blank" rel="noopener noreferrer" className="modal-mkt-btn">
              🏷 Ver no Mercado Steam
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Stats Tab ────────────────────────────────────────────────────────────────

function StatsTab({ steamid }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr]         = useState('');

  useEffect(() => {
    if (!steamid) return;
    setLoading(true); setErr('');
    fetch(`/api/stats?steamid=${steamid}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => { setErr('Falha ao carregar estatísticas.'); setLoading(false); });
  }, [steamid]);

  if (loading) return <Spinner text="CARREGANDO STATS..." />;
  if (err)     return <ErrBox msg={err} />;
  if (!data?.stats) return <Empty icon="📊" title="Stats não encontradas" text="Perfil privado ou nenhuma partida registrada no CS2." />;

  const s = parseStats(data.stats);
  const bars = [
    { icon: '🎯', val: s.hsP + '%', lbl: 'Headshot %', pct: parseFloat(s.hsP), color: 'var(--purple)' },
    { icon: '🔫', val: s.acc + '%', lbl: 'Precisão',   pct: parseFloat(s.acc), color: 'var(--accent)' },
    { icon: '📈', val: s.wr  + '%', lbl: 'Win Rate',   pct: parseFloat(s.wr),  color: 'var(--green)'  },
  ];

  return (
    <div className="stats-wrap">
      {/* KDR hero card */}
      <div className="stat-hero">
        <div className="stat-hero-kdr">{s.kdr}</div>
        <div className="stat-hero-lbl">K/D Ratio</div>
        <div className="stat-hero-tag">
          {Number(s.kdr) >= 1.5 ? '🔥 Excelente' : Number(s.kdr) >= 1 ? '✓ Positivo' : '↓ Abaixo da média'}
        </div>
      </div>

      {/* Grid de cards */}
      <div className="stats-grid">
        {[
          ['💀', fmt(s.kills),   'Kills'],
          ['☠️', fmt(s.deaths),  'Deaths'],
          ['🏆', fmt(s.wins),    'Vitórias'],
          ['🎮', fmt(s.matches), 'Partidas'],
          ['🌀', fmt(s.rounds),  'Rounds'],
          ['⭐', fmt(s.mvps),    'MVPs'],
          ['💥', fmt(s.damage),  'Dano Total'],
          ['🎯', fmt(s.awpK),    'Kills AWP'],
          ['🔪', fmt(s.knifeK),  'Kills Faca'],
          ['💣', fmt(s.bp),      'Bombas Plant.'],
          ['🛡️', fmt(s.bd),     'Bombas Desarm.'],
        ].map(([icon, val, lbl]) => (
          <div key={lbl} className="stat-card">
            <div className="stat-card-icon">{icon}</div>
            <div className="stat-card-val">{val}</div>
            <div className="stat-card-lbl">{lbl}</div>
          </div>
        ))}
      </div>

      {/* Cards com barra de progresso */}
      <div className="stats-bars">
        {bars.map(({ icon, val, lbl, pct, color }) => (
          <div key={lbl} className="stat-bar-card">
            <div className="stat-bar-top">
              <span className="stat-bar-icon">{icon}</span>
              <span className="stat-bar-val">{val}</span>
              <span className="stat-bar-lbl">{lbl}</span>
            </div>
            <div className="stat-bar-track">
              <div className="stat-bar-fill" style={{ width: `${Math.min(pct, 100)}%`, background: color }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Inventory Tab ────────────────────────────────────────────────────────────

function InventoryTab({ steamid }) {
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(false);
  const [err, setErr]           = useState('');
  const [filter, setFilter]     = useState('Todos');
  const [search, setSearch]     = useState('');
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    if (!steamid) return;
    setLoading(true); setErr('');
    fetch(`/api/inventory?steamid=${steamid}`)
      .then(r => r.json())
      .then(d => { if (d.error) setErr(d.error); else setData(d); setLoading(false); })
      .catch(() => { setErr('Falha ao carregar inventário.'); setLoading(false); });
  }, [steamid]);

  if (loading) return <Spinner text="CARREGANDO INVENTÁRIO..." />;
  if (err)     return <div><ErrBox msg={err} /><Empty icon="🔒" title="Inventário Privado" text="Steam → Perfil → Privacidade → Inventário Público." /></div>;
  if (!data)   return null;

  const items = data.items || [];
  const cats  = ['Todos', ...Array.from(new Set(items.map(i => i.weapon_type || i.type?.split(' ')[0] || 'Outro').filter(Boolean)))];

  const visible = items
    .filter(i => filter === 'Todos' || (i.weapon_type || i.type?.split(' ')[0] || 'Outro') === filter)
    .filter(i => !search || i.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      {/* Controls */}
      <div className="inv-controls">
        <div className="inv-search-wrap">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            className="inv-search"
            placeholder="Filtrar itens..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && <button className="inv-search-clear" onClick={() => setSearch('')}>✕</button>}
        </div>
        <div className="inv-count">{visible.length} <span>de {items.length} itens</span></div>
      </div>

      <div className="filter-row">
        {cats.slice(0, 10).map(c => (
          <button key={c} className={`filter-btn ${filter === c ? 'on' : ''}`} onClick={() => setFilter(c)}>{c}</button>
        ))}
      </div>

      {visible.length === 0
        ? <Empty icon="📦" title="Nenhum item" text="Tente outro filtro ou termo de busca." />
        : (
          <div className="inv-grid">
            {visible.map((item, i) => {
              const rc = rarityColor(item.rarity, item.rarity_color);
              return (
                <button
                  key={`${item.assetid}-${i}`}
                  className="item-card"
                  style={{ '--rarity': rc, animationDelay: `${Math.min(i * 0.02, 0.5)}s` }}
                  onClick={() => setSelected(item)}
                >
                  <div className="item-rarity-bar" />
                  <div className="item-img-box">
                    {item.icon_url
                      ? <img src={item.icon_url} alt={item.name} className="item-img" loading="lazy" />
                      : <span style={{ fontSize: 44 }}>🔫</span>}
                  </div>
                  <div className="item-info">
                    <p className="item-name" title={item.name}>{item.name}</p>
                    {item.exterior && <p className="item-ext">{item.exterior}</p>}
                    {item.rarity   && <p className="item-rarity-lbl" style={{ color: rc }}>{item.rarity}</p>}
                    <div className="item-tags">
                      {item.tradable   && <span className="tag tag-t">trade</span>}
                      {item.marketable && <span className="tag tag-m">market</span>}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )
      }
      {selected && <ItemModal item={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

// ─── Feed Tab ─────────────────────────────────────────────────────────────────

function FeedTab({ currentPlayer, currentSteamid }) {
  const [posts, setPosts]          = useState([]);
  const [loadingPosts, setLoading] = useState(true);
  const [content, setContent]      = useState('');
  const [posting, setPosting]      = useState(false);
  const [friends, setFriends]      = useState([]);
  const MAX = 280;

  useEffect(() => {
    fetch('/api/posts').then(r => r.json()).then(d => { setPosts(d.posts || []); setLoading(false); });
  }, []);

  useEffect(() => {
    if (!currentSteamid) return;
    fetch(`/api/friends?steamid=${currentSteamid}`).then(r => r.json()).then(d => setFriends(d.friends || []));
  }, [currentSteamid]);

  const submitPost = async () => {
    if (!content.trim() || content.length > MAX) return;
    setPosting(true);
    const res = await fetch('/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        steamid:  currentSteamid || '',
        username: currentPlayer?.personaname || 'Anônimo',
        avatar:   currentPlayer?.avatarmedium || null,
        content:  content.trim(),
      }),
    });
    const d = await res.json();
    if (d.post) setPosts(prev => [d.post, ...prev]);
    setContent(''); setPosting(false);
  };

  const toggleLike = async (id) => {
    const res = await fetch('/api/posts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, steamid: currentSteamid || 'anon' }),
    });
    const d = await res.json();
    if (d.post) setPosts(prev => prev.map(p => p.id === id ? d.post : p));
  };

  const sid         = currentSteamid || 'anon';
  const onlineCount = friends.filter(f => f.status === 1 || f.status === 6).length;

  return (
    <div className="community-layout">
      {/* Feed principal */}
      <div className="feed-col">
        {/* Compose */}
        <div className="compose-box">
          <div className="compose-head">
            {currentPlayer?.avatarmedium
              ? <img src={currentPlayer.avatarmedium} alt="" className="compose-av" />
              : <div className="compose-av compose-av-placeholder">👤</div>}
            <div>
              <p className="compose-name">{currentPlayer?.personaname || 'Visitante'}</p>
              <p className="compose-sub">{currentPlayer ? 'Conectado via Steam' : 'Faça login para postar'}</p>
            </div>
          </div>
          <textarea
            className="compose-area"
            placeholder="Compartilhe uma conquista, peça dicas, ou comente sobre CS2..."
            value={content}
            onChange={e => setContent(e.target.value)}
            maxLength={MAX + 10}
            disabled={!currentPlayer}
          />
          <div className="compose-foot">
            <span className={`compose-count ${content.length > MAX ? 'over' : ''}`}>{content.length}/{MAX}</span>
            <button
              className="compose-submit"
              onClick={submitPost}
              disabled={posting || !content.trim() || content.length > MAX || !currentPlayer}
            >
              {posting ? 'Publicando…' : 'Publicar'}
            </button>
          </div>
        </div>

        {/* Posts */}
        {loadingPosts
          ? <Spinner text="CARREGANDO FEED..." />
          : posts.length === 0
            ? <Empty icon="💬" title="Feed vazio" text="Seja o primeiro a postar!" />
            : posts.map((post, i) => (
              <article key={post.id} className="post-card" style={{ animationDelay: `${i * 0.04}s` }}>
                <div className="post-head">
                  {post.avatar
                    ? <img src={post.avatar} alt="" className="post-av" />
                    : <div className="post-av post-av-ph">👤</div>}
                  <div>
                    <p className="post-user">{post.username}</p>
                    <time className="post-time">{timeAgo(post.createdAt)}</time>
                  </div>
                </div>
                <p className="post-body">{post.content}</p>
                <div className="post-actions">
                  <button
                    className={`post-like ${post.likedBy?.includes(sid) ? 'liked' : ''}`}
                    onClick={() => toggleLike(post.id)}
                    aria-label={post.likedBy?.includes(sid) ? 'Descurtir' : 'Curtir'}
                  >
                    {post.likedBy?.includes(sid) ? '❤️' : '🤍'} {post.likes}
                  </button>
                  <button
                    className="post-share"
                    onClick={() => navigator.clipboard?.writeText(window.location.href)}
                  >
                    🔗 Compartilhar
                  </button>
                </div>
              </article>
            ))
        }
      </div>

      {/* Sidebar */}
      <aside className="feed-sidebar">
        {currentPlayer && (
          <div className="sidebar-card">
            <div className="sidebar-card-title">
              👥 Amigos
              {onlineCount > 0 && <span className="online-pill">{onlineCount} online</span>}
            </div>
            {friends.length === 0
              ? <p className="sidebar-empty">Lista privada ou vazia.</p>
              : friends.slice(0, 10).map(f => {
                const st = statusInfo(f.status);
                return (
                  <a key={f.steamid} href={f.profileurl} target="_blank" rel="noopener noreferrer" className="friend-row">
                    <img src={f.avatar} alt="" className="friend-av" />
                    <div className="friend-info">
                      <span className="friend-name">{f.username}</span>
                      <span className="friend-sub">{f.gameextrainfo || st.label}</span>
                    </div>
                    <span className={`friend-dot ${st.dot}`} />
                  </a>
                );
              })
            }
          </div>
        )}
        <div className="sidebar-card">
          <div className="sidebar-card-title">📌 Sobre</div>
          <p className="sidebar-about">
            Plataforma de stats e comunidade para jogadores de CS2. Faça login com Steam para ver suas estatísticas, inventário e interagir com a comunidade.
          </p>
        </div>
      </aside>
    </div>
  );
}

// ─── Ranking Tab ──────────────────────────────────────────────────────────────

function RankingTab({ onLoadProfile }) {
  const [ranking, setRanking] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort]       = useState('kills');

  useEffect(() => {
    fetch('/api/ranking').then(r => r.json()).then(d => { setRanking(d.ranking || []); setLoading(false); });
  }, []);

  const sorted = [...ranking].sort((a, b) => {
    if (sort === 'kills') return b.kills - a.kills;
    if (sort === 'kdr')   return parseFloat(b.kdr) - parseFloat(a.kdr);
    if (sort === 'wins')  return b.wins - a.wins;
    if (sort === 'hours') return b.hours - a.hours;
    return 0;
  });

  if (loading) return <Spinner text="CARREGANDO RANKING..." />;

  return (
    <div>
      <div className="ranking-controls">
        <p className="inv-count"><b>{ranking.length}</b> jogadores</p>
        <div className="filter-row">
          {[['kills','💀 Kills'],['kdr','⚔️ K/D'],['wins','🏆 Vitórias'],['hours','⏱ Horas']].map(([k, l]) => (
            <button key={k} className={`filter-btn ${sort === k ? 'on' : ''}`} onClick={() => setSort(k)}>{l}</button>
          ))}
        </div>
      </div>

      {sorted.length === 0
        ? <Empty icon="🏆" title="Ranking vazio" text="Carregue seu perfil para entrar no ranking!" />
        : (
          <div className="ranking-table-wrap">
            <table className="ranking-table">
              <thead>
                <tr>
                  <th>#</th><th>Jogador</th><th>Kills</th><th>K/D</th>
                  <th>Vitórias</th><th>HS%</th><th>Horas</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((p, i) => (
                  <tr key={p.steamid} className={i < 3 ? `top-${i + 1}` : ''}>
                    <td>
                      <span className={`rank-pos ${i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : ''}`}>
                        {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                      </span>
                    </td>
                    <td>
                      <div className="rank-player">
                        {p.avatar
                          ? <img src={p.avatar} alt="" className="rank-av" />
                          : <div className="rank-av rank-av-ph">👤</div>}
                        <button className="rank-name-btn" onClick={() => onLoadProfile(p.steamid)}>
                          {p.username}
                        </button>
                      </div>
                    </td>
                    <td><span className={`rank-val ${sort === 'kills' ? 'hl' : ''}`}>{fmt(p.kills)}</span></td>
                    <td><span className={`rank-val ${sort === 'kdr'   ? 'hl' : ''}`}>{p.kdr}</span></td>
                    <td><span className={`rank-val ${sort === 'wins'  ? 'hl' : ''}`}>{fmt(p.wins)}</span></td>
                    <td><span className="rank-val">{p.hsPercent}%</span></td>
                    <td><span className={`rank-val ${sort === 'hours' ? 'hl' : ''}`}>{fmt(p.hours)}h</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      }
    </div>
  );
}

// ─── Profiles Tab ─────────────────────────────────────────────────────────────

function ProfilesTab({ onLoadProfile }) {
  const [query, setQuery]     = useState('');
  const [results, setResults] = useState([]);
  const [result, setResult]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr]         = useState('');

  const search = async () => {
    if (!query.trim()) return;
    setLoading(true); setErr(''); setResult(null); setResults([]);
    try {
      const res  = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`);
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || 'Jogador não encontrado');
      } else if (data.results?.length === 1) {
        const pData = await fetch(`/api/player?steamid=${data.results[0].steamid}`).then(r => r.json());
        setResult(pData?.response?.players?.[0] || data.results[0]);
      } else if (data.results?.length > 1) {
        setResults(data.results);
      } else {
        setErr('Nenhum resultado encontrado.');
      }
    } catch { setErr('Erro na busca.'); }
    setLoading(false);
  };

  return (
    <div className="profiles-wrap">
      <div className="profiles-header">
        <h2 className="profiles-title">Buscar Perfis</h2>
        <p className="profiles-sub">Digite uma URL personalizada do Steam ou SteamID64.</p>
      </div>

      <div className="profiles-search-box">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <input
          placeholder="Ex: gaben  ou  76561197960287930"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && search()}
          autoFocus
        />
        <button className="profiles-search-btn" onClick={search} disabled={loading || !query.trim()}>
          {loading ? '…' : 'Buscar'}
        </button>
      </div>

      {loading && <Spinner text="BUSCANDO..." />}
      {err     && <ErrBox msg={err} />}

      {results.length > 1 && (
        <div className="search-results">
          {results.map(r => (
            <button key={r.steamid} className="search-result-row" onClick={() => onLoadProfile(r.steamid)}>
              {r.avatar && <img src={r.avatar} alt={r.username} className="search-result-av" />}
              <div className="search-result-info">
                <span className="search-result-name">{r.username}</span>
                <span className="search-result-sid">{r.steamid}</span>
              </div>
              <span className="search-result-arrow">→</span>
            </button>
          ))}
        </div>
      )}

      {result && (
        <div className="found-card">
          <img src={result.avatarfull || result.avatarmedium} alt="" className="found-av" />
          <div className="found-info">
            <p className="found-name">{result.personaname || result.username}</p>
            <p className="found-sid">{result.steamid}</p>
            {result.personastate != null && <StatusBadge state={result.personastate} />}
            {result.gameextrainfo && <p className="found-game">🎮 {result.gameextrainfo}</p>}
          </div>
          <button className="found-load-btn" onClick={() => onLoadProfile(result.steamid)}>
            Carregar Perfil →
          </button>
        </div>
      )}

      {!result && results.length === 0 && !loading && !err && (
        <div className="profiles-tip">
          <strong>💡 Dica</strong>
          <p>Busque pela URL personalizada (ex: <code>gaben</code>) ou pelo SteamID64 (ex: <code>76561197960287930</code>).</p>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const NAV = [
  ['meu-perfil', '👤', 'Perfil'],
  ['feed',       '💬', 'Feed'],
  ['ranking',    '🏆', 'Ranking'],
  ['perfis',     '🔍', 'Perfis'],
];

export default function Home({ steamUser, onLogout }) {
  const [page, setPage]             = useState('meu-perfil');
  const [profileTab, setProfileTab] = useState('stats');
  const [steamid, setSteamid]       = useState('');
  const [player, setPlayer]         = useState(null);
  const [hours, setHours]           = useState(null);
  const [loading, setLoading]       = useState(false);
  const [err, setErr]               = useState('');
  const [mobileNav, setMobileNav]   = useState(false);

  // Auto-load ao fazer login com Steam
  useEffect(() => {
    if (steamUser?.steamid && !player && !loading) loadProfile(steamUser.steamid);
  }, [steamUser]);

  // Fechar menu mobile ao mudar de página
  useEffect(() => { setMobileNav(false); }, [page]);

  const loadProfile = useCallback(async (query) => {
    const q = (typeof query === 'string' ? query : '').trim();
    if (!q) return;
    setLoading(true); setErr(''); setPlayer(null); setSteamid(''); setHours(null);

    try {
      const resolveData = await fetch(`/api/resolve?vanity=${encodeURIComponent(q)}`).then(r => r.json());
      if (resolveData.error || !resolveData.steamid) {
        setErr(resolveData.error || 'Perfil não encontrado.');
        setLoading(false);
        return;
      }

      const sid = resolveData.steamid;
      setSteamid(sid);

      const [playerRes, playtimeRes] = await Promise.allSettled([
        fetch(`/api/player?steamid=${sid}`).then(r => r.json()),
        fetch(`/api/playtime?steamid=${sid}`).then(r => r.json()),
        // Registra stats no ranking em background
        fetch(`/api/stats?steamid=${sid}`).then(r => r.json()).then(statsData => {
          if (!statsData?.stats) return;
          const s = parseStats(statsData.stats);
          fetch(`/api/player?steamid=${sid}`).then(r => r.json()).then(pd => {
            const p = pd?.response?.players?.[0];
            if (!p) return;
            fetch('/api/ranking', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ steamid: sid, username: p.personaname, avatar: p.avatarmedium, kills: s.kills, deaths: s.deaths, wins: s.wins, kdr: s.kdr, hsPercent: s.hsP }),
            }).catch(() => {});
          });
        }).catch(() => {}),
      ]);

      if (playerRes.status === 'fulfilled') {
        const p = playerRes.value?.response?.players?.[0];
        if (p) setPlayer(p); else setErr('Jogador não encontrado.');
      }

      if (playtimeRes.status === 'fulfilled') {
        const g = playtimeRes.value?.response?.games?.[0];
        if (g) {
          const hrs = Math.round(g.playtime_forever / 60);
          setHours(hrs);
          const pName = playerRes.status === 'fulfilled' ? playerRes.value?.response?.players?.[0] : null;
          fetch('/api/ranking', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ steamid: sid, username: pName?.personaname || '', avatar: pName?.avatarmedium || null, hours: hrs }),
          }).catch(() => {});
        }
      }
    } catch {
      setErr('Erro de conexão. Tente novamente.');
    }

    setLoading(false);
    setPage('meu-perfil');
  }, []);

  const handleUserFound   = sid => { loadProfile(sid); setPage('meu-perfil'); };
  const handleLoadRanking = sid => { loadProfile(sid); setPage('meu-perfil'); };

  return (
    <>
      <Head>
        <title>COMYCS — CS2 Stats &amp; Comunidade</title>
        <meta name="description" content="Stats, inventário e comunidade para jogadores de CS2." />
      </Head>

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <header className="header">
        <div className="header-inner">
          {/* Logo */}
          <a href="/" className="logo" onClick={e => { e.preventDefault(); setPage('meu-perfil'); }}>
            <div className="logo-icon">
              <svg viewBox="0 0 18 18" fill="none" aria-hidden="true">
                <path d="M2 14L6 4L9 11L12 7L16 14" stroke="#000" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="9" cy="11" r="2" fill="#000"/>
              </svg>
            </div>
            <span className="logo-text">COM<em>YCS</em></span>
          </a>

          {/* SteamAuth (centro, desktop) */}
          <div className="header-auth">
            <SteamAuth steamUser={steamUser} onLogout={onLogout} onUserFound={handleUserFound} />
          </div>

          {/* Nav desktop */}
          <nav className="header-nav" aria-label="Navegação principal">
            {NAV.map(([id, , label]) => (
              <button key={id} className={`nav-btn ${page === id ? 'active' : ''}`} onClick={() => setPage(id)}>
                {label}
              </button>
            ))}
          </nav>

          {/* Hambúrguer mobile */}
          <button
            className={`hamburger ${mobileNav ? 'open' : ''}`}
            onClick={() => setMobileNav(v => !v)}
            aria-label="Menu"
            aria-expanded={mobileNav}
          >
            <span /><span /><span />
          </button>
        </div>

        {/* Nav mobile drawer */}
        {mobileNav && (
          <nav className="mobile-drawer" aria-label="Menu mobile">
            <div className="mobile-auth">
              <SteamAuth steamUser={steamUser} onLogout={onLogout} onUserFound={handleUserFound} />
            </div>
            {NAV.map(([id, icon, label]) => (
              <button key={id} className={`mobile-nav-btn ${page === id ? 'active' : ''}`} onClick={() => setPage(id)}>
                <span>{icon}</span> {label}
              </button>
            ))}
          </nav>
        )}
      </header>

      <main className="main">

        {/* ── Hero ────────────────────────────────────────────────────────── */}
        {page === 'meu-perfil' && !player && !loading && (
          <section className="hero">
            <div className="hero-glow" aria-hidden="true" />
            <div className="hero-grid" aria-hidden="true" />

            <h1 className="hero-title">COM<em>YCS</em></h1>
            <p className="hero-sub">Stats · Inventário · Comunidade — tudo do CS2 num só lugar</p>

            <div className="hero-cta">
              <a href="/api/auth/steam" className="hero-steam-btn">
                <svg width="18" height="18" viewBox="0 0 496 512" fill="currentColor" aria-hidden="true">
                  <path d="M496 256c0 137-111.2 248-248.4 248-113.8 0-209.7-75.2-239.1-177.4l95.7 39.6c6.6 32.4 35.5 56.8 70.2 56.8 39.1 0 70.9-32 70.9-71s-31.8-71-70.9-71l-1.4.1-66.7-97.4v-1.7c0-97.2 78.8-176 176-176s176 78.8 176 176zm-248 106.7c39.3 0 71-31.7 71-70.7s-31.8-70.7-71-70.7-71 31.7-71 70.7 31.8 70.7 71 70.7zm-98.7-214.5c0 40.3 26.8 73 63.4 82.7l-23.5-58.3c-14.4 0-26.1-11.7-26.1-26.1s11.7-26.1 26.1-26.1 26.1 11.7 26.1 26.1c0 8.3-3.9 15.6-10 20.2l25.3 62.5c32.3-16.4 54.6-50.1 54.6-89.1 0-55.2-44.8-100-100-100s-100 44.8-100 100z"/>
                </svg>
                Entrar com Steam
              </a>

              <div className="hero-divider"><span>ou</span></div>

              <div className="hero-search-wrap">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                </svg>
                <input
                  id="hero-q"
                  placeholder="URL Steam ou SteamID64..."
                  onKeyDown={e => e.key === 'Enter' && handleUserFound(e.target.value)}
                />
                <button onClick={() => { const v = document.getElementById('hero-q')?.value; if (v) handleUserFound(v); }}>
                  Buscar
                </button>
              </div>
            </div>

            <div className="hero-pages">
              {[['feed','💬','Feed'],['ranking','🏆','Ranking'],['perfis','🔍','Perfis']].map(([id, icon, label]) => (
                <button key={id} className="hero-page-btn" onClick={() => setPage(id)}>
                  {icon} {label}
                </button>
              ))}
            </div>
          </section>
        )}

        {/* ── States ──────────────────────────────────────────────────────── */}
        {loading && <Spinner text="BUSCANDO PERFIL STEAM..." />}
        {err && !loading && (
          <div className="content-wrap" style={{ paddingTop: 20 }}>
            <ErrBox msg={err} />
            <button className="retry-btn" onClick={() => setErr('')}>← Tentar novamente</button>
          </div>
        )}

        {/* ── Perfil carregado ─────────────────────────────────────────────── */}
        {page === 'meu-perfil' && player && !loading && (
          <>
            <div className="profile-banner">
              <div className="profile-banner-inner">
                <img
                  src={player.avatarfull || player.avatarmedium}
                  alt={player.personaname}
                  className="profile-av"
                />
                <div className="profile-info">
                  <h2 className="profile-name">{player.personaname}</h2>
                  <p className="profile-sid">SteamID64: {player.steamid}</p>
                  <div className="profile-meta">
                    <StatusBadge state={player.personastate} />
                    {player.gameextrainfo && <span className="profile-game">🎮 {player.gameextrainfo}</span>}
                    <a href={player.profileurl} target="_blank" rel="noopener noreferrer" className="profile-link">
                      ↗ Steam
                    </a>
                  </div>
                </div>
                <div className="profile-hours-block">
                  <div className="profile-hrs">{hours != null ? hours.toLocaleString('pt-BR') : '—'}</div>
                  <div className="profile-hrs-lbl">horas no CS2</div>
                  {player.timecreated && (
                    <div className="profile-since">desde {new Date(player.timecreated * 1000).getFullYear()}</div>
                  )}
                </div>
              </div>
            </div>

            <div className="content-wrap">
              <div className="tab-bar">
                <button className={`tab-btn ${profileTab === 'stats'     ? 'active' : ''}`} onClick={() => setProfileTab('stats')}>📊 Estatísticas</button>
                <button className={`tab-btn ${profileTab === 'inventory' ? 'active' : ''}`} onClick={() => setProfileTab('inventory')}>🎒 Inventário</button>
              </div>
              {profileTab === 'stats'     && <StatsTab     steamid={steamid} />}
              {profileTab === 'inventory' && <InventoryTab steamid={steamid} />}
            </div>
          </>
        )}

        {/* ── Outras páginas ───────────────────────────────────────────────── */}
        {page === 'feed' && (
          <div className="content-wrap">
            <h1 className="page-title">💬 Feed da Comunidade</h1>
            <FeedTab currentPlayer={player} currentSteamid={steamid} />
          </div>
        )}

        {page === 'ranking' && (
          <div className="content-wrap">
            <h1 className="page-title">🏆 Ranking Global</h1>
            <RankingTab onLoadProfile={handleLoadRanking} />
          </div>
        )}

        {page === 'perfis' && (
          <div className="content-wrap">
            <ProfilesTab onLoadProfile={handleLoadRanking} />
          </div>
        )}
      </main>

      <footer className="footer">
        <strong>COMYCS</strong> — CS2 Stats &amp; Comunidade
        <span className="footer-sep">·</span>
        Dados via Steam Web API
        <span className="footer-sep">·</span>
        Não afiliado à Valve Corporation
      </footer>
    </>
  );
}
