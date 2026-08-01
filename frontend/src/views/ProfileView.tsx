import { useState, useEffect } from 'react';
import type { RispostaStato, RispostaStorico } from '@backend/domain/types';
import { getHistory } from '../api';
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

const LOCK_NODE = (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '24px 0', color: '#8A9485', fontSize: 13, fontWeight: 700 }}>
    <svg width="24" height="24" viewBox="0 0 24 24">
      <rect x="5" y="10" width="14" height="10" rx="2" fill="none" stroke="#B3BAA9" strokeWidth="2" />
      <path d="M8 10V7a4 4 0 018 0v3" fill="none" stroke="#B3BAA9" strokeWidth="2" />
    </svg>
    Unlock in the Shop 🔒
  </div>
);

export default function ProfileView({ stato }: Props) {
  const { profilo, barra, benefit } = stato;
  const [history, setHistory] = useState<RispostaStorico | null>(null);
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
    getHistory(400)
      .then(setHistory)
      .catch(() => { /* non-blocking */ });
  }, []);

  return (
    <>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #EEF0EA' }}>
        <div style={{ fontFamily: 'Poppins, sans-serif', fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em', color: '#21281F' }}>
          Profile
        </div>
      </div>

      <div style={{ flex: 1, padding: 20, display: 'flex', flexDirection: 'column', gap: 18, paddingBottom: 100 }}>

        {/* User card */}
        <div style={CARD}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
              <div style={{
                width: 52, height: 52,
                borderRadius: '50%',
                background: '#2E3A2E',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: 17,
                flexShrink: 0,
              }}>
                {initials}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: profilo.colore }}>{profilo.nome}</div>
                <div style={{ fontSize: 13, color: '#8A9485' }}>
                  Phase {stato.fase.numero} · {profilo.etichettaColore}
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
        </div>

        {/* Pain chart */}
        <div style={CARD}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <div style={{ fontFamily: 'Poppins, sans-serif', fontSize: 16, fontWeight: 600, color: '#21281F' }}>
              Perceived Pain
            </div>
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

        {/* Annual heatmap */}
        <div style={CARD}>
          <div style={{ fontFamily: 'Poppins, sans-serif', fontSize: 16, fontWeight: 600, color: '#21281F', marginBottom: 2 }}>
            Annual Activity
          </div>
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

      </div>
    </>
  );
}
