import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Sparkles, History, Home as HomeIcon } from 'lucide-react';

const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const touchStartX = useRef(null);
  const touchCurrentX = useRef(null);

  // Orden de navegación con swipe (solo Inicio y Historial)
  const swipeRoutes = ['/', '/history'];
  const currentIndex = swipeRoutes.indexOf(location.pathname);

  useEffect(() => {
    if (currentIndex === -1) return;

    const handleTouchStart = (e) => {
      touchStartX.current = e.touches[0].clientX;
      touchCurrentX.current = e.touches[0].clientX;
    };

    const handleTouchMove = (e) => {
      if (!touchStartX.current) return;
      touchCurrentX.current = e.touches[0].clientX;
    };

    const handleTouchEnd = () => {
      if (!touchStartX.current || !touchCurrentX.current) return;

      const deltaX = touchCurrentX.current - touchStartX.current;
      const minSwipeDistance = 50;

      // Swipe izquierda → siguiente
      if (deltaX < -minSwipeDistance && currentIndex < swipeRoutes.length - 1) {
        navigate(swipeRoutes[currentIndex + 1]);
      }
      // Swipe derecha → anterior
      else if (deltaX > minSwipeDistance && currentIndex > 0) {
        navigate(swipeRoutes[currentIndex - 1]);
      }

      touchStartX.current = null;
      touchCurrentX.current = null;
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [location.pathname, currentIndex, navigate]);

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        {/* Logo */}
        <Link to="/">
          <div className="inline-flex items-center gap-2 bg-white/80 backdrop-blur-sm px-3 py-1.5 contenedorCosas border border-violet-100 shadow-sm">
            <Sparkles className="w-4 h-4 text-violet-500" />
            <span className="text-sm font-medium text-slate-700">DeKolapS</span>
          </div>
        </Link>

        {/* Navegación - visible siempre (móvil y desktop) */}
        <nav className="flex gap-1">
          <Link
            to="/"
            className={`nav-link flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all ${
              location.pathname === '/' ? 'active' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <HomeIcon className="w-5 h-5" />
            <span className="hidden sm:inline">Inicio</span>
            <span className="sm:hidden">Inicio</span> {/* Siempre visible en móvil si quieres solo icono, quita el texto */}
          </Link>

          <Link
            to="/history"
            className={`nav-link flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all ${
              location.pathname === '/history' ? 'active' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <History className="w-5 h-5" />
            <span className="hidden sm:inline">Historial</span>
            <span className="sm:hidden">Historial</span>
          </Link>
        </nav>
      </div>
    </div>
  );
};

export default Navbar;