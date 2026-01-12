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
import { useState, useEffect } from 'react';

function App() {
  const [session, setSession] = useState(null);
  const [isAuthenticating, setIsAuthenticating] = useState(true); // Controla la carga inicial
  const location = useLocation();

  const isAuthPage = location.pathname === '/auth';

  useEffect(() => {
    // 1. Carga inicial de la sesión
    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setSession(session);
      } catch (error) {
        console.error('Error al obtener sesión inicial:', error);
      } finally {
        setIsAuthenticating(false);
      }
    };

    initializeAuth();

    // 2. Listener de cambios de estado de autenticación
    const { data: listener } = supabase.auth.onAuthStateChange((_, currentSession) => {
      setSession(currentSession);
      setIsAuthenticating(false); // Ya no necesitamos loading después del primer cambio
    });

    // Cleanup
    return () => {
      listener?.subscription?.unsubscribe();
    };
  }, []);

  // Mientras estamos resolviendo si hay sesión o no → mostramos pantalla de carga
  if (isAuthenticating) {
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

      {/* Solo mostramos Navbar si NO estamos en la página de auth */}
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
          element={
            session ? <Navigate to="/" replace /> : <Navigate to="/auth" replace />
          }
        />
      </Routes>
    </>
  );
}

export default App;