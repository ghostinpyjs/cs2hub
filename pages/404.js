import Head from 'next/head';
import { useRouter } from 'next/router';

export default function NotFound() {
  const router = useRouter();
  return (
    <>
      <Head><title>404 — COMYCS</title></Head>
      <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:16, padding:20 }}>
        <div style={{ fontFamily:'var(--font-display)', fontSize:80, fontWeight:800, color:'var(--accent)', lineHeight:1 }}>404</div>
        <div style={{ fontFamily:'var(--font-display)', fontSize:22, fontWeight:700, color:'var(--text)' }}>Página não encontrada</div>
        <p style={{ fontSize:14, color:'var(--text3)', textAlign:'center', maxWidth:360 }}>Essa página não existe ou foi removida.</p>
        <button onClick={() => router.push('/')} style={{ marginTop:8, background:'var(--accent)', color:'#000', border:'none', borderRadius:'var(--radius-sm)', padding:'10px 24px', fontFamily:'var(--font)', fontSize:14, fontWeight:700, cursor:'pointer' }}>
          Voltar ao início
        </button>
      </div>
    </>
  );
}
