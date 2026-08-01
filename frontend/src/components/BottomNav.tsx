import type { View } from '../App';

interface Props {
  active: View;
  onNavigate: (view: View) => void;
}

const ACCENT = '#4FA8E8';
const DIM = '#B3BAA9';

function HomeIcon({ c }: { c: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H5a1 1 0 01-1-1V9.5z" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M9 21V12h6v9" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function DumbbellIcon({ c }: { c: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M6.5 6.5h.01M17.5 6.5h.01M6.5 17.5h.01M17.5 17.5h.01M4 12h16" stroke={c} strokeWidth="2" strokeLinecap="round"/>
      <rect x="4" y="9.5" width="2" height="5" rx="1" stroke={c} strokeWidth="2"/>
      <rect x="18" y="9.5" width="2" height="5" rx="1" stroke={c} strokeWidth="2"/>
      <rect x="2" y="7.5" width="2" height="9" rx="1" stroke={c} strokeWidth="2"/>
      <rect x="20" y="7.5" width="2" height="9" rx="1" stroke={c} strokeWidth="2"/>
    </svg>
  );
}

function PersonIcon({ c }: { c: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="8" r="4" stroke={c} strokeWidth="2"/>
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke={c} strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

function BagIcon({ c }: { c: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M3 6h18M16 10a4 4 0 01-8 0" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function PlusCircleIcon({ c }: { c: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke={c} strokeWidth="2"/>
      <path d="M12 8v8M8 12h8" stroke={c} strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

const TABS: { id: View; label: string; Icon: (p: { c: string }) => JSX.Element }[] = [
  { id: 'main',    label: 'Home',    Icon: HomeIcon },
  { id: 'workout', label: 'Workout', Icon: DumbbellIcon },
  { id: 'profile', label: 'Profile', Icon: PersonIcon },
  { id: 'shop',    label: 'Shop',    Icon: BagIcon },
  { id: 'create',  label: 'Create',  Icon: PlusCircleIcon },
];

export default function BottomNav({ active, onNavigate }: Props) {
  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: '50%',
      transform: 'translateX(-50%)',
      width: '100%',
      maxWidth: 430,
      background: '#FFFFFF',
      borderTop: '1px solid #EEF0EA',
      display: 'flex',
      zIndex: 100,
    }}>
      {TABS.map(({ id, label, Icon }) => {
        const on = id === active;
        const c = on ? ACCENT : DIM;
        return (
          <button
            key={id}
            onClick={() => onNavigate(id)}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 3,
              padding: '10px 0 14px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: c,
              fontFamily: 'Inter, sans-serif',
              fontSize: 10,
              fontWeight: 700,
            }}
          >
            <Icon c={c} />
            {label}
          </button>
        );
      })}
    </div>
  );
}
