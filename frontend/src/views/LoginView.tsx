import { useState } from 'react';

interface Props {
  onLogin: () => Promise<void>;
}

export default function LoginView({ onLogin }: Props) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const handleLogin = async () => {
    setLoading(true);
    setErr('');
    try {
      await onLogin();
    } catch {
      setErr('Cannot reach the server. Make sure the backend is running on port 3001.');
      setLoading(false);
    }
  };

  return (
    <div style={{
      flex: 1,
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      background: 'linear-gradient(170deg, #0F325A 0%, #1D5282 30%, #143C6E 65%, #0A2346 100%)',
      minHeight: '100vh',
    }}>
      <div style={{
        width: '100%',
        position: 'relative',
        zIndex: 1,
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
      }}>
        {/* Logo icon */}
        <div style={{
          width: 56, height: 56,
          borderRadius: 16,
          background: '#4FA8E8',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 8,
          boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
        }}>
          <svg width="28" height="28" viewBox="0 0 24 24">
            <path d="M2 13h4l2-8 4 16 2-8 2 5h6" fill="none" stroke="#21281F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.14em', color: 'rgba(255,255,255,0.75)', textTransform: 'uppercase' }}>
          Welcome to
        </div>
        <div style={{ fontFamily: 'Poppins, sans-serif', fontSize: 34, fontWeight: 600, letterSpacing: '-0.03em', color: '#FFFFFF', marginBottom: 4 }}>
          RehAPP
        </div>
        <div style={{ fontSize: 16, color: 'rgba(255,255,255,0.85)', lineHeight: 1.55, marginBottom: 28 }}>
          Personalized rehab plans, built and followed by anyone — no roles, no gatekeeping.
        </div>

        <button
          onClick={handleLogin}
          disabled={loading}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            background: '#FFFFFF',
            border: '1.5px solid #E1E4DD',
            borderRadius: 14,
            padding: '14px 20px',
            fontSize: 15,
            fontWeight: 700,
            color: '#21281F',
            cursor: 'pointer',
            boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
            opacity: loading ? 0.7 : 1,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18">
            <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" />
            <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.583-5.036-3.71H.957v2.332A8.997 8.997 0 009 18z" />
            <path fill="#FBBC05" d="M3.964 10.707A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" />
            <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z" />
          </svg>
          {loading ? 'Loading…' : 'Log in with Google'}
        </button>

        <button
          onClick={handleLogin}
          disabled={loading}
          style={{
            width: '100%',
            background: 'rgba(255,255,255,0.12)',
            backdropFilter: 'blur(6px)',
            border: '1.5px solid rgba(255,255,255,0.5)',
            borderRadius: 14,
            padding: '14px 20px',
            fontSize: 15,
            fontWeight: 700,
            color: '#FFFFFF',
            cursor: 'pointer',
            marginTop: 10,
            opacity: loading ? 0.7 : 1,
          }}
        >
          Create an account
        </button>

        {err && (
          <div style={{ fontSize: 13, color: '#FFB3B3', marginTop: 8, fontWeight: 600 }}>{err}</div>
        )}

        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 18 }}>
          By continuing you agree this is a demo. No data leaves your browser.
        </div>
      </div>
    </div>
  );
}
