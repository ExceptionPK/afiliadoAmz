// components/OneSignalInit.jsx
import { useEffect } from "react";
import OneSignal from "react-onesignal";

const OneSignalInit = ({ session }) => {
  useEffect(() => {
    if (!session?.user?.id) {
      console.log("⏸️ OneSignal: sin sesión → no inicializamos");
      return;
    }

    const initializeOneSignal = async () => {
      try {
        console.log(`🚀 Iniciando OneSignal para usuario: ${session.user.id}`);

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

        console.log("✅ OneSignal SDK inicializado correctamente");

        // Pequeño delay importante para evitar race conditions con el backend de OneSignal
        await new Promise((resolve) => setTimeout(resolve, 800));

        // Login del usuario (external user ID)
        await OneSignal.login(session.user.id);

        console.log(`🔑 OneSignal login exitoso para: ${session.user.id}`);

      } catch (error) {
        console.error("❌ Error al inicializar OneSignal:", error);
      }
    };

    initializeOneSignal();

    // Cleanup (opcional pero recomendado)
    return () => {
      // OneSignal no tiene un método destroy oficial, pero podemos limpiar listeners si fuera necesario
      console.log(`🧹 OneSignal cleanup para usuario: ${session.user.id}`);
    };
  }, [session?.user?.id]);

  return null;
};

export default OneSignalInit;