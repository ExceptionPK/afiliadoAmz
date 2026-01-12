import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../utils/supabaseClient";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import MagicParticles from "../components/MagicParticles";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Lock, Eye, EyeOff, ArrowLeft, X, Check } from "lucide-react";
import { Suspense } from 'react';
import Spline from '@splinetool/react-spline';
import { useMediaQuery } from 'react-responsive';

const GoogleLogo = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
);

const Loader = () => (
  <motion.div
    className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"
    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
  />
);

const Auth = () => {
  const [mode, setMode] = useState(
    localStorage.getItem('authMode') === 'register' ? 'register' : 'login'
  );

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  const navigate = useNavigate();
  const passwordInputRef = useRef(null);

  const [passwordChecks, setPasswordChecks] = useState({
    length: false,
    upper: false,
    lower: false,
    number: false,
  });

  const isLg = useMediaQuery({ minWidth: 1024 });

  useEffect(() => {
    localStorage.setItem('authMode', mode);
  }, [mode]);

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) navigate("/");
    };
    checkSession();

    const { data: listener } = supabase.auth.onAuthStateChange((_, session) => {
      if (session) navigate("/");
    });

    return () => listener?.subscription?.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (!password) {
      setPasswordChecks({ length: false, upper: false, lower: false, number: false });
      return;
    }

    setPasswordChecks({
      length: password.length >= 6,
      upper: /[A-Z]/.test(password),
      lower: /[a-z]/.test(password),
      number: /[0-9]/.test(password),
    });
  }, [password]);

  const isPasswordStrong = Object.values(passwordChecks).every(Boolean);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (mode === 'register' && !isPasswordStrong) {
      toast.error("La contraseña no cumple los requisitos mínimos");
      return;
    }

    setLoading(true);

    let error;
    let data;

    if (mode === 'register') {
      const response = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin + "/" },
      });

      data = response.data;
      error = response.error;

      if (error) {
        toast.error(error.message);
      } else if (data?.user) {
        // Caso 1: Email ya registrado y confirmado → identities vacío
        if (data.user.identities?.length === 0) {
          toast.warning("Este correo ya está registrado.");
        }
        // Caso 2: Registro nuevo o pendiente de confirmar
        else if (!data.user.confirmed_at) {
          toast.info("Revisa tu correo para confirmar la cuenta.");
        }
        // Caso raro: ya confirmado automáticamente (poco común con confirm email activado)
        else {
          toast.success("¡Cuenta creada correctamente!");
        }
      }
    } else {
      // Login
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      error = signInError;

      if (error) {
        if (error.message.includes("Invalid login credentials")) {
          toast.error("Credenciales incorrectas o cuenta de Google");
        } else {
          toast.error(error.message);
        }
      }
    }

    setLoading(false);
  };


  const handleGoogle = async () => {
    setLoadingGoogle(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) toast.error(error.message);
    setLoadingGoogle(false);
  };

  const resetForm = () => {
    setEmail("");
    setPassword("");
    setShowPassword(false);
    setShowTooltip(false);
  };

  return (
    <>
      {/* Botón de cierre */}
      {isLg ? (
        <button
          onClick={() => navigate("/")}
          className="fixed bottom-5 right-5 z-[1000] flex items-center gap-2 px-2.5 py-2 
            bg-white/65 backdrop-blur-xl border border-white/30 
            shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)] 
            hover:bg-white/85 hover:shadow-[0_8px_30px_rgba(139,92,246,0.15)] 
            text-violet-700 hover:text-violet-600 
            transition-all duration-300 font-medium text-sm contenedorCosas"
        >
          <ArrowLeft className="w-4 h-4" /> Volver a Inicio
        </button>
      ) : (
        <button
          onClick={() => navigate("/")}
          className="fixed top-6 right-4 z-[1000] w-10 h-10 
            bg-white/65 backdrop-blur-xl border border-white/30 
            shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)] 
            hover:bg-white/85 hover:shadow-[0_8px_30px_rgba(139,92,246,0.15)] 
            text-violet-700 hover:text-violet-600 transition-all contenedorCosas"
        >
          <X className="w-5 h-5 mx-auto" />
        </button>
      )}

      <div className="fixed inset-0 flex flex-col lg:flex-row overflow-hidden">
        {/* LADO IZQUIERDO - Formulario */}
        <div className="relative flex-1 flex items-center justify-center px-4 py-10 bg-gradient-to-br from-slate-50 via-violet-50 to-purple-50">
          <div className="absolute inset-0 opacity-30 pointer-events-none">
            <MagicParticles />
          </div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="relative z-10 w-full max-w-md"
          >
            <div
              className="
                  bg-white/55 backdrop-blur-xl border border-slate-200/20
                  shadow-[0_8px_32px_-4px_rgba(0,0,0,0.12),_0_4px_16px_-4px_rgba(0,0,0,0.08)]
                  hover:shadow-[0_20px_50px_-12px_rgba(0,0,0,0.18),_0_8px_30px_-8px_rgba(139,92,246,0.15)]
                  ring-1 ring-black/5 transition-all duration-300 ease-out
                  contenedorCosas overflow-hidden
                "
            >
              {/* Tabs superiores */}
              <div className="flex border-b border-gray-200/30 bg-white/30 backdrop-blur-md">
                <button
                  onClick={() => { setMode('login'); resetForm(); }}
                  className={`flex-1 py-4 text-center font-medium transition-all duration-200
                    ${mode === 'login'
                      ? "text-violet-700 border-b-2 border-violet-600 bg-white/20 shadow-sm"
                      : "text-slate-600 hover:text-slate-800 hover:bg-white/15"}`}
                >
                  Iniciar sesión
                </button>
                <button
                  onClick={() => { setMode('register'); resetForm(); }}
                  className={`flex-1 py-4 text-center font-medium transition-all duration-200
                    ${mode === 'register'
                      ? "text-violet-700 border-b-2 border-violet-600 bg-white/20 shadow-sm"
                      : "text-slate-600 hover:text-slate-800 hover:bg-white/15"}`}
                >
                  Crear cuenta
                </button>
              </div>

              {/* Formulario */}
              <div className="p-5 min-h-[380px] flex flex-col">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={mode}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.35 }}
                    className="flex flex-col flex-1"
                  >
                    <form onSubmit={handleSubmit} className="space-y-5 flex-1 flex flex-col">
                      {/* Email */}
                      <div>
                        <label className="block text-left text-sm font-medium text-slate-700 mb-1.5">
                          Correo electrónico
                        </label>
                        <div className="relative">
                          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                          <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="w-full h-11 pl-11 pr-4 bg-white/90 border-2 border-slate-200 contenedorCosas text-slate-900 placeholder-slate-400 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200/40 transition-all shadow-sm"
                            placeholder="nombre@ejemplo.com"
                          />
                        </div>
                      </div>

                      {/* Password */}
                      <div>
                        <label className="block text-left text-sm font-medium text-slate-700 mb-1.5">
                          Contraseña
                        </label>
                        <div className="relative">
                          <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                          <input
                            ref={passwordInputRef}
                            type={showPassword ? "text" : "password"}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            minLength={6}
                            onFocus={() => setShowTooltip(true)}
                            onBlur={() => setShowTooltip(false)}
                            className="w-full h-11 pl-11 pr-12 bg-white/90 border-2 border-slate-200 contenedorCosas text-slate-900 placeholder-slate-400 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200/40 transition-all shadow-sm"
                            placeholder="••••••••"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 transition-colors"
                          >
                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                          </button>
                        </div>

                        {/* Tooltip requisitos - solo registro y con foco */}
                        <AnimatePresence>
                          {mode === 'register' && showTooltip && (
                            <motion.div
                              initial={{ opacity: 0, y: -8, scale: 0.96 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: -8, scale: 0.96 }}
                              transition={{
                                duration: 0.2,
                                ease: [0.4, 0, 0.2, 1], // curva suave tipo material design
                              }}
                              className="
                              mt-2
                              max-w-[240px] w-full
                              px-3 py-2.5
                              bg-white/95 backdrop-blur-sm 
                              border border-violet-200/60 contenedorCosas 
                              shadow-lg
                              text-[11px] leading-tight
                              pointer-events-none
                              z-50
                              absolute left-5 right-0
                              "
                            >
                              <div className="space-y-1.5">
                                {[
                                  { key: "length", label: "Mínimo 6 caracteres" },
                                  { key: "upper", label: "Al menos una mayúscula" },
                                  { key: "lower", label: "Al menos una minúscula" },
                                  { key: "number", label: "Al menos un número" },
                                ].map(({ key, label }) => (
                                  <div key={key} className="flex items-center gap-2 whitespace-nowrap">
                                    {passwordChecks[key] ? (
                                      <Check size={12} className="text-green-600 flex-shrink-0" />
                                    ) : (
                                      <span className="w-2.5 h-2.5 rounded-full border-2 border-slate-300 inline-block flex-shrink-0" />
                                    )}
                                    <span className={passwordChecks[key] ? "text-green-700" : "text-slate-600"}>
                                      {label}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>

                      </div>

                      {/* Zona inferior fija */}
                      <div className="mt-auto pt-6 border-gray-200/30">
                        <button
                          type="submit"
                          disabled={loading || (mode === 'register' && !isPasswordStrong)}
                          className="w-full h-11 bg-gradient-to-r from-violet-600 to-purple-600 text-white font-medium contenedorCosas shadow-lg hover:shadow-xl hover:brightness-105 disabled:opacity-60 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 mb-3"
                        >
                          {loading ? (
                            <Loader />
                          ) : mode === 'login' ? (
                            "Iniciar sesión"
                          ) : (
                            "Crear cuenta"
                          )}
                        </button>

                        <div className="relative my-2 flex items-center gap-2">
                          <div className="flex-1 h-px bg-gray-300/90" />
                          <span className="text-slate-500 text-sm font-medium contenedorCosas">o</span>
                          <div className="flex-1 h-px bg-gray-300/90" />
                        </div>

                        <button
                          onClick={handleGoogle}
                          disabled={loadingGoogle}
                          className="w-full h-11 flex items-center justify-center gap-3 bg-white border-2 border-slate-200 contenedorCosas shadow-sm hover:shadow-md hover:bg-slate-50 transition-all text-slate-800 font-medium disabled:opacity-60"
                        >
                          {loadingGoogle ? <Loader /> : <GoogleLogo />}
                          Continuar con Google
                        </button>
                      </div>
                    </form>
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        </div>

        {/* LADO DERECHO - igual que antes */}
        {isLg && (
          <div className="relative flex-1 bg-gradient-to-br from-violet-900 via-purple-900 to-slate-900 flex items-center justify-center overflow-hidden">
            <MagicParticles />
            <div className="absolute inset-0 z-10">
              <Suspense fallback={
                <div className="w-full h-full flex items-center justify-center text-white text-xl">
                  Cargando...
                </div>
              }>
                <Spline
                  scene="https://prod.spline.design/9hqvpCPz93euGBFn/scene.splinecode"
                  style={{ width: '100%', height: '100%', background: 'transparent' }}
                />
              </Suspense>
            </div>

            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1.1, delay: 0.4 }}
              className="relative z-20 flex items-center justify-center w-full h-full text-center px-10 pointer-events-none"
            >
              <div className="relative">
                <h1
                  className="text-[12rem] lg:text-[16rem] font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white via-violet-200 to-purple-300/70 drop-shadow-[0_0_60px_rgba(139,92,246,0.6)]"
                  style={{
                    WebkitTextStroke: "1px rgba(139,92,246,0.3)",
                    textShadow: "0 0 80px rgba(139,92,246,0.5), 0 0 120px rgba(168,85,247,0.4)",
                  }}
                >
                  DKS
                </h1>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </>
  );
};

export default Auth;