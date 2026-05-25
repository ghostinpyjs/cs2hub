// pages/_app.jsx
import '../styles/globals.css';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { Analytics } from '@vercel/analytics/next';

export default function App({ Component, pageProps }) {
  const router = useRouter();
  const [steamUser, setSteamUser] = useState(null);

  // 1. Captura ?steamid=...&login=success após o callback OpenID
  useEffect(() => {
    const { steamid, login, error } = router.query;

    if (login === 'success' && steamid) {
      sessionStorage.setItem('steamid', steamid);

      fetch(`/api/player?steamid=${steamid}`)
        .then(r => r.json())
        .then(data => {
          const p = data?.response?.players?.[0];
          if (p) {
            const user = {
              steamid:    p.steamid,
              username:   p.personaname,
              avatar:     p.avatarmedium || p.avatar,
              profileUrl: p.profileurl,
            };
            setSteamUser(user);
            sessionStorage.setItem('steamUser', JSON.stringify(user));
          }
        })
        .catch(console.error);

      router.replace('/', undefined, { shallow: true });
    }

    if (error) {
      router.replace(`/login?error=${error}`, undefined, { shallow: true });
    }
  }, [router.query]);

  // 2. Restaura sessão ao recarregar a página
  useEffect(() => {
    const saved = sessionStorage.getItem('steamUser');
    if (saved) {
      try { setSteamUser(JSON.parse(saved)); }
      catch { sessionStorage.removeItem('steamUser'); }
    }
  }, []);

  const handleLogout = () => {
    setSteamUser(null);
    sessionStorage.removeItem('steamid');
    sessionStorage.removeItem('steamUser');
  };

  return (
    <>
      <Component
        {...pageProps}
        steamUser={steamUser}
        setSteamUser={setSteamUser}
        onLogout={handleLogout}
      />
      <Analytics />
    </>
  );
}
