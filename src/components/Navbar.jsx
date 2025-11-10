import { Link, useLocation } from 'react-router-dom';
import { Sparkles, History, Home as HomeIcon } from 'lucide-react';

const Navbar = () => {
    const location = useLocation();

    return (
        <div className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100">
            <div className="container mx-auto px-4 py-3 flex items-center justify-between">
                <Link to="/" className="flex items-center gap-2">
                    <div className="inline-flex items-center gap-2 bg-white/80 backdrop-blur-sm px-4 py-2 contenedorCosas border border-violet-100 shadow-sm">
                        <Sparkles className="w-4 h-4 text-violet-500" />
                        <span className="text-sm font-medium text-slate-700">Made by PKM</span>
                    </div>
                </Link>

                <nav className="flex gap-1">
                    <Link
                        to="/"
                        className={`nav-link ${location.pathname === '/' ? 'active' : ''}`}
                    >
                        <HomeIcon />
                        Inicio
                    </Link>

                    <Link
                        to="/history"
                        className={`nav-link ${location.pathname === '/history' ? 'active' : ''}`}
                    >
                        <History />
                        Historial
                    </Link>
                </nav>
            </div>
        </div>
    );
};

export default Navbar;