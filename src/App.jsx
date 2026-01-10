import './App.css';
import { Toaster } from 'sonner';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import Dashboard from './pages/Home';
import History from './pages/History';
import Chat from './pages/Chat';
import Auth from './pages/Auth';
import { supabase } from './utils/supabaseClient';
import { useState, useEffect } from 'react';

function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const location = useLocation();

  useEffect(() => {
    // Sesión inicial
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // Listener de cambios
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  // Mientras carga la sesión → pantalla de carga
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Cargando...</div>;
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

      {/* Siempre mostramos Navbar, la lógica interna decide qué renderizar */}
      <Navbar session={session} />

      <Routes>
        {/* Rutas públicas */}
        <Route path="/auth" element={<Auth />} />

        {/* Ambas principales públicas */}
        <Route path="/" element={<Dashboard />} />
        <Route path="/history" element={<History />} />

        {/* Chat sigue protegido (cámbialo si también lo quieres público) */}
        <Route
          path="/chat"
          element={
            session ? <Chat /> : <Navigate to="/auth" state={{ from: location }} replace />
          }
        />

        {/* Catch-all */}
        <Route
          path="*"
          element={session ? <Navigate to="/" replace /> : <Navigate to="/auth" replace />}
        />
      </Routes>
    </>
  );
}

export default App;