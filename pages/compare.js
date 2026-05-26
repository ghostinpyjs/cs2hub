import Head from 'next/head';
import { useState } from 'react';

function getStat(s, name) { return Number(s?.find(x => x.name === name)?.value || 0); }
function parseStats(raw) {
  const s = raw?.playerstats?.stats || [];
  const kills = getStat(s,'total_kills'), deaths = getStat(s,'total_deaths'),
    wins = getStat(s,'total_wins'), rounds = getStat(s,'total_rounds_played'),
    hs = getStat(s,'total_kills_headshot'), shots = getStat(s,'total_shots_fired'),
    hits = getStat(s,'total_shots_hit'), mvps = getStat(s,'total_mvps'),
    damage = getStat(s,'total_damage_done'),
    matches = getStat(s,'total_matches_played') || Math.round(rounds/25) || 0;
  return { kills, deaths, wins, rounds, hs, mvps, damage, matches,
    kdr: deaths>0?(kills/deaths).toFixed(2):kills>0?'∞':'0.00',
    hsP: kills>0?((hs/kills)*100).toFixed(1):'0.0',
    acc: shots>0?((hits/shots)*100).toFixed(1):'0.0',
    wr: matches>0?((wins/matches)*100).toFixed(1):'0.0' };
}
function fmt(n) { if(!n||isNaN(n)) return '0'; if(n>=1e6) return (n/1e6).toFixed(1)+'M'; if(n>=1000) return (n/1000).toFixed(1)+'K'; return Number(n).toLocaleString('pt-BR'); }

function Bar({ v1, v2, label }) {
  const total = (Number(v1)||0) + (Number(v2)||0);
  const pct1 = total > 0 ? ((Number(v1)||0)/total)*100 : 50;
  return (
    <div style={{ marginBottom:14 }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4, fontSize:13 }}>
        <span style={{ fontWeight:700, color:'var(--accent)' }}>{v1}</span>
        <span style={{ fontSize:11, color:'var(--text3)', textTransform:'uppercase', letterSpacing:1, fontFamily:'var(--font-mono)' }}>{label}</span>
        <span style={{ fontWeight:700, color:'var(--blue)' }}>{v2}</span>
      </div>
      <div style={{ height:6, background:'var(--border)', borderRadius:3, overflow:'hidden', display:'flex' }}>
        <div style={{ width:`${pct1}%`, background:'var(--accent)', borderRadius:3, transition:'width .8s ease' }}/>
        <div style={{ flex:1, background:'var(--blue)', borderRadius:3 }}/>
      </div>
    </div>
  );
}

export default function ComparePage({ steamUser }) {
  const [q1,setQ1]=useState(''); const [q2,setQ2]=useState('');
  const [data,setData]=useState(null); const [loading,setLoading]=useState(false); const [err,setErr]=useState('');

  const resolveSteamid = async (q) => {
    if (/^\d{17}$/.test(q)) return q;
    const r = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
    const d = await r.json();
    if (!r.ok || !d.results?.length) throw new Error(`"${q}" não encontrado`);
    return d.results[0].steamid;
  };

  const compare = async () => {
    if (!q1.trim() || !q2.trim()) return;
    setLoading(true); setErr(''); setData(null);
    try {
      const [sid1, sid2] = await Promise.all([resolveSteamid(q1.trim()), resolveSteamid(q2.trim())]);
      const r = await fetch(`/api/compare?steamid1=${sid1}&steamid2=${sid2}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setData(d);
    } catch(e) { setErr(e.message || 'Erro ao comparar'); }
    setLoading(false);
  };

  const s1 = data?.stats1 ? parseStats(data.stats1) : null;
  const s2 = data?.stats2 ? parseStats(data.stats2) : null;
  const p1 = data?.player1; const p2 = data?.player2;

  return (
    <>
      <Head><title>Comparar Jogadores — COMYCS</title></Head>
      <div style={{ paddingTop:80, minHeight:'100vh' }}>
        {/* Header simples */}
        <header className="header">
          <div className="header-inner">
            <a href="/" className="logo">
              <div className="logo-mark"><svg viewBox="0 0 18 18" fill="none"><path d="M2 14L6 4L9 11L12 7L16 14" stroke="#000" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/><circle cx="9" cy="11" r="2" fill="#000"/></svg></div>
              <span className="logo-name">COM<span>YCS</span></span>
            </a>
            <a href="/" style={{ marginLeft:'auto', fontSize:13, color:'var(--text2)', textDecoration:'none' }}>← Voltar</a>
          </div>
        </header>

        <div className="wrap" style={{ padding:'40px 20px' }}>
          <div style={{ fontFamily:'var(--font-display)', fontSize:28, fontWeight:800, marginBottom:6 }}>⚔️ Comparar Jogadores</div>
          <div style={{ fontSize:14, color:'var(--text2)', marginBottom:32 }}>Coloque dois jogadores frente a frente e veja quem é melhor.</div>

          {/* Inputs */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr auto 1fr', gap:12, alignItems:'center', maxWidth:700, marginBottom:32 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, background:'var(--bg3)', border:'1px solid var(--border2)', borderRadius:'var(--radius-sm)', padding:'10px 14px' }}>
              <input value={q1} onChange={e=>setQ1(e.target.value)} onKeyDown={e=>e.key==='Enter'&&compare()} placeholder="Jogador 1 (nome ou SteamID64)" style={{ flex:1, background:'none', border:'none', outline:'none', color:'var(--accent)', fontFamily:'var(--font)', fontSize:14, fontWeight:600 }}/>
            </div>
            <div style={{ fontFamily:'var(--font-display)', fontWeight:800, color:'var(--text3)', fontSize:18, textAlign:'center' }}>VS</div>
            <div style={{ display:'flex', alignItems:'center', gap:8, background:'var(--bg3)', border:'1px solid var(--border2)', borderRadius:'var(--radius-sm)', padding:'10px 14px' }}>
              <input value={q2} onChange={e=>setQ2(e.target.value)} onKeyDown={e=>e.key==='Enter'&&compare()} placeholder="Jogador 2 (nome ou SteamID64)" style={{ flex:1, background:'none', border:'none', outline:'none', color:'var(--blue)', fontFamily:'var(--font)', fontSize:14, fontWeight:600 }}/>
            </div>
          </div>
          <button onClick={compare} disabled={loading||!q1.trim()||!q2.trim()} style={{ background:'var(--accent)', color:'#000', border:'none', borderRadius:'var(--radius-sm)', padding:'11px 32px', fontFamily:'var(--font)', fontSize:15, fontWeight:700, cursor:'pointer', transition:'all .2s', opacity:loading||!q1.trim()||!q2.trim()?.6:1 }}>
            {loading ? 'Comparando...' : 'Comparar'}
          </button>

          {err && <div className="err" style={{ marginTop:16 }}><span>⚠</span> {err}</div>}

          {data && p1 && p2 && (
            <div style={{ marginTop:40 }}>
              {/* Player headers */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 120px 1fr', gap:12, alignItems:'center', marginBottom:32 }}>
                <div style={{ display:'flex', alignItems:'center', gap:12, background:'var(--bg3)', border:'2px solid var(--accent)', borderRadius:'var(--radius)', padding:'16px 20px' }}>
                  <img src={p1.avatarfull||p1.avatarmedium} alt="" style={{ width:52, height:52, borderRadius:'var(--radius-sm)', border:'2px solid var(--accent)' }}/>
                  <div>
                    <div style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:16, color:'var(--text)' }}>{p1.personaname}</div>
                    <div style={{ fontSize:11, color:'var(--text3)', fontFamily:'var(--font-mono)', marginTop:2 }}>{data.hours1}h no CS2</div>
                    <a href={p1.profileurl} target="_blank" rel="noopener noreferrer" style={{ fontSize:11, color:'var(--accent)', textDecoration:'none' }}>↗ Steam</a>
                  </div>
                </div>
                <div style={{ textAlign:'center', fontFamily:'var(--font-display)', fontSize:22, fontWeight:900, color:'var(--text3)' }}>VS</div>
                <div style={{ display:'flex', alignItems:'center', gap:12, background:'var(--bg3)', border:'2px solid var(--blue)', borderRadius:'var(--radius)', padding:'16px 20px', flexDirection:'row-reverse' }}>
                  <img src={p2.avatarfull||p2.avatarmedium} alt="" style={{ width:52, height:52, borderRadius:'var(--radius-sm)', border:'2px solid var(--blue)' }}/>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:16, color:'var(--text)' }}>{p2.personaname}</div>
                    <div style={{ fontSize:11, color:'var(--text3)', fontFamily:'var(--font-mono)', marginTop:2 }}>{data.hours2}h no CS2</div>
                    <a href={p2.profileurl} target="_blank" rel="noopener noreferrer" style={{ fontSize:11, color:'var(--blue)', textDecoration:'none' }}>↗ Steam</a>
                  </div>
                </div>
              </div>

              {/* Comparison bars */}
              {s1 && s2 ? (
                <div style={{ background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'28px 32px' }}>
                  <div style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:16, marginBottom:24, color:'var(--text)' }}>📊 Estatísticas</div>
                  <Bar v1={s1.kills} v2={s2.kills} label="Kills" />
                  <Bar v1={s1.kdr} v2={s2.kdr} label="K/D Ratio" />
                  <Bar v1={s1.hsP+'%'} v2={s2.hsP+'%'} label="Headshot %" />
                  <Bar v1={s1.acc+'%'} v2={s2.acc+'%'} label="Precisão" />
                  <Bar v1={s1.wins} v2={s2.wins} label="Vitórias" />
                  <Bar v1={s1.wr+'%'} v2={s2.wr+'%'} label="Win Rate" />
                  <Bar v1={s1.mvps} v2={s2.mvps} label="MVPs" />
                  <Bar v1={fmt(s1.damage)} v2={fmt(s2.damage)} label="Dano Total" />
                  <Bar v1={data.hours1+'h'} v2={data.hours2+'h'} label="Horas" />
                </div>
              ) : (
                <div className="err"><span>⚠</span> Um dos perfis está privado — as stats não podem ser comparadas.</div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
