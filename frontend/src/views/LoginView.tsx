import { useState } from 'react';

interface Props {
  onLogin: (username: string, password: string) => Promise<void>;
  onRegister: () => void;
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: '#FFFFFF',
  border: '1px solid #EEF0EA',
  borderRadius: 14,
  padding: '14px 16px',
  fontSize: 15,
  fontFamily: 'Inter, sans-serif',
  color: '#21281F',
  outline: 'none',
  boxSizing: 'border-box',
};

export default function LoginView({ onLogin, onRegister }: Props) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErr('');
    try {
      await onLogin(username.trim(), password);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Cannot reach the server. Make sure the backend is running on port 3001.');
      setLoading(false);
    }
  };

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      background: '#EDEFEA',
      minHeight: '100vh',
    }}>
      <div style={{ width: '100%', maxWidth: 340, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
        <div style={{
          fontFamily: 'Poppins, sans-serif',
          fontSize: 42,
          fontWeight: 700,
          letterSpacing: '-0.03em',
          color: '#21281F',
          marginBottom: 32,
        }}>
          Rehub
        </div>

        <form onSubmit={handleLogin} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoCapitalize="none"
            autoComplete="username"
            style={inputStyle}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            style={inputStyle}
          />

          <button
            type="submit"
            disabled={loading || !username || !password}
            style={{
              width: '100%',
              background: '#4FA8E8',
              border: 'none',
              borderRadius: 14,
              padding: '14px 20px',
              fontSize: 15,
              fontWeight: 700,
              color: '#21281F',
              cursor: loading || !username || !password ? 'default' : 'pointer',
              opacity: loading || !username || !password ? 0.6 : 1,
              marginTop: 4,
            }}
          >
            {loading ? 'Logging in…' : 'Log in'}
          </button>
        </form>

        {err && (
          <div style={{ fontSize: 13, color: '#C4453A', marginTop: 4, fontWeight: 600, textAlign: 'center' }}>{err}</div>
        )}

        <button
          type="button"
          onClick={onRegister}
          style={{
            background: 'none',
            border: 'none',
            fontSize: 13,
            color: '#4FA8E8',
            fontWeight: 700,
            cursor: 'pointer',
            marginTop: 16,
          }}
        >
          Create an account
        </button>

        <div style={{ fontSize: 12, color: '#8A9485', marginTop: 16, textAlign: 'center' }}>
          Your account keeps your plan and your progress across devices.
        </div>
      </div>
    </div>
  );
}
