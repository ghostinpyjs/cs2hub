// components/SteamAuth.jsx
import { useState, useRef, useEffect } from 'react';

export default function SteamAuth({ steamUser, onLogout, onUserFound }) {
  const [query, setQuery]               = useState('');
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState('');
  const [results, setResults]           = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef                     = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target))
        setShowDropdown(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true); setError(''); setResults([]);
    try {
      const res  = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Jogador não encontrado');
        setShowDropdown(false);
      } else if (data.results?.length === 1) {
        onUserFound?.(data.results[0].steamid);
        setQuery(''); setShowDropdown(false);
      } else if (data.results?.length > 1) {
        setResults(data.results); setShowDropdown(true);
      } else {
        setError('Nenhum resultado encontrado.');
      }
    } catch { setError('Erro ao buscar jogador'); }
    finally  { setLoading(false); }
  };

  const handleSelect = (r) => {
    onUserFound?.(r.steamid);
    setQuery(''); setShowDropdown(false); setResults([]);
  };

  /* ── Logged-in chip ──────────────────────────────────────────────────────── */
  if (steamUser) {
    return (
      <div className="auth-chip">
        {steamUser.avatar && (
          <img src={steamUser.avatar} alt={steamUser.username} className="auth-chip-av" />
        )}
        <span className="auth-chip-name">{steamUser.username}</span>
        <button className="auth-chip-logout" onClick={onLogout}>Sair</button>
      </div>
    );
  }

  /* ── Not logged in: Steam button + search ───────────────────────────────── */
  return (
    <div className="auth-bar">
      <a href="/api/auth/steam" className="auth-steam-btn">
        <svg width="16" height="16" viewBox="0 0 496 512" fill="currentColor" aria-hidden="true">
          <path d="M496 256c0 137-111.2 248-248.4 248-113.8 0-209.7-75.2-239.1-177.4l95.7 39.6c6.6 32.4 35.5 56.8 70.2 56.8 39.1 0 70.9-32 70.9-71s-31.8-71-70.9-71l-1.4.1-66.7-97.4v-1.7c0-97.2 78.8-176 176-176s176 78.8 176 176zm-248 106.7c39.3 0 71-31.7 71-70.7s-31.8-70.7-71-70.7-71 31.7-71 70.7 31.8 70.7 71 70.7zm-98.7-214.5c0 40.3 26.8 73 63.4 82.7l-23.5-58.3c-14.4 0-26.1-11.7-26.1-26.1s11.7-26.1 26.1-26.1 26.1 11.7 26.1 26.1c0 8.3-3.9 15.6-10 20.2l25.3 62.5c32.3-16.4 54.6-50.1 54.6-89.1 0-55.2-44.8-100-100-100s-100 44.8-100 100z"/>
        </svg>
        Entrar
      </a>

      <div className="auth-sep" aria-hidden="true" />

      <div ref={dropdownRef} className="auth-search-wrap">
        <form onSubmit={handleSearch} className="auth-search-form">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="auth-search-icon" aria-hidden="true">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); setError(''); }}
            placeholder="Buscar perfil..."
            autoComplete="off"
            className="auth-search-input"
          />
          <button type="submit" className="auth-search-btn" disabled={loading || !query.trim()}>
            {loading ? '…' : 'Buscar'}
          </button>
        </form>

        {error && <p className="auth-error">{error}</p>}

        {showDropdown && results.length > 0 && (
          <div className="auth-dropdown">
            {results.map(r => (
              <button key={r.steamid} className="auth-dropdown-item" onClick={() => handleSelect(r)}>
                {r.avatar && <img src={r.avatar} alt={r.username} className="auth-dropdown-av" />}
                <div className="auth-dropdown-info">
                  <span className="auth-dropdown-name">{r.username}</span>
                  <span className="auth-dropdown-sid">{r.steamid}</span>
                </div>
                <span className="auth-dropdown-arrow">→</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
