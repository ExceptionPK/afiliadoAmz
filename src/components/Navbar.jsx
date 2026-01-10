import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { History, Home as HomeIcon, LogOut, User, Settings, ChevronDown, LogIn } from 'lucide-react';
import { supabase } from '../utils/supabaseClient';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

const Navbar = ({ session }) => {   // ← solo añadimos esta prop
  const location = useLocation();
  const navigate = useNavigate();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const dropdownRef = useRef(null);

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) {
      console.error("Error en signOut:", error);
      toast.error("Error al cerrar sesión");
    } else {
      toast.info("Sesión cerrada");
      setIsDropdownOpen(false);
      navigate("/auth");
    }
  };

  // Cerrar dropdown al click fuera (sin cambios)
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isDropdownOpen]);

  return (
    <>
      <div className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          {/* Izquierda: Mi cuenta o Iniciar sesión */}
          <div className="relative" ref={dropdownRef}>
            {session ? (
              // ── Versión original casi intacta ───────────────────────────────
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="inline-flex items-center gap-2 bg-white/80 backdrop-blur-sm px-3 py-1.5 contenedorCosas border border-violet-100 shadow-sm hover:shadow transition"
              >
                <User className="w-4 h-4 text-violet-500" />
                <span className="text-sm font-medium text-slate-700">Mi cuenta</span>
                <ChevronDown
                  className={`w-4 h-4 text-slate-500 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`}
                />
              </button>
            ) : (
              // ── Versión muy parecida, mismo estilo base ─────────────────────
              <button
                onClick={() => navigate("/auth")}
                className="inline-flex items-center gap-2 bg-white/80 backdrop-blur-sm px-3 py-1.5 contenedorCosas border border-violet-100 shadow-sm hover:shadow transition"
              >
                <LogIn className="w-4 h-4 text-violet-500" />
                <span className="text-sm font-medium text-slate-700">Iniciar sesión</span>
              </button>
            )}

            {/* Dropdown solo aparece si hay sesión */}
            <AnimatePresence>
              {session && isDropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  className="absolute top-full left-0 mt-2 w-48 bg-white rounded-lg shadow-xl border border-slate-200 overflow-hidden z-50"
                >
                  <Link
                    to="/profile"
                    onClick={() => setIsDropdownOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
                  >
                    <User className="w-4 h-4" />
                    Perfil
                  </Link>
                  <Link
                    to="/settings"
                    onClick={() => setIsDropdownOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
                  >
                    <Settings className="w-4 h-4" />
                    Configuración
                  </Link>
                  <hr className="border-slate-200" />
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition text-left"
                  >
                    <LogOut className="w-4 h-4" />
                    Cerrar sesión
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Centro: navegación principal → sin ningún cambio */}
          <nav className="flex items-center gap-1">
            <Link
              to="/"
              className={`nav-link flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all ${location.pathname === '/' ? 'active' : 'text-slate-600 hover:text-slate-900'}`}
            >
              <HomeIcon className="w-5 h-5" />
              <span>Inicio</span>
            </Link>

            <Link
              to="/history"
              className={`nav-link flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all ${location.pathname === '/history' ? 'active' : 'text-slate-600 hover:text-slate-900'}`}
            >
              <History className="w-5 h-5" />
              <span>Historial</span>
            </Link>
          </nav>
        </div>
      </div>
    </>
  );
};

export default Navbar;