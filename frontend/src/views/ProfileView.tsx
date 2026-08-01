import { useState, useEffect } from 'react';
import type { RispostaStato, RispostaStorico, RispostaBadge, RispostaVoucher, RispostaPiani, PianoCreato } from '@backend/domain/types';
import { getHistory, getBadges, getVouchers, getPlans } from '../api';
import PainChart from '../components/PainChart';
import Heatmap from '../components/Heatmap';

interface Props {
  stato: RispostaStato;
}

type Timeframe = 'week' | 'month' | '3m' | '6m' | 'year';

const CARD: React.CSSProperties = {
  background: '#FFFFFF',
  border: '1px solid #EEF0EA',
  borderRadius: 24,
  padding: 20,
  boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
};

const SECTION_TITLE: React.CSSProperties = {
  fontFamily: 'Poppins, sans-serif',
  fontSize: 16,
  fontWeight: 600,
  color: '#21281F',
  marginBottom: 14,
};

const LOCK_NODE = (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '24px 0', color: '#8A9485', fontSize: 13, fontWeight: 700 }}>
    <svg width="24" height="24" viewBox="0 0 24 24">
      <rect x="5" y="10" width="14" height="10" rx="2" fill="none" stroke="#B3BAA9" strokeWidth="2" />
      <path d="M8 10V7a4 4 0 018 0v3" fill="none" stroke="#B3BAA9" strokeWidth="2" />
    </svg>
    Unlock in the Shop
  </div>
);

function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function daysSince(iso: string): number {
  const start = new Date(iso + 'T00:00:00').getTime();
  return Math.floor((Date.now() - start) / 86_400_000);
}

export default function ProfileView({ stato }: Props) {
  const { profilo, barra, benefit, fase, paziente } = stato;

  const [history, setHistory] = useState<RispostaStorico | null>(null);
  const [badges, setBadges] = useState<RispostaBadge | null>(null);
  const [vouchers, setVouchers] = useState<RispostaVoucher | null>(null);
  const [plans, setPlans] = useState<RispostaPiani | null>(null);
  const [expandedPlan, setExpandedPlan] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState<Timeframe>('week');

  const painBenefit = benefit.find(b => b.id === 'grafico-dolore');
  const heatmapBenefit = benefit.find(b => b.id === 'calendario-heatmap');

  const initials = profilo.nome
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  useEffect(() => {
    getHistory(400).then(setHistory).catch(() => {});
    getBadges().then(setBadges).catch(() => {});
    getVouchers().then(setVouchers).catch(() => {});
    getPlans().then(setPlans).catch(() => {});
  }, []);

  const daysInRecovery = daysSince(paziente.dataIntervento);

  return (
    <>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #EEF0EA' }}>
        <div style={{ fontFamily: 'Poppins, sans-serif', fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em', color: '#21281F' }}>
          Profile
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 18, paddingBottom: 100 }}>

        {/* ── User card ── */}
        <div style={CARD}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{
              width: 60, height: 60,
              borderRadius: '50%',
              background: profilo.colore,
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: 20,
              flexShrink: 0,
            }}>
              {initials}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: profilo.colore, fontFamily: 'Poppins, sans-serif' }}>
                {profilo.nome}
              </div>
              <div style={{ fontSize: 13, color: '#8A9485', marginTop: 2 }}>
                Phase {fase.numero} of {fase.totaleFasi} · {profilo.etichettaColore}
              </div>
            </div>
            <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 20, fontWeight: 700, color: '#1D74B8' }}>
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path d="M12 21c-4 0-6-2.5-6-6 0-3 2-5 3-8 1 2 1 3 2 3 0-2-1-4 1-7 3 3 5 6 5 9a5 5 0 01-5 9z" fill="#1D74B8" />
                </svg>
                {barra.streakGiorni}
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#C9A227' }}>
                {barra.gemme} gems
              </div>
            </div>
          </div>
        </div>

        {/* ── Clinical info ── */}
        <div style={CARD}>
          <div style={SECTION_TITLE}>Clinical Info</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <InfoRow label="Condition" value={paziente.patologia} />
            <InfoRow label="Surgery" value={formatDate(paziente.dataIntervento)} />
            <InfoRow label="Age" value={`${paziente.eta} years`} />
            <InfoRow label="Recovery started" value={`${daysInRecovery} day${daysInRecovery !== 1 ? 's' : ''} ago`} />
            <div style={{ borderTop: '1px solid #EEF0EA', marginTop: 4, paddingTop: 10 }}>
              <div style={{ fontSize: 12, color: '#8A9485', fontWeight: 600, marginBottom: 4 }}>Current goal</div>
              <div style={{ fontSize: 13, color: '#21281F', lineHeight: 1.5 }}>{fase.obiettivo}</div>
            </div>
          </div>
        </div>

        {/* ── Stats row ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          <StatBox label="Total RP" value={barra.rpTotali.toLocaleString()} color="#4FA8E8" />
          <StatBox label="Phase day" value={`${fase.giorniTrascorsi}`} color="#21281F" />
          <StatBox label="Multiplier" value={`×${barra.moltiplicatore.toFixed(2)}`} color="#C9A227" />
        </div>

        {/* ── Phase precautions ── */}
        {fase.precauzioni.length > 0 && (
          <div style={CARD}>
            <div style={SECTION_TITLE}>Phase Precautions</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {fase.precauzioni.map((p, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <div style={{
                    flexShrink: 0,
                    width: 6, height: 6,
                    borderRadius: '50%',
                    background: '#F59E0B',
                    marginTop: 6,
                  }} />
                  <div style={{ fontSize: 13.5, color: '#21281F', lineHeight: 1.5 }}>{p}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Badges ── */}
        <div style={CARD}>
          <div style={SECTION_TITLE}>Badges</div>
          {badges ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {badges.badge.map(b => {
                const pct = Math.min(Math.round((b.progresso / b.obiettivo) * 100), 100);
                return (
                  <div key={b.id} style={{
                    padding: '12px 14px',
                    borderRadius: 16,
                    background: b.ottenuto ? '#F0F9FF' : '#FAFBF8',
                    border: `1.5px solid ${b.ottenuto ? '#B8DCF2' : '#EEF0EA'}`,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {b.ottenuto ? (
                          <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#4FA8E8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <svg width="12" height="12" viewBox="0 0 20 20">
                              <path d="M4 10l4 4 8-9" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </div>
                        ) : (
                          <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#EEF0EA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#B3BAA9' }} />
                          </div>
                        )}
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#21281F' }}>{b.nome}</div>
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: b.ottenuto ? '#4FA8E8' : '#8A9485' }}>
                        {b.progresso}/{b.obiettivo}
                      </div>
                    </div>
                    <div style={{ fontSize: 12, color: '#8A9485', marginBottom: 8 }}>{b.descrizione}</div>
                    <div style={{ width: '100%', height: 5, borderRadius: 999, background: '#EAF1F7' }}>
                      <div style={{ height: '100%', borderRadius: 999, background: b.ottenuto ? '#4FA8E8' : '#B8DCF2', width: `${pct}%`, transition: 'width 0.4s ease' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '16px 0', color: '#8A9485', fontSize: 13 }}>Loading…</div>
          )}
        </div>

        {/* ── Pain chart ── */}
        <div style={CARD}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <div style={SECTION_TITLE}>Perceived Pain</div>
            {painBenefit?.sbloccato && (
              <select
                value={timeframe}
                onChange={e => setTimeframe(e.target.value as Timeframe)}
                style={{ border: '1.5px solid #E7EAE3', borderRadius: 10, padding: '6px 10px', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', color: '#1D74B8', background: '#EAF4FC' }}
              >
                <option value="week">Week</option>
                <option value="month">Month</option>
                <option value="3m">3 Months</option>
                <option value="6m">6 Months</option>
                <option value="year">Year</option>
              </select>
            )}
          </div>
          {painBenefit?.sbloccato ? (
            history ? (
              <>
                <div style={{ fontSize: 12, color: '#8A9485', marginBottom: 14 }}>Self-reported · 1–10 scale</div>
                <PainChart history={history.giorni} timeframe={timeframe} />
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '24px 0', color: '#8A9485', fontSize: 13 }}>Loading…</div>
            )
          ) : (
            <>
              <div style={{ fontSize: 12, color: '#8A9485', marginBottom: 6 }}>
                Unlocks at phase {painBenefit?.faseRichiesta ?? '?'}
              </div>
              {LOCK_NODE}
            </>
          )}
        </div>

        {/* ── Annual heatmap ── */}
        <div style={CARD}>
          <div style={SECTION_TITLE}>Annual Activity</div>
          {heatmapBenefit?.sbloccato ? (
            history ? (
              <>
                <div style={{ fontSize: 12, color: '#8A9485', marginBottom: 14 }}>
                  {new Date().getFullYear()} · daily plan completion
                </div>
                <Heatmap history={history.giorni} />
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '24px 0', color: '#8A9485', fontSize: 13 }}>Loading…</div>
            )
          ) : (
            <>
              <div style={{ fontSize: 12, color: '#8A9485', marginBottom: 6 }}>
                Unlocks at phase {heatmapBenefit?.faseRichiesta ?? '?'}
              </div>
              {LOCK_NODE}
            </>
          )}
        </div>

        {/* ── Saved plans ── */}
        {plans && plans.piani.length > 0 && (
          <div style={CARD}>
            <div style={SECTION_TITLE}>My Plans</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {plans.piani.map((p: PianoCreato) => {
                const isOpen = expandedPlan === p.id;
                return (
                  <div key={p.id} style={{ borderRadius: 16, border: '1.5px solid #EEF0EA', overflow: 'hidden' }}>
                    <button
                      onClick={() => setExpandedPlan(isOpen ? null : p.id)}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 14px',
                        background: isOpen ? '#F0F9FF' : '#FAFBF8',
                        border: 'none',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#21281F' }}>
                          {p.label || 'Unnamed plan'}
                        </div>
                        <div style={{ fontSize: 12, color: '#8A9485', marginTop: 2 }}>
                          {p.creatoIl} · {p.esercizi.length} exercise{p.esercizi.length !== 1 ? 's' : ''}
                          {p.farmaci.length > 0 ? ` · ${p.farmaci.length} med${p.farmaci.length !== 1 ? 's' : ''}` : ''}
                          {' · '}{p.settimane} week{p.settimane !== 1 ? 's' : ''}
                        </div>
                      </div>
                      <div style={{ fontSize: 16, color: '#8A9485', marginLeft: 8, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                        ›
                      </div>
                    </button>

                    {isOpen && (
                      <div style={{ padding: '0 14px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {/* Days */}
                        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' as const, marginTop: 10 }}>
                          {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => {
                            const on = p.giorni.includes(d);
                            return (
                              <div key={d} style={{
                                padding: '5px 9px',
                                borderRadius: 8,
                                fontSize: 11,
                                fontWeight: 700,
                                background: on ? '#EAF4FC' : '#F5F6F2',
                                color: on ? '#1D74B8' : '#B3BAA9',
                              }}>{d}</div>
                            );
                          })}
                        </div>

                        {/* Exercises */}
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#6B7566', marginTop: 4 }}>Exercises</div>
                        {p.esercizi.map(e => (
                          <div key={e.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 700, color: '#21281F' }}>{e.nome}</div>
                              <div style={{ fontSize: 11, color: '#8A9485' }}>{e.area}</div>
                            </div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: '#4FA8E8', flexShrink: 0 }}>
                              {e.serie}×{e.ripetizioni} · {e.frequenza}×/day
                            </div>
                          </div>
                        ))}

                        {/* Medications */}
                        {p.farmaci.length > 0 && (
                          <>
                            <div style={{ fontSize: 12, fontWeight: 700, color: '#6B7566', marginTop: 4 }}>Medications</div>
                            {p.farmaci.map((f, i) => (
                              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                                <div style={{ fontSize: 13, fontWeight: 700, color: '#21281F' }}>{f.nome}</div>
                                <div style={{ fontSize: 12, color: '#8A9485', textAlign: 'right' as const, flexShrink: 0 }}>
                                  {f.orari.join(', ')}
                                </div>
                              </div>
                            ))}
                          </>
                        )}

                        {/* Share link */}
                        <div style={{
                          fontFamily: 'JetBrains Mono, monospace',
                          fontSize: 12,
                          fontWeight: 700,
                          color: '#1D74B8',
                          background: '#EAF4FC',
                          borderRadius: 8,
                          padding: '7px 10px',
                          marginTop: 4,
                          letterSpacing: '0.04em',
                        }}>
                          rehub.com/plan/{p.shareId}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Redeemed vouchers ── */}
        {vouchers && vouchers.voucher.length > 0 && (
          <div style={CARD}>
            <div style={SECTION_TITLE}>Redeemed Rewards</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {vouchers.voucher.map(v => (
                <div key={v.id} style={{
                  padding: '12px 14px',
                  borderRadius: 16,
                  background: '#FAFBF8',
                  border: '1.5px solid #EEF0EA',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#21281F' }}>{v.nome}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#C9A227' }}>−{v.gemmeSpese} gems</div>
                  </div>
                  <div style={{ fontSize: 12, color: '#8A9485', marginBottom: 8 }}>{v.partner} · {v.riscattatoIl}</div>
                  <div style={{
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: 13,
                    fontWeight: 700,
                    color: '#1D74B8',
                    background: '#EAF4FC',
                    borderRadius: 8,
                    padding: '6px 10px',
                    letterSpacing: '0.08em',
                  }}>
                    {v.codice}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#8A9485', minWidth: 110, paddingTop: 1 }}>{label}</div>
      <div style={{ fontSize: 13, color: '#21281F', flex: 1 }}>{value}</div>
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      background: '#FFFFFF',
      border: '1px solid #EEF0EA',
      borderRadius: 20,
      padding: '14px 12px',
      textAlign: 'center',
      boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
    }}>
      <div style={{ fontSize: 18, fontWeight: 700, color, fontFamily: 'Poppins, sans-serif' }}>{value}</div>
      <div style={{ fontSize: 11, color: '#8A9485', fontWeight: 600, marginTop: 3 }}>{label}</div>
    </div>
  );
}
