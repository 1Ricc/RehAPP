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
import ChoosePlanView from './views/ChoosePlanView';

export type View =
  | 'login'
  | 'register'
  | 'choose-plan'
  | 'main'
  | 'workout'
  | 'profile'
  | 'shop'
  | 'create';

export default function App() {
  const [view, setView] = useState<View>('login');
  const [stato, setStato] = useState<RispostaStato | null>(null);

  const handleLogin = async (username: string, password: string) => {
    const risposta = await accedi(username, password);
    // An account answers with a token to keep; the demo login answers with a
    // bare state and leaves the guest save file exactly as it was.
    const nuovo = conAccount(risposta) ? risposta.stato : risposta;
    if (conAccount(risposta)) impostaSessione(risposta.token);
    setStato(nuovo);
    setView(nuovo.senzaPiano ? 'choose-plan' : 'main');
  };

  /**
   * Every state the app receives comes through here, so a state with no plan
   * can only ever land on the choose-a-plan screen. The builder is the one
   * exception: you are on your way to having a plan, and being bounced out of
   * it mid-form would make it impossible to finish.
   */
  const updateStato = (s: RispostaStato) => {
    setStato(s);
    if (s.senzaPiano && view !== 'create') setView('choose-plan');
  };

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
            setView(s.senzaPiano ? 'choose-plan' : 'main');
          }}
          onBack={() => setView('login')}
        />
      );
    }
    if (!stato) return null;
    switch (view) {
      case 'choose-plan':
        return (
          <ChoosePlanView
            onAdopted={(s) => {
              setStato(s);
              setView('main');
            }}
            onBuild={() => setView('create')}
          />
        );
      case 'main':    return <HomeView stato={stato} onStateUpdate={updateStato} onNavigate={setView} />;
      case 'workout': return <WorkoutView stato={stato} onStateUpdate={updateStato} />;
      case 'profile': return <ProfileView stato={stato} onLogout={handleLogout} />;
      case 'shop':    return <ShopView stato={stato} onStateUpdate={updateStato} />;
      // Leaving the builder with no plan yet goes back to choosing one, not to
      // a home screen that has nothing to show.
      case 'create':  return <CreatePlanView onBack={() => setView(stato.senzaPiano ? 'choose-plan' : 'main')} />;
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
        {/* Workout and Shop have nothing to show without a plan, so the nav
            stays away until there is one. */}
        {stato && !stato.senzaPiano
          && view !== 'login' && view !== 'register'
          && view !== 'create' && view !== 'choose-plan' && (
          <BottomNav active={view} onNavigate={setView} />
        )}
      </div>
    </div>
  );
}
