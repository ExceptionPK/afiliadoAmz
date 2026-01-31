// src/components/FeedbackForm.jsx
import { useState, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { MessageSquare, X, ChevronDown, Phone } from 'lucide-react';
import { supabase } from '../utils/supabaseClient';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

// Loader
const Loader = () => (
  <motion.div
    className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"
    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
  />
);

const feedbackTypes = [
  { value: 'bug', label: 'Bug / Error encontrado' },
  { value: 'mejora', label: 'Mejora / Idea' },
  { value: 'sugerencia', label: 'Sugerencia / Nueva funcionalidad' },
  { value: 'otro', label: 'Otro comentario' },
];

export default function FeedbackForm({ onClose }) {
  const [type, setType] = useState('mejora');
  const [message, setMessage] = useState('');
  const [phone, setPhone] = useState('');           // ← Cambiado de email a phone
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const selectRef = useRef(null);

  // Cerrar select al click fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (selectRef.current && !selectRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = feedbackTypes.find((opt) => opt.value === type);

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

      // Limpiamos el teléfono (quitamos espacios, guiones, etc.)
      const cleanPhone = phone.replace(/\D/g, '');

      const { error } = await supabase.from('feedback').insert({
        user_id: isLoggedIn ? user.id : null,
        type,
        message: message.trim(),
        page: location.pathname,
        phone: cleanPhone || null,           // ← nuevo campo
      });

      if (error) throw error;

      toast.success('¡Gracias por tu feedback!');

      if (cleanPhone && cleanPhone.length >= 9) {
        try {
          const { error: funcError } = await supabase.functions.invoke('send-whatsapp', {
            body: {
              phone: cleanPhone,
              type: selectedOption?.label || type,
              message: message.trim()
            }
          });

          if (funcError) {
            console.error('Error invocando send-whatsapp:', funcError);
            toast.warning('Feedback guardado, pero no se pudo enviar confirmación por WhatsApp.');
          } else {
            toast.info('Te hemos enviado un mensaje de confirmación por WhatsApp.');
          }
        } catch (invokeErr) {
          console.error('Excepción al invocar función:', invokeErr);
          toast.warning('Feedback guardado, pero hubo un problema técnico con WhatsApp.');
        }
      }

      // Resetear formulario
      setMessage('');
      setPhone('');
      onClose?.();

    } catch (err) {
      console.error('Error al enviar feedback:', err);
      toast.error('No se pudo enviar. Inténtalo de nuevo más tarde.');
    } finally {
      setLoading(false);
    }
  };

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
          {/* Select personalizado */}
          <div className="relative" ref={selectRef}>
            <label className="block text-sm text-left font-medium text-slate-700 mb-1.5">
              Tipo de comentario
            </label>

            <button
              type="button"
              onClick={() => setIsOpen(!isOpen)}
              className={`
                ${inputBaseClass} px-4 py-2.5 h-12 
                flex items-center justify-between 
                text-left cursor-pointer
              `}
            >
              <span className={selectedOption ? 'text-slate-900' : 'text-slate-400'}>
                {selectedOption?.label || 'Selecciona una opción'}
              </span>
              <ChevronDown
                className={`w-5 h-5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
              />
            </button>

            <AnimatePresence>
              {isOpen && (
                <motion.ul
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="
                    absolute z-10 mt-1.5 w-full 
                    bg-white border border-slate-200 contenedorCosas
                    shadow-xl overflow-hidden rounded-lg
                  "
                >
                  {feedbackTypes.map((option) => (
                    <motion.li
                      key={option.value}
                      whileHover={{ backgroundColor: '#f1f5f9' }}
                      transition={{ duration: 0.1 }}
                      onClick={() => {
                        setType(option.value);
                        setIsOpen(false);
                      }}
                      className={`
                        px-4 py-3 cursor-pointer text-slate-800
                        ${type === option.value
                          ? 'bg-violet-50 text-violet-700 font-medium'
                          : 'hover:bg-slate-50'}
                      `}
                    >
                      {option.label}
                    </motion.li>
                  ))}
                </motion.ul>
              )}
            </AnimatePresence>
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

          {/* Campo de teléfono con prefijo +34 fijo */}
          <div>
            <label className="block text-left text-sm font-medium text-slate-700 mb-1.5">
              Teléfono (opcional – para responderte por WhatsApp)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
                <span className="text-slate-500 font-medium">+34</span>
              </div>
              <input
                type="tel"
                value={phone}
                onChange={(e) => {
                  // Solo permite números, espacios y guiones
                  const val = e.target.value.replace(/[^0-9\s-]/g, '');
                  setPhone(val);
                }}
                placeholder="612 345 678"
                className={`${inputBaseClass} pl-16 px-4 py-2.5 h-11`}
                inputMode="tel"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !message.trim()}
            className="w-full h-11 bg-gradient-to-r from-violet-600 to-purple-600 text-white font-medium contenedorCosas shadow-lg hover:shadow-xl hover:brightness-105 disabled:opacity-60 disabled:cursor-not-allowed transition flex items-center justify-center gap-2 mt-2"
          >
            {loading ? <Loader /> : 'Enviar comentario'}
          </button>

          <p className="text-xs text-center text-slate-500">
            No guardamos ni compartimos tu número. Solo se usa para abrir WhatsApp si lo proporcionas.
          </p>
        </form>
      </div>
    </div>
  );
}