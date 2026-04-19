// components/OneSignalInit.jsx
import { useEffect } from "react";
import OneSignal from "react-onesignal";

const OneSignalInit = ({ session }) => {
  useEffect(() => {
    if (!session?.user?.id) {
      console.log("⏸️ OneSignal: sin sesión → no inicializamos");
      return;
    }

    let isMounted = true;

    const initializeOneSignal = async () => {
      try {
        console.log(`🚀 Iniciando OneSignal para usuario: ${session.user.id}`);

        await OneSignal.init({
          appId: import.meta.env.VITE_ONESIGNAL_APP_ID,
          allowLocalhostAsSecureOrigin: true,
          autoResubscribe: true,           // mantenemos true
          notifyButton: { enable: false },
          promptOptions: {
            slidedown: { enabled: false, autoPrompt: false },
          },
          // Opción importante para reducir operaciones automáticas conflictivas
          serviceWorkerParam: { scope: "/" },
        });

        console.log("✅ OneSignal SDK inicializado");

        // Login del usuario
        await OneSignal.login(session.user.id);
        console.log(`🔑 OneSignal login exitoso para: ${session.user.id}`);

        // Listener de cambios en la suscripción (para debug)
        const subListener = OneSignal.User.PushSubscription.addEventListener(
          "subscriptionChange",
          (event) => {
            console.log("📡 Subscription change:", {
              subscribed: event.current?.optedIn,
              id: event.current?.id,
              token: event.current?.token ? "present" : "empty",
              enabled: event.current?.enabled,
            });
          }
        );

        const permListener = OneSignal.Notifications.addEventListener(
          "permissionChange",
          (permission) => {
            console.log(`🔄 Notification permission changed to: ${permission}`);
          }
        );

        // Cleanup
        return () => {
          console.log("🧹 Limpiando listeners OneSignal");
          OneSignal.User.PushSubscription.removeEventListener("subscriptionChange", subListener);
          OneSignal.Notifications.removeEventListener("permissionChange", permListener);
        };

      } catch (error) {
        console.error("❌ Error al inicializar OneSignal:", error);
      }
    };

    initializeOneSignal();

    return () => {
      isMounted = false;
    };
  }, [session?.user?.id]);

  return null;
};

export default OneSignalInit;