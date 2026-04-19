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

        // 1. Inicializar OneSignal
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

        console.log("✅ OneSignal SDK inicializado");

        if (!isMounted) return;

        // 2. Login del usuario (external_id)
        await OneSignal.login(session.user.id);
        console.log(`🔑 OneSignal login exitoso para: ${session.user.id}`);

        // 3. Listener para detectar cuando la suscripción se crea/actualiza correctamente
        const subscriptionListener = OneSignal.User.PushSubscription.addEventListener(
          "subscriptionChange",
          (event) => {
            console.log("📡 Cambio en suscripción detectado:", event);

            if (event.current?.id) {
              console.log(`✅ Suscripción creada correctamente. ID: ${event.current.id}`);
              // Aquí podrías guardar el subscription ID en tu base de datos si quieres
            }

            if (event.current?.optedIn === true) {
              console.log("✅ Usuario suscrito y listo para recibir pushes");
            }
          }
        );

        // Listener opcional para cambios de permiso
        const permissionListener = OneSignal.Notifications.addEventListener(
          "permissionChange",
          (permission) => {
            console.log(`🔄 Permiso cambiado a: ${permission}`);
          }
        );

        // Cleanup de listeners cuando se desmonta el componente
        return () => {
          console.log("🧹 Limpiando listeners de OneSignal");
          if (subscriptionListener) {
            OneSignal.User.PushSubscription.removeEventListener("subscriptionChange", subscriptionListener);
          }
          if (permissionListener) {
            OneSignal.Notifications.removeEventListener("permissionChange", permissionListener);
          }
        };

      } catch (error) {
        console.error("❌ Error al inicializar OneSignal:", error);
      }
    };

    initializeOneSignal();

    // Cleanup general del useEffect
    return () => {
      isMounted = false;
    };
  }, [session?.user?.id]);

  return null;
};

export default OneSignalInit;