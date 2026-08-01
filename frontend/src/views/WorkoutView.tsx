import { useState, useEffect } from 'react';
import type { RispostaStato, BloccoChecklist } from '@backend/domain/types';
import { toggleTask, declareRecovery } from '../api';
import VasModal from '../components/VasModal';

interface Props {
  stato: RispostaStato;
  onStateUpdate: (s: RispostaStato) => void;
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

  // Local set counters for exercises: id → setsDone
  const [setsMap, setSetsMap] = useState<Record<string, number>>({});
  const [vasOpen, setVasOpen] = useState(false);
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [recoveryText, setRecoveryText] = useState('');
  const [loading, setLoading] = useState<string | null>(null);

  // Sync set counter with API state on day change
  useEffect(() => {
    const exerciseBlock = oggi.blocchi.find(b => b.id === 'esercizi');
    if (!exerciseBlock) return;
    const init: Record<string, number> = {};
    exerciseBlock.voci.forEach(v => {
      const max = parseSeries(v.dettaglio);
      init[v.id] = v.fatto ? max : 0;
    });
    setSetsMap(init);
  }, [oggi.data]);

  const completedBlocks = oggi.blocchi.filter(b => b.completo).length;
  const totalBlocks = oggi.blocchi.length;
  const progressPct = totalBlocks > 0 ? Math.round((completedBlocks / totalBlocks) * 100) : 0;

  const handleToggle = async (blocco: 'esercizi' | 'farmaci', voceId: string, fatto: boolean) => {
    const key = `${blocco}:${voceId}`;
    setLoading(key);
    try {
      onStateUpdate(await toggleTask(blocco, voceId, fatto));
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(null);
    }
  };

  const incSet = async (voceId: string, maxSets: number) => {
    const current = setsMap[voceId] ?? 0;
    if (current >= maxSets) return;
    const next = current + 1;
    setSetsMap(prev => ({ ...prev, [voceId]: next }));
    if (next >= maxSets) {
      await handleToggle('esercizi', voceId, true);
    }
  };

  const decSet = async (voceId: string, maxSets: number) => {
    const current = setsMap[voceId] ?? 0;
    if (current <= 0) return;
    const next = current - 1;
    setSetsMap(prev => ({ ...prev, [voceId]: next }));
    if (current >= maxSets && next < maxSets) {
      await handleToggle('esercizi', voceId, false);
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

  const renderBlock = (block: BloccoChecklist) => {
    const isExercises = block.id === 'esercizi';
    const isMeds = block.id === 'farmaci';
    const isDiary = block.id === 'diario';
    const dimmed = !block.richiestoOggi;

    return (
      <div key={block.id} style={CARD}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: block.completo ? '#4FA8E8' : '#D8DCD1' }} />
            <div style={{ fontFamily: 'Poppins, sans-serif', fontSize: 15, fontWeight: 600, color: '#21281F' }}>
              {block.titolo}
            </div>
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: block.completo ? '#4FA8E8' : '#8A9485' }}>
            {block.completo ? '✓ Done' : `${block.rpOggi > 0 ? `+${block.rpOggi} RP` : 'no RP today'}`}
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
              const setsDone = isExercises ? (setsMap[v.id] ?? (v.fatto ? maxSets : 0)) : (v.fatto ? 1 : 0);
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
                    background: '#FAFBF8',
                    opacity: dimmed ? 0.55 : 1,
                    textDecoration: dimmed ? 'line-through' : 'none',
                  }}
                >
                  <button
                    onClick={() => !dimmed && (isMeds ? handleToggle('farmaci', v.id, !checked) : (checked ? handleToggle('esercizi', v.id, false) : incSet(v.id, maxSets)))}
                    disabled={busy || dimmed}
                    style={{
                      flexShrink: 0,
                      width: 26,
                      height: 26,
                      borderRadius: 8,
                      border: `2px solid ${checked ? '#4FA8E8' : '#D8DCD1'}`,
                      background: checked ? '#4FA8E8' : '#FFFFFF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      marginTop: 2,
                    }}
                  >
                    {checked && (
                      <svg width="13" height="13" viewBox="0 0 20 20">
                        <path d="M4 10l4 4 8-9" fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#21281F' }}>{v.etichetta}</div>
                    {v.dettaglio && (
                      <div style={{ fontSize: 12.5, color: '#8A9485', marginTop: 2, marginBottom: 6 }}>{v.dettaglio}</div>
                    )}

                    {isExercises && maxSets > 1 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6 }}>
                        <button
                          onClick={() => decSet(v.id, maxSets)}
                          disabled={setsDone <= 0 || dimmed}
                          style={{
                            width: 30, height: 30,
                            borderRadius: 9,
                            border: '1.5px solid #D8DCD1',
                            background: '#FFFFFF',
                            cursor: 'pointer',
                            fontSize: 16,
                            fontWeight: 700,
                            color: '#21281F',
                            lineHeight: 1,
                            opacity: setsDone <= 0 ? 0.4 : 1,
                          }}
                        >
                          −
                        </button>
                        <div style={{ minWidth: 52, textAlign: 'center', fontSize: 13, fontWeight: 700, color: '#21281F' }}>
                          {setsDone} / {maxSets} sets
                        </div>
                        <button
                          onClick={() => incSet(v.id, maxSets)}
                          disabled={setsDone >= maxSets || dimmed}
                          style={{
                            width: 30, height: 30,
                            borderRadius: 9,
                            border: '1.5px solid #D8DCD1',
                            background: '#FFFFFF',
                            cursor: 'pointer',
                            fontSize: 16,
                            fontWeight: 700,
                            color: '#21281F',
                            lineHeight: 1,
                            opacity: setsDone >= maxSets ? 0.4 : 1,
                          }}
                        >
                          ＋
                        </button>
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
            onClick={() => setVasOpen(true)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: 12,
              borderRadius: 16,
              background: '#FAFBF8',
              border: 'none',
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <div style={{
              width: 26, height: 26,
              borderRadius: 8,
              border: `2px solid ${block.completo ? '#4FA8E8' : '#D8DCD1'}`,
              background: block.completo ? '#4FA8E8' : '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              {block.completo && (
                <svg width="13" height="13" viewBox="0 0 20 20">
                  <path d="M4 10l4 4 8-9" fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#21281F' }}>
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
          Workout
        </div>
      </div>

      <div style={{ flex: 1, padding: 20, display: 'flex', flexDirection: 'column', gap: 18, paddingBottom: 100 }}>

        {/* Progress bar */}
        <div style={CARD}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontFamily: 'Poppins, sans-serif', fontSize: 15, fontWeight: 600, color: '#21281F' }}>
              {isRecovery ? 'Recovery Day' : "Today's Checklist"}
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#4FA8E8' }}>
              {completedBlocks}/{totalBlocks} done
            </div>
          </div>
          <div style={{ width: '100%', height: 10, borderRadius: 999, background: '#EAF1F7', overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 999, background: '#4FA8E8', width: `${progressPct}%`, transition: 'width 0.35s ease' }} />
          </div>
          {isRecovery && (
            <div style={{ fontSize: 12, color: '#8A9485', marginTop: 8 }}>
              Points are paused today. Exercises aren't required.
            </div>
          )}
        </div>

        {/* Blocks */}
        {oggi.blocchi.map(renderBlock)}

        {/* Recovery declaration (only on normal days without an existing recovery) */}
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
                  width: '100%',
                  border: '1.5px solid #E7EAE3',
                  borderRadius: 12,
                  padding: '10px 14px',
                  fontSize: 14,
                  fontFamily: 'Inter, sans-serif',
                  resize: 'none',
                  marginBottom: 12,
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
                width: '100%',
                background: 'transparent',
                border: '1.5px dashed #D8DCD1',
                borderRadius: 16,
                padding: '14px',
                fontSize: 13,
                fontWeight: 700,
                color: '#8A9485',
                cursor: 'pointer',
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
          onDone={s => { onStateUpdate(s); setVasOpen(false); }}
          onClose={() => setVasOpen(false)}
        />
      )}
    </>
  );
}
