// components/OneSignalInit.jsx
import { useEffect } from "react";
import OneSignal from "react-onesignal";

const OneSignalInit = ({ session }) => {
  useEffect(() => {
    // ← Solo inicializamos si hay sesión
    if (!session?.user?.id) {
      console.log("⏸️ OneSignal: sin sesión → no inicializamos");
      return;
    }

    const initializeOneSignal = async () => {
      try {
        await OneSignal.init({
          appId: import.meta.env.VITE_ONESIGNAL_APP_ID,
          allowLocalhostAsSecureOrigin: true,
          autoResubscribe: true,
          notifyButton: { enable: false },
          promptOptions: {
            slidedown: {
              enabled: false,
              autoPrompt: false,
            },
          },
        });

        console.log("✅ OneSignal inicializado para usuario:", session.user.id);

        // Login del usuario en OneSignal (external_id)
        await OneSignal.login(session.user.id);

        console.log(`🔑 OneSignal login exitoso para: ${session.user.id}`);
      } catch (error) {
        console.error("❌ Error al inicializar OneSignal:", error);
      }
    };

    initializeOneSignal();

    // Cleanup opcional (buena práctica)
    return () => {
      // OneSignal no tiene un "destroy" oficial fácil, pero podemos desuscribir si quieres
    };
  }, [session?.user?.id]); // ← Importante: depende del user id

  return null;
};

export default OneSignalInit;