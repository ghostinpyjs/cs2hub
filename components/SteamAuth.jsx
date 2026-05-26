// components/SteamAuth.jsx
import { useState, useRef, useEffect } from 'react';

export default function SteamAuth({ steamUser, onLogout, onUserFound }) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target))
        setShowDropdown(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleSearch = async (e) => {
    e?.preventDefault();
    if (!query.trim()) return;
    setLoading(true); setError(''); setResults([]);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Jogador não encontrado');
        setShowDropdown(false);
      } else if (data.results?.length > 0) {
        if (data.results.length === 1) {
          onUserFound?.(data.results[0].steamid);
          setQuery(''); setShowDropdown(false);
        } else {
          setResults(data.results); setShowDropdown(true);
        }
      } else {
        setError('Nenhum jogador encontrado com esse nome.');
      }
    } catch { setError('Erro ao buscar jogador'); }
    setLoading(false);
  };

  const handleSelect = (result) => {
    onUserFound?.(result.steamid);
    setQuery(''); setShowDropdown(false); setResults([]);
  };

  if (steamUser) {
    return (
      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'6px 12px', background:'var(--bg3)', borderRadius:'var(--radius-sm)', border:'1px solid var(--border2)' }}>
        {steamUser.avatar && <img src={steamUser.avatar} alt={steamUser.username} style={{ width:30, height:30, borderRadius:6, objectFit:'cover' }} />}
        <span style={{ fontSize:14, fontWeight:600, color:'var(--text)' }}>{steamUser.username}</span>
        <span style={{ fontSize:11, background:'rgba(61,214,140,.1)', color:'var(--green)', border:'1px solid rgba(61,214,140,.2)', borderRadius:20, padding:'1px 8px', marginLeft:2 }}>✓ Logado</span>
        <button onClick={onLogout} style={{ marginLeft:'auto', fontSize:12, color:'var(--text3)', background:'none', border:'none', cursor:'pointer', padding:'4px 8px', borderRadius:'var(--radius-sm)', transition:'color .2s' }}
          onMouseEnter={e=>e.currentTarget.style.color='var(--red)'}
          onMouseLeave={e=>e.currentTarget.style.color='var(--text3)'}>
          Sair
        </button>
      </div>
    );
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      {/* Botão login Steam */}
      <a href="/api/auth/login" className="steam-login-btn">
        <svg viewBox="0 0 496 512" fill="currentColor" width={20} height={20} style={{flexShrink:0}}>
          <path d="M496 256c0 137-111.2 248-248.4 248-113.8 0-209.7-75.2-239.1-177.4l95.7 39.6c6.6 32.4 35.5 56.8 70.2 56.8 39.1 0 70.9-32 70.9-71s-31.8-71-70.9-71l-1.4.1-66.7-97.4v-1.7c0-97.2 78.8-176 176-176s176 78.8 176 176zm-248 106.7c39.3 0 71-31.7 71-70.7s-31.8-70.7-71-70.7-71 31.7-71 70.7 31.8 70.7 71 70.7zm-98.7-214.5c0 40.3 26.8 73 63.4 82.7l-23.5-58.3c-14.4 0-26.1-11.7-26.1-26.1s11.7-26.1 26.1-26.1 26.1 11.7 26.1 26.1c0 8.3-3.9 15.6-10 20.2l25.3 62.5c32.3-16.4 54.6-50.1 54.6-89.1 0-55.2-44.8-100-100-100s-100 44.8-100 100z"/>
        </svg>
        Entrar com a conta Steam
      </a>

      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
        <div style={{ flex:1, height:1, background:'var(--border)' }} />
        <span style={{ fontSize:12, color:'var(--text3)', whiteSpace:'nowrap' }}>ou buscar por nome</span>
        <div style={{ flex:1, height:1, background:'var(--border)' }} />
      </div>

      {/* Busca por nome */}
      <div ref={dropdownRef} style={{ position:'relative' }}>
        <div style={{ display:'flex', gap:8 }}>
          <div style={{ flex:1, display:'flex', alignItems:'center', gap:8, background:'var(--bg4)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:'8px 12px', transition:'border-color .2s' }}
            onFocus={e=>e.currentTarget.style.borderColor='var(--accent2)'}
            onBlur={e=>e.currentTarget.style.borderColor='var(--border)'}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{color:'var(--text3)',flexShrink:0}}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input
              value={query}
              onChange={e => { setQuery(e.target.value); setError(''); }}
              onKeyDown={e => e.key === 'Enter' && handleSearch(e)}
              placeholder="Nome, URL personalizada ou SteamID64"
              style={{ flex:1, background:'none', border:'none', outline:'none', color:'var(--text)', fontFamily:'var(--font)', fontSize:14 }}
              autoComplete="off"
            />
          </div>
          <button onClick={handleSearch} disabled={loading || !query.trim()} style={{ background:'var(--accent)', color:'#000', border:'none', borderRadius:'var(--radius-sm)', padding:'8px 16px', fontFamily:'var(--font)', fontSize:13, fontWeight:600, cursor:'pointer', transition:'background .2s', whiteSpace:'nowrap', opacity: loading || !query.trim() ? .6 : 1 }}>
            {loading ? '...' : 'Buscar'}
          </button>
        </div>

        {error && <p style={{ fontSize:13, color:'var(--red)', marginTop:8 }}>{error}</p>}

        {showDropdown && results.length > 0 && (
          <div style={{ position:'absolute', top:'calc(100% + 6px)', left:0, right:0, background:'var(--bg3)', border:'1px solid var(--border2)', borderRadius:'var(--radius-sm)', zIndex:100, overflow:'hidden', boxShadow:'0 10px 40px rgba(0,0,0,.5)' }}>
            {results.map(r => (
              <button key={r.steamid} onClick={() => handleSelect(r)} style={{ display:'flex', alignItems:'center', gap:10, width:'100%', padding:'10px 14px', background:'none', border:'none', borderBottom:'1px solid var(--border)', cursor:'pointer', textAlign:'left', transition:'background .15s' }}
                onMouseEnter={e=>e.currentTarget.style.background='var(--bg4)'}
                onMouseLeave={e=>e.currentTarget.style.background='none'}>
                {r.avatar && <img src={r.avatar} alt={r.username} style={{ width:32, height:32, borderRadius:6 }} />}
                <div>
                  <p style={{ margin:0, fontSize:14, fontWeight:600, color:'var(--text)' }}>{r.username}</p>
                  <p style={{ margin:0, fontSize:11, color:'var(--text3)', fontFamily:'var(--font-mono)' }}>{r.steamid}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
