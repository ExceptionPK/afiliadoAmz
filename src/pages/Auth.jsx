import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../utils/supabaseClient";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import MagicParticles from "../components/MagicParticles";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, Mail, Check, X, Eye, EyeOff, Sparkles } from "lucide-react";
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

// NUEVO: Componente Loader circular con Framer Motion
const Loader = () => (
  <motion.div
    className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full"
    animate={{ rotate: 360 }}
    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
  />
);

const formVariants = {
  enter: { opacity: 0, y: 30 },
  center: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -30 },
};

export default function Auth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSignup, setIsSignup] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const navigate = useNavigate();
  const passwordInputRef = useRef(null);
  const [passwordFocused, setPasswordFocused] = useState(false);

  // Validación de contraseña (exactamente igual que antes)
  const [passwordValidations, setPasswordValidations] = useState({
    length: false,
    uppercase: false,
    lowercase: false,
    number: false,
  });

  useEffect(() => {
    if (window.location.hash) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (password === "") {
      setPasswordValidations({
        length: false,
        uppercase: false,
        lowercase: false,
        number: false,
      });
      return;
    }

    setPasswordValidations({
      length: password.length >= 6,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /[0-9]/.test(password),
    });
  }, [password]);

  const isPasswordValid = Object.values(passwordValidations).every(Boolean);

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) navigate("/");
    };
    checkSession();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) navigate("/");
    });

    return () => listener?.subscription?.unsubscribe();
  }, [navigate]);

  const handleEmailPassword = async (e) => {
    e.preventDefault();

    if (isSignup && !isPasswordValid) {
      toast.error("La contraseña no cumple los requisitos");
      return;
    }

    setLoading(true);

    let error;
    let data; // Para capturar la respuesta completa

    if (isSignup) {
      const { data: signupData, error: signupError } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin + "/" },
      });
      data = signupData;
      error = signupError;
    } else {
      const { error: signinError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      error = signinError;
    }

    if (error) {
      if (error.message.includes("Invalid login credentials")) {
        toast.error("Credenciales incorrectas o cuenta creada con Google");
      } else {
        toast.error(error.message);
      }
    } else {
      if (isSignup) {
        if (data.user && data.user.identities && data.user.identities.length === 0) {
          toast.error("Este email ya está registrado. Inicia sesión o usa recuperación de contraseña.");
        } else if (data.user && !data.user.confirmed_at && data.session === null) {
          toast.info("Revisa tu correo para confirmar tu cuenta.");
        } else {
          toast.success("¡Cuenta creada correctamente!");
        }
      }
    }

    setLoading(false);
  };

  const handleGoogleSignIn = async () => {
    setLoadingGoogle(true);

    // ¡¡IMPORTANTE!! Usa la misma URL pero SIN barra final
    const redirectTo = window.location.origin;  // ← así: https://afiliiado-amz.vercel.app (sin / al final)

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,  // Supabase añadirá automáticamente el #access_token=... aquí
      },
    });

    if (error) {
      toast.error(error.message);
      console.error(error);
    }
    setLoadingGoogle(false);
  };

  // Función para cambiar modo limpiando estados
  const toggleMode = () => {
    setIsSignup(!isSignup);
    setPassword("");
    setShowPassword(false);
    // No limpiamos email para mejor UX (el usuario suele mantenerlo)
  };

  const isLg = useMediaQuery({ minWidth: 1024 });

  return (
    <div className="fixed inset-0 flex flex-col lg:flex-row overflow-hidden">
      {/* LADO IZQUIERDO - Formulario */}
      <div className="relative flex-1 flex items-center justify-center px-6 py-12">
        <div className="absolute inset-0 opacity-30">
          <MagicParticles />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="relative z-10 w-full max-w-md"
        >
          {/* Título y subtítulo con animación propia */}
          <motion.h1
            key={`title-${isSignup}`}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-3xl md:text-4xl mt-10 font-bold text-center text-slate-900 mb-2"
          >
            {isSignup ? "Crear cuenta" : "Iniciar sesión"}
          </motion.h1>
          <motion.p
            key={`subtitle-${isSignup}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.5 }}
            className="text-center text-base text-slate-600 mb-8"
          >
            {isSignup
              ? "Únete y empieza a guardar tus enlaces de Amazon"
              : "Accede a tu cuenta para gestionar tus productos"}
          </motion.p>

          {/* === AQUÍ ESTÁ LA ANIMACIÓN PRINCIPAL === */}
          <AnimatePresence mode="wait">
            <motion.div
              key={isSignup ? "signup-form" : "signin-form"} // Clave única para animar entrada/salida
              variants={formVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.4, ease: "easeInOut" }}
              className="space-y-4"
            >
              <form onSubmit={handleEmailPassword} className="space-y-6">
                {/* Email */}
                <div>
                  <label className="block text-left text-sm font-medium text-slate-700 mb-2">
                    Correo electrónico
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="w-full h-12 pl-12 pr-4 bg-white border-2 border-slate-200 contenedorCosas text-slate-900 placeholder-slate-400 focus:outline-none focus:border-violet-500 transition-all shadow-sm"
                      placeholder="tu@email.com"
                    />
                  </div>
                </div>

                {/* Contraseña con toggle */}
                <div>
                  <label className="block text-left text-sm font-medium text-slate-700 mb-2">
                    Contraseña
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      ref={passwordInputRef}
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onFocus={() => setPasswordFocused(true)}
                      onBlur={() => setPasswordFocused(false)}
                      required
                      minLength={6}
                      className="w-full h-12 pl-12 pr-14 bg-white border-2 border-slate-200 contenedorCosas text-slate-900 placeholder-slate-400 focus:outline-none focus:border-violet-500 transition-all shadow-sm"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
                      aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>

                  {/* Validaciones EXACTAMENTE como las tenías */}
                  <div className="mt-3 mb-11 min-h-[75px]">
                    {isSignup && (
                      <div className="relative mt-2">
                        <AnimatePresence>
                          {passwordFocused && (
                            <motion.div
                              initial={{ opacity: 0, y: -8, scale: 0.95 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: -8, scale: 0.95 }}
                              transition={{ duration: 0.2 }}
                              className="absolute left-0 -top-2 translate-y-[-100%] w-72 bg-white border border-slate-200 contenedorCosas shadow-xl py-3 px-4 z-50"
                            >
                              <div className="space-y-2">
                                <div className="flex items-center gap-2 text-xs">
                                  {passwordValidations.length ? (
                                    <Check className="w-4 h-4 text-green-600" />
                                  ) : (
                                    <X className="w-4 h-4 text-red-500" />
                                  )}
                                  <span className={passwordValidations.length ? "text-green-700 font-medium" : "text-slate-600"}>
                                    Mínimo 6 caracteres
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 text-xs">
                                  {passwordValidations.uppercase ? (
                                    <Check className="w-4 h-4 text-green-600" />
                                  ) : (
                                    <X className="w-4 h-4 text-red-500" />
                                  )}
                                  <span className={passwordValidations.uppercase ? "text-green-700 font-medium" : "text-slate-600"}>
                                    Al menos una mayúscula
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 text-xs">
                                  {passwordValidations.lowercase ? (
                                    <Check className="w-4 h-4 text-green-600" />
                                  ) : (
                                    <X className="w-4 h-4 text-red-500" />
                                  )}
                                  <span className={passwordValidations.lowercase ? "text-green-700 font-medium" : "text-slate-600"}>
                                    Al menos una minúscula
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 text-xs">
                                  {passwordValidations.number ? (
                                    <Check className="w-4 h-4 text-green-600" />
                                  ) : (
                                    <X className="w-4 h-4 text-red-500" />
                                  )}
                                  <span className={passwordValidations.number ? "text-green-700 font-medium" : "text-slate-600"}>
                                    Al menos un número
                                  </span>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )}
                  </div>
                </div>

                {/* Botón principal - CAMBIADO: Ahora muestra Loader en lugar de texto cuando loading */}
                <motion.button
                  whileHover={{ scale: (isPasswordValid || !isSignup) ? 1.02 : 1 }}
                  whileTap={{ scale: (isPasswordValid || !isSignup) ? 0.98 : 1 }}
                  type="submit"
                  disabled={loading || (isSignup && !isPasswordValid && password.length > 0)}
                  className="w-full h-12 px-4 font-semibold text-white bg-gradient-to-r from-violet-600 to-purple-600 contenedorCosas shadow-lg hover:shadow-violet-600/40 transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {loading ? (
                    <Loader />
                  ) : isSignup ? (
                    "Crear cuenta"
                  ) : (
                    "Iniciar sesión"
                  )}
                </motion.button>
              </form>

              <div className="flex items-center my-4">
                <div className="flex-1 h-px bg-slate-300" />
                <span className="px-4 text-sm text-slate-500">O</span>
                <div className="flex-1 h-px bg-slate-300" />
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleGoogleSignIn}
                disabled={loadingGoogle}
                className="w-full h-12 flex items-center justify-center gap-3 px-4 bg-white border-2 border-slate-200 text-slate-800 font-medium contenedorCosas shadow-md hover:shadow-lg transition-all disabled:opacity-70"
              >
                {loadingGoogle ? (
                  <div className="w-5 h-5 border-2 border-slate-400 border-t-slate-800 contenedorCosas animate-spin" />
                ) : (
                  <GoogleLogo />
                )}
                Continuar con Google
              </motion.button>
            </motion.div>
          </AnimatePresence>

          {/* Enlace para cambiar modo */}
          <p className="text-center mt-8 text-slate-600">
            {isSignup ? "¿Ya tienes una cuenta?" : "¿No tienes cuenta?"}{" "}
            <button
              type="button"
              onClick={toggleMode}
              className="font-medium text-violet-600 hover:text-violet-700 hover:underline underline-offset-4 transition-all"
            >
              {isSignup ? "Iniciar sesión" : "Crear una cuenta"}
            </button>
          </p>
        </motion.div>
      </div>

      {/* LADO DERECHO - Hero SOLO en pantallas grandes */}
      {isLg && (
        <div className="lg:relative lg:flex lg:flex-1 bg-gradient-to-br from-violet-900 via-purple-900 to-slate-900 flex items-center justify-center overflow-hidden">
          <MagicParticles />
          <div className="absolute inset-0 z-10">
            <Suspense fallback={
              <div className="w-full h-full flex items-center justify-center text-white text-xl">
                Cargando cubo...
              </div>
            }>
              <Spline
                scene="https://prod.spline.design/9hqvpCPz93euGBFn/scene.splinecode"
                style={{ width: '100%', height: '100%', background: 'transparent' }}
              />
            </Suspense>
          </div>

          {/* El texto DKS (sin cambios) */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.1, delay: 0.4, ease: "easeOut" }}
            className="relative z-20 flex items-center justify-center w-full h-full text-center px-10 pointer-events-none"
          >
            <div className="relative">
              <h1
                className="text-[10rem] md:text-[16rem] lg:text-[16rem] font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white via-violet-200 to-purple-300/70 drop-shadow-[0_0_60px_rgba(139,92,246,0.6)]"
                style={{
                  WebkitTextStroke: "1px rgba(139,92,246,0.3)",
                  textShadow: "0 0 80px rgba(139,92,246,0.5), 0 0 120px rgba(168,85,247,0.4)",
                }}
              >
                DKS
              </h1>
              <motion.p
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 0.7, y: 0 }}
                transition={{ delay: 0.9, duration: 0.8 }}
                className="absolute bottom-[-60px] left-1/2 -translate-x-1/2 text-xl md:text-2xl font-light tracking-widest text-violet-200/60"
              />
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}