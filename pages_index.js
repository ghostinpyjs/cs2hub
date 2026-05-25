import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmt(n) {
  if (n == null || isNaN(n)) return '0';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return Number(n).toLocaleString('pt-BR');
}

function getStat(stats, name) {
  return Number(stats?.find(s => s.name === name)?.value || 0);
}

function parseStats(raw) {
  const s = raw?.playerstats?.stats || [];
  const kills = getStat(s, 'total_kills');
  const deaths = getStat(s, 'total_deaths');
  const wins = getStat(s, 'total_wins');
  const rounds = getStat(s, 'total_rounds_played');
  const hs = getStat(s, 'total_kills_headshot');
  const shots = getStat(s, 'total_shots_fired');
  const hits = getStat(s, 'total_shots_hit');
  const mvps = getStat(s, 'total_mvps');
  const damage = getStat(s, 'total_damage_done');
  const bp = getStat(s, 'total_planted_bombs');
  const bd = getStat(s, 'total_defused_bombs');
  const knifeK = getStat(s, 'total_kills_knife');
  const awpK = getStat(s, 'total_kills_awp');
  const matches = getStat(s, 'total_matches_played') || Math.round(rounds / 25) || 0;
  return {
    kills, deaths, wins, rounds, hs, shots, hits, mvps, damage, bp, bd, knifeK, awpK, matches,
    kdr: deaths > 0 ? (kills / deaths).toFixed(2) : kills > 0 ? '∞' : '0.00',
    hsP: kills > 0 ? ((hs / kills) * 100).toFixed(1) : '0.0',
    acc: shots > 0 ? ((hits / shots) * 100).toFixed(1) : '0.0',
    wr: matches > 0 ? ((wins / matches) * 100).toFixed(1) : '0.0',
  };
}

function statusInfo(state) {
  if (state === 1) return { label: 'Online', cls: 's-online', dot: 'online-dot' };
  if (state === 6) return { label: 'In-Game', cls: 's-ingame', dot: 'ingame-dot' };
  if ([2, 3, 4, 5].includes(state)) return { label: 'Away', cls: 's-offline', dot: 'offline-dot' };
  return { label: 'Offline', cls: 's-offline', dot: 'offline-dot' };
}

function rarityColor(rarity, hex) {
  if (hex) return `#${hex}`;
  const m = { Contraband: '#e4ae39', Covert: '#eb4b4b', Classified: '#d32ce6', Restricted: '#8847ff', 'Mil-Spec Grade': '#4b69ff', 'Industrial Grade': '#5e98d9', 'Consumer Grade': '#b0c3d9', 'Base Grade': '#b0c3d9' };
  return m[rarity] || '#b0c3d9';
}

function timeAgo(ts) {
  const diff = Date.now() - ts;
  if (diff < 60000) return 'agora';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m atrás`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h atrás`;
  return `${Math.floor(diff / 86400000)}d atrás`;
}

// ─── Small components ────────────────────────────────────────────────────────

function Loading({ text }) {
  return (
    <div className="loading">
      <div className="spinner" />
      <div className="loading-txt">{text || 'CARREGANDO...'}</div>
    </div>
  );
}

function Err({ msg }) {
  return <div className="err"><span>⚠</span> {msg}</div>;
}

function Empty({ icon, title, text }) {
  return (
    <div className="empty-notice">
      <div className="empty-icon">{icon}</div>
      <div className="empty-title">{title}</div>
      <p className="empty-txt">{text}</p>
    </div>
  );
}

// ─── Item Modal ───────────────────────────────────────────────────────────────

function ItemModal({ item, onClose }) {
  const rc = rarityColor(item.rarity, item.rarity_color);
  const mktUrl = `https://steamcommunity.com/market/listings/730/${encodeURIComponent(item.market_hash_name || item.name)}`;
  return (
    <div className="overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-bar" style={{ background: rc }} />
        <div className="modal-body">
          <button className="modal-close" onClick={onClose}>✕</button>
          <div className="modal-img-area">
            {item.icon_url ? <img src={item.icon_url} alt={item.name} className="modal-img" /> : <div style={{ fontSize: 56, color: 'var(--text3)' }}>🔫</div>}
          </div>
          <div className="modal-name">{item.name}</div>
          <div className="modal-type">{item.type}</div>
          <div className="modal-rows">
            {item.rarity && <div className="modal-row"><span className="modal-row-k">Raridade</span><span className="modal-row-v" style={{ color: rc }}>{item.rarity}</span></div>}
            {item.exterior && <div className="modal-row"><span className="modal-row-k">Exterior</span><span className="modal-row-v">{item.exterior}</span></div>}
            {item.weapon_type && <div className="modal-row"><span className="modal-row-k">Arma</span><span className="modal-row-v">{item.weapon_type}</span></div>}
            <div className="modal-row"><span className="modal-row-k">Comercializável</span><span className="modal-row-v" style={{ color: item.tradable ? 'var(--green)' : 'var(--red)' }}>{item.tradable ? '✓ Sim' : '✗ Não'}</span></div>
            <div className="modal-row"><span className="modal-row-k">Mercado Steam</span><span className="modal-row-v" style={{ color: item.marketable ? 'var(--green)' : 'var(--red)' }}>{item.marketable ? '✓ Disponível' : '✗ Indisponível'}</span></div>
          </div>
          {item.marketable && <a href={mktUrl} target="_blank" rel="noopener noreferrer" className="modal-mkt-btn">🏷 Ver no Mercado Steam</a>}
        </div>
      </div>
    </div>
  );
}

// ─── Stats Tab ────────────────────────────────────────────────────────────────

function StatsTab({ steamid }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!steamid) return;
    setLoading(true); setErr('');
    fetch(`/api/stats?steamid=${steamid}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => { setErr('Erro ao carregar stats'); setLoading(false); });
  }, [steamid]);

  if (loading) return <Loading text="CARREGANDO STATS..." />;
  if (err) return <div><Err msg={err} /><Empty icon="📊" title="Stats Indisponíveis" text="Esse perfil pode estar privado." /></div>;
  if (!data?.stats) return <Empty icon="📊" title="Stats Não Encontradas" text="Perfil privado ou nenhuma partida registrada no CS2." />;

  const s = parseStats(data.stats);
  return (
    <div className="stats-grid">
      <div className="stat-card stat-wide">
        <div className="stat-card-icon">⚔️</div>
        <div className="stat-card-val">{s.kdr}</div>
        <div className="stat-card-lbl">K/D Ratio</div>
        <div className="stat-kd-tag">{Number(s.kdr) >= 1.5 ? '🔥 Excelente' : Number(s.kdr) >= 1 ? '✓ Positivo' : '↓ Abaixo da média'}</div>
      </div>
      <div className="stat-card"><div className="stat-card-icon">💀</div><div className="stat-card-val">{fmt(s.kills)}</div><div className="stat-card-lbl">Kills</div></div>
      <div className="stat-card"><div className="stat-card-icon">☠️</div><div className="stat-card-val">{fmt(s.deaths)}</div><div className="stat-card-lbl">Deaths</div></div>
      <div className="stat-card">
        <div className="stat-card-icon">🎯</div><div className="stat-card-val">{s.hsP}%</div><div className="stat-card-lbl">Headshot %</div>
        <div className="stat-card-bar"><div className="stat-card-bar-fill" style={{ width: `${Math.min(parseFloat(s.hsP), 100)}%`, background: 'var(--purple)' }} /></div>
      </div>
      <div className="stat-card">
        <div className="stat-card-icon">🔫</div><div className="stat-card-val">{s.acc}%</div><div className="stat-card-lbl">Precisão</div>
        <div className="stat-card-bar"><div className="stat-card-bar-fill" style={{ width: `${Math.min(parseFloat(s.acc), 100)}%`, background: 'var(--accent)' }} /></div>
      </div>
      <div className="stat-card"><div className="stat-card-icon">🏆</div><div className="stat-card-val">{fmt(s.wins)}</div><div className="stat-card-lbl">Vitórias</div></div>
      <div className="stat-card">
        <div className="stat-card-icon">📈</div><div className="stat-card-val">{s.wr}%</div><div className="stat-card-lbl">Win Rate</div>
        <div className="stat-card-bar"><div className="stat-card-bar-fill" style={{ width: `${Math.min(parseFloat(s.wr), 100)}%`, background: 'var(--green)' }} /></div>
      </div>
      <div className="stat-card"><div className="stat-card-icon">🎮</div><div className="stat-card-val">{fmt(s.matches)}</div><div className="stat-card-lbl">Partidas</div></div>
      <div className="stat-card"><div className="stat-card-icon">🌀</div><div className="stat-card-val">{fmt(s.rounds)}</div><div className="stat-card-lbl">Rounds</div></div>
      <div className="stat-card"><div className="stat-card-icon">⭐</div><div className="stat-card-val">{fmt(s.mvps)}</div><div className="stat-card-lbl">MVPs</div></div>
      <div className="stat-card"><div className="stat-card-icon">💥</div><div className="stat-card-val">{fmt(s.damage)}</div><div className="stat-card-lbl">Dano Total</div></div>
      <div className="stat-card"><div className="stat-card-icon">🎯</div><div className="stat-card-val">{fmt(s.awpK)}</div><div className="stat-card-lbl">Kills AWP</div></div>
      <div className="stat-card"><div className="stat-card-icon">🔪</div><div className="stat-card-val">{fmt(s.knifeK)}</div><div className="stat-card-lbl">Kills Faca</div></div>
      <div className="stat-card"><div className="stat-card-icon">💣</div><div className="stat-card-val">{fmt(s.bp)}</div><div className="stat-card-lbl">Bombas Plantadas</div></div>
      <div className="stat-card"><div className="stat-card-icon">🛡️</div><div className="stat-card-val">{fmt(s.bd)}</div><div className="stat-card-lbl">Bombas Desarmadas</div></div>
    </div>
  );
}

// ─── Inventory Tab ────────────────────────────────────────────────────────────

function InventoryTab({ steamid }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [filter, setFilter] = useState('Todos');
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    if (!steamid) return;
    setLoading(true); setErr('');
    fetch(`/api/inventory?steamid=${steamid}`)
      .then(r => r.json())
      .then(d => { if (d.error) setErr(d.error); else setData(d); setLoading(false); })
      .catch(() => { setErr('Erro ao carregar inventário'); setLoading(false); });
  }, [steamid]);

  if (loading) return <Loading text="CARREGANDO INVENTÁRIO..." />;
  if (err) return <div><Err msg={err} /><Empty icon="🔒" title="Inventário Privado" text="Vá em Steam → Perfil → Privacidade e defina o Inventário como Público." /></div>;
  if (!data) return null;

  const items = data.items || [];
  const cats = ['Todos', ...Array.from(new Set(items.map(i => i.weapon_type || (i.type?.split(' ')[0]) || 'Outro').filter(Boolean)))];
  const filtered = filter === 'Todos' ? items : items.filter(i => (i.weapon_type || (i.type?.split(' ')[0]) || 'Outro') === filter);

  return (
    <div>
      <div className="inv-header">
        <div className="inv-count">Total: <b>{items.length}</b> itens{filter !== 'Todos' && <> · Filtro: <b>{filtered.length}</b></>}</div>
        <div className="filter-row">
          {cats.slice(0, 9).map(c => (
            <button key={c} className={`filter-btn ${filter === c ? 'on' : ''}`} onClick={() => setFilter(c)}>{c}</button>
          ))}
        </div>
      </div>
      {filtered.length === 0
        ? <Empty icon="📦" title="Nenhum item" text="Sem itens nessa categoria." />
        : (
          <div className="inv-grid">
            {filtered.map((item, i) => {
              const rc = rarityColor(item.rarity, item.rarity_color);
              return (
                <div key={`${item.assetid}-${i}`} className="item-card" style={{ animationDelay: `${Math.min(i * 0.025, 0.4)}s`, borderColor: `${rc}30` }} onClick={() => setSelected(item)}>
                  <div className="item-top" style={{ background: rc }} />
                  <div className="item-img-box">
                    {item.icon_url ? <img src={item.icon_url} alt={item.name} className="item-img" loading="lazy" /> : <div style={{ fontSize: 48, color: 'var(--text3)' }}>🔫</div>}
                  </div>
                  <div className="item-foot">
                    <div className="item-name" title={item.name}>{item.name}</div>
                    {item.exterior && <div className="item-ext">{item.exterior}</div>}
                    {item.rarity && <div className="item-rarity" style={{ color: rc }}>{item.rarity}</div>}
                    <div className="item-tags">
                      {item.tradable && <span className="tag tag-t">trade</span>}
                      {item.marketable && <span className="tag tag-m">market</span>}
                    </div>
                  </div>
                </div>
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
  const [posts, setPosts] = useState([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [content, setContent] = useState('');
  const [posting, setPosting] = useState(false);
  const [friends, setFriends] = useState([]);
  const MAX = 280;

  useEffect(() => {
    fetch('/api/posts').then(r => r.json()).then(d => { setPosts(d.posts || []); setLoadingPosts(false); });
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
      body: JSON.stringify({ steamid: currentSteamid || '', username: currentPlayer?.personaname || 'Anônimo', avatar: currentPlayer?.avatarmedium || null, content: content.trim() }),
    });
    const d = await res.json();
    if (d.post) setPosts(prev => [d.post, ...prev]);
    setContent(''); setPosting(false);
  };

  const toggleLike = async (id) => {
    const res = await fetch('/api/posts', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, steamid: currentSteamid || 'anon' }) });
    const d = await res.json();
    if (d.post) setPosts(prev => prev.map(p => p.id === id ? d.post : p));
  };

  const sid = currentSteamid || 'anon';
  const onlineCount = friends.filter(f => f.status === 1 || f.status === 6).length;

  return (
    <div className="community-layout">
      <div>
        <div className="feed-compose">
          <div className="compose-header">
            {currentPlayer?.avatarmedium
              ? <img src={currentPlayer.avatarmedium} alt="" className="compose-avatar" style={{ borderRadius: 'var(--radius-sm)' }} />
              : <div className="compose-avatar">👤</div>}
            <div>
              <div className="compose-name">{currentPlayer?.personaname || 'Visitante'}</div>
              <div className="compose-sub">{currentPlayer ? 'Conectado via Steam' : 'Carregue seu perfil para postar'}</div>
            </div>
          </div>
          <textarea className="compose-textarea" placeholder="Compartilhe uma conquista, peça dicas, ou poste qualquer coisa sobre CS2..." value={content} onChange={e => setContent(e.target.value)} maxLength={MAX + 10} />
          <div className="compose-footer">
            <span className={`compose-chars ${content.length > MAX ? 'warn' : ''}`}>{content.length}/{MAX}</span>
            <button className="compose-btn" onClick={submitPost} disabled={posting || !content.trim() || content.length > MAX}>{posting ? 'Postando...' : 'Publicar'}</button>
          </div>
        </div>
        {loadingPosts ? <Loading text="CARREGANDO FEED..." /> : posts.length === 0
          ? <Empty icon="💬" title="Feed vazio" text="Seja o primeiro a postar!" />
          : posts.map((post, i) => (
            <div key={post.id} className="post-card" style={{ animationDelay: `${i * 0.04}s` }}>
              <div className="post-header">
                {post.avatar ? <img src={post.avatar} alt="" className="post-avatar" /> : <div className="post-avatar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg4)', fontSize: 18 }}>👤</div>}
                <div><div className="post-user">{post.username}</div><div className="post-time">{timeAgo(post.createdAt)}</div></div>
              </div>
              <div className="post-content">{post.content}</div>
              <div className="post-footer">
                <button className={`like-btn ${post.likedBy?.includes(sid) ? 'liked' : ''}`} onClick={() => toggleLike(post.id)}>{post.likedBy?.includes(sid) ? '❤️' : '🤍'} {post.likes}</button>
                <button className="share-btn" onClick={() => { navigator.clipboard?.writeText(window.location.href); }}>🔗 Compartilhar</button>
              </div>
            </div>
          ))
        }
      </div>
      <div className="sidebar">
        {currentPlayer && (
          <div className="sidebar-card">
            <div className="sidebar-title">👥 Amigos {onlineCount > 0 && <span style={{ fontSize: 12, color: 'var(--green)', fontFamily: 'var(--font-mono)' }}>{onlineCount} online</span>}</div>
            {friends.length === 0
              ? <div style={{ padding: '16px 18px', fontSize: 13, color: 'var(--text3)' }}>Lista de amigos privada ou vazia.</div>
              : friends.slice(0, 10).map(f => {
                const st = statusInfo(f.status);
                return (
                  <a key={f.steamid} href={f.profileurl} target="_blank" rel="noopener noreferrer" className="sidebar-item">
                    <img src={f.avatar} alt="" className="sidebar-item-av" />
                    <div style={{ flex: 1, minWidth: 0 }}><div className="sidebar-item-name">{f.username}</div><div className="sidebar-item-sub">{f.gameextrainfo || st.label}</div></div>
                    <div className="sidebar-item-status"><div className={st.dot} /></div>
                  </a>
                );
              })
            }
          </div>
        )}
        <div className="sidebar-card">
          <div className="sidebar-title">📌 Sobre o COMYCS</div>
          <div style={{ padding: '14px 18px', fontSize: 13, color: 'var(--text2)', lineHeight: 1.7 }}>Plataforma de stats e comunidade para jogadores de CS2. Carregue seu perfil Steam para ver suas estatísticas, inventário e interagir com outros jogadores.</div>
        </div>
      </div>
    </div>
  );
}

// ─── Ranking Tab ──────────────────────────────────────────────────────────────

function RankingTab({ onLoadProfile }) {
  const [ranking, setRanking] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState('kills');

  useEffect(() => {
    fetch('/api/ranking').then(r => r.json()).then(d => { setRanking(d.ranking || []); setLoading(false); });
  }, []);

  const sorted = [...ranking].sort((a, b) => {
    if (sort === 'kills') return b.kills - a.kills;
    if (sort === 'kdr') return parseFloat(b.kdr) - parseFloat(a.kdr);
    if (sort === 'wins') return b.wins - a.wins;
    if (sort === 'hours') return b.hours - a.hours;
    return 0;
  });

  if (loading) return <Loading text="CARREGANDO RANKING..." />;
  return (
    <div>
      <div className="inv-header">
        <div className="inv-count"><b>{ranking.length}</b> jogadores no ranking</div>
        <div className="filter-row">
          {[['kills', '💀 Kills'], ['kdr', '⚔️ K/D'], ['wins', '🏆 Vitórias'], ['hours', '⏱ Horas']].map(([k, l]) => (
            <button key={k} className={`filter-btn ${sort === k ? 'on' : ''}`} onClick={() => setSort(k)}>{l}</button>
          ))}
        </div>
      </div>
      {sorted.length === 0 ? (
        <div className="rank-empty"><div className="rank-empty-icon">🏆</div><div className="rank-empty-txt">O ranking será preenchido conforme os jogadores carregarem seus perfis.</div></div>
      ) : (
        <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
          <table className="ranking-table">
            <thead><tr><th>#</th><th>Jogador</th><th>Kills</th><th>K/D</th><th>Vitórias</th><th>HS%</th><th>Horas</th></tr></thead>
            <tbody>
              {sorted.map((p, i) => (
                <tr key={p.steamid}>
                  <td><span className={`rank-num ${i === 0 ? 'rank-1' : i === 1 ? 'rank-2' : i === 2 ? 'rank-3' : ''}`}>{i + 1}</span></td>
                  <td>
                    <div className="rank-player">
                      {p.avatar ? <img src={p.avatar} alt="" className="rank-av" /> : <div className="rank-av" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg4)', fontSize: 14 }}>👤</div>}
                      <button onClick={() => onLoadProfile(p.steamid)} className="rank-name" style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>{p.username}</button>
                    </div>
                  </td>
                  <td><span className={`rank-val ${sort === 'kills' ? 'rank-val-hl' : ''}`}>{fmt(p.kills)}</span></td>
                  <td><span className={`rank-val ${sort === 'kdr' ? 'rank-val-hl' : ''}`}>{p.kdr}</span></td>
                  <td><span className={`rank-val ${sort === 'wins' ? 'rank-val-hl' : ''}`}>{fmt(p.wins)}</span></td>
                  <td><span className="rank-val">{p.hsPercent}%</span></td>
                  <td><span className={`rank-val ${sort === 'hours' ? 'rank-val-hl' : ''}`}>{fmt(p.hours)}h</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Profiles Tab ─────────────────────────────────────────────────────────────

function ProfilesTab({ onLoadProfile }) {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const search = async () => {
    if (!query.trim()) return;
    setLoading(true); setErr(''); setResult(null);
    try {
      const res = await fetch(`/api/resolve?vanity=${encodeURIComponent(query.trim())}`);
      const d = await res.json();
      if (d.error) { setErr(d.error); setLoading(false); return; }
      const pRes = await fetch(`/api/player?steamid=${d.steamid}`);
      const pData = await pRes.json();
      const p = pData?.response?.players?.[0];
      if (!p) { setErr('Jogador não encontrado'); setLoading(false); return; }
      setResult({ ...p });
    } catch { setErr('Erro na busca'); }
    setLoading(false);
  };

  const st = result ? statusInfo(result.personastate) : null;
  return (
    <div className="profile-search-wrap">
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800, marginBottom: 6 }}>Buscar Perfis</div>
        <div style={{ fontSize: 14, color: 'var(--text2)' }}>Digite um nome de usuário Steam ou SteamID64 para encontrar e carregar o perfil de qualquer jogador.</div>
      </div>
      <div className="profile-search-box">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text3)', flexShrink: 0 }}><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
        <input placeholder="Nome de usuário ou SteamID64..." value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && search()} autoFocus />
        <button className="profile-search-btn" onClick={search}>Buscar</button>
      </div>
      {loading && <Loading text="BUSCANDO..." />}
      {err && <Err msg={err} />}
      {result && (
        <div className="found-profile-card">
          <img src={result.avatarfull || result.avatarmedium} alt="" className="found-avatar" />
          <div className="found-info">
            <div className="found-name">{result.personaname}</div>
            <div className="found-sid">{result.steamid}</div>
            <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <div className={`profile-status ${st?.cls}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                <span className="s-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />{st?.label}
              </div>
              {result.gameextrainfo && <span style={{ fontSize: 13, color: 'var(--blue)' }}>🎮 {result.gameextrainfo}</span>}
            </div>
          </div>
          <button className="found-load-btn" onClick={() => onLoadProfile(result.steamid)}>Carregar Perfil →</button>
        </div>
      )}
      {!result && !loading && !err && (
        <div style={{ marginTop: 32, padding: '24px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 14, color: 'var(--text3)', lineHeight: 1.8 }}>
          <div style={{ fontWeight: 600, color: 'var(--text2)', marginBottom: 8 }}>💡 Dica</div>
          Você pode buscar pelo nome de usuário (ex: <b style={{ color: 'var(--text)' }}>valve</b>), pela URL personalizada (ex: <b style={{ color: 'var(--text)' }}>gaben</b>), ou pelo SteamID64.
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Home({ steamUser, onLogout }) {
  const [page, setPage] = useState('meu-perfil');
  const [profileTab, setProfileTab] = useState('stats');
  const [input, setInput] = useState('');
  const [steamid, setSteamid] = useState('');
  const [player, setPlayer] = useState(null);
  const [hours, setHours] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  // Quando o usuário loga via Steam, carrega o perfil automaticamente
  useEffect(() => {
    if (steamUser?.steamid && !player) {
      loadProfile(steamUser.steamid);
    }
  }, [steamUser]);

  const loadProfile = useCallback(async (query) => {
    const q = (typeof query === 'string' ? query : input).trim();
    if (!q) return;
    setLoading(true); setErr(''); setPlayer(null); setSteamid(''); setHours(null);
    try {
      const resolveRes = await fetch(`/api/resolve?vanity=${encodeURIComponent(q)}`);
      const resolveData = await resolveRes.json();
      if (resolveData.error || !resolveData.steamid) { setErr(resolveData.error || 'Perfil não encontrado'); setLoading(false); return; }
      const sid = resolveData.steamid;
      setSteamid(sid);
      const [playerRes, playtimeRes] = await Promise.allSettled([
        fetch(`/api/player?steamid=${sid}`).then(r => r.json()),
        fetch(`/api/playtime?steamid=${sid}`).then(r => r.json()),
        fetch(`/api/stats?steamid=${sid}`).then(r => r.json()).then(statsData => {
          if (statsData?.stats) {
            const s = parseStats(statsData.stats);
            fetch(`/api/player?steamid=${sid}`).then(r => r.json()).then(pd => {
              const p = pd?.response?.players?.[0];
              if (p) fetch('/api/ranking', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ steamid: sid, username: p.personaname, avatar: p.avatarmedium, kills: s.kills, deaths: s.deaths, wins: s.wins, kdr: s.kdr, hsPercent: s.hsP }) }).catch(() => {});
            });
          }
        }).catch(() => {}),
      ]);
      if (playerRes.status === 'fulfilled') {
        const p = playerRes.value?.response?.players?.[0];
        if (p) setPlayer(p); else setErr('Jogador não encontrado');
      }
      if (playtimeRes.status === 'fulfilled') {
        const g = playtimeRes.value?.response?.games?.[0];
        if (g) {
          const hrs = Math.round(g.playtime_forever / 60);
          setHours(hrs);
          fetch('/api/ranking', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ steamid: sid, username: playerRes.value?.response?.players?.[0]?.personaname || '', avatar: playerRes.value?.response?.players?.[0]?.avatarmedium || null, hours: hrs }) }).catch(() => {});
        }
      }
    } catch { setErr('Erro de conexão. Tente novamente.'); }
    setLoading(false);
    setPage('meu-perfil');
  }, [input]);

  const handleLoadFromRanking = (sid) => { loadProfile(sid); setPage('meu-perfil'); };
  const status = player ? statusInfo(player.personastate) : null;

  return (
    <>
      <Head><title>COMYCS — CS2 Stats & Comunidade</title></Head>

      {/* ── Header ── */}
      <header className="header">
        <div className="header-inner">
          <a href="/" className="logo">
            <div className="logo-mark">
              <svg viewBox="0 0 18 18" fill="none"><path d="M2 14L6 4L9 11L12 7L16 14" stroke="#000" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /><circle cx="9" cy="11" r="2" fill="#000" /></svg>
            </div>
            <span className="logo-name">COM<span>YCS</span></span>
          </a>

          <div className="hdr-search">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text3)', flexShrink: 0 }}><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
            <input placeholder="Nome Steam ou SteamID64..." value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && loadProfile()} />
            <button className="hdr-search-btn" onClick={() => loadProfile()}>Buscar</button>
          </div>

          <nav className="hdr-nav">
            {[['meu-perfil', '👤 Perfil'], ['feed', '💬 Feed'], ['ranking', '🏆 Ranking'], ['perfis', '🔍 Perfis']].map(([id, label]) => (
              <button key={id} className={`hdr-nav-btn ${page === id ? 'active' : ''}`} onClick={() => setPage(id)}>{label}</button>
            ))}
          </nav>

          {/* ── Login / User no header ── */}
          <div className="hdr-user">
            {steamUser ? (
              <div className="hdr-logged">
                <img src={steamUser.avatar} alt={steamUser.username} className="hdr-avatar" />
                <span className="hdr-username">{steamUser.username}</span>
                <button className="hdr-logout" onClick={onLogout} title="Sair">✕</button>
              </div>
            ) : (
              <a href="/api/auth/steam" className="hdr-login-btn">
                <svg width="16" height="16" viewBox="0 0 496 512" fill="currentColor">
                  <path d="M496 256c0 137-111.2 248-248.4 248-113.8 0-209.7-75.2-239.1-177.4l95.7 39.6c6.6 32.4 35.5 56.8 70.2 56.8 39.1 0 70.9-32 70.9-71s-31.8-71-70.9-71l-1.4.1-66.7-97.4v-1.7c0-97.2 78.8-176 176-176s176 78.8 176 176zm-248 106.7c39.3 0 71-31.7 71-70.7s-31.8-70.7-71-70.7-71 31.7-71 70.7 31.8 70.7 71 70.7zm-98.7-214.5c0 40.3 26.8 73 63.4 82.7l-23.5-58.3c-14.4 0-26.1-11.7-26.1-26.1s11.7-26.1 26.1-26.1 26.1 11.7 26.1 26.1c0 8.3-3.9 15.6-10 20.2l25.3 62.5c32.3-16.4 54.6-50.1 54.6-89.1 0-55.2-44.8-100-100-100s-100 44.8-100 100z"/>
                </svg>
                Entrar
              </a>
            )}
          </div>
        </div>
      </header>

      <main className="main">
        {/* ── Hero ── */}
        {page === 'meu-perfil' && !player && !loading && (
          <div className="hero">
            <div className="hero-glow" />
            <div className="hero-grid" />
            <h1>COM<span>YCS</span></h1>
            <div className="hero-tagline">Stats · Inventário · Comunidade — tudo do CS2 num só lugar</div>
            <div className="hero-search">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text3)', flexShrink: 0 }}><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
              <input placeholder="Seu nome de usuário Steam ou SteamID64..." value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && loadProfile()} autoFocus />
              <button className="hero-search-btn" onClick={() => loadProfile()}>Buscar</button>
            </div>

            {/* Botão de login Steam no hero (quando não logado) */}
            {!steamUser && (
              <div className="hero-login-area">
                <div className="hero-divider"><span>ou entre com sua conta</span></div>
                <a href="/api/auth/steam" className="hero-steam-btn">
                  <svg width="18" height="18" viewBox="0 0 496 512" fill="currentColor">
                    <path d="M496 256c0 137-111.2 248-248.4 248-113.8 0-209.7-75.2-239.1-177.4l95.7 39.6c6.6 32.4 35.5 56.8 70.2 56.8 39.1 0 70.9-32 70.9-71s-31.8-71-70.9-71l-1.4.1-66.7-97.4v-1.7c0-97.2 78.8-176 176-176s176 78.8 176 176zm-248 106.7c39.3 0 71-31.7 71-70.7s-31.8-70.7-71-70.7-71 31.7-71 70.7 31.8 70.7 71 70.7zm-98.7-214.5c0 40.3 26.8 73 63.4 82.7l-23.5-58.3c-14.4 0-26.1-11.7-26.1-26.1s11.7-26.1 26.1-26.1 26.1 11.7 26.1 26.1c0 8.3-3.9 15.6-10 20.2l25.3 62.5c32.3-16.4 54.6-50.1 54.6-89.1 0-55.2-44.8-100-100-100s-100 44.8-100 100z"/>
                  </svg>
                  Entrar com Steam — carrega seu perfil automaticamente
                </a>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 32, flexWrap: 'wrap' }}>
              {[['feed', '💬', 'Feed'], ['ranking', '🏆', 'Ranking'], ['perfis', '🔍', 'Perfis']].map(([id, icon, label]) => (
                <button key={id} onClick={() => setPage(id)} className="hero-nav-pill">{icon} {label}</button>
              ))}
            </div>
          </div>
        )}

        {loading && <Loading text="BUSCANDO PERFIL STEAM..." />}
        {err && !loading && <div className="wrap" style={{ padding: '20px' }}><Err msg={err} /></div>}

        {/* ── Meu Perfil ── */}
        {page === 'meu-perfil' && player && !loading && (
          <>
            <div className="profile-wrap">
              <div className="profile-card">
                <img src={player.avatarfull || player.avatarmedium} alt={player.personaname} className="profile-avatar" />
                <div className="profile-info">
                  <div className="profile-name">{player.personaname}</div>
                  <div className="profile-sid">SteamID64: {player.steamid}</div>
                  <div className={`profile-status ${status?.cls}`} style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                    <span className="s-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />{status?.label}
                  </div>
                  {player.gameextrainfo && <div className="profile-game">🎮 {player.gameextrainfo}</div>}
                  <a href={player.profileurl} target="_blank" rel="noopener noreferrer" className="profile-link">↗ Abrir no Steam</a>
                </div>
                <div className="profile-hours">
                  <div className="profile-hrs-num">{hours != null ? hours.toLocaleString('pt-BR') : '—'}</div>
                  <div className="profile-hrs-lbl">Horas no CS2</div>
                  {player.timecreated && <div className="profile-year">Conta desde {new Date(player.timecreated * 1000).getFullYear()}</div>}
                </div>
              </div>
            </div>
            <div className="page-tabs-wrap">
              <div className="page-tabs">
                <button className={`page-tab ${profileTab === 'stats' ? 'active' : ''}`} onClick={() => setProfileTab('stats')}>📊 Estatísticas</button>
                <button className={`page-tab ${profileTab === 'inventory' ? 'active' : ''}`} onClick={() => setProfileTab('inventory')}>🎒 Inventário</button>
              </div>
              {profileTab === 'stats' && <StatsTab steamid={steamid} />}
              {profileTab === 'inventory' && <InventoryTab steamid={steamid} />}
            </div>
          </>
        )}

        {page === 'feed' && (
          <div className="page-tabs-wrap" style={{ animationName: 'fadeIn', animationDuration: '.3s' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 800, marginBottom: 20 }}>💬 Feed da Comunidade</div>
            <FeedTab currentPlayer={player} currentSteamid={steamid} />
          </div>
        )}

        {page === 'ranking' && (
          <div className="page-tabs-wrap">
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 800, marginBottom: 20 }}>🏆 Ranking Global</div>
            <RankingTab onLoadProfile={handleLoadFromRanking} />
          </div>
        )}

        {page === 'perfis' && (
          <div className="page-tabs-wrap">
            <ProfilesTab onLoadProfile={handleLoadFromRanking} />
          </div>
        )}
      </main>

      <footer className="footer">
        <b>COMYCS</b> — CS2 Stats & Comunidade · Dados via Steam Web API · Não afiliado à Valve Corporation
      </footer>
    </>
  );
}
