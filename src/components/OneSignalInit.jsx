// components/OneSignalInit.jsx
import { useEffect, useRef } from "react";
import OneSignal from "react-onesignal";

const OneSignalInit = ({ session }) => {
  const isInitialized = useRef(false);
  const isLoggingIn = useRef(false);

  // Inicializar SDK SOLO UNA VEZ
  useEffect(() => {
    if (isInitialized.current) return;

    const initSDK = async () => {
      try {
        console.log("🚀 Iniciando OneSignal SDK...");

        await OneSignal.init({
          appId: import.meta.env.VITE_ONESIGNAL_APP_ID,
          allowLocalhostAsSecureOrigin: true,
          autoResubscribe: true,
          notifyButton: { enable: false },
          promptOptions: {
            slidedown: { enabled: false, autoPrompt: false },
          },
        });

        console.log("✅ OneSignal SDK inicializado correctamente");
        isInitialized.current = true;
      } catch (error) {
        console.error("❌ Error inicializando OneSignal:", error);
      }
    };

    initSDK();
  }, []);

  // Manejar login / logout cuando cambia la sesión
  useEffect(() => {
    if (!isInitialized.current) return;

    const manageUser = async () => {
      if (isLoggingIn.current) return; // Evitar llamadas simultáneas
      isLoggingIn.current = true;

      try {
        if (session?.user?.id) {
          console.log(`🔑 Intentando login para usuario: ${session.user.id}`);

          // Pequeño delay para asegurar que el SDK esté listo después de init
          await new Promise((resolve) => setTimeout(resolve, 600));

          await OneSignal.login(session.user.id);
          console.log(`✅ Login exitoso para usuario: ${session.user.id}`);
        } else {
          console.log("🚪 No hay sesión → haciendo logout + optOut");
          await OneSignal.logout();
          // Forzamos que la subscription quede limpia para el próximo usuario
          try {
            await OneSignal.User.PushSubscription.optOut();
          } catch (e) {
            console.log("optOut no crítico:", e.message);
          }
        }
      } catch (error) {
        console.error("❌ Error en login/logout OneSignal:", error);
        // Si falla el login, intentamos de nuevo una sola vez
        if (session?.user?.id && error.message?.includes("undefined")) {
          console.log("🔄 Reintentando login después de error...");
          await new Promise((r) => setTimeout(r, 800));
          try {
            await OneSignal.login(session.user.id);
            console.log("✅ Reintento de login exitoso");
          } catch (retryErr) {
            console.error("Reintento también falló:", retryErr);
          }
        }
      } finally {
        isLoggingIn.current = false;
      }
    };

    manageUser();
  }, [session?.user?.id]);

  return null;
};

export default OneSignalInit;