import './App.css';
import { Toaster } from 'sonner';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import Dashboard from './pages/Home';
import History from './pages/History';
import Chat from './pages/Chat';
import Auth from './pages/Auth';
import Planes from './pages/Planes';
import Success from './pages/Success';
import ChatWidget from './components/ChatWidget';
import LoadingScreen from './components/LoadingScreen';
import OneSignalInit from './components/OneSignalInit';
import PushPermissionPrompt from './components/PushPermissionPrompt';
import OneSignal from "react-onesignal";
import { supabase } from './utils/supabaseClient';
import { useState, useEffect } from 'react';

function App() {
  const [session, setSession] = useState(null);
  const [isAuthenticating, setIsAuthenticating] = useState(true); // Controla la carga inicial
  const location = useLocation();

  const isAuthPage = location.pathname === '/auth';

  // ==================== ONESIGNAL LOGIN / LOGOUT ====================
  useEffect(() => {
    const handleOneSignalAuth = async () => {
      // Espera más generosa para que OneSignalInit termine completamente
      await new Promise(resolve => setTimeout(resolve, 300));

      if (!session?.user?.id) {
        // Logout
        try {
          await OneSignal.logout();
          console.log("✅ OneSignal.logout() ejecutado correctamente");
        } catch (err) {
          console.warn("OneSignal.logout() falló (puede ser normal):", err.message || err);
        }
        return;
      }

      // Login con nuevo usuario
      try {
        const isInitialized = await OneSignal.isInitialized?.();
        if (!isInitialized) {
          await new Promise(r => setTimeout(r, 1000));
        }

        await OneSignal.login(session.user.id);
        console.log(`🔑 OneSignal.login() correcto para usuario: ${session.user.id}`);
      } catch (err) {
        const errorMsg = err.message || JSON.stringify(err);

        if (errorMsg.includes("user-2") || errorMsg.includes("409") || errorMsg.includes("Aliases claimed")) {
          // Este error es esperado al cambiar de cuenta
          console.warn(`⚠️ OneSignal 409 / user-2 (normal al cambiar de usuario): ${errorMsg}`);
        } else {
          console.error("Error real en OneSignal.login():", err);
        }
      }
    };

    handleOneSignalAuth();
  }, [session?.user?.id]);

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

      <OneSignalInit />
      <PushPermissionPrompt session={session} />
      <ChatWidget />

      {/* Solo mostramos Navbar si NO estamos en la página de auth */}
      {!isAuthPage && <Navbar session={session} />}

      <Routes>
        <Route path="/auth" element={<Auth />} />

        <Route path="/" element={<Dashboard />} />
        <Route path="/history" element={<History />} />
        <Route path="/planes" element={<Planes />} />
        <Route path="/success" element={<Success />} />

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