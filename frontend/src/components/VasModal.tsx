import { useState } from 'react';
import type { Diario } from '@backend/domain/types';
import { submitDiary } from '../api';
import type { RispostaStato } from '@backend/domain/types';

interface Props {
  existing: Diario | null;
  onDone: (stato: RispostaStato) => void;
  onClose: () => void;
}

function vasColor(v: number): string {
  if (v <= 3) return '#3BAB6E';
  if (v <= 6) return '#E8A020';
  return '#E8504F';
}

export default function VasModal({ existing, onDone, onClose }: Props) {
  const [vas, setVas] = useState(existing?.vas ?? 3);
  const [nota, setNota] = useState(existing?.nota ?? '');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const handleSubmit = async () => {
    setLoading(true);
    setErr('');
    try {
      const nuovoStato = await submitDiary(vas, nota || undefined);
      onDone(nuovoStato);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  };

  const color = vasColor(vas);

  return (
    <>
      {/* backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200,
        }}
      />
      {/* sheet */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        width: '100%',
        maxWidth: 430,
        background: '#FFFFFF',
        borderRadius: '24px 24px 0 0',
        padding: '28px 24px 40px',
        zIndex: 201,
        boxShadow: '0 -8px 40px rgba(0,0,0,0.12)',
      }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: '#E7EAE3', margin: '0 auto 24px' }} />

        <div style={{ fontFamily: 'Poppins, sans-serif', fontSize: 18, fontWeight: 600, color: '#21281F', marginBottom: 4 }}>
          How does your knee feel?
        </div>
        <div style={{ fontSize: 13, color: '#8A9485', marginBottom: 28 }}>
          Self-reported pain · 0 = no pain, 10 = maximum
        </div>

        {/* VAS display */}
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 56, fontWeight: 700, color, lineHeight: 1, fontFamily: 'Poppins, sans-serif' }}>
            {vas}
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color, marginTop: 4 }}>
            {vas <= 3 ? 'Mild pain' : vas <= 6 ? 'Moderate pain' : 'Severe pain'}
          </div>
        </div>

        {/* Slider */}
        <div style={{ position: 'relative', marginBottom: 8 }}>
          <input
            type="range"
            min={0}
            max={10}
            step={1}
            value={vas}
            onChange={e => setVas(Number(e.target.value))}
            style={{
              width: '100%',
              height: 8,
              cursor: 'pointer',
              accentColor: color,
            }}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#B3BAA9', fontWeight: 700, marginBottom: 24 }}>
          <span>0</span><span>5</span><span>10</span>
        </div>

        {/* Note */}
        <textarea
          value={nota}
          onChange={e => setNota(e.target.value)}
          placeholder="Add a note (optional)…"
          rows={2}
          style={{
            width: '100%',
            border: '1.5px solid #E7EAE3',
            borderRadius: 14,
            padding: '12px 14px',
            fontSize: 14,
            fontFamily: 'Inter, sans-serif',
            color: '#21281F',
            resize: 'none',
            marginBottom: 16,
          }}
        />

        {err && (
          <div style={{ fontSize: 13, color: '#E8504F', marginBottom: 12 }}>{err}</div>
        )}

        <button
          onClick={handleSubmit}
          disabled={loading}
          style={{
            width: '100%',
            background: '#4FA8E8',
            border: 'none',
            borderRadius: 16,
            padding: '16px',
            fontSize: 15,
            fontWeight: 700,
            color: '#21281F',
            cursor: 'pointer',
            opacity: loading ? 0.7 : 1,
            fontFamily: 'Poppins, sans-serif',
          }}
        >
          {loading ? 'Saving…' : 'Save diary entry'}
        </button>
      </div>
    </>
  );
}
