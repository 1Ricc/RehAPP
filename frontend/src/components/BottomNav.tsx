import type { View } from '../App';

interface Props {
  active: View;
  onNavigate: (view: View) => void;
}

const ACCENT = '#4FA8E8';
const DIM = '#9BA89A';

function HomeIcon({ c }: { c: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H5a1 1 0 01-1-1V9.5z" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M9 21V12h6v9" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function ClipboardCheckIcon({ c }: { c: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" stroke={c} strokeWidth="2" strokeLinecap="round"/>
      <rect x="9" y="3" width="6" height="4" rx="1" stroke={c} strokeWidth="2"/>
      <path d="M9 12l2 2 4-4" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
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
  { id: 'workout', label: 'Today',   Icon: ClipboardCheckIcon },
  { id: 'profile', label: 'Profile', Icon: PersonIcon },
  { id: 'shop',    label: 'Shop',    Icon: BagIcon },
  { id: 'create',  label: 'Create',  Icon: PlusCircleIcon },
];

export default function BottomNav({ active, onNavigate }: Props) {
  return (
    <div style={{
      position: 'fixed',
      bottom: 20,
      left: '50%',
      transform: 'translateX(-50%)',
      width: 'calc(100% - 48px)',
      maxWidth: 382,
      background: 'rgba(255, 255, 255, 0.72)',
      backdropFilter: 'blur(24px) saturate(180%)',
      WebkitBackdropFilter: 'blur(24px) saturate(180%)',
      borderRadius: 28,
      border: '1px solid rgba(255, 255, 255, 0.85)',
      boxShadow: '0 8px 32px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.9)',
      display: 'flex',
      zIndex: 100,
      padding: '6px 4px',
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
              padding: '8px 4px 8px',
              background: on ? 'rgba(79,168,232,0.13)' : 'none',
              border: 'none',
              borderRadius: 20,
              cursor: 'pointer',
              color: c,
              fontFamily: 'Inter, sans-serif',
              fontSize: 10,
              fontWeight: 700,
              transition: 'background 0.15s ease',
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
