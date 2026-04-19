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
              enabled: true,
              autoPrompt: false,
            },
          },
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