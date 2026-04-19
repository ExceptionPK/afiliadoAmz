// components/OneSignalInit.jsx
import { useEffect } from "react";
import OneSignal from "react-onesignal";

const OneSignalInit = ({ session }) => {
  useEffect(() => {
    if (!session?.user?.id) return;

    const initializeOneSignal = async () => {
      try {
        console.log(`🚀 Iniciando OneSignal para usuario: ${session.user.id}`);

        // Forzar reset de suscripción antes de inicializar
        try {
          await OneSignal.User.PushSubscription.optOut();
          console.log("🔄 Forzado optOut de suscripción anterior");
        } catch (e) {
          console.log("No había suscripción previa para optOut");
        }

        await OneSignal.init({
          appId: import.meta.env.VITE_ONESIGNAL_APP_ID,
          allowLocalhostAsSecureOrigin: true,
          autoResubscribe: false,           // Importante: desactivado
          notifyButton: { enable: false },
          promptOptions: {
            slidedown: { enabled: false, autoPrompt: false },
          },
        });

        console.log("✅ OneSignal SDK inicializado");

        // Delay más largo para estabilizar
        await new Promise((resolve) => setTimeout(resolve, 1200));

        await OneSignal.login(session.user.id);
        console.log(`🔑 OneSignal login exitoso para: ${session.user.id}`);

        // Listener para debug
        OneSignal.User.PushSubscription.addEventListener("subscriptionChange", (event) => {
          console.log("📡 SubscriptionChange →", {
            optedIn: event.current?.optedIn,
            id: event.current?.id || "sin-id",
            token: !!event.current?.token ? "presente" : "vacío"
          });
        });

      } catch (error) {
        console.error("❌ Error al inicializar OneSignal:", error);
      }
    };

    initializeOneSignal();
  }, [session?.user?.id]);

  return null;
};

export default OneSignalInit;