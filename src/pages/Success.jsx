import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { CheckCircle2, Sparkles, ArrowRight } from 'lucide-react';
import LoadingScreenCore from '../components/LoadingScreenCore';   // ← Importamos tu componente
import MagicParticles from '../components/MagicParticles';

export default function Success() {
  const [searchParams] = useSearchParams();
  const [isLoading, setIsLoading] = useState(true);
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    // Simulamos verificación del pago
    const timer = setTimeout(() => {
      setIsLoading(false);
      setTimeout(() => setShowContent(true), 250);
    }, 1600); // Tiempo ideal para que se vea bien la animación

    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      <MagicParticles />

      <div className="min-h-screen flex items-center justify-center pt-20 pb-12">
        <div className="w-full max-w-md mx-auto">

          <div 
            className={`
              contenedorCosas bg-white border border-slate-200 
              shadow-xl shadow-slate-900/10 rounded-3xl 
              p-8 md:p-10
              transition-all duration-700 ease-out
              ${showContent ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}
            `}
          >
            {isLoading ? (
              /* Usamos tu componente LoadingScreenCore */
              <div className="py-10 flex justify-center">
                <LoadingScreenCore />
              </div>
            ) : (
              /* Contenido de éxito - muy comprimido */
              <div className="text-center">
                {/* Icono éxito */}
                <div className="mx-auto w-20 h-20 bg-emerald-100 rounded-2xl flex items-center justify-center mb-6 contenedorCosas">
                  <CheckCircle2 className="w-11 h-11 text-emerald-600" strokeWidth={3} />
                </div>

                <h1 className="text-3xl font-bold text-slate-900 tracking-tight mb-2">
                  ¡Todo listo!
                </h1>

                <div className="flex items-center justify-center gap-2 mb-6">
                  <p className="text-emerald-600 font-semibold text-xl">Pago confirmado</p>
                  <Sparkles className="w-5 h-5 text-amber-500" />
                </div>

                <p className="text-slate-600 text-base mb-9">
                  Tu suscripción se ha activado correctamente.
                </p>

                {/* Beneficios compactos */}
                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 mb-9 text-left contenedorCosas">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="w-4 h-4 text-violet-600" />
                    <p className="font-medium text-sm text-slate-700">Ahora tienes:</p>
                  </div>
                  <ul className="space-y-2.5 text-sm text-slate-600">
                    <li className="flex items-start gap-2.5">
                      <div className="w-4 h-4 bg-emerald-100 rounded flex items-center justify-center mt-0.5 flex-shrink-0">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600 stroke-[3.5]" />
                      </div>
                      Funciones premium activadas
                    </li>
                    <li className="flex items-start gap-2.5">
                      <div className="w-4 h-4 bg-emerald-100 rounded flex items-center justify-center mt-0.5 flex-shrink-0">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600 stroke-[3.5]" />
                      </div>
                      Historial ilimitado + IA avanzada
                    </li>
                    <li className="flex items-start gap-2.5">
                      <div className="w-4 h-4 bg-emerald-100 rounded flex items-center justify-center mt-0.5 flex-shrink-0">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600 stroke-[3.5]" />
                      </div>
                      Soporte prioritario
                    </li>
                  </ul>
                </div>

                {/* Botones */}
                <div className="space-y-3">
                  <Link
                    to="/"
                    className={`
                      block w-full py-3.5 bg-violet-600 hover:bg-violet-700 
                      text-white font-semibold text-base rounded-2xl contenedorCosas
                      shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2
                    `}
                  >
                    Ir al Inicio
                    <ArrowRight className="w-4 h-4" />
                  </Link>

                  <Link
                    to="/planes"
                    className={`
                      block w-full py-3 text-center font-medium text-sm contenedorCosas
                      border border-slate-300 hover:border-slate-400 text-slate-700 
                      rounded-2xl transition-all hover:bg-slate-50
                    `}
                  >
                    Ver mis planes
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}