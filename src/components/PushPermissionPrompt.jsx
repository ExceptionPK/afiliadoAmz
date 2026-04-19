import { useState, useEffect } from "react";
import { Bell } from "lucide-react";
import OneSignal from "react-onesignal";
import { toast } from "sonner";

const PushPermissionPrompt = ({ session }) => {
const [show, setShow] = useState(false);
  const [visible, setVisible] = useState(false);
  const [permission, setPermission] = useState(Notification.permission);

  // Solo inicializamos si hay sesión
  useEffect(() => {
    if (!session?.user?.id) {
      setShow(false);
      setVisible(false);
      return;
    }

    if (permission === "default") {
      const dismissedUntil = localStorage.getItem("push_prompt_dismissed_until");
      const shouldShow = !dismissedUntil || Date.now() > parseInt(dismissedUntil);

      if (shouldShow) {
        const timer = setTimeout(() => {
          setShow(true);
          setTimeout(() => setVisible(true), 20);
        }, 2800);
        return () => clearTimeout(timer);
      }
    }
  }, [permission, session?.user?.id]);   // ←←← Dependemos también de la sesión

  const handleEnable = async () => {
    try {
      await OneSignal.showSlidedownPrompt();
      setVisible(false);
      setTimeout(() => setShow(false), 500);

      setTimeout(async () => {
        const newPermission = await OneSignal.getPermission();
        setPermission(newPermission);

        if (newPermission === "granted") {
          toast.success("Notificaciones activadas", {
            description: "Recibe una notificación cuando bajen de precio tus favoritos.",
            duration: 4000,
          });
        }
      }, 1000);
    } catch (err) {
      console.error(err);
      toast.error("No se pudieron activar las notificaciones");
    }
  };

  const handleDismiss = () => {
    setVisible(false);
    setTimeout(() => {
      setShow(false);
      const dismissUntil = Date.now() + 24 * 60 * 60 * 1000;
      localStorage.setItem("push_prompt_dismissed_until", dismissUntil.toString());
    }, 500);
  };

  // ←←← NUEVO: No renderizamos nada si no hay sesión
  if (!session?.user?.id || !show) return null;

    return (
        <div
            className={`fixed bottom-6 left-6 z-[100] max-w-[300px] bg-white/50 border border-violet-200 
                  rounded-xl shadow-xl overflow-hidden transition-all duration-500 ease-out
                  ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
            {/* Brillo morado suave en el fondo de la caja */}
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
                    Recibe una <span className="font-semibold text-slate-700">notificación</span> cuando bajen de precio tus productos favoritos.
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

                {/* Botón Activar con shimmer blanco */}
                <button
                    onClick={handleEnable}
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
    );
};

export default PushPermissionPrompt;