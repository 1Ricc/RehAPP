import { useState } from 'react';
import type { RispostaStato } from '@backend/domain/types';
import { impostaSessione, registra } from '../api';

interface Props {
  onRegistered: (stato: RispostaStato) => void;
  onBack: () => void;
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

/**
 * The server's messages are Italian, the UI is English. The two it can answer
 * with that a person will actually hit get translated here; anything else falls
 * back to the server's text, which is still better than a generic failure.
 */
function inInglese(messaggio: string): string {
  if (messaggio.includes('già preso')) return 'That username is taken.';
  if (messaggio.includes('richiedono un database')) {
    return 'Accounts are not available on this server. You can still try the demo.';
  }
  return messaggio;
}

export default function RegisterView({ onRegistered, onBack }: Props) {
  const [nome, setNome] = useState('');
  const [eta, setEta] = useState('');
  const [obiettivo, setObiettivo] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  // Checked here as well as on the server, so a password that was never going
  // to be accepted does not cost a round trip to find out.
  const problema =
    nome.trim().length === 0
      ? 'Enter your name.'
      : username.trim().length < 3
        ? 'Username must be at least 3 characters.'
        : password.length < 8
          ? 'Password must be at least 8 characters.'
          : eta !== '' && (!Number.isInteger(Number(eta)) || Number(eta) < 1 || Number(eta) > 120)
            ? 'Age must be a whole number between 1 and 120.'
            : '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (problema) {
      setErr(problema);
      return;
    }
    setLoading(true);
    setErr('');
    try {
      const risposta = await registra({
        username: username.trim(),
        password,
        nome: nome.trim(),
        eta: eta === '' ? null : Number(eta),
        obiettivo: obiettivo.trim(),
      });
      impostaSessione(risposta.token);
      onRegistered(risposta.stato);
    } catch (e) {
      setErr(e instanceof Error ? inInglese(e.message) : 'Could not create the account.');
      setLoading(false);
    }
  };

  const disabilitato = loading || problema !== '';

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      background: '#EDEFEA',
      minHeight: '100vh',
      overflowY: 'auto',
    }}>
      <div style={{ width: '100%', maxWidth: 340, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
        <div style={{
          fontFamily: 'Poppins, sans-serif',
          fontSize: 42,
          fontWeight: 700,
          letterSpacing: '-0.03em',
          color: '#21281F',
          marginBottom: 8,
        }}>
          Rehub
        </div>
        <div style={{ fontSize: 14, color: '#8A9485', marginBottom: 20, textAlign: 'center' }}>
          Create your account
        </div>

        <form onSubmit={handleSubmit} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input
            type="text"
            placeholder="Your name"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            autoComplete="name"
            style={inputStyle}
          />
          <input
            type="number"
            placeholder="Age (optional)"
            value={eta}
            onChange={(e) => setEta(e.target.value)}
            style={inputStyle}
          />
          <input
            type="text"
            placeholder="Your goal (optional)"
            value={obiettivo}
            onChange={(e) => setObiettivo(e.target.value)}
            style={inputStyle}
          />
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
            placeholder="Password (8 characters or more)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            style={inputStyle}
          />

          <button
            type="submit"
            disabled={disabilitato}
            style={{
              width: '100%',
              background: '#4FA8E8',
              border: 'none',
              borderRadius: 14,
              padding: '14px 20px',
              fontSize: 15,
              fontWeight: 700,
              color: '#21281F',
              cursor: disabilitato ? 'default' : 'pointer',
              opacity: disabilitato ? 0.6 : 1,
              marginTop: 4,
            }}
          >
            {loading ? 'Creating…' : 'Create account'}
          </button>
        </form>

        {err && (
          <div style={{ fontSize: 13, color: '#C4453A', marginTop: 4, fontWeight: 600, textAlign: 'center' }}>{err}</div>
        )}

        <button
          type="button"
          onClick={onBack}
          style={{
            background: 'none',
            border: 'none',
            fontSize: 13,
            color: '#8A9485',
            fontWeight: 600,
            cursor: 'pointer',
            marginTop: 16,
          }}
        >
          I already have an account
        </button>
      </div>
    </div>
  );
}
