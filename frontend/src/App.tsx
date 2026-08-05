import { useState } from 'react';
import type { RispostaStato } from '@backend/domain/types';
import { accedi, conAccount, dimenticaSessione, esci, impostaSessione } from './api';
import BottomNav from './components/BottomNav';
import LoginView from './views/LoginView';
import RegisterView from './views/RegisterView';
import HomeView from './views/HomeView';
import WorkoutView from './views/WorkoutView';
import ProfileView from './views/ProfileView';
import ShopView from './views/ShopView';
import CreatePlanView from './views/CreatePlanView';

export type View = 'login' | 'register' | 'main' | 'workout' | 'profile' | 'shop' | 'create';

export default function App() {
  const [view, setView] = useState<View>('login');
  const [stato, setStato] = useState<RispostaStato | null>(null);

  const handleLogin = async (username: string, password: string) => {
    const risposta = await accedi(username, password);
    // An account answers with a token to keep; the demo login answers with a
    // bare state and leaves the guest save file exactly as it was.
    if (conAccount(risposta)) {
      impostaSessione(risposta.token);
      setStato(risposta.stato);
    } else {
      setStato(risposta);
    }
    setView('main');
  };

  const updateStato = (s: RispostaStato) => setStato(s);

  const handleLogout = async () => {
    // Best effort: the token is being thrown away either way, and failing to
    // reach the server is not a reason to keep somebody logged in.
    try {
      await esci();
    } catch {
      /* ignore */
    }
    dimenticaSessione();
    setStato(null);
    setView('login');
  };

  const content = () => {
    if (view === 'login') return <LoginView onLogin={handleLogin} onRegister={() => setView('register')} />;
    if (view === 'register') {
      return (
        <RegisterView
          onRegistered={(s) => {
            setStato(s);
            setView('main');
          }}
          onBack={() => setView('login')}
        />
      );
    }
    if (!stato) return null;
    switch (view) {
      case 'main':    return <HomeView stato={stato} onStateUpdate={updateStato} onNavigate={setView} />;
      case 'workout': return <WorkoutView stato={stato} onStateUpdate={updateStato} />;
      case 'profile': return <ProfileView stato={stato} onLogout={handleLogout} />;
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
        {view !== 'login' && view !== 'register' && view !== 'create' && stato && (
          <BottomNav active={view} onNavigate={setView} />
        )}
      </div>
    </div>
  );
}
