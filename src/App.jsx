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

  // Detectamos si estamos en la página de autenticación
  const isAuthPage = location.pathname === '/auth';

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

      // Caso: nuevo login detectado
      if (wasLoggedOut && isNowLoggedIn) {
        const timer = setTimeout(() => {
          setSession(currentSession);
          prevSessionRef.current = currentSession;
          setLoading(false);
        }, 1400); // ajusta este tiempo según prefieras

        return () => clearTimeout(timer);
      }

      // Resto de casos
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

      {/* Solo mostramos el Navbar si NO estamos en /auth */}
      {!isAuthPage && <Navbar session={session} />}

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