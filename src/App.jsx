import './App.css';
import { Toaster } from 'sonner';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import Dashboard from './pages/Home';
import History from './pages/History';
import Chat from './pages/Chat';
import Auth from './pages/Auth';
import LoadingScreen from './components/LoadingScreen';
import { supabase } from './utils/supabaseClient';
import { useState, useEffect, useRef } from 'react';

function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const prevSessionRef = useRef(null);
  const location = useLocation();

  useEffect(() => {
    // Carga inicial de sesión
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      prevSessionRef.current = session;
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      const wasLoggedOut = !prevSessionRef.current;
      const isNowLoggedIn = !!currentSession;

      // Caso: acaba de hacer login (de no tener sesión → tenerla)
      if (wasLoggedOut && isNowLoggedIn) {
        // Retrasamos la actualización del estado para que se vea el loading
        const timer = setTimeout(() => {
          setSession(currentSession);
          prevSessionRef.current = currentSession;
          setLoading(false);
        }, 1400); // ← 1.4 segundos, puedes bajarlo a 1000 o subirlo a 1800

        return () => clearTimeout(timer);
      }

      // Todos los demás casos (refresh, logout, etc)
      setSession(currentSession);
      prevSessionRef.current = currentSession;
      setLoading(false);
    });

    return () => listener?.subscription?.unsubscribe();
  }, []);

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <>
      <Toaster
        position="top-center"
        richColors
        duration={2000}
        toastOptions={{
          classNames: {
            toast: "justify-start",
            title: "!text-center",
            description: "!text-center",
            content: "flex-1 text-center",
          }
        }}
      />

      <Navbar session={session} />

      <Routes>
        <Route path="/auth" element={<Auth />} />

        <Route path="/" element={<Dashboard />} />
        <Route path="/history" element={<History />} />

        <Route
          path="/chat"
          element={
            session ? <Chat /> : <Navigate to="/auth" state={{ from: location }} replace />
          }
        />

        <Route
          path="*"
          element={session ? <Navigate to="/" replace /> : <Navigate to="/auth" replace />}
        />
      </Routes>
    </>
  );
}

export default App;