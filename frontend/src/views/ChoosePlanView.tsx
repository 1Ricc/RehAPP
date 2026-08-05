import { useEffect, useState } from 'react';
import type { PianoCreato, RispostaStato } from '@backend/domain/types';
import { adottaPiano, getPlans } from '../api';

interface Props {
  onAdopted: (stato: RispostaStato) => void;
  onBuild: () => void;
}

const CARD: React.CSSProperties = {
  background: '#FFFFFF',
  border: '1px solid #EEF0EA',
  borderRadius: 24,
  padding: 20,
  boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
  width: '100%',
};

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
 * Where an account lands before it has a plan. Two ways out and nothing else on
 * the page: build one, or type the code somebody shared with you. Everything
 * else in the app needs a plan to mean anything, so there is nothing honest to
 * show here besides these two doors.
 */
export default function ChoosePlanView({ onAdopted, onBuild }: Props) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [miei, setMiei] = useState<PianoCreato[]>([]);

  // Plans this save file has already built. Coming back from the builder, the
  // new one is at the top — so adopting it is a tap, not a copied code.
  useEffect(() => {
    getPlans()
      .then((r) => setMiei(r.piani))
      .catch(() => { /* the code box still works */ });
  }, []);

  const adotta = async (shareId: string) => {
    setLoading(true);
    setErr('');
    try {
      onAdopted(await adottaPiano(shareId));
    } catch (e) {
      // The server's messages here are written to be read by a person — a
      // missing code, or a plan that cannot be trained. Show them as they are.
      setErr(e instanceof Error ? e.message : 'That code did not work.');
      setLoading(false);
    }
  };

  const handleAdopt = (e: React.FormEvent) => {
    e.preventDefault();
    void adotta(code.trim());
  };

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      padding: 24,
      gap: 16,
      background: '#EDEFEA',
      overflowY: 'auto',
    }}>
      <div style={{
        fontFamily: 'Poppins, sans-serif',
        fontSize: 28,
        fontWeight: 700,
        letterSpacing: '-0.03em',
        color: '#21281F',
      }}>
        Let's set up your plan
      </div>
      <div style={{ fontSize: 14, color: '#6B7566', marginBottom: 8, lineHeight: 1.5 }}>
        Your rehab starts with a plan. Build your own, or enter the code your
        physiotherapist gave you.
      </div>

      <div style={CARD}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#21281F', marginBottom: 6 }}>
          Build my plan
        </div>
        <div style={{ fontSize: 13, color: '#6B7566', marginBottom: 14, lineHeight: 1.5 }}>
          Pick your exercises, your days and how many weeks it runs.
        </div>
        <button
          type="button"
          onClick={onBuild}
          style={{
            width: '100%',
            background: '#4FA8E8',
            border: 'none',
            borderRadius: 14,
            padding: '14px 20px',
            fontSize: 15,
            fontWeight: 700,
            color: '#21281F',
            cursor: 'pointer',
          }}
        >
          Build a plan
        </button>
      </div>

      {miei.length > 0 && (
        <div style={CARD}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#21281F', marginBottom: 14 }}>
            Plans you built
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {miei.map((p) => (
              <div
                key={p.id}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#21281F', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.label || 'Untitled plan'}
                  </div>
                  <div style={{ fontSize: 12, color: '#8A9485' }}>
                    {p.giorni.join(', ')} · {p.settimane} week{p.settimane !== 1 ? 's' : ''} · {p.shareId}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => void adotta(p.shareId)}
                  style={{
                    background: '#4FA8E8',
                    border: 'none',
                    borderRadius: 12,
                    padding: '10px 16px',
                    fontSize: 13,
                    fontWeight: 700,
                    color: '#21281F',
                    cursor: loading ? 'default' : 'pointer',
                    opacity: loading ? 0.6 : 1,
                    flexShrink: 0,
                  }}
                >
                  Start
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={CARD}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#21281F', marginBottom: 6 }}>
          I have a code
        </div>
        <div style={{ fontSize: 13, color: '#6B7566', marginBottom: 14, lineHeight: 1.5 }}>
          Enter the share code of a plan that was built for you.
        </div>
        <form onSubmit={handleAdopt} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input
            type="text"
            placeholder="Plan code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoCapitalize="none"
            style={inputStyle}
          />
          <button
            type="submit"
            disabled={loading || code.trim().length === 0}
            style={{
              width: '100%',
              background: '#FFFFFF',
              border: '2px solid #4FA8E8',
              borderRadius: 14,
              padding: '12px 20px',
              fontSize: 15,
              fontWeight: 700,
              color: '#1D74B8',
              cursor: loading || code.trim().length === 0 ? 'default' : 'pointer',
              opacity: loading || code.trim().length === 0 ? 0.6 : 1,
            }}
          >
            {loading ? 'Starting…' : 'Start this plan'}
          </button>
        </form>
        {err && (
          <div style={{ fontSize: 13, color: '#C4453A', marginTop: 10, fontWeight: 600 }}>{err}</div>
        )}
      </div>
    </div>
  );
}
