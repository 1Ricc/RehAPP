import { useState, useEffect, useRef } from 'react';
import type { RispostaStato, BloccoChecklist } from '@backend/domain/types';
import { toggleTask, declareRecovery, closeDay } from '../api';
import VasModal from '../components/VasModal';

interface Props {
  stato: RispostaStato;
  onStateUpdate: (s: RispostaStato) => void;
}

interface Toast {
  emoji: string;
  title: string;
  subtitle: string;
  big: boolean;
}

function parseSeries(dettaglio = ''): number {
  const m = dettaglio.match(/^(\d+)\s+sets?/i);
  return m ? parseInt(m[1]) : 1;
}

const CARD: React.CSSProperties = {
  background: '#FFFFFF',
  border: '1px solid #EEF0EA',
  borderRadius: 24,
  padding: 18,
  boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
};

export default function WorkoutView({ stato, onStateUpdate }: Props) {
  const { oggi } = stato;
  const isRecovery = oggi.tipoGiorno === 'recupero';

  const [setsMap, setSetsMap] = useState<Record<string, number>>({});
  const [vasOpen, setVasOpen] = useState(false);
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [recoveryText, setRecoveryText] = useState('');
  const [loading, setLoading] = useState<string | null>(null);

  const [toast, setToast] = useState<Toast | null>(null);
  const [toastIn, setToastIn] = useState(false);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);
  const [closing, setClosing] = useState(false);

  // Sync set counters when the day rolls over
  useEffect(() => {
    const exerciseBlock = oggi.blocchi.find(b => b.id === 'esercizi');
    if (!exerciseBlock) return;
    const init: Record<string, number> = {};
    exerciseBlock.voci.forEach(v => {
      init[v.id] = v.fatto ? parseSeries(v.dettaglio) : 0;
    });
    setSetsMap(init);
  }, [oggi.data]);

  const completedBlocks = oggi.blocchi.filter(b => b.completo).length;
  const totalBlocks = oggi.blocchi.length;
  const progressPct = totalBlocks > 0 ? Math.round((completedBlocks / totalBlocks) * 100) : 0;

  const showToast = (t: Toast) => {
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    setToast(t);
    setToastIn(false);
    setTimeout(() => setToastIn(true), 10);
    dismissTimer.current = setTimeout(() => {
      setToastIn(false);
      setTimeout(() => setToast(null), 350);
    }, t.big ? 4500 : 2800);
  };

  const dismissToast = () => {
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    setToastIn(false);
    setTimeout(() => setToast(null), 350);
  };

  const notifyCompletion = (prev: RispostaStato, next: RispostaStato) => {
    if (!prev.oggi.checklistCompleta && next.oggi.checklistCompleta) {
      showToast({
        emoji: '🎉',
        title: 'Day complete!',
        subtitle: `+${next.oggi.rpMaturati} RP · ${prev.barra.streakGiorni + 1}-day streak tomorrow 🔥`,
        big: true,
      });
      return;
    }
    for (const nb of next.oggi.blocchi) {
      const ob = prev.oggi.blocchi.find(b => b.id === nb.id);
      if (nb.completo && !ob?.completo) {
        showToast({
          emoji: nb.id === 'esercizi' ? '💪' : nb.id === 'farmaci' ? '💊' : '📊',
          title: `${nb.titolo} done!`,
          subtitle: nb.rpOggi > 0 ? `+${nb.rp} RP earned` : 'Logged',
          big: false,
        });
        break;
      }
    }
  };

  // Checkbox: direct complete/incomplete toggle. setsMap is purely visual.
  const handleToggle = async (
    blocco: 'esercizi' | 'farmaci',
    voceId: string,
    markDone: boolean,
    maxSets = 1,
  ) => {
    const key = `${blocco}:${voceId}`;
    setLoading(key);
    if (blocco === 'esercizi') {
      setSetsMap(prev => ({ ...prev, [voceId]: markDone ? maxSets : 0 }));
    }
    try {
      const prevStato = stato;
      const newStato = await toggleTask(blocco, voceId, markDone);
      onStateUpdate(newStato);
      if (markDone) notifyCompletion(prevStato, newStato);
    } catch (e) {
      if (blocco === 'esercizi') {
        setSetsMap(prev => ({ ...prev, [voceId]: markDone ? 0 : maxSets }));
      }
      alert(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(null);
    }
  };

  const handleDeclareRecovery = async () => {
    if (!recoveryText.trim()) return;
    try {
      onStateUpdate(await declareRecovery(recoveryText.trim()));
      setRecoveryOpen(false);
      setRecoveryText('');
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error');
    }
  };

  const handleCloseDay = async () => {
    setClosing(true);
    try {
      const newStato = await closeDay();
      onStateUpdate(newStato);
      setCloseConfirmOpen(false);
      showToast({
        emoji: '🔒',
        title: 'Day locked in!',
        subtitle: `Streak: ${newStato.barra.streakGiorni} days · +${newStato.oggi.rpMaturati} RP · ${newStato.barra.gemme} gems`,
        big: false,
      });
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error');
    } finally {
      setClosing(false);
    }
  };

  const renderBlock = (block: BloccoChecklist) => {
    const isExercises = block.id === 'esercizi';
    const isMeds = block.id === 'farmaci';
    const isDiary = block.id === 'diario';
    const dimmed = !block.richiestoOggi;
    // The day is locked once finalised — nothing here should still be clickable.
    const locked = dimmed || oggi.finalizzato;

    return (
      <div key={block.id} style={CARD}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: block.completo ? '#3BAB6E' : '#D8DCD1', transition: 'background 0.3s' }} />
            <div style={{ fontFamily: 'Poppins, sans-serif', fontSize: 15, fontWeight: 600, color: '#21281F' }}>
              {block.titolo}
            </div>
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: block.completo ? '#3BAB6E' : '#8A9485' }}>
            {block.completo ? '✓ Done' : block.rpOggi > 0 ? `+${block.rpOggi} RP` : 'no RP today'}
          </div>
        </div>

        {dimmed && (
          <div style={{ fontSize: 12, color: '#8A9485', marginBottom: 10, fontWeight: 600 }}>
            Not required today (recovery day)
          </div>
        )}

        {(isExercises || isMeds) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {block.voci.map(v => {
              const checked = v.fatto;
              const maxSets = isExercises ? parseSeries(v.dettaglio) : 1;
              const setsDone = isExercises ? (setsMap[v.id] ?? (checked ? maxSets : 0)) : 0;
              const busy = loading === `${block.id}:${v.id}`;

              return (
                <div
                  key={v.id}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 12,
                    padding: 12,
                    borderRadius: 16,
                    background: checked ? 'rgba(59,171,110,0.07)' : '#FAFBF8',
                    opacity: locked ? 0.55 : 1,
                    transition: 'background 0.25s ease',
                  }}
                >
                  {/* Checkbox — one click = done, click again = undo */}
                  <button
                    onClick={() => !locked && handleToggle(
                      isExercises ? 'esercizi' : 'farmaci',
                      v.id,
                      !checked,
                      maxSets,
                    )}
                    disabled={busy || locked}
                    style={{
                      flexShrink: 0,
                      width: 26,
                      height: 26,
                      borderRadius: 8,
                      border: `2px solid ${checked ? '#3BAB6E' : '#D8DCD1'}`,
                      background: checked ? '#3BAB6E' : '#FFFFFF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: locked ? 'default' : 'pointer',
                      marginTop: 2,
                      transition: 'all 0.2s ease',
                    }}
                  >
                    {checked && (
                      <svg width="13" height="13" viewBox="0 0 20 20">
                        <path d="M4 10l4 4 8-9" fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: checked ? '#3BAB6E' : '#21281F', textDecoration: checked ? 'line-through' : 'none', transition: 'color 0.2s' }}>
                      {v.etichetta}
                    </div>
                    {v.dettaglio && (
                      <div style={{ fontSize: 12.5, color: '#8A9485', marginTop: 2, marginBottom: isExercises && maxSets > 1 ? 6 : 0 }}>
                        {v.dettaglio}
                      </div>
                    )}

                    {/* Set counter — visual only, no API call */}
                    {isExercises && maxSets > 1 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
                        <button
                          onClick={() => setSetsMap(prev => ({ ...prev, [v.id]: Math.max((prev[v.id] ?? 0) - 1, 0) }))}
                          disabled={locked || setsDone <= 0}
                          style={{
                            width: 28, height: 28, borderRadius: 8,
                            border: '1.5px solid #D8DCD1', background: '#FFFFFF',
                            cursor: 'pointer', fontSize: 16, fontWeight: 700, color: '#21281F',
                            lineHeight: 1, opacity: setsDone <= 0 ? 0.35 : 1,
                          }}
                        >−</button>
                        <div style={{ minWidth: 48, textAlign: 'center', fontSize: 12.5, fontWeight: 700, color: setsDone >= maxSets ? '#3BAB6E' : '#21281F' }}>
                          {setsDone}/{maxSets} sets
                        </div>
                        <button
                          onClick={() => setSetsMap(prev => ({ ...prev, [v.id]: Math.min((prev[v.id] ?? 0) + 1, maxSets) }))}
                          disabled={locked || setsDone >= maxSets}
                          style={{
                            width: 28, height: 28, borderRadius: 8,
                            border: '1.5px solid #D8DCD1', background: '#FFFFFF',
                            cursor: 'pointer', fontSize: 16, fontWeight: 700, color: '#21281F',
                            lineHeight: 1, opacity: setsDone >= maxSets ? 0.35 : 1,
                          }}
                        >＋</button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {isDiary && (
          <button
            onClick={() => !locked && setVasOpen(true)}
            disabled={locked}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: 12,
              borderRadius: 16,
              background: block.completo ? 'rgba(59,171,110,0.07)' : '#FAFBF8',
              border: 'none',
              opacity: locked ? 0.55 : 1,
              cursor: locked ? 'default' : 'pointer',
              textAlign: 'left',
              transition: 'background 0.25s ease',
            }}
          >
            <div style={{
              width: 26, height: 26, borderRadius: 8, flexShrink: 0,
              border: `2px solid ${block.completo ? '#3BAB6E' : '#D8DCD1'}`,
              background: block.completo ? '#3BAB6E' : '#FFFFFF',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.2s ease',
            }}>
              {block.completo && (
                <svg width="13" height="13" viewBox="0 0 20 20">
                  <path d="M4 10l4 4 8-9" fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: block.completo ? '#3BAB6E' : '#21281F', textDecoration: block.completo ? 'line-through' : 'none' }}>
                {block.voci[0]?.etichetta ?? 'Pain diary'}
              </div>
              <div style={{ fontSize: 12.5, color: '#8A9485', marginTop: 2 }}>
                {oggi.diario
                  ? `VAS ${oggi.diario.vas}/10 at ${oggi.diario.compilatoAlle} — tap to update`
                  : block.voci[0]?.dettaglio ?? 'Ten seconds, every day'}
              </div>
            </div>
          </button>
        )}
      </div>
    );
  };

  return (
    <>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #EEF0EA' }}>
        <div style={{ fontFamily: 'Poppins, sans-serif', fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em', color: '#21281F' }}>
          Today
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 18, paddingBottom: 100 }}>

        {/* Progress bar */}
        <div style={CARD}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontFamily: 'Poppins, sans-serif', fontSize: 15, fontWeight: 600, color: '#21281F' }}>
              {isRecovery ? 'Recovery Day' : "Today's Checklist"}
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: progressPct === 100 ? '#3BAB6E' : '#4FA8E8' }}>
              {completedBlocks}/{totalBlocks} done
            </div>
          </div>
          <div style={{ width: '100%', height: 10, borderRadius: 999, background: '#EAF1F7', overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 999,
              background: progressPct === 100 ? '#3BAB6E' : '#4FA8E8',
              width: `${progressPct}%`,
              transition: 'width 0.35s ease, background 0.3s ease',
            }} />
          </div>
          {isRecovery && (
            <div style={{ fontSize: 12, color: '#8A9485', marginTop: 8 }}>
              Points are paused today. Exercises aren't required.
            </div>
          )}
        </div>

        {oggi.blocchi.map(renderBlock)}

        {/* Finalise CTA — shown when everything is done and day isn't locked yet */}
        {oggi.checklistCompleta && !oggi.finalizzato && !isRecovery && (
          <button
            onClick={() => setCloseConfirmOpen(true)}
            style={{
              width: '100%',
              background: 'linear-gradient(135deg, #3BAB6E, #2E9960)',
              border: 'none',
              borderRadius: 20,
              padding: '22px',
              fontFamily: 'Poppins, sans-serif',
              fontSize: 17,
              fontWeight: 700,
              color: '#FFFFFF',
              cursor: 'pointer',
              boxShadow: '0 10px 24px rgba(59,171,110,0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
            }}
          >
            <span style={{ fontSize: 22 }}>✅</span>
            Close your day
          </button>
        )}

        {/* Already finalised banner */}
        {oggi.finalizzato && (
          <div style={{
            background: 'linear-gradient(135deg, rgba(59,171,110,0.12), rgba(59,171,110,0.06))',
            border: '1.5px solid rgba(59,171,110,0.3)',
            borderRadius: 20,
            padding: '20px 22px',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
          }}>
            <span style={{ fontSize: 32, flexShrink: 0 }}>🔒</span>
            <div>
              <div style={{ fontFamily: 'Poppins, sans-serif', fontSize: 15, fontWeight: 700, color: '#2E9960' }}>
                Day complete & locked!
              </div>
              <div style={{ fontSize: 13, color: '#6B7566', marginTop: 3 }}>
                Stats are saved. See you tomorrow!
              </div>
            </div>
          </div>
        )}

        {!isRecovery && !oggi.motivoRecupero && (
          recoveryOpen ? (
            <div style={CARD}>
              <div style={{ fontFamily: 'Poppins, sans-serif', fontSize: 15, fontWeight: 600, color: '#21281F', marginBottom: 12 }}>
                Take a rest day
              </div>
              <textarea
                value={recoveryText}
                onChange={e => setRecoveryText(e.target.value)}
                placeholder="Short reason (e.g. 'knee swelling')"
                rows={2}
                style={{
                  width: '100%', border: '1.5px solid #E7EAE3', borderRadius: 12,
                  padding: '10px 14px', fontSize: 14, fontFamily: 'Inter, sans-serif',
                  resize: 'none', marginBottom: 12,
                }}
              />
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => { setRecoveryOpen(false); setRecoveryText(''); }}
                  style={{ flex: 1, background: '#F5F6F2', border: 'none', borderRadius: 12, padding: '12px', fontSize: 13, fontWeight: 700, color: '#6B7566', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeclareRecovery}
                  disabled={!recoveryText.trim()}
                  style={{ flex: 1, background: '#4FA8E8', border: 'none', borderRadius: 12, padding: '12px', fontSize: 13, fontWeight: 700, color: '#21281F', cursor: 'pointer', opacity: recoveryText.trim() ? 1 : 0.5 }}
                >
                  Confirm rest day
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setRecoveryOpen(true)}
              style={{
                width: '100%', background: 'transparent', border: '1.5px dashed #D8DCD1',
                borderRadius: 16, padding: '14px', fontSize: 13, fontWeight: 700,
                color: '#8A9485', cursor: 'pointer',
              }}
            >
              I need a rest day today
            </button>
          )
        )}
      </div>

      {vasOpen && (
        <VasModal
          existing={oggi.diario}
          onDone={s => {
            notifyCompletion(stato, s);
            onStateUpdate(s);
            setVasOpen(false);
          }}
          onClose={() => setVasOpen(false)}
        />
      )}

      {/* Day-close confirmation sheet */}
      {closeConfirmOpen && (
        <div
          onClick={() => !closing && setCloseConfirmOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 200,
            background: 'rgba(0,0,0,0.45)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#FFFFFF',
              borderRadius: '28px 28px 0 0',
              padding: '28px 24px 40px',
              width: '100%',
              maxWidth: 430,
              boxShadow: '0 -8px 32px rgba(0,0,0,0.14)',
            }}
          >
            <div style={{ width: 40, height: 4, borderRadius: 2, background: '#D8DCD1', margin: '0 auto 24px' }} />
            <div style={{ fontSize: 28, textAlign: 'center', marginBottom: 12 }}>🏁</div>
            <div style={{ fontFamily: 'Poppins, sans-serif', fontSize: 20, fontWeight: 700, color: '#21281F', textAlign: 'center', marginBottom: 8 }}>
              Are you sure you're done?
            </div>
            <div style={{ fontSize: 14, color: '#8A9485', textAlign: 'center', lineHeight: 1.5, marginBottom: 24 }}>
              This will lock in your stats for today. You won't be able to undo this.
            </div>

            {/* Stats preview */}
            <div style={{
              background: '#F5F6F2',
              borderRadius: 16,
              padding: '14px 18px',
              display: 'flex',
              justifyContent: 'space-around',
              marginBottom: 24,
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#4FA8E8', fontFamily: 'Poppins, sans-serif' }}>
                  +{oggi.rpMaturati}
                </div>
                <div style={{ fontSize: 11, color: '#8A9485', fontWeight: 700, textTransform: 'uppercase', marginTop: 2 }}>RP</div>
              </div>
              <div style={{ width: 1, background: '#E5E8E0' }} />
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#21281F', fontFamily: 'Poppins, sans-serif' }}>
                  {stato.barra.streakGiorni}🔥
                </div>
                <div style={{ fontSize: 11, color: '#8A9485', fontWeight: 700, textTransform: 'uppercase', marginTop: 2 }}>Streak</div>
              </div>
              <div style={{ width: 1, background: '#E5E8E0' }} />
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#C9A227', fontFamily: 'Poppins, sans-serif' }}>
                  +{Math.floor(oggi.rpMaturati * stato.barra.moltiplicatore)}
                </div>
                <div style={{ fontSize: 11, color: '#8A9485', fontWeight: 700, textTransform: 'uppercase', marginTop: 2 }}>Gems</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => setCloseConfirmOpen(false)}
                disabled={closing}
                style={{
                  flex: 1,
                  background: '#F5F6F2',
                  border: 'none',
                  borderRadius: 16,
                  padding: '16px',
                  fontSize: 15,
                  fontWeight: 700,
                  color: '#6B7566',
                  cursor: 'pointer',
                }}
              >
                Not yet
              </button>
              <button
                onClick={handleCloseDay}
                disabled={closing}
                style={{
                  flex: 2,
                  background: 'linear-gradient(135deg, #3BAB6E, #2E9960)',
                  border: 'none',
                  borderRadius: 16,
                  padding: '16px',
                  fontSize: 15,
                  fontWeight: 700,
                  color: '#FFFFFF',
                  cursor: closing ? 'default' : 'pointer',
                  opacity: closing ? 0.7 : 1,
                }}
              >
                {closing ? 'Locking in…' : "Yes, I'm done!"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Small block-complete toast — slides down from top */}
      {toast && !toast.big && (
        <div
          onClick={dismissToast}
          style={{
            position: 'fixed',
            top: toastIn ? 16 : -80,
            left: '50%',
            transform: 'translateX(-50%)',
            opacity: toastIn ? 1 : 0,
            transition: 'top 0.38s cubic-bezier(0.34,1.56,0.64,1), opacity 0.3s ease',
            zIndex: 150,
            background: '#4FA8E8',
            borderRadius: 20,
            padding: '12px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            boxShadow: '0 8px 24px rgba(79,168,232,0.35)',
            width: 'calc(100% - 48px)',
            maxWidth: 340,
            cursor: 'pointer',
          }}
        >
          <span style={{ fontSize: 24, lineHeight: 1 }}>{toast.emoji}</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#21281F' }}>{toast.title}</div>
            <div style={{ fontSize: 12, color: 'rgba(33,40,31,0.65)', marginTop: 2 }}>{toast.subtitle}</div>
          </div>
        </div>
      )}

      {/* Big day-complete modal — scale-in from center */}
      {toast && toast.big && (
        <div
          onClick={dismissToast}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 150,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: `rgba(0,0,0,${toastIn ? 0.45 : 0})`,
            backdropFilter: toastIn ? 'blur(6px)' : 'none',
            WebkitBackdropFilter: toastIn ? 'blur(6px)' : 'none',
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
            transform: `scale(${toastIn ? 1 : 0.82})`,
            opacity: toastIn ? 1 : 0,
            transition: 'transform 0.42s cubic-bezier(0.34,1.56,0.64,1), opacity 0.3s ease',
            boxShadow: '0 24px 48px rgba(0,0,0,0.18)',
          }}>
            <div style={{ fontSize: 64, lineHeight: 1, marginBottom: 16 }}>{toast.emoji}</div>
            <div style={{ fontFamily: 'Poppins, sans-serif', fontSize: 22, fontWeight: 700, color: '#21281F', marginBottom: 8 }}>
              {toast.title}
            </div>
            <div style={{ fontSize: 15, color: '#6B7566', fontWeight: 600, marginBottom: 24 }}>
              {toast.subtitle}
            </div>
            <div style={{ fontSize: 12, color: '#B3BAA9' }}>Tap anywhere to close</div>
          </div>
        </div>
      )}
    </>
  );
}
