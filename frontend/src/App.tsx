import { useState } from 'react';
import type { RispostaStato } from '@backend/domain/types';
import { login } from './api';
import BottomNav from './components/BottomNav';
import LoginView from './views/LoginView';
import HomeView from './views/HomeView';
import WorkoutView from './views/WorkoutView';
import ProfileView from './views/ProfileView';
import ShopView from './views/ShopView';
import CreatePlanView from './views/CreatePlanView';

export type View = 'login' | 'main' | 'workout' | 'profile' | 'shop' | 'create';

export default function App() {
  const [view, setView] = useState<View>('login');
  const [stato, setStato] = useState<RispostaStato | null>(null);

  const handleLogin = async (username: string, password: string) => {
    const s = await login(username, password);
    setStato(s);
    setView('main');
  };

  const updateStato = (s: RispostaStato) => setStato(s);

  const content = () => {
    if (view === 'login') return <LoginView onLogin={handleLogin} />;
    if (!stato) return null;
    switch (view) {
      case 'main':    return <HomeView stato={stato} onStateUpdate={updateStato} onNavigate={setView} />;
      case 'workout': return <WorkoutView stato={stato} onStateUpdate={updateStato} />;
      case 'profile': return <ProfileView stato={stato} />;
      case 'shop':    return <ShopView stato={stato} onStateUpdate={updateStato} />;
      case 'create':  return <CreatePlanView onBack={() => setView('main')} />;
      default:        return null;
    }
  };

  return (
    <div style={{ height: '100vh', width: '100%', display: 'flex', justifyContent: 'center', background: '#EDEFEA' }}>
      <div style={{
        width: '100%',
        maxWidth: 430,
        height: '100vh',
        background: '#FFFFFF',
        position: 'relative',
        boxShadow: '0 0 40px rgba(0,0,0,0.06)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {content()}
        {view !== 'login' && view !== 'create' && stato && (
          <BottomNav active={view} onNavigate={setView} />
        )}
      </div>
    </div>
  );
}
