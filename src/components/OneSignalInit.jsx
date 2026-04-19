import { useEffect } from "react";
import OneSignal from "react-onesignal";

const OneSignalInit = () => {
  useEffect(() => {
    const initialize = async () => {
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

          // === CONFIGURACIONES IMPORTANTES PARA PC (Chrome/Firefox) ===
          serviceWorkerPath: "/OneSignalSDKWorker.js",
          serviceWorkerParam: { scope: "/" },

          persistNotification: true,

          // Ayuda a estabilizar la creación de suscripciones en desktop
          subscriptionOptions: {
            enableOnSession: true,
          },

          // Reduce errores ruidosos de OneSignal
          // OneSignal.Debug.setLogLevel("Error");   // Descomenta si quieres menos ruido en consola
        });

        console.log("✅ OneSignal inicializado correctamente");
      } catch (error) {
        console.error("❌ Error al inicializar OneSignal:", error);
      }
    };

    initialize();
  }, []);

  return null;
};

export default OneSignalInit;