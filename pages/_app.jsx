import '../styles/globals.css'
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { Analytics } from '@vercel/analytics/next';

export default function App({ Component, pageProps }) {
  const router = useRouter();
  const [steamUser, setSteamUser] = useState(null);

  // Lê o SteamID64 da URL após callback de login Steam
  useEffect(() => {
    const { steamid, login, error } = router.query;

    if (login === 'success' && steamid) {
      sessionStorage.setItem('steamid', steamid);

      fetch(`/api/player?steamid=${steamid}`)
        .then(r => r.json())
        .then(data => {
          const player = data?.response?.players?.[0];
          if (player) {
            const userData = {
              steamid: player.steamid,
              username: player.personaname,
              avatar: player.avatarmedium || player.avatar,
              avatarfull: player.avatarfull || player.avatarmedium,
              profileUrl: player.profileurl,
              personastate: player.personastate,
              timecreated: player.timecreated,
            };
            setSteamUser(userData);
            sessionStorage.setItem('steamUser', JSON.stringify(userData));
          }
        })
        .catch(console.error);

      router.replace(router.pathname, undefined, { shallow: true });
    }

    if (error) {
      console.error('Steam login error:', error);
      router.replace(router.pathname, undefined, { shallow: true });
    }
  }, [router.query]);

  // Restaura usuário do sessionStorage ao recarregar
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
