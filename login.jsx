// pages/login.jsx
import Head from 'next/head';
import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function LoginPage({ steamUser }) {
  const router = useRouter();
  const { error } = router.query;

  // Se já está logado, vai direto pro perfil
  useEffect(() => {
    if (steamUser) router.replace('/');
  }, [steamUser]);

  const errorMessages = {
    auth_failed:     'Autenticação recusada pelo Steam. Tente novamente.',
    invalid_steamid: 'Não foi possível identificar sua conta Steam.',
    server_error:    'Erro interno. Tente novamente em instantes.',
  };

  return (
    <>
      <Head><title>Login — COMYCS</title></Head>

      <div className="login-page">
        {/* Background grid */}
        <div className="login-grid" />
        <div className="login-glow" />

        <div className="login-card">
          {/* Logo */}
          <div className="login-logo">
            <div className="login-logo-mark">
              <svg viewBox="0 0 18 18" fill="none">
                <path d="M2 14L6 4L9 11L12 7L16 14" stroke="#000" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="9" cy="11" r="2" fill="#000"/>
              </svg>
            </div>
            <span className="login-logo-name">COM<span>YCS</span></span>
          </div>

          <h1 className="login-title">Entrar na plataforma</h1>
          <p className="login-sub">
            Conecte sua conta Steam para ver suas stats de CS2,
            inventário e interagir com a comunidade.
          </p>

          {error && (
            <div className="login-error">
              ⚠ {errorMessages[error] || 'Ocorreu um erro. Tente novamente.'}
            </div>
          )}

          {/* Botão principal */}
          <a href="/api/auth/steam" className="login-steam-btn">
            <svg width="22" height="22" viewBox="0 0 496 512" fill="currentColor">
              <path d="M496 256c0 137-111.2 248-248.4 248-113.8 0-209.7-75.2-239.1-177.4l95.7 39.6c6.6 32.4 35.5 56.8 70.2 56.8 39.1 0 70.9-32 70.9-71s-31.8-71-70.9-71l-1.4.1-66.7-97.4v-1.7c0-97.2 78.8-176 176-176s176 78.8 176 176zm-248 106.7c39.3 0 71-31.7 71-70.7s-31.8-70.7-71-70.7-71 31.7-71 70.7 31.8 70.7 71 70.7zm-98.7-214.5c0 40.3 26.8 73 63.4 82.7l-23.5-58.3c-14.4 0-26.1-11.7-26.1-26.1s11.7-26.1 26.1-26.1 26.1 11.7 26.1 26.1c0 8.3-3.9 15.6-10 20.2l25.3 62.5c32.3-16.4 54.6-50.1 54.6-89.1 0-55.2-44.8-100-100-100s-100 44.8-100 100z"/>
            </svg>
            Entrar com Steam
          </a>

          <div className="login-divider"><span>ou</span></div>

          <a href="/" className="login-guest-btn">
            Continuar sem login →
          </a>

          <p className="login-note">
            Ao entrar, você concorda com os Termos de Serviço da Steam.
            Seus dados são obtidos diretamente via Steam Web API e nunca armazenados permanentemente.
          </p>
        </div>
      </div>

      <style jsx>{`
        .login-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          position: relative;
          overflow: hidden;
          background: var(--bg);
        }
        .login-grid {
          position: absolute; inset: 0;
          background-image:
            linear-gradient(rgba(31,37,51,.5) 1px, transparent 1px),
            linear-gradient(90deg, rgba(31,37,51,.5) 1px, transparent 1px);
          background-size: 48px 48px;
          pointer-events: none;
        }
        .login-glow {
          position: absolute;
          top: -200px; left: 50%; transform: translateX(-50%);
          width: 800px; height: 600px;
          background: radial-gradient(ellipse, rgba(245,166,35,.09) 0%, transparent 65%);
          pointer-events: none;
        }
        .login-card {
          position: relative; z-index: 1;
          background: var(--bg3);
          border: 1px solid var(--border2);
          border-radius: 16px;
          padding: 44px 40px;
          width: 100%; max-width: 420px;
          text-align: center;
          animation: fadeUp .5s ease both;
          box-shadow: 0 32px 80px rgba(0,0,0,.5);
        }
        .login-logo {
          display: flex; align-items: center;
          justify-content: center; gap: 10px;
          margin-bottom: 32px;
        }
        .login-logo-mark {
          width: 36px; height: 36px; border-radius: 9px;
          background: var(--accent);
          display: flex; align-items: center; justify-content: center;
        }
        .login-logo-mark svg { width: 20px; height: 20px; }
        .login-logo-name {
          font-family: var(--font-display);
          font-size: 22px; font-weight: 800;
          color: var(--text); letter-spacing: 1px;
        }
        .login-logo-name span { color: var(--accent); }
        .login-title {
          font-family: var(--font-display);
          font-size: 24px; font-weight: 800;
          color: var(--text); margin-bottom: 10px;
        }
        .login-sub {
          font-size: 14px; color: var(--text2);
          line-height: 1.7; margin-bottom: 28px;
        }
        .login-error {
          background: rgba(224,85,85,.08);
          border: 1px solid rgba(224,85,85,.25);
          border-radius: 8px; padding: 12px 16px;
          color: var(--red); font-size: 13px;
          margin-bottom: 20px; text-align: left;
        }
        .login-steam-btn {
          display: flex; align-items: center;
          justify-content: center; gap: 12px;
          width: 100%; padding: 14px 20px;
          background: #1b2838;
          color: #c7d5e0;
          border: 1px solid #2a475e;
          border-radius: 10px;
          font-family: var(--font);
          font-size: 15px; font-weight: 600;
          text-decoration: none;
          transition: all .2s;
          cursor: pointer;
        }
        .login-steam-btn:hover {
          background: #2a475e;
          border-color: #4a8cbf;
          color: #fff;
          transform: translateY(-1px);
          box-shadow: 0 8px 24px rgba(42,71,94,.4);
        }
        .login-divider {
          display: flex; align-items: center;
          gap: 12px; margin: 20px 0;
          color: var(--text3); font-size: 12px;
        }
        .login-divider::before,
        .login-divider::after {
          content: ''; flex: 1;
          height: 1px; background: var(--border);
        }
        .login-guest-btn {
          display: block; width: 100%;
          padding: 12px 20px;
          background: transparent;
          border: 1px solid var(--border);
          border-radius: 10px;
          color: var(--text2);
          font-family: var(--font);
          font-size: 14px; font-weight: 500;
          text-decoration: none;
          transition: all .2s;
        }
        .login-guest-btn:hover {
          border-color: var(--border2);
          color: var(--text);
          background: var(--bg4);
        }
        .login-note {
          font-size: 11px; color: var(--text3);
          line-height: 1.6; margin-top: 24px;
        }
      `}</style>
    </>
  );
}
