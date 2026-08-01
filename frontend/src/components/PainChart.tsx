import type { GiornoStorico } from '@backend/domain/types';

interface Props {
  history: GiornoStorico[];
  timeframe: 'week' | 'month' | '3m' | '6m' | 'year';
}

function buildPath(values: number[]): { line: string; area: string } {
  const w = 280, h = 150, n = values.length;
  if (n === 0) return { line: '', area: '' };
  const xs = values.map((_, i) => i * (w / Math.max(n - 1, 1)));
  const ys = values.map(v => h - (v / 10) * h);
  let line = `M ${xs[0]} ${ys[0]}`;
  for (let i = 1; i < n; i++) {
    const mx = (xs[i - 1] + xs[i]) / 2;
    const my = (ys[i - 1] + ys[i]) / 2;
    line += ` Q ${xs[i - 1]} ${ys[i - 1]} ${mx} ${my}`;
  }
  line += ` T ${xs[n - 1]} ${ys[n - 1]}`;
  const area = `${line} L ${xs[n - 1]} ${h} L ${xs[0]} ${h} Z`;
  return { line, area };
}

const DAYS: Record<Props['timeframe'], number> = {
  week: 7,
  month: 30,
  '3m': 90,
  '6m': 180,
  year: 365,
};

const LABELS: Record<Props['timeframe'], string> = {
  week: '7d ago',
  month: '30d ago',
  '3m': '3mo ago',
  '6m': '6mo ago',
  year: '12mo ago',
};

export default function PainChart({ history, timeframe }: Props) {
  const cutoff = DAYS[timeframe];
  const slice = history.slice(-cutoff).filter(d => d.vas !== null);

  if (slice.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '24px 0', color: '#8A9485', fontSize: 13, fontWeight: 700 }}>
        No pain data yet for this period.
      </div>
    );
  }

  const values = slice.map(d => d.vas as number);
  const { line, area } = buildPath(values);

  return (
    <>
      <svg viewBox="0 0 280 150" style={{ width: '100%', height: 'auto', display: 'block' }}>
        <defs>
          <linearGradient id="painFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6DBEF0" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#6DBEF0" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 37.5, 75, 112.5].map(y => (
          <line key={y} x1="0" y1={y} x2="280" y2={y} stroke="#F0F2EC" strokeWidth="1" />
        ))}
        <path d={area} fill="url(#painFill)" />
        <path d={line} fill="none" stroke="#4FA8E8" strokeWidth="3" strokeLinecap="round" />
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 10, color: '#B3BAA9', fontWeight: 700 }}>
        <span>{LABELS[timeframe]}</span><span>Today</span>
      </div>
    </>
  );
}
