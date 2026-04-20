// components/OneSignalInit.jsx
import { useEffect, useRef } from "react";
import OneSignal from "react-onesignal";

const OneSignalInit = ({ session }) => {
  const initialized = useRef(false);

  // 1. Inicializar SDK SOLO UNA VEZ (al montar la app)
  useEffect(() => {
    if (initialized.current) return;

    const initialize = async () => {
      try {
        await OneSignal.init({
          appId: import.meta.env.VITE_ONESIGNAL_APP_ID,
          allowLocalhostAsSecureOrigin: true,
          autoResubscribe: true,
          notifyButton: { enable: false },
          promptOptions: {
            slidedown: { enabled: false, autoPrompt: false },
          },
        });
        console.log("✅ OneSignal SDK inicializado (UNA sola vez)");
        initialized.current = true;
      } catch (error) {
        console.error("❌ Error al inicializar OneSignal:", error);
      }
    };

    initialize();
  }, []);

  // 2. Login / Logout cuando cambia la sesión
  useEffect(() => {
    if (!initialized.current) return; // esperar a que init termine

    const handleAuthChange = async () => {
      try {
        if (session?.user?.id) {
          // Pequeño delay para evitar race condition con logout anterior
          await new Promise((r) => setTimeout(r, 500));
          await OneSignal.login(session.user.id);
          console.log(`🔑 OneSignal login exitoso → usuario ${session.user.id}`);
        } else {
          await OneSignal.logout();
          // Opcional pero recomendado: fuerza que la próxima suscripción sea "limpia"
          await OneSignal.User.PushSubscription.optOut();
          console.log("🚪 OneSignal logout + optOut ejecutado");
        }
      } catch (err) {
        console.error("Error en login/logout OneSignal:", err);
      }
    };

    handleAuthChange();
  }, [session?.user?.id]);

  return null;
};

export default OneSignalInit;