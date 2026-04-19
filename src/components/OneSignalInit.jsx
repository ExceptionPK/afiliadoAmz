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
          autoResubscribe: false,
          notifyButton: { enable: false },
          promptOptions: {
            slidedown: { enabled: false, autoPrompt: false },
          },
        });

        console.log("✅ OneSignal SDK inicializado");

        // Pequeño delay controlado para dar tiempo a que se cree la suscripción
        await new Promise((resolve) => setTimeout(resolve, 600));

        await OneSignal.login(session.user.id);
        console.log(`🔑 OneSignal login exitoso para: ${session.user.id}`);

        // Listener mejorado (solo loguea cambios relevantes)
        OneSignal.User.PushSubscription.addEventListener("subscriptionChange", (event) => {
          console.log("📡 Subscription change:", {
            optedIn: event.current?.optedIn,
            subscriptionId: event.current?.id || "no-id-yet",
            tokenPresent: !!event.current?.token,
          });
        });

        OneSignal.Notifications.addEventListener("permissionChange", (permission) => {
          console.log(`🔄 Permission changed to: ${permission}`);
        });

      } catch (error) {
        console.error("❌ Error al inicializar OneSignal:", error);
      }
    };

    initializeOneSignal();

    return () => {
      console.log(`🧹 Cleanup OneSignal para usuario: ${session.user.id}`);
    };
  }, [session?.user?.id]);

  return null;
};

export default OneSignalInit;