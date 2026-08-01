import type { GiornoStorico } from '@backend/domain/types';

interface Props {
  history: GiornoStorico[];
}

const COLORS = ['#EAF1F7', '#B8DCF2', '#6DBEF0', '#1D74B8'];

function cellColor(entry: GiornoStorico | undefined): string {
  if (!entry) return COLORS[0];
  if (entry.tipoGiorno === 'recupero') return COLORS[1];
  if (!entry.checklistCompleta) return COLORS[0];
  const done = Object.values(entry.blocchiCompletati).filter(Boolean).length;
  const total = Object.values(entry.blocchiCompletati).length;
  if (total === 0) return COLORS[0];
  const ratio = done / total;
  if (ratio >= 1) return COLORS[3];
  if (ratio >= 0.5) return COLORS[2];
  return COLORS[1];
}

export default function Heatmap({ history }: Props) {
  const year = new Date().getFullYear();
  const start = new Date(year, 0, 1);
  const today = new Date();
  const map = new Map(history.map(d => [d.data, d]));

  const cells: { color: string; title: string }[] = [];
  for (let i = 0; i < 365; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const iso = d.toISOString().slice(0, 10);
    const isFuture = d > today;
    if (isFuture) {
      cells.push({ color: '#F5F6F2', title: iso });
    } else {
      const entry = map.get(iso);
      cells.push({ color: cellColor(entry), title: iso + (entry?.checklistCompleta ? ' · done' : '') });
    }
  }

  return (
    <>
      <div style={{
        display: 'grid',
        gridAutoFlow: 'column',
        gridTemplateRows: 'repeat(7, 9px)',
        gap: 3,
        overflowX: 'auto',
        paddingBottom: 4,
      }}>
        {cells.map((cell, i) => (
          <div
            key={i}
            title={cell.title}
            style={{ width: 9, height: 9, borderRadius: 2.5, background: cell.color }}
          />
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, marginTop: 10, fontSize: 10, color: '#B3BAA9', fontWeight: 700 }}>
        Less
        {COLORS.map(c => (
          <div key={c} style={{ width: 10, height: 10, borderRadius: 2, background: c }} />
        ))}
        More
      </div>
    </>
  );
}
