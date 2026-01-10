// src/components/LoadingScreen.jsx
import React from "react";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import MagicParticles from "./MagicParticles";

export default function LoadingScreen() {
  return (
    <div className="fixed inset-0 min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-50 via-purple-50 to-indigo-100 overflow-hidden">
      {/* Partículas mágicas de fondo sutiles */}
      <div className="absolute inset-0 opacity-50">
        <MagicParticles />
      </div>

      {/* Orbe central mágico con glow pulsante */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1, ease: "easeOut" }}
        className="relative"
      >
        {/* Orbe principal con gradient y pulse suave */}
        <motion.div
          animate={{
            scale: [1, 1.15, 1],
            boxShadow: [
              "0 0 60px rgba(139, 92, 246, 0.6)",
              "0 0 100px rgba(139, 92, 246, 0.8)",
              "0 0 60px rgba(139, 92, 246, 0.6)",
            ],
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="w-32 h-32 md:w-40 md:h-40 bg-gradient-to-br from-violet-500 to-purple-600 rounded-full relative overflow-hidden shadow-2xl flex items-center justify-center"
        >
          {/* Glow interno sutil */}
          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/20 to-transparent animate-pulse" />

          {/* Icono Sparkles estático que solo gira sobre sí mismo */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{
              duration: 20,
              repeat: Infinity,
              ease: "linear",
            }}
          >
            <Sparkles
              size={55}               // Más pequeño en móvil
              className="md:size-20 text-white drop-shadow-2xl"
              strokeWidth={1}
            />
          </motion.div>
        </motion.div>

        {/* Halo exterior mágico girando */}
        <motion.div
          animate={{ rotate: -360 }}
          transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
          className="absolute -inset-8 border-4 border-violet-400/30 rounded-full"
        />
      </motion.div>

      {/* Primer anillo orbital - sentido horario */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
        className="absolute w-48 h-48 md:w-64 md:h-64 border-2 border-transparent border-t-violet-400/40 rounded-full"
      />

      {/* Segundo anillo orbital - más grande y sentido antihorario */}
      <motion.div
        animate={{ rotate: -360 }}
        transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
        className="absolute w-64 h-64 md:w-80 md:h-80 border-2 border-transparent border-t-indigo-400/30 border-b-purple-500/30 rounded-full"
      />
    </div>
  );
}