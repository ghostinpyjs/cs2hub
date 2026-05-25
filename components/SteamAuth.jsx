// components/SteamAuth.jsx
// Componente reutilizável: botão de login Steam + busca por nome de usuário
import { useState, useRef, useEffect } from 'react';

export default function SteamAuth({ steamUser, onLogout, onUserFound }) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  // Fecha o dropdown ao clicar fora
  useEffect(() => {
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError('');
    setResults([]);

    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Jogador não encontrado');
        setShowDropdown(false);
      } else if (data.results?.length > 0) {
        if (data.results.length === 1) {
          // Resultado único: carrega direto
          onUserFound?.(data.results[0].steamid);
          setShowDropdown(false);
        } else {
          setResults(data.results);
          setShowDropdown(true);
        }
      }
    } catch {
      setError('Erro ao buscar jogador');
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (result) => {
    onUserFound?.(result.steamid);
    setQuery('');
    setShowDropdown(false);
    setResults([]);
  };

  const handleLoginWithSteam = () => {
    window.location.href = '/api/auth/steam';
  };

  if (steamUser) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '8px 14px',
        background: 'var(--color-background-secondary)',
        borderRadius: 'var(--border-radius-lg)',
        border: '0.5px solid var(--color-border-tertiary)',
      }}>
        {steamUser.avatar && (
          <img
            src={steamUser.avatar}
            alt={steamUser.username}
            style={{ width: 32, height: 32, borderRadius: '50%' }}
          />
        )}
        <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)' }}>
          {steamUser.username}
        </span>
        <button
          onClick={onLogout}
          style={{
            marginLeft: 'auto',
            fontSize: 12,
            color: 'var(--color-text-secondary)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '4px 8px',
            borderRadius: 'var(--border-radius-md)',
          }}
        >
          Sair
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Login com conta Steam */}
      <button
        onClick={handleLoginWithSteam}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '10px',
          padding: '10px 20px',
          background: '#1b2838',
          color: '#c7d5e0',
          border: 'none',
          borderRadius: 'var(--border-radius-md)',
          fontSize: 14,
          fontWeight: 500,
          cursor: 'pointer',
          transition: 'background 0.15s',
        }}
        onMouseEnter={e => e.currentTarget.style.background = '#2a475e'}
        onMouseLeave={e => e.currentTarget.style.background = '#1b2838'}
      >
        {/* Ícone Steam SVG */}
        <svg width="20" height="20" viewBox="0 0 496 512" fill="#c7d5e0" aria-hidden="true">
          <path d="M496 256c0 137-111.2 248-248.4 248-113.8 0-209.7-75.2-239.1-177.4l95.7 39.6c6.6 32.4 35.5 56.8 70.2 56.8 39.1 0 70.9-32 70.9-71s-31.8-71-70.9-71l-1.4.1-66.7-97.4v-1.7c0-97.2 78.8-176 176-176s176 78.8 176 176zm-248 106.7c39.3 0 71-31.7 71-70.7s-31.8-70.7-71-70.7-71 31.7-71 70.7 31.8 70.7 71 70.7zm-98.7-214.5c0 40.3 26.8 73 63.4 82.7l-23.5-58.3c-14.4 0-26.1-11.7-26.1-26.1s11.7-26.1 26.1-26.1 26.1 11.7 26.1 26.1c0 8.3-3.9 15.6-10 20.2l25.3 62.5c32.3-16.4 54.6-50.1 54.6-89.1 0-55.2-44.8-100-100-100s-100 44.8-100 100z"/>
        </svg>
        Entrar com Steam
      </button>

      {/* Divisor */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ flex: 1, height: '0.5px', background: 'var(--color-border-tertiary)' }} />
        <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>ou buscar por nome</span>
        <div style={{ flex: 1, height: '0.5px', background: 'var(--color-border-tertiary)' }} />
      </div>

      {/* Busca por nome de usuário */}
      <div ref={dropdownRef} style={{ position: 'relative' }}>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); setError(''); }}
            placeholder="Nome de usuário, URL ou SteamID64"
            style={{ flex: 1, fontSize: 14 }}
            autoComplete="off"
          />
          <button type="submit" disabled={loading || !query.trim()}>
            {loading ? '...' : 'Buscar'}
          </button>
        </form>

        {error && (
          <p style={{ fontSize: 13, color: 'var(--color-text-danger)', marginTop: 8 }}>
            {error}
          </p>
        )}

        {showDropdown && results.length > 0 && (
          <div style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: 4,
            background: 'var(--color-background-primary)',
            border: '0.5px solid var(--color-border-secondary)',
            borderRadius: 'var(--border-radius-md)',
            zIndex: 100,
            overflow: 'hidden',
          }}>
            {results.map(r => (
              <button
                key={r.steamid}
                onClick={() => handleSelect(r)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  width: '100%',
                  padding: '8px 12px',
                  background: 'none',
                  border: 'none',
                  borderBottom: '0.5px solid var(--color-border-tertiary)',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--color-background-secondary)'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
              >
                {r.avatar && (
                  <img src={r.avatar} alt={r.username} style={{ width: 28, height: 28, borderRadius: '50%' }} />
                )}
                <div>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)' }}>
                    {r.username}
                  </p>
                  <p style={{ margin: 0, fontSize: 12, color: 'var(--color-text-secondary)' }}>
                    {r.steamid}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
