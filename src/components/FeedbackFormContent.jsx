// src/components/FeedbackFormContent.jsx
import { useState, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { ChevronDown } from 'lucide-react';
import { supabase } from '../utils/supabaseClient';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

const feedbackTypes = [
    { value: 'bug', label: 'Bug / Error encontrado' },
    { value: 'mejora', label: 'Mejora / Idea' },
    { value: 'sugerencia', label: 'Sugerencia / Nueva funcionalidad' },
    { value: 'otro', label: 'Otro comentario' },
];

export default function FeedbackFormContent({ onClose }) {
    const [type, setType] = useState('mejora');
    const [message, setMessage] = useState('');
    const [phone, setPhone] = useState('');
    const [loading, setLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const location = useLocation();
    const selectRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (selectRef.current && !selectRef.current.contains(e.target)) {
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
            const cleanPhone = phone.replace(/\D/g, '');

            const { error } = await supabase.from('feedback').insert({
                user_id: user?.id || null,
                type,
                message: message.trim(),
                page: location.pathname,
                phone: cleanPhone || null,
            });

            if (error) throw error;

            toast.success('¡Gracias por tu feedback!');

            // Lógica de WhatsApp (igual que antes) ...

            setMessage('');
            setPhone('');
            onClose?.(); // vuelve al menú
        } catch (err) {
            console.error(err);
            toast.error('No se pudo enviar. Inténtalo más tarde.');
        } finally {
            setLoading(false);
        }
    };

    const inputBase = `
    w-full bg-white/90 border-2 border-slate-200 contenedorCosas 
    text-slate-900 placeholder-slate-400 
    focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200/40 
    transition-all shadow-sm
  `;

    return (
        <div className="h-full flex flex-col">
            <form onSubmit={handleSubmit} className="flex-1 px-4 sm:px-5 py-4 space-y-11 overflow-hidden">
                {/* Select – más compacto */}
                <div className="relative" ref={selectRef}>
                    <label className="block text-sm text-left font-medium text-slate-700 mb-1">
                        Tipo de comentario
                    </label>
                    <button
                        type="button"
                        onClick={() => setIsOpen(!isOpen)}
                        className={`${inputBase} px-4 py-2.5 h-10 flex items-center justify-between text-left text-sm`}
                    >
                        <span className={selectedOption ? 'text-slate-900' : 'text-slate-400'}>
                            {selectedOption?.label || 'Selecciona una opción'}
                        </span>
                        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </button>

                    <AnimatePresence>
                        {isOpen && (
                            <motion.ul
                                initial={{ opacity: 0, y: -8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -8 }}
                                className="absolute z-10 mt-3 w-full bg-white border border-slate-200 shadow-lg rounded-md overflow-hidden text-sm"
                            >
                                {feedbackTypes.map((opt) => (
                                    <li
                                        key={opt.value}
                                        onClick={() => {
                                            setType(opt.value);
                                            setIsOpen(false);
                                        }}
                                        className={`
                    px-4 py-2.5 cursor-pointer text-sm
                    ${type === opt.value ? 'bg-violet-50 text-violet-700 font-medium' : 'hover:bg-slate-50'}
                  `}
                                    >
                                        {opt.label}
                                    </li>
                                ))}
                            </motion.ul>
                        )}
                    </AnimatePresence>
                </div>

                {/* Mensaje – textarea más baja */}
                <div>
                    <label className="block text-sm text-left font-medium text-slate-700 mb-1">Tu mensaje</label>
                    <textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        rows={4}                      // ← bajado de 5 a 4
                        className={`${inputBase} px-4 py-2.5 text-sm resize-none min-h-[80px]`}
                        placeholder="Describe el problema, idea o sugerencia..."
                        required
                    />
                </div>

                {/* Teléfono – más compacto */}
                <div>
                    <label className="block text-left text-sm font-medium text-slate-700 mb-1">
                        Teléfono (opcional)
                    </label>
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                            <span className="text-slate-500 text-sm font-medium">+34</span>
                        </div>
                        <input
                            type="tel"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value.replace(/[^0-9\s-]/g, ''))}
                            placeholder="612 345 678"
                            className={`${inputBase} pl-14 px-4 py-2.5 h-10 text-sm`}
                            inputMode="tel"
                        />
                    </div>
                </div>

                {/* Botón */}
                <button
                    type="submit"
                    disabled={loading || !message.trim()}
                    className="w-full h-10 bg-gradient-to-r from-violet-600 to-purple-600 text-white text-sm font-medium contenedorCosas shadow-md hover:brightness-105 disabled:opacity-60 transition flex items-center justify-center gap-2 mt-2"
                >
                    {loading ? 'Enviando...' : 'Enviar comentario'}
                </button>
            </form>
        </div>
    );
}