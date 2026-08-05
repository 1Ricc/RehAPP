import { useEffect, useState } from 'react';
import type { RispostaStato } from '@backend/domain/types';
import { advancePhase, getHistory } from '../api';
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

function toISODate(dt: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

/**
 * Bright blue for a completed day (today included, once its checklist is
 * done), light blue for today while it's still in progress, white for
 * everything else — past misses and days yet to come both read as "not
 * done", which is the point: the strip only highlights what's finished.
 */
function buildCalendar(dataISO: string, completedDates: Set<string>, oggiCompleto: boolean) {
  const [y, m, d] = dataISO.split('-').map(Number);
  const today = new Date(y, m - 1, d);
  const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return Array.from({ length: 9 }, (_, i) => {
    const dt = new Date(today);
    dt.setDate(today.getDate() + (i - 4));
    const isToday = i === 4;
    const completo = isToday ? oggiCompleto : completedDates.has(toISODate(dt));
    return {
      label: labels[dt.getDay()],
      num: dt.getDate(),
      bg: completo ? '#4FA8E8' : isToday ? '#EAF4FC' : '#FAFBF8',
      color: completo ? '#21281F' : isToday ? '#1D74B8' : '#6B7566',
      border: isToday ? '2px solid #1D74B8' : '2px solid transparent',
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
  const [completedDates, setCompletedDates] = useState<Set<string>>(new Set());
  // Holds the newly-reached phase number while the badge celebration shows.
  const [badgeUnlock, setBadgeUnlock] = useState<number | null>(null);
  const [badgeIn, setBadgeIn] = useState(false);

  useEffect(() => {
    // A manual day-close appends today to `storico` while `oggi.data` stays
    // today until the next natural rollover, so the last-N window can include
    // today itself. Over-fetch and match by exact date so the 4 real past
    // days the strip needs are never pushed out by that overlap.
    getHistory(8)
      .then((h) => setCompletedDates(new Set(h.giorni.filter((g) => g.checklistCompleta).map((g) => g.data))))
      .catch(() => { /* strip just shows today + upcoming */ });
  }, [oggi.data]);

  // Never rendered without a plan: App routes a `senzaPiano` state to the
  // choose-a-plan screen. The guard is here so the phase card can read `fase`
  // without a null check on every field.
  if (!fase) return null;

  const initials = profilo.nome
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const calendarDays = buildCalendar(oggi.data, completedDates, oggi.checklistCompleta);
  const quote = QUOTES[Math.floor(new Date(oggi.data).getTime() / 86400000) % QUOTES.length];
  const rpPct = fase.sogliaRp > 0 ? Math.min(100, Math.round((fase.rpProgresso / fase.sogliaRp) * 100)) : 0;
  const isRecovery = oggi.tipoGiorno === 'recupero';

  const handleAdvance = async () => {
    setAdvancing(true);
    try {
      const next = await advancePhase();
      onStateUpdate(next);
      // "Phase Cleared" is earned the moment a phase closes — celebrate it
      // right here, where the presenter's own click triggers it live.
      setBadgeIn(false);
      setBadgeUnlock(next.fase?.numero ?? fase.numero);
      setTimeout(() => setBadgeIn(true), 10);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error');
    } finally {
      setAdvancing(false);
    }
  };

  const dismissBadge = () => {
    setBadgeIn(false);
    setTimeout(() => setBadgeUnlock(null), 300);
  };

  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 18, paddingBottom: 100 }}>

      {/* Stats bar — streak front and centre */}
      <div style={{
        background: '#FFFFFF',
        border: '1px solid #EEF0EA',
        borderRadius: 22,
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
      }}>
        {/* Streak */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <svg width="24" height="24" viewBox="0 0 24 24">
              <path d="M12 21c-4 0-6-2.5-6-6 0-3 2-5 3-8 1 2 1 3 2 3 0-2-1-4 1-7 3 3 5 6 5 9a5 5 0 01-5 9z" fill="#4FA8E8" />
            </svg>
            <span style={{ fontFamily: 'Poppins, sans-serif', fontSize: 22, fontWeight: 800, color: '#21281F', lineHeight: 1 }}>
              {barra.streakGiorni}
            </span>
          </div>
          <span style={{ fontSize: 10, color: '#8A9485', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>streak</span>
        </div>

        <div style={{ width: 1, height: 36, background: '#EEF0EA' }} />

        {/* RP */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
          <span style={{ fontFamily: 'Poppins, sans-serif', fontSize: 22, fontWeight: 800, color: '#4FA8E8', lineHeight: 1 }}>
            {barra.rpProgressoFase}
          </span>
          <span style={{ fontSize: 10, color: '#8A9485', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>rp</span>
        </div>

        <div style={{ width: 1, height: 36, background: '#EEF0EA' }} />

        {/* Gems */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
          <span style={{ fontFamily: 'Poppins, sans-serif', fontSize: 22, fontWeight: 800, color: '#C9A227', lineHeight: 1 }}>
            {barra.gemme}
          </span>
          <span style={{ fontSize: 10, color: '#8A9485', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>gems</span>
        </div>

        <div style={{ width: 1, height: 36, background: '#EEF0EA' }} />

        {/* Multiplier */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
          <div style={{
            background: barra.moltiplicatore > 1 ? '#EAF4FC' : '#F5F5F3',
            borderRadius: 9,
            padding: '3px 10px',
          }}>
            <span style={{ fontFamily: 'Poppins, sans-serif', fontSize: 14, fontWeight: 800, color: barra.moltiplicatore > 1 ? '#1D74B8' : '#8A9485', lineHeight: 1.4 }}>
              ×{barra.moltiplicatore.toFixed(2)}
            </span>
          </div>
          <span style={{ fontSize: 10, color: '#8A9485', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>mult</span>
        </div>
      </div>

      {/* Greeting */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 42, height: 42, borderRadius: '50%',
          background: profilo.colore, color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 700, fontSize: 15, flexShrink: 0,
        }}>
          {initials}
        </div>
        <div>
          <div style={{ fontSize: 13, color: '#8A9485', fontWeight: 700 }}>Good to see you,</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: profilo.colore, marginTop: 2 }}>
            {profilo.nome}
          </div>
        </div>
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
              background: '#4FA8E8',
              color: '#21281F',
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
        <div className="no-scrollbar" style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
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
                border: d.border,
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
      <div style={{ background: '#EAF4FC', border: '1px solid #C7E3F5', borderRadius: 24, padding: 22 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#1D74B8', opacity: 0.7, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 8 }}>
          Today's motivation
        </div>
        <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.4, fontStyle: 'italic', color: '#21281F' }}>
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
            color: '#FFFFFF',
            cursor: 'pointer',
            boxShadow: '0 10px 24px rgba(79,168,232,0.35)',
            textAlign: 'center',
          }}
        >
          Start your routine →
        </button>
      )}

      {/* Badge-unlocked celebration, shown right after confirming a level-up */}
      {badgeUnlock !== null && (
        <div
          onClick={dismissBadge}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 150,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: `rgba(0,0,0,${badgeIn ? 0.45 : 0})`,
            backdropFilter: badgeIn ? 'blur(6px)' : 'none',
            WebkitBackdropFilter: badgeIn ? 'blur(6px)' : 'none',
            transition: 'background 0.35s ease, backdrop-filter 0.35s ease',
            cursor: 'pointer',
          }}
        >
          <div style={{
            background: '#FFFFFF',
            borderRadius: 28,
            padding: '36px 28px 28px',
            width: 'calc(100% - 48px)',
            maxWidth: 340,
            textAlign: 'center',
            transform: `scale(${badgeIn ? 1 : 0.82})`,
            opacity: badgeIn ? 1 : 0,
            transition: 'transform 0.42s cubic-bezier(0.34,1.56,0.64,1), opacity 0.3s ease',
            boxShadow: '0 24px 48px rgba(0,0,0,0.18)',
          }}>
            <div style={{ fontSize: 64, lineHeight: 1, marginBottom: 16 }}>🏆</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#1D74B8', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>
              Badge unlocked
            </div>
            <div style={{ fontFamily: 'Poppins, sans-serif', fontSize: 22, fontWeight: 700, color: '#21281F', marginBottom: 8 }}>
              Phase Cleared
            </div>
            <div style={{ fontSize: 15, color: '#6B7566', fontWeight: 600, marginBottom: 24 }}>
              You completed a phase of the clinical path — welcome to phase {badgeUnlock}.
            </div>
            <div style={{ fontSize: 12, color: '#B3BAA9' }}>Tap anywhere to close</div>
          </div>
        </div>
      )}

    </div>
  );
}
