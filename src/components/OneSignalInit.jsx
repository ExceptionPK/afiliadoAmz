// components/OneSignalInit.jsx
import { useEffect } from "react";
import OneSignal from "react-onesignal";

const OneSignalInit = ({ session }) => {
  useEffect(() => {
    if (!session?.user?.id) return;

    const initializeOneSignal = async () => {
      try {
        console.log(`🚀 Iniciando OneSignal para usuario: ${session.user.id}`);

        await OneSignal.init({
          appId: import.meta.env.VITE_ONESIGNAL_APP_ID,
          allowLocalhostAsSecureOrigin: true,
          autoResubscribe: true,
          notifyButton: { enable: false },
          promptOptions: {
            slidedown: { enabled: false, autoPrompt: false },
          },
        });

        console.log("✅ OneSignal SDK inicializado");

        // Delay moderado
        await new Promise(r => setTimeout(r, 800));

        await OneSignal.login(session.user.id);
        console.log(`🔑 Login exitoso para usuario: ${session.user.id}`);

        // Listener simple
        OneSignal.User.PushSubscription.addEventListener("subscriptionChange", (event) => {
          console.log("📡 SubscriptionChange:", {
            optedIn: event.current?.optedIn ?? "undefined",
            id: event.current?.id || "sin-id",
          });
        });

      } catch (error) {
        console.error("❌ Error OneSignal init:", error);
      }
    };

    initializeOneSignal();
  }, [session?.user?.id]);

  return null;
};

export default OneSignalInit;