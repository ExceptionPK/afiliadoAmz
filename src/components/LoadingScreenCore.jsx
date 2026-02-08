// src/components/LoadingScreenCore.jsx
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";

export default function LoadingScreenCore() {
  return (
    <div className="relative flex flex-col items-center gap-6">
      {/* Orbe central */}
      <motion.div
        animate={{
          scale: [1, 1.12, 1],
          boxShadow: [
            "0 0 40px rgba(139, 92, 246, 0.5)",
            "0 0 80px rgba(139, 92, 246, 0.7)",
            "0 0 40px rgba(139, 92, 246, 0.5)",
          ],
        }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        className="w-24 h-24 md:w-32 md:h-32 bg-gradient-to-br from-violet-500 to-purple-600 rounded-full flex items-center justify-center shadow-xl relative overflow-hidden"
      >
        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/15 to-transparent animate-pulse" />
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
        >
          <Sparkles size={48} className="text-white drop-shadow-lg md:size-64" strokeWidth={1.2} />
        </motion.div>
      </motion.div>

      <p className="text-lg font-medium text-violet-900">Importando enlaces...</p>
      <p className="text-sm text-slate-600">No cierres la pestaña</p>
    </div>
  );
}