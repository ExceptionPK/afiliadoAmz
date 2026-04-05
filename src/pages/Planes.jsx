import React, { useState, useEffect } from 'react';
import { Check, Sparkles } from 'lucide-react';
import MagicParticles from '../components/MagicParticles';

// PriceCounter sin cambios
const PriceCounter = ({ target, duration = 700 }) => {
  const [displayValue, setDisplayValue] = useState('0');

  useEffect(() => {
    const numericTarget = Number(target.replace(',', '.'));
    if (isNaN(numericTarget)) {
      setDisplayValue(target);
      return;
    }

    let current = 0;
    const steps = duration / 16;
    const increment = numericTarget / steps;

    const timer = setInterval(() => {
      current += increment;
      if (current >= numericTarget) {
        setDisplayValue(numericTarget.toLocaleString('es-ES', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }));
        clearInterval(timer);
      } else {
        setDisplayValue(current.toLocaleString('es-ES', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }));
      }
    }, 16);

    return () => clearInterval(timer);
  }, [target, duration]);

  return <span>{displayValue}</span>;
};

export default function Planes() {
  const [isYearly, setIsYearly] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Función principal para pagar con Stripe
  const handleSubscribe = async (planName) => {
    const planKey = planName.toLowerCase() === 'profesional' ? 'pro' : 'premier';
    const billing = isYearly ? 'yearly' : 'monthly';

    // Guardamos qué plan está cargando
    setLoadingPlan(planName);

    console.log(`→ Iniciando pago: ${planName} (${planKey} - ${billing})`);

    try {
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planKey, billing }),
      });

      const data = await response.json();

      if (response.ok && data.url) {
        console.log('Redirigiendo a Stripe →', data.url);
        window.location.href = data.url;   // Redirección inmediata
      } else {
        console.error('Error del servidor:', data);
        alert(data.error || 'Error al procesar el pago. Inténtalo de nuevo.');
      }
    } catch (error) {
      console.error('❌ Error en la petición:', error);
      alert('Hubo un problema de conexión. Por favor, inténtalo más tarde.');
    } finally {
      setLoadingPlan(null);   // ← Importante: siempre liberamos el estado
    }
  };

  const plans = [
    {
      name: 'Gratis',
      priceMonthly: '0',
      priceYearly: '0',
      description: 'Prueba todo sin compromiso',
      features: [
        'Enlaces afiliados ilimitados',
        'Historial últimos 30 días',
        'Recomendaciones básicas',
        'Soporte por email',
      ],
      variant: 'outline',
      popular: false,
      isCurrent: true,
    },
    {
      name: 'Profesional',
      priceMonthly: '4,99',
      priceYearly: '49,90',
      description: 'Para afiliados serios y constantes',
      features: [
        'Todo de Gratis',
        'Historial ilimitado + búsqueda',
        'Recomendaciones IA avanzada',
        'Estadísticas y exportación',
        'Soporte prioritario 24h',
        'Enlaces sin marca de agua',
      ],
      buttonText: 'Comprar',
      variant: 'primary',
      popular: true,
      isCurrent: false,
    },
    {
      name: 'Premier',
      priceMonthly: '12,90',
      priceYearly: '129',
      description: 'Máximo rendimiento y ventajas exclusivas',
      features: [
        'Todo de Profesional',
        'Funciones beta anticipadas',
        'API privada',
        'Soporte VIP (chat + WA)',
        'Asesoría mensual 1:1',
        'Dominio propio tracking',
        'Hasta 5 cuentas',
      ],
      buttonText: 'Comprar',
      variant: 'premium',
      popular: false,
      isCurrent: false,
    },
  ];

  return (
    <>
      <MagicParticles />

      <div className="min-h-screen flex items-center justify-center md:pt-14 pt-20 pb-12 px-4 sm:px-6">
        <div className="w-full max-w-6xl mx-auto">

          {/* Toggle */}
          <div className="flex justify-center md:mb-14 mb-6">
            <div className={`
              inline-flex items-center bg-white/70 backdrop-blur-lg border border-slate-200 
              contenedorCosas p-1 shadow-md
              transition-all duration-500 ease-out
              ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}
            `}>
              <button
                onClick={() => setIsYearly(false)}
                className={`px-5 py-1.5 text-sm font-medium rounded transition-all duration-200 contenedorCosas
                  ${!isYearly ? 'bg-violet-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100/70'}`}
              >
                Mensual
              </button>
              <button
                onClick={() => setIsYearly(true)}
                className={`px-5 py-1.5 text-sm font-medium rounded transition-all duration-200 contenedorCosas
                  ${isYearly ? 'bg-violet-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100/70'}`}
              >
                Anual <span className="text-xs opacity-75">(-17%)</span>
              </button>
            </div>
          </div>

          {/* Tarjetas */}
          <div className={`grid md:grid-cols-3 gap-6 transition-all duration-700 ${mounted ? 'opacity-100' : 'opacity-0'}`}>
            {plans.map((plan, index) => {
              const priceValue = isYearly ? plan.priceYearly : plan.priceMonthly;
              const period = isYearly ? '/año' : '/mes';
              const isFree = plan.name === 'Gratis';

              return (
                <div
                  key={plan.name}
                  className={`
                    relative contenedorCosas border bg-white/80 backdrop-blur-xl 
                    shadow-xl shadow-slate-900/10 
                    transition-all duration-500 ease-out
                    hover:shadow-2xl hover:shadow-violet-500/20 hover:-translate-y-0.5
                    flex flex-col w-full
                    ${plan.popular ? 'border-violet-400/50 md:scale-105 ring-1 ring-violet-400/20' : 'border-slate-200/60'}
                    ${plan.isCurrent ? 'ring-2 ring-emerald-400/30' : ''}
                    ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}
                  `}
                  style={{ transitionDelay: `${index * 120}ms` }}
                >
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-violet-600 to-purple-600 text-white text-xs font-semibold shadow-md flex items-center gap-1.5 contenedorCosas">
                      <Sparkles className="w-3.5 h-3.5" />
                      Popular
                    </div>
                  )}

                  {plan.isCurrent && (
                    <div className="absolute -top-3 right-4 px-3 py-1 bg-emerald-600/90 text-white text-xs font-medium shadow-sm contenedorCosas">
                      Actual
                    </div>
                  )}

                  <div className="p-5 sm:p-6 flex flex-col flex-grow">
                    <h3 className="text-xl font-bold text-slate-800 mb-2">{plan.name}</h3>
                    <p className="text-slate-600 text-sm leading-relaxed mb-5">{plan.description}</p>

                    <div className="flex items-baseline mb-6">
                      <span className="text-4xl sm:text-5xl font-extrabold text-slate-900">
                        <PriceCounter target={priceValue} duration={700} />
                      </span>
                      <span className="ml-2 text-lg font-medium text-slate-500">€{period}</span>
                    </div>

                    <ul className="space-y-2.5 text-left mb-8 flex-grow">
                      {plan.features.map((feature, i) => (
                        <li key={i} className="flex items-start gap-2.5 text-slate-700 text-sm">
                          <div className="relative flex-shrink-0">
                            <div className="w-5 h-5 contenedorCosas bg-emerald-100 flex items-center justify-center">
                              <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" />
                            </div>
                          </div>
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>

                    <div className="mt-auto pt-4 min-h-[52px]">
                      {!plan.isCurrent && (
                        <button
                          onClick={() => handleSubscribe(plan.name)}
                          disabled={loadingPlan !== null}
                          className={`
                          block w-full py-3 text-center font-medium text-base contenedorCosas
                          !text-white hover:!text-white focus:!text-white active:!text-white
                          transition-all duration-300 ease-out
                          bg-violet-600 hover:bg-violet-700 shadow-md hover:shadow-lg rounded-md
                          disabled:opacity-70 disabled:cursor-not-allowed
                        `}
                        >
                          {loadingPlan === plan.name
                            ? 'Procesando pago...'
                            : (plan.buttonText || 'Seleccionar plan')}
                        </button>
                      )}

                      {plan.isCurrent && !isFree && (
                        <div className="w-full py-3 text-center font-medium text-base bg-emerald-50/80 text-emerald-800 border border-emerald-200 contenedorCosas rounded-md">
                          Plan activo
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="md:mt-12 md:mb-0 -mb-10 mt-6 text-center text-slate-600 font-medium text-sm">
            Sin permanencia • Cancela cuando quieras
          </div>
        </div>
      </div>
    </>
  );
}