import { useState, useEffect } from "react";
import { Bell } from "lucide-react";
import OneSignal from "react-onesignal";
import { toast } from "sonner";
import { supabase } from '../utils/supabaseClient';

const PushPermissionPrompt = ({ session }) => {
    const [show, setShow] = useState(false);
    const [visible, setVisible] = useState(false);
    const [loading, setLoading] = useState(false);

    // Reset cuando cambia de usuario
    useEffect(() => {
        setShow(false);
        setVisible(false);
    }, [session?.user?.id]);

    useEffect(() => {
        if (!session?.user?.id) return;

        const checkPromptStatus = async () => {
            try {
                // 1. Obtener preferencia del usuario (si quiere recibir notificaciones)
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('push_notifications')
                    .eq('id', session.user.id)
                    .maybeSingle();

                const userWantsNotifications = profile?.push_notifications === true;

                // 2. Estado real del dispositivo actual
                const permission = await OneSignal.Notifications.permission;
                const isSubscribed = await OneSignal.User.PushSubscription.optedIn || false;

                console.log(`Dispositivo actual → User wants: ${userWantsNotifications}, Subscribed: ${isSubscribed}, Permission: ${permission}`);

                // Mostrar prompt si:
                // - El usuario quiere notificaciones (o nunca lo configuró)
                // - Y este dispositivo NO está suscrito todavía
                if (userWantsNotifications === false || !isSubscribed) {
                    console.log("🔔 Mostrando prompt porque este dispositivo no está suscrito");
                    setTimeout(() => {
                        setShow(true);
                        setTimeout(() => setVisible(true), 300);
                    }, 2200);
                } else {
                    console.log("⏭️ Prompt omitido: este dispositivo ya está suscrito");
                }
            } catch (err) {
                console.error("Error checking prompt status:", err);
            }
        };

        const timer = setTimeout(checkPromptStatus, 1200);
        return () => clearTimeout(timer);
    }, [session?.user?.id]);

    const handleEnable = async () => {
        setLoading(true);
        try {
            console.log("🔄 Solicitando permiso...");

            // Aseguramos login antes de pedir permiso
            await OneSignal.login(session.user.id);

            const granted = await OneSignal.Notifications.requestPermission();

            console.log("Resultado requestPermission:", granted);

            if (granted) {
                // Guardamos que el usuario quiere notificaciones
                await supabase.from('profiles').upsert({
                    id: session.user.id,
                    push_notifications: true,
                    push_enabled_at: new Date().toISOString()
                });

                toast.success("✅ Notificaciones activadas en este dispositivo");
                setShow(false);
            } else {
                toast.info("Notificaciones bloqueadas por el navegador");
                setShow(false);
            }
        } catch (err) {
            console.error("Error en requestPermission:", err);
            toast.error("Error al activar. Recarga la página e inténtalo de nuevo.");
        } finally {
            setLoading(false);
        }
    };

    const handleDismiss = () => {
        setVisible(false);
        setTimeout(() => setShow(false), 500);
    };

    if (!session?.user?.id || !show) return null;

    return (
        <div className={`fixed bottom-6 left-6 z-[100] max-w-[300px] bg-white/95 backdrop-blur-xl border border-violet-200 
                    rounded-2xl shadow-2xl overflow-hidden transition-all duration-500
                    ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>

            <div className="flex justify-center pt-3 pb-2 border-b border-violet-100">
                <div className="w-10 h-10 bg-violet-100 rounded-2xl flex items-center justify-center">
                    <Bell className="w-6 h-6 text-violet-600" />
                </div>
            </div>

            <div className="px-5 py-5 text-center">
                <p className="text-slate-700 text-[15px]">
                    ¿Quieres recibir <span className="font-semibold">notificaciones</span> cuando bajen de precio tus productos favoritos?
                </p>
            </div>

            <div className="flex border-t border-violet-100 bg-violet-50 px-4 py-3 gap-2">
                <button
                    onClick={handleDismiss}
                    className="flex-1 py-2.5 text-sm font-medium text-slate-600 bg-white hover:bg-slate-100 rounded-xl transition"
                >
                    Ahora no
                </button>
                <button
                    onClick={handleEnable}
                    disabled={loading}
                    className="flex-1 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-400 text-white text-sm font-semibold rounded-xl transition"
                >
                    {loading ? "Activando..." : "Activar ahora"}
                </button>
            </div>
        </div>
    );
};

export default PushPermissionPrompt;