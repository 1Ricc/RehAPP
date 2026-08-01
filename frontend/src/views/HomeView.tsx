import { useState } from 'react';
import type { RispostaStato } from '@backend/domain/types';
import { advancePhase } from '../api';
import type { View } from '../App';

interface Props {
  stato: RispostaStato;
  onStateUpdate: (s: RispostaStato) => void;
  onNavigate: (v: View) => void;
}

const QUOTES = [
  'Progress, not perfection — every rep counts.',
  "Healing isn't linear, but it's always moving forward.",
  'Small steps every day lead to a strong comeback.',
  'Consistency is the key to lasting recovery.',
  'Your body heals faster than you think.',
];

function buildCalendar(dataISO: string) {
  const [y, m, d] = dataISO.split('-').map(Number);
  const today = new Date(y, m - 1, d);
  const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return Array.from({ length: 9 }, (_, i) => {
    const dt = new Date(today);
    dt.setDate(today.getDate() + (i - 4));
    const isToday = i === 4;
    return {
      label: labels[dt.getDay()],
      num: dt.getDate(),
      bg: isToday ? '#4FA8E8' : '#FAFBF8',
      color: isToday ? '#21281F' : '#6B7566',
    };
  });
}

const CARD: React.CSSProperties = {
  background: '#FFFFFF',
  border: '1px solid #EEF0EA',
  borderRadius: 24,
  padding: 20,
  boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
};

export default function HomeView({ stato, onStateUpdate, onNavigate }: Props) {
  const { profilo, barra, fase, oggi, allerta } = stato;
  const [advancing, setAdvancing] = useState(false);

  const initials = profilo.nome
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const calendarDays = buildCalendar(oggi.data);
  const quote = QUOTES[Math.floor(new Date(oggi.data).getTime() / 86400000) % QUOTES.length];
  const rpPct = fase.sogliaRp > 0 ? Math.min(100, Math.round((fase.rpProgresso / fase.sogliaRp) * 100)) : 0;
  const isRecovery = oggi.tipoGiorno === 'recupero';

  const handleAdvance = async () => {
    setAdvancing(true);
    try {
      onStateUpdate(await advancePhase());
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error');
    } finally {
      setAdvancing(false);
    }
  };

  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 18, paddingBottom: 100 }}>

      {/* Greeting header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <div style={{
            width: 42, height: 42, borderRadius: '50%',
            background: '#2E3A2E', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, fontSize: 15, flexShrink: 0,
          }}>
            {initials}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, color: '#8A9485', fontWeight: 700 }}>Good to see you,</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: profilo.colore, marginTop: 2 }}>
              {profilo.nome}
            </div>
          </div>
        </div>

        {barra.streakGiorni >= 1 && (
          <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 22, fontWeight: 700, color: '#1D74B8' }}>
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path d="M12 21c-4 0-6-2.5-6-6 0-3 2-5 3-8 1 2 1 3 2 3 0-2-1-4 1-7 3 3 5 6 5 9a5 5 0 01-5 9z" fill="#1D74B8" />
              </svg>
              {barra.streakGiorni}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 700, color: '#C9A227' }}>
              <svg width="14" height="14" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="9" fill="none" stroke="#C9A227" strokeWidth="2" />
                <path d="M12 7v5l3.5 2" fill="none" stroke="#C9A227" strokeWidth="2" strokeLinecap="round" />
              </svg>
              {barra.gemme} pts
            </div>
          </div>
        )}
      </div>

      {/* Level-up banner */}
      {fase.avanzamentoDisponibile && (
        <div style={{
          background: 'linear-gradient(135deg, #C9A227, #E8C547)',
          borderRadius: 20,
          padding: '18px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
        }}>
          <div style={{ fontSize: 32 }}>🏆</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'Poppins, sans-serif', fontSize: 15, fontWeight: 600, color: '#21281F' }}>
              Phase complete!
            </div>
            <div style={{ fontSize: 13, color: '#21281F', opacity: 0.75, marginTop: 2 }}>
              You're ready to advance to the next phase.
            </div>
          </div>
          <button
            onClick={handleAdvance}
            disabled={advancing}
            style={{
              background: '#21281F',
              color: '#fff',
              border: 'none',
              borderRadius: 12,
              padding: '10px 16px',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            {advancing ? '…' : 'Level up →'}
          </button>
        </div>
      )}

      {/* Alert banner */}
      {allerta.livello !== 'nessuna' && (
        <div style={{ background: '#FFF3CD', border: '1px solid #F0D070', borderRadius: 16, padding: '14px 16px', fontSize: 13, color: '#7A5C00', fontWeight: 600 }}>
          ⚠️ {allerta.messaggio}
        </div>
      )}

      {/* Mini calendar strip */}
      <div style={CARD}>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
          {calendarDays.map((d, i) => (
            <div
              key={i}
              style={{
                flexShrink: 0,
                width: 46,
                textAlign: 'center',
                borderRadius: 14,
                padding: '9px 0',
                background: d.bg,
                color: d.color,
                fontWeight: 700,
              }}
            >
              <div style={{ fontSize: 10, opacity: 0.8 }}>{d.label}</div>
              <div style={{ fontSize: 15, marginTop: 2 }}>{d.num}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Phase progress card */}
      <div style={CARD}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#6B7566', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Phase {fase.numero} of {fase.totaleFasi}
            </div>
            <div style={{ fontFamily: 'Poppins, sans-serif', fontSize: 15, fontWeight: 600, color: '#21281F', marginTop: 2 }}>
              {fase.nome}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#4FA8E8' }}>{rpPct}%</div>
            <div style={{ fontSize: 11, color: '#8A9485' }}>{fase.rpProgresso}/{fase.sogliaRp} RP</div>
          </div>
        </div>
        <div style={{ height: 8, borderRadius: 999, background: '#EAF1F7', overflow: 'hidden' }}>
          <div style={{ height: '100%', borderRadius: 999, background: '#4FA8E8', width: `${rpPct}%`, transition: 'width 0.4s ease' }} />
        </div>
        <div style={{ fontSize: 12, color: '#8A9485', marginTop: 8 }}>
          Projected end: {fase.fineFasePrevista} · {fase.bonusGemmeFine} gems bonus on completion
        </div>
      </div>

      {/* Motivation quote */}
      <div style={{ background: '#2E3A2E', borderRadius: 24, padding: 22, color: '#fff' }}>
        <div style={{ fontSize: 11, fontWeight: 600, opacity: 0.6, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 8 }}>
          Today's motivation
        </div>
        <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.4, fontStyle: 'italic' }}>
          "{quote}"
        </div>
      </div>

      {/* CTA */}
      {isRecovery ? (
        <div style={{
          width: '100%',
          background: '#EAF4FC',
          borderRadius: 20,
          padding: '24px 22px',
          fontFamily: 'Poppins, sans-serif',
          fontSize: 18,
          fontWeight: 600,
          color: '#1D74B8',
          textAlign: 'center',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="9" fill="none" stroke="#1D74B8" strokeWidth="2" />
            <path d="M8 12.5l2.5 2.5 5-6" fill="none" stroke="#1D74B8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Rest day — you're free today!
        </div>
      ) : (
        <button
          onClick={() => onNavigate('workout')}
          style={{
            width: '100%',
            background: '#4FA8E8',
            border: 'none',
            borderRadius: 20,
            padding: '24px 22px',
            fontFamily: 'Poppins, sans-serif',
            fontSize: 18,
            fontWeight: 600,
            letterSpacing: '-0.01em',
            color: '#21281F',
            cursor: 'pointer',
            boxShadow: '0 10px 24px rgba(79,168,232,0.35)',
            textAlign: 'center',
          }}
        >
          Start Daily Workout →
        </button>
      )}

      {/* Multiplier note */}
      {barra.moltiplicatore > 1 && (
        <div style={{ textAlign: 'center', fontSize: 13, color: '#8A9485' }}>
          🔥 ×{barra.moltiplicatore.toFixed(2)} streak multiplier active
        </div>
      )}
    </div>
  );
}
