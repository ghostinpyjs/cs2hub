import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';

// ── Utility helpers ────────────────────────────────────────────────────────────
function fmt(n) {
  if (n == null || isNaN(n)) return '0';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return Number(n).toLocaleString('pt-BR');
}

function getStat(stats, name) {
  const s = stats?.find(s => s.name === name);
  return s ? Number(s.value) : 0;
}

function parseStats(rawStats) {
  const stats = rawStats?.playerstats?.stats || [];
  const kills = getStat(stats, 'total_kills');
  const deaths = getStat(stats, 'total_deaths');
  const wins = getStat(stats, 'total_wins');
  const rounds = getStat(stats, 'total_rounds_played');
  const hs = getStat(stats, 'total_kills_headshot');
  const shots = getStat(stats, 'total_shots_fired');
  const hits = getStat(stats, 'total_shots_hit');
  const mvps = getStat(stats, 'total_mvps');
  const damage = getStat(stats, 'total_damage_done');
  const bombsPlanted = getStat(stats, 'total_planted_bombs');
  const bombsDefused = getStat(stats, 'total_defused_bombs');
  const knifeKills = getStat(stats, 'total_kills_knife');
  const pistolKills = getStat(stats, 'total_kills_deagle') + getStat(stats, 'total_kills_glock') + getStat(stats, 'total_kills_p250') + getStat(stats, 'total_kills_elite');
  const awpKills = getStat(stats, 'total_kills_awp');
  const matchesWon = wins;
  const matchesPlayed = getStat(stats, 'total_matches_played') || Math.round(rounds / 25) || 0;

  return {
    kills, deaths, wins, rounds,
    headshots: hs,
    shots, hits,
    mvps, damage,
    bombsPlanted, bombsDefused,
    knifeKills, pistolKills, awpKills,
    kdr: deaths > 0 ? (kills / deaths).toFixed(2) : kills > 0 ? '∞' : '0.00',
    hsPercent: kills > 0 ? ((hs / kills) * 100).toFixed(1) : '0.0',
    accuracy: shots > 0 ? ((hits / shots) * 100).toFixed(1) : '0.0',
    winRate: matchesPlayed > 0 ? ((wins / matchesPlayed) * 100).toFixed(1) : '0.0',
    matchesPlayed,
  };
}

function getPlayerStatus(state) {
  if (state === 1) return { label: 'Online', cls: 'status-online' };
  if (state === 2) return { label: 'Busy', cls: 'status-online' };
  if (state === 3) return { label: 'Away', cls: 'status-offline' };
  if (state === 6) return { label: 'In-Game', cls: 'status-ingame' };
  return { label: 'Offline', cls: 'status-offline' };
}

function getRarityColor(rarity) {
  const map = {
    'Contraband': '#e4ae39',
    'Covert': '#eb4b4b',
    'Classified': '#d32ce6',
    'Restricted': '#8847ff',
    'Mil-Spec Grade': '#4b69ff',
    'Industrial Grade': '#5e98d9',
    'Consumer Grade': '#b0c3d9',
    'Base Grade': '#b0c3d9',
  };
  return map[rarity] || '#b0c3d9';
}

// ── Components ─────────────────────────────────────────────────────────────────

function LoadingSpinner({ text }) {
  return (
    <div className="loading-overlay">
      <div className="loading-spinner" />
      <div className="loading-text">{text || 'CARREGANDO...'}</div>
    </div>
  );
}

function ErrorBox({ msg }) {
  return (
    <div className="error-box">
      <span className="error-icon">⚠</span>
      <p>{msg}</p>
    </div>
  );
}

function StatCard({ icon, value, label, cls, extra }) {
  return (
    <div className={`stat-card ${cls || ''}`}>
      <span className="stat-icon">{icon}</span>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
      {extra}
    </div>
  );
}

function ItemModal({ item, onClose }) {
  if (!item) return null;
  const rarityColor = item.rarity_color ? `#${item.rarity_color}` : getRarityColor(item.rarity);

  const mktName = encodeURIComponent(item.market_hash_name || item.market_name || item.name);
  const marketUrl = `https://steamcommunity.com/market/listings/730/${mktName}`;

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header" style={{ background: rarityColor }} />
        <div className="modal-body" style={{ position: 'relative' }}>
          <button className="modal-close" onClick={onClose}>✕</button>

          <div className="modal-image-area">
            {item.icon_url ? (
              <img src={item.icon_url} alt={item.name} className="modal-image" />
            ) : (
              <div style={{ fontSize: 60, color: 'var(--text-muted)' }}>🔫</div>
            )}
          </div>

          <div className="modal-name">{item.name}</div>
          <div className="modal-type">{item.type}</div>

          <div>
            {item.rarity && (
              <div className="modal-row">
                <span className="modal-row-label">Raridade</span>
                <span className="modal-row-value" style={{ color: rarityColor }}>{item.rarity}</span>
              </div>
            )}
            {item.exterior && (
              <div className="modal-row">
                <span className="modal-row-label">Exterior</span>
                <span className="modal-row-value">{item.exterior}</span>
              </div>
            )}
            {item.weapon_type && (
              <div className="modal-row">
                <span className="modal-row-label">Arma</span>
                <span className="modal-row-value">{item.weapon_type}</span>
              </div>
            )}
            <div className="modal-row">
              <span className="modal-row-label">Comercializável</span>
              <span className="modal-row-value" style={{ color: item.tradable ? 'var(--green)' : 'var(--red)' }}>
                {item.tradable ? '✓ Sim' : '✗ Não'}
              </span>
            </div>
            <div className="modal-row">
              <span className="modal-row-label">No Mercado</span>
              <span className="modal-row-value" style={{ color: item.marketable ? 'var(--green)' : 'var(--red)' }}>
                {item.marketable ? '✓ Sim' : '✗ Não'}
              </span>
            </div>
          </div>

          {item.marketable && (
            <a href={marketUrl} target="_blank" rel="noopener noreferrer" className="modal-market-btn">
              🏷 Ver no Mercado Steam
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function InventoryTab({ steamid }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('Todos');
  const [selectedItem, setSelectedItem] = useState(null);

  useEffect(() => {
    if (!steamid) return;
    setLoading(true);
    setError('');
    fetch(`/api/inventory?steamid=${steamid}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error);
        else setData(d);
        setLoading(false);
      })
      .catch(() => {
        setError('Erro ao carregar inventário');
        setLoading(false);
      });
  }, [steamid]);

  if (loading) return <LoadingSpinner text="CARREGANDO INVENTÁRIO..." />;
  if (error) return (
    <div>
      <div className="error-box"><span className="error-icon">🔒</span><p>{error}</p></div>
      <div className="private-notice">
        <div className="icon">🔒</div>
        <h3>Inventário Privado</h3>
        <p>Para ver o inventário, acesse as configurações de privacidade do Steam e torne seu inventário público.</p>
      </div>
    </div>
  );
  if (!data) return null;

  const items = data.items || [];

  // Build filter categories
  const categories = ['Todos'];
  const typeMap = {};
  items.forEach(item => {
    const cat = item.weapon_type || (item.type?.split(' ')[0]) || 'Outro';
    if (!typeMap[cat]) { typeMap[cat] = 0; categories.push(cat); }
    typeMap[cat]++;
  });

  const filtered = filter === 'Todos' ? items : items.filter(item => {
    const cat = item.weapon_type || (item.type?.split(' ')[0]) || 'Outro';
    return cat === filter;
  });

  return (
    <div>
      <div className="inventory-header">
        <div className="inventory-count">
          Total: <span>{items.length}</span> itens
          {filter !== 'Todos' && <> · Filtro: <span>{filtered.length}</span></>}
        </div>
        <div className="filter-bar">
          {categories.slice(0, 8).map(cat => (
            <button
              key={cat}
              className={`filter-btn ${filter === cat ? 'active' : ''}`}
              onClick={() => setFilter(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="private-notice">
          <div className="icon">📦</div>
          <h3>Inventário Vazio</h3>
          <p>Nenhum item encontrado nessa categoria.</p>
        </div>
      ) : (
        <div className="inventory-grid">
          {filtered.map((item, i) => {
            const rarityColor = item.rarity_color ? `#${item.rarity_color}` : getRarityColor(item.rarity);
            return (
              <div
                key={`${item.assetid}-${i}`}
                className="item-card"
                style={{ animationDelay: `${Math.min(i * 0.03, 0.5)}s`, borderColor: `${rarityColor}33` }}
                onClick={() => setSelectedItem(item)}
              >
                <div className="item-rarity-bar" style={{ background: rarityColor }} />
                <div className="item-image-wrapper">
                  {item.icon_url ? (
                    <img src={item.icon_url} alt={item.name} className="item-image" loading="lazy" />
                  ) : (
                    <div className="item-no-img">🔫</div>
                  )}
                </div>
                <div className="item-info">
                  <div className="item-name" title={item.name}>{item.name}</div>
                  {item.exterior && <div className="item-exterior">{item.exterior}</div>}
                  {item.rarity && (
                    <div className="item-rarity-tag" style={{ color: rarityColor }}>{item.rarity}</div>
                  )}
                  <div className="item-badges">
                    {item.tradable && <span className="badge badge-tradable">trade</span>}
                    {item.marketable && <span className="badge badge-market">market</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedItem && (
        <ItemModal item={selectedItem} onClose={() => setSelectedItem(null)} />
      )}
    </div>
  );
}

function StatsTab({ steamid }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!steamid) return;
    setLoading(true);
    setError('');
    fetch(`/api/stats?steamid=${steamid}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error);
        else setData(d);
        setLoading(false);
      })
      .catch(() => {
        setError('Erro ao carregar estatísticas');
        setLoading(false);
      });
  }, [steamid]);

  if (loading) return <LoadingSpinner text="CARREGANDO ESTATÍSTICAS..." />;
  if (error) return (
    <div>
      <ErrorBox msg={error} />
      <div className="private-notice" style={{ marginTop: 20 }}>
        <div className="icon">📊</div>
        <h3>Stats Indisponíveis</h3>
        <p>Esse perfil pode estar privado ou ainda não ter jogado CS2. Verifique as configurações de privacidade do Steam.</p>
      </div>
    </div>
  );
  if (!data?.stats) return (
    <div className="private-notice">
      <div className="icon">📊</div>
      <h3>Stats Não Encontradas</h3>
      <p>Perfil privado ou nenhuma partida registrada no CS2.</p>
    </div>
  );

  const s = parseStats(data.stats);
  const winRateNum = parseFloat(s.winRate);
  const hsNum = parseFloat(s.hsPercent);

  return (
    <div className="stats-grid">
      <StatCard icon="💀" value={fmt(s.kills)} label="Kills" cls="kills" />
      <StatCard icon="☠️" value={fmt(s.deaths)} label="Deaths" cls="deaths" />
      <StatCard
        icon="⚔️"
        value={s.kdr}
        label="K/D Ratio"
        cls={`kdr kd-highlight`}
        extra={
          <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)', fontFamily: 'Share Tech Mono, monospace' }}>
            {Number(s.kdr) >= 1.5 ? '🔥 Excelente' : Number(s.kdr) >= 1 ? '✓ Positivo' : '↓ Abaixo da média'}
          </div>
        }
      />
      <StatCard
        icon="🎯"
        value={s.hsPercent + '%'}
        label="Headshot %"
        cls="headshots"
        extra={
          <div className="winrate-bar-wrapper">
            <div className="winrate-bar-bg">
              <div className="winrate-bar-fill" style={{ width: `${Math.min(hsNum, 100)}%`, background: 'var(--purple)' }} />
            </div>
          </div>
        }
      />
      <StatCard icon="🏆" value={fmt(s.wins)} label="Vitórias" cls="wins" />
      <StatCard
        icon="📈"
        value={s.winRate + '%'}
        label="Win Rate"
        cls="matches"
        extra={
          <div className="winrate-bar-wrapper">
            <div className="winrate-bar-bg">
              <div className="winrate-bar-fill" style={{ width: `${Math.min(winRateNum, 100)}%` }} />
            </div>
          </div>
        }
      />
      <StatCard icon="🎮" value={fmt(s.matchesPlayed)} label="Partidas" cls="matches" />
      <StatCard icon="🌀" value={fmt(s.rounds)} label="Rounds" cls="matches" />
      <StatCard icon="⭐" value={fmt(s.mvps)} label="MVPs" cls="mvps" />
      <StatCard
        icon="🔫"
        value={s.accuracy + '%'}
        label="Precisão"
        cls="accuracy"
        extra={
          <div className="winrate-bar-wrapper">
            <div className="winrate-bar-bg">
              <div className="winrate-bar-fill" style={{ width: `${Math.min(parseFloat(s.accuracy), 100)}%`, background: 'var(--accent)' }} />
            </div>
          </div>
        }
      />
      <StatCard icon="💥" value={fmt(s.damage)} label="Dano Total" cls="damage" />
      <StatCard icon="🔪" value={fmt(s.knifeKills)} label="Kills de Faca" cls="kills" />
      <StatCard icon="🎯" value={fmt(s.awpKills)} label="Kills AWP" cls="kills" />
      <StatCard icon="💣" value={fmt(s.bombsPlanted)} label="Bombas Plantadas" cls="bombs_planted" />
      <StatCard icon="🛡️" value={fmt(s.bombsDefused)} label="Bombas Desarmadas" cls="bombs_defused" />
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function Home() {
  const [input, setInput] = useState('');
  const [steamid, setSteamid] = useState('');
  const [player, setPlayer] = useState(null);
  const [hours, setHours] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('stats');

  const search = useCallback(async (val) => {
    const query = (val || input).trim();
    if (!query) return;
    setLoading(true);
    setError('');
    setPlayer(null);
    setSteamid('');
    setHours(null);

    try {
      // 1. Resolve to steamid
      const resolveRes = await fetch(`/api/resolve?vanity=${encodeURIComponent(query)}`);
      const resolveData = await resolveRes.json();

      if (resolveData.error || !resolveData.steamid) {
        setError(resolveData.error || 'Perfil não encontrado. Verifique o nome de usuário ou SteamID.');
        setLoading(false);
        return;
      }

      const sid = resolveData.steamid;
      setSteamid(sid);

      // 2. Get player summary and playtime in parallel
      const [playerRes, playtimeRes] = await Promise.allSettled([
        fetch(`/api/player?steamid=${sid}`).then(r => r.json()),
        fetch(`/api/playtime?steamid=${sid}`).then(r => r.json()),
      ]);

      if (playerRes.status === 'fulfilled') {
        const p = playerRes.value?.response?.players?.[0];
        if (p) setPlayer(p);
        else setError('Jogador não encontrado.');
      }

      if (playtimeRes.status === 'fulfilled') {
        const game = playtimeRes.value?.response?.games?.[0];
        if (game) setHours(Math.round(game.playtime_forever / 60));
      }
    } catch (err) {
      setError('Erro na conexão. Tente novamente.');
    }

    setLoading(false);
  }, [input]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') search();
  };

  const status = player ? getPlayerStatus(player.personastate) : null;

  return (
    <>
      <Head>
        <title>COMYCS — CS2 Stats & Inventário</title>
      </Head>

      {/* Header */}
      <header className="header">
        <div className="header-inner">
          <a href="/" className="logo">
            <svg className="logo-icon" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="36" height="36" rx="4" fill="#f0a000" fillOpacity="0.1" />
              <path d="M8 26L14 10L18 20L22 14L28 26" stroke="#f0a000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="18" cy="20" r="3" fill="#f0a000"/>
            </svg>
            <div>
              <div className="logo-text">COMYCS</div>
              <div className="logo-sub">CS2 TRACKER</div>
            </div>
          </a>

          <div className="search-bar header-search">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              placeholder="Nome Steam ou SteamID64..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <button className="search-btn" onClick={() => search()}>BUSCAR</button>
          </div>
        </div>
      </header>

      <main className="main">
        {/* Hero (shown when no player loaded) */}
        {!player && !loading && (
          <div className="hero">
            <div className="hero-bg" />
            <div className="hero-grid" />
            <h1>COMYCS</h1>
            <div className="hero-sub">CS2 Stats · Inventário · Tracker</div>
            <div className="hero-desc">
              Digite seu nome de usuário do Steam ou SteamID64 para ver suas estatísticas, nível, kills, horas e inventário do CS2.
            </div>

            <div className="hero-search">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <input
                placeholder="Nome de usuário ou SteamID64..."
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                autoFocus
              />
              <button className="hero-search-btn" onClick={() => search()}>
                BUSCAR
              </button>
            </div>
          </div>
        )}

        {/* Loading state */}
        {loading && <LoadingSpinner text="BUSCANDO PERFIL STEAM..." />}

        {/* Error */}
        {error && !loading && (
          <div className="container">
            <ErrorBox msg={error} />
          </div>
        )}

        {/* Player loaded */}
        {player && !loading && (
          <>
            {/* Profile card */}
            <div className="profile-section">
              <div className="profile-card">
                <img
                  src={player.avatarfull || player.avatarmedium}
                  alt={player.personaname}
                  className="profile-avatar"
                />
                <div className="profile-info">
                  <div className="profile-name">{player.personaname}</div>
                  <div className="profile-steamid">SteamID: {player.steamid}</div>
                  <div className={`profile-status ${status?.cls}`}>
                    <span className="status-dot" />
                    {status?.label}
                  </div>
                  {player.gameextrainfo && (
                    <div style={{ fontSize: 13, color: 'var(--blue)', marginTop: 6, fontFamily: 'Share Tech Mono, monospace' }}>
                      🎮 {player.gameextrainfo}
                    </div>
                  )}
                  <a
                    href={player.profileurl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="profile-steam-link"
                  >
                    ↗ Ver no Steam
                  </a>
                </div>

                <div className="profile-hours">
                  <div className="profile-hours-num">{hours != null ? hours.toLocaleString('pt-BR') : '—'}</div>
                  <div className="profile-hours-label">Horas no CS2</div>
                  {player.timecreated && (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8, fontFamily: 'Share Tech Mono, monospace' }}>
                      Conta desde {new Date(player.timecreated * 1000).getFullYear()}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="tabs-section">
              <div className="tabs">
                <button
                  className={`tab-btn ${tab === 'stats' ? 'active' : ''}`}
                  onClick={() => setTab('stats')}
                >
                  📊 Estatísticas
                </button>
                <button
                  className={`tab-btn ${tab === 'inventory' ? 'active' : ''}`}
                  onClick={() => setTab('inventory')}
                >
                  🎒 Inventário
                </button>
              </div>

              {tab === 'stats' && <StatsTab steamid={steamid} />}
              {tab === 'inventory' && <InventoryTab steamid={steamid} />}
            </div>
          </>
        )}
      </main>

      <footer className="footer">
        <span>COMYCS</span> — CS2 Stats Tracker · Dados via Steam Web API · Não afiliado à Valve
      </footer>
    </>
  );
}
