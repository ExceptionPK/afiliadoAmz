// components/OneSignalInit.jsx
import { useEffect, useRef } from "react";
import OneSignal from "react-onesignal";

const OneSignalInit = ({ session }) => {
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;

    // Usamos OneSignalDeferred para evitar race conditions (recomendado por OneSignal)
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async function (OneSignalAPI) {
      try {
        await OneSignalAPI.init({
          appId: import.meta.env.VITE_ONESIGNAL_APP_ID,
          allowLocalhostAsSecureOrigin: true,
          autoResubscribe: true,
          notifyButton: { enable: false },
          promptOptions: {
            slidedown: { enabled: false, autoPrompt: false },
          },
        });

        console.log("✅ OneSignal SDK inicializado con OneSignalDeferred");
        initializedRef.current = true;
      } catch (error) {
        console.error("❌ Error init OneSignal:", error);
      }
    });
  }, []);

  // Login / Logout cuando cambia el usuario
  useEffect(() => {
    if (!initializedRef.current) return;

    window.OneSignalDeferred.push(async function (OneSignalAPI) {
      try {
        if (session?.user?.id) {
          console.log(`🔑 Login OneSignal → ${session.user.id}`);
          await OneSignalAPI.login(session.user.id);
          console.log(`✅ Login completado para ${session.user.id}`);
        } else {
          console.log("🚪 Logout OneSignal + optOut");
          await OneSignalAPI.logout();
          await OneSignalAPI.User.PushSubscription.optOut();
        }
      } catch (error) {
        console.error("Error en login/logout con Deferred:", error);
      }
    });
  }, [session?.user?.id]);

  return null;
};

export default OneSignalInit;