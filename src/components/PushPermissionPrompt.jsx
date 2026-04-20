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
            // Fuerza login justo antes de pedir permiso (importante)
            if (session?.user?.id) {
                await OneSignal.login(session.user.id);
            }

            const granted = await OneSignal.Notifications.requestPermission();

            if (granted) {
                await supabase.from('profiles').upsert({
                    id: session.user.id,
                    push_notifications: true,
                    push_enabled_at: new Date().toISOString(),
                });

                toast.success("Notificaciones activadas");
                setShow(false);
            } else {
                toast.info("Notificaciones denegadas por el navegador");
                setShow(false);
            }
        } catch (err) {
            console.error("Error activando notificaciones:", err);
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
        <>
            {/* ====================== MÓVIL - Barra superior ====================== */}
            <div className="md:hidden">
                <div
                    className={`fixed top-0 left-0 right-0 z-[100] bg-white border-b border-violet-200 shadow-md
                        transition-all duration-500 ease-out ${visible ? 'translate-y-0' : '-translate-y-full'}`}
                >

                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-violet-300/30 to-transparent 
                  -skew-x-12 pointer-events-none animate-shimmer" />
                    <div className="flex items-start gap-3 px-4 py-4">
                        {/* Texto + Botones */}
                        <div className="flex-1">
                            <p className="text-sm text-slate-700 leading-tight">
                                <span className="font-semibold text-slate-700">Recibe una notificación</span> cuando bajen de precio tus productos favoritos.
                            </p>

                            <div className="flex gap-2 mt-3">
                                <button
                                    onClick={handleDismiss}
                                    className="flex-1 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 contenedorCosas transition-colors"
                                >
                                    Ahora no
                                </button>
                                <button
                                    onClick={handleEnable}
                                    disabled={loading}
                                    className="flex-1 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold contenedorCosas transition-all active:scale-[0.97] flex items-center justify-center gap-1.5"
                                >
                                    <Bell className="w-4 h-4" />
                                    Activar
                                </button>
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent 
                              -skew-x-12 pointer-events-none animate-shimmer" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ====================== DESKTOP - Tu diseño original exacto ====================== */}
            <div className="hidden md:block">
                <div
                    className={`fixed bottom-6 left-6 z-[100] max-w-[300px] bg-white/50 border border-violet-200 
                        rounded-xl shadow-xl overflow-hidden transition-all duration-500 ease-out
                        ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
                >
                    {/* Brillo morado suave */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-violet-300/25 to-transparent 
                              -skew-x-12 pointer-events-none animate-shimmer" />

                    {/* Cabecera - Solo icono centrado */}
                    <div className="flex justify-center pt-2 pb-2 border-b border-violet-100 relative z-10">
                        <div className="w-9 h-9 bg-violet-100 rounded-2xl flex items-center justify-center">
                            <Bell className="w-5 h-5 text-violet-600" />
                        </div>
                    </div>

                    {/* Texto */}
                    <div className="px-4 py-4 text-center relative z-10">
                        <p className="text-slate-600 text-sm leading-[1.4]">
                            <span className="font-semibold text-slate-700">Recibe una notificación</span> cuando bajen de precio tus productos favoritos.
                        </p>
                    </div>

                    {/* Botones */}
                    <div className="flex border-t border-violet-100 bg-violet-50/70 px-4 py-3 gap-2 relative z-10">
                        <button
                            onClick={handleDismiss}
                            className="flex-1 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 contenedorCosas transition-colors"
                        >
                            Ahora no
                        </button>

                        <button
                            onClick={handleEnable}
                            disabled={loading}
                            className="flex-1 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold contenedorCosas transition-all active:scale-[0.97] flex items-center justify-center gap-1.5 overflow-hidden relative group"
                        >
                            <Bell className="w-4 h-4" />
                            Activar

                            {/* Shimmer blanco dentro del botón */}
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent 
                                  -skew-x-12 pointer-events-none animate-shimmer" />
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
};

export default PushPermissionPrompt;