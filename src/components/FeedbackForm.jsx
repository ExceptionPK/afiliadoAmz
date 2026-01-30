// src/components/FeedbackForm.jsx
import { useState } from 'react';
import { toast } from 'sonner';
import { MessageSquare, X } from 'lucide-react';
import { supabase } from '../utils/supabaseClient';
import { useLocation } from 'react-router-dom';
import { motion } from 'framer-motion'; // si no lo tienes, quítalo o instálalo

// Loader idéntico al de Auth.jsx
const Loader = () => (
  <motion.div
    className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"
    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
  />
);

export default function FeedbackForm({ onClose }) {
  const [type, setType] = useState('mejora');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const location = useLocation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!message.trim()) {
      toast.error('Escribe algo antes de enviar');
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const isLoggedIn = !!user;

      const { error } = await supabase.from('feedback').insert({
        user_id: isLoggedIn ? user.id : null,
        type,
        message: message.trim(),
        page: location.pathname,
        email: email.trim() || null,
      });

      if (error) throw error;

      toast.success('¡Gracias por tu feedback!');
      setMessage('');
      setEmail('');
      onClose?.();
    } catch (err) {
      console.error('Error al enviar feedback:', err);
      toast.error('No se pudo enviar. Inténtalo de nuevo más tarde.');
    } finally {
      setLoading(false);
    }
  };

  // Clase base para inputs (ya ajustada antes)
  const inputBaseClass = `
    w-full bg-white/90 border-2 border-slate-200 contenedorCosas 
    text-slate-900 placeholder-slate-400 
    focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200/40 
    transition-all shadow-sm
  `;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white contenedorCosas shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 border border-violet-100">
        {/* Header */}
        <div className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MessageSquare className="w-6 h-6" />
            <h3 className="font-semibold text-lg">Envía tus sugerencias</h3>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white transition">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label className="block text-sm text-left font-medium text-slate-700 mb-1.5">
              Tipo de comentario
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className={`${inputBaseClass} px-4 py-2.5 h-12 appearance-none`}
            >
              <option value="bug">Bug / Error encontrado</option>
              <option value="mejora">Mejora o idea para la app</option>
              <option value="sugerencia">Sugerencia / Nueva funcionalidad</option>
              <option value="otro">Otro comentario</option>
            </select>
          </div>

          <div>
            <label className="block text-left text-sm font-medium text-slate-700 mb-1.5">
              Tu mensaje
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              placeholder="Tu mensaje"
              className={`${inputBaseClass} px-4 py-3 resize-none`}
              required
            />
          </div>

          <div>
            <label className="block text-left text-sm font-medium text-slate-700 mb-1.5">
              Email (opcional – solo si quieres que te respondamos)
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tucorreo@ejemplo.com"
              className={`${inputBaseClass} px-4 py-2.5 h-11`}
            />
          </div>

          <button
            type="submit"
            disabled={loading || !message.trim()}
            className="w-full h-11 bg-gradient-to-r from-violet-600 to-purple-600 text-white font-medium contenedorCosas shadow-lg hover:shadow-xl hover:brightness-105 disabled:opacity-60 disabled:cursor-not-allowed transition flex items-center justify-center gap-2 mt-0"
          >
            {loading ? (
              <Loader />
            ) : (
              'Enviar comentario'
            )}
          </button>

          <p className="text-xs text-center text-slate-500">
            No compartimos tu email con nadie. Solo lo usamos si necesitas respuesta.
          </p>
        </form>
      </div>
    </div>
  );
}