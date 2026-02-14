// components/ChatWidget.jsx
import { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Bot } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY || "";

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { id: 1, text: "¡Hola! ¿En qué te puedo ayudar hoy?", sender: 'bot' },
  ]);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) scrollToBottom();
  }, [messages, isOpen]);

  const handleSend = async () => {
    if (!input.trim()) return;

    // Mensaje del usuario
    const userMsg = { id: Date.now(), text: input.trim(), sender: 'user' };
    setMessages(prev => [...prev, userMsg]);
    setInput('');

    // Llamada real a Groq (basado en History.jsx)
    try {
      const prompt = `Eres un asistente útil y amigable. Responde de forma concisa y natural en español. Pregunta del usuario: "${input.trim()}"`;

      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.9,
          max_tokens: 140,
          top_p: 0.92
        })
      });

      if (!response.ok) throw new Error("Error en Groq");

      const data = await response.json();
      let generated = data.choices?.[0]?.message?.content?.trim() || "Lo siento, hubo un error.";

      generated = generated
        .replace(/^"(.+)"$/, '$1')
        .trim();

      const botMsg = { id: Date.now() + 1, text: generated, sender: 'bot' };
      setMessages(prev => [...prev, botMsg]);
    } catch (err) {
      console.error("Error generando respuesta:", err);
      const botMsg = { id: Date.now() + 1, text: "Lo siento, hubo un error al procesar tu mensaje. Intenta de nuevo.", sender: 'bot' };
      setMessages(prev => [...prev, botMsg]);
    }

    scrollToBottom();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Botón flotante – movido más arriba: bottom-20 en lugar de bottom-6 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          fixed bottom-20 right-6 z-50
          w-14 h-14 rounded-full 
          bg-violet-600 hover:bg-violet-700 
          text-white shadow-xl
          flex items-center justify-center
          transition-all duration-300
          hover:scale-110 active:scale-95
          shadow-violet-500/40 hover:shadow-violet-600/60
        `}
        aria-label={isOpen ? "Cerrar chat" : "Abrir chat"}
      >
        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.div
              key="close"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <X className="w-7 h-7" />
            </motion.div>
          ) : (
            <motion.div
              key="chat"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <MessageSquare className="w-7 h-7" />
            </motion.div>
          )}
        </AnimatePresence>
      </button>

      {/* Ventana de chat – ajustada para que no se solape con el botón */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className={`
              fixed bottom-36 right-6 z-50
              w-80 sm:w-96 h-[500px] max-h-[80vh]
              bg-white contenedorCosas shadow-2xl
              border border-slate-200 overflow-hidden
              flex flex-col
            `}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Bot className="w-6 h-6" />
                <div>
                  <h3 className="font-semibold">Asistente DKS</h3>
                </div>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="text-white/80 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mensajes */}
            <div className="flex-1 text-slate-900 text-left p-4 overflow-y-auto bg-slate-50/70 space-y-4">
              {messages.map(msg => (
                <div
                  key={msg.id}
                  className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`
                      max-w-[80%] px-4 py-3 contenedorCosas text-sm
                      ${msg.sender === 'user'
                        ? 'bg-violet-600 text-white contenedorCosas'
                        : 'bg-white shadow-sm contenedorCosas border'
                      }
                    `}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="border-t border-slate-200 p-4 bg-white">
              <div className="relative flex items-center">
                <textarea
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Escribe tu mensaje..."
                  rows={1}
                  className="
                    w-full px-4 py-3 pr-12 text-sm border border-slate-300 bg-white text-slate-900 contenedorCosas
                    focus:outline-none focus:border-violet-500 resize-none
                    min-h-[48px] max-h-32
                  "
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim()}
                  className={`
                    absolute right-2 p-2 contenedorCosas
                    ${input.trim()
                      ? 'text-violet-600 hover:bg-violet-50'
                      : 'text-slate-300 cursor-not-allowed'
                    }
                  `}
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}