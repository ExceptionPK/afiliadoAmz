// components/ChatWidget.jsx
import { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, User, Bot } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import FeedbackFormContent from './FeedbackFormContent';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useLocation } from 'react-router-dom';

const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY || "";

function MessageContent({ text, isUser }) {
  const components = {
    // Personalizamos los enlaces
    a: ({ node, children, ...props }) => {
      // Truncamos visualmente si es muy largo (pero el href real queda completo)
      const displayText = typeof children === 'string' && children.length > 60
        ? children.slice(0, 40) + '...' + children.slice(-10)
        : children;

      return (
        <a
          {...props}
          target="_blank"
          rel="noopener noreferrer"
          className={`
            underline transition-colors
            ${isUser
              ? 'text-violet-100 hover:text-white'
              : 'text-violet-600 hover:text-violet-800'}
          `}
        >
          {displayText}
        </a>
      );
    },
    p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
    strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
    em: ({ children }) => <em className="italic">{children}</em>,
    ul: ({ children }) => <ul className="list-disc pl-5 mb-1.5 space-y-0.5">{children}</ul>,
    ol: ({ children }) => <ol className="list-decimal pl-5 mb-1.5 space-y-0.5">{children}</ol>,
    li: ({ children }) => <li className="mb-0.5">{children}</li>,
    code: ({ inline, children }) =>
      inline ? (
        <code className="bg-slate-200/70 px-1 py-0.5 rounded text-xs font-mono">{children}</code>
      ) : (
        <pre className="bg-slate-800/90 text-slate-100 p-2 rounded my-1.5 text-xs overflow-x-auto">
          <code>{children}</code>
        </pre>
      ),
  };

  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {text}
    </ReactMarkdown>
  );
}

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('chat');
  const [messages, setMessages] = useState([
    {
      id: 1,
      text: "¡Hola! ¿En qué te puedo ayudar?",
      sender: 'bot',
      timestamp: Date.now(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  const location = useLocation();
  const isAuthPage = location.pathname === '/auth';

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen && activeTab === 'chat') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'instant' });
      setTimeout(scrollToBottom, 50);
    }
  }, [messages, isTyping, isOpen, activeTab]);

  useEffect(() => {
    if (isOpen && activeTab === 'chat') {
      const timer = setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'instant' });
        setTimeout(scrollToBottom, 80);
      }, 180);

      return () => clearTimeout(timer);
    }
  }, [activeTab, isOpen]);

  const formatTime = (timestamp) => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Definición de tools para web search y browse Amazon
  const tools = [
    {
      type: "function",
      function: {
        name: "web_search",
        description: "Busca información actualizada en internet (precios Amazon, ofertas, reseñas, novedades 2025/2026). Úsala SIEMPRE que necesites datos post-2024.",
        parameters: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "La consulta de búsqueda precisa (ej: 'precio actual Amazon Echo Dot 2026' o 'mejores ofertas Prime Day 2026')",
            },
          },
          required: ["query"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "browse_amazon_page",
        description: "Lee el contenido de una página específica de Amazon para extraer precios, specs o disponibilidad actual.",
        parameters: {
          type: "object",
          properties: {
            url: {
              type: "string",
              description: "URL completa del producto en Amazon (ej: https://www.amazon.es/dp/B0XXXXXX)",
            },
            instructions: {
              type: "string",
              description: "Qué extraer exactamente (ej: 'precio actual, disponibilidad, rating promedio, características clave')",
            },
          },
          required: ["url", "instructions"],
        },
      },
    },
  ];

  const handleSend = async () => {
    if (!input.trim()) return;

    const now = Date.now();
    const userMsg = {
      id: now,
      text: input.trim(),
      sender: 'user',
      timestamp: now,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      const history = messages.map((msg) => ({
        role: msg.sender === 'bot' ? 'assistant' : 'user',
        content: msg.text,
      }));

      history.push({ role: 'user', content: input.trim() });

      const systemPrompt = {
        role: 'system',
        content: `Eres un amigo que ayuda con cosas de Amazon, hablas de forma normal y relajada como una persona real, nada de lenguaje de robot ni muy formal. 
Cuando te pido que generes un mensaje para alguien (por ejemplo "generame un mensaje para Teresa"), escribe exactamente un mensaje corto y natural como si lo estuviera mandando yo por WhatsApp o Instagram, sin sonar a vendedor profesional, sin exagerar, sin inventarte ofertas ni precios que no sepas, y sin poner emojis.

Si te pido recomendaciones, búsquedas o filtrados de productos, responde de manera clara y directa con lo que sabes de verdad, sin inventarte nada. Si no tienes información suficiente o actualizada, dilo sin rodeos.

Recuerda y haz referencia a lo que hablamos antes. 
No empieces conversaciones de cero si ya hemos hablado del tema.
Mantén el contexto de la conversación. Sé breve cuando no haga falta alargar. Usa alguna expresión coloquial de vez en cuando, como "pues mira", "la verdad es que", "no sé si te servirá pero...", pero sin pasarte.

IMPORTANTE: Tu entrenamiento base llega hasta 2024. Si te pregunto algo posterior a eso (como ofertas 2025 o 2026), usa la tool "web_search" o "browse_amazon_page" para obtener info actualizada y no inventes precios ni novedades. Describe la tool call claramente si es necesario, pero responde al usuario de forma natural una vez tengas el resultado.`,
      };

      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "meta-llama/llama-4-maverick-17b-128e-instruct",
          messages: [systemPrompt, ...history],
          temperature: 0.7,
          max_tokens: 400,
          top_p: 0.92,
          tools: tools,
          tool_choice: "auto",
        }),
      });

      if (!response.ok) throw new Error("Error en Groq API");

      const data = await response.json();
      let generated = "";
      let message = data.choices?.[0]?.message;

      if (message?.tool_calls) {
        // El modelo decidió usar una tool
        for (const toolCall of message.tool_calls) {
          const funcName = toolCall.function.name;
          const args = JSON.parse(toolCall.function.arguments);

          let toolResult = "";

          if (funcName === "web_search") {
            // Aquí llamas a TU backend o a una API de búsqueda (no puedes hacerlo directo desde frontend por CORS/seguridad)
            // Ejemplo: fetch a tu server que use SerpAPI, Tavily, Bing, etc.
            toolResult = await fetch(`/api/search?q=${encodeURIComponent(args.query)}`).then(r => r.json()).then(d => d.result || "No encontré info.");
          } else if (funcName === "browse_amazon_page") {
            toolResult = await fetch(`/api/browse?url=${encodeURIComponent(args.url)}&instructions=${encodeURIComponent(args.instructions)}`)
              .then(r => r.json())
              .then(d => d.content || "No pude leer la página.");
          }

          // Añade el resultado como mensaje de tool
          history.push({
            role: "tool",
            tool_call_id: toolCall.id,
            name: funcName,
            content: toolResult,
          });
        }

        // Vuelve a llamar a la API con el resultado de la tool para que genere la respuesta final
        const toolResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${GROQ_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "meta-llama/llama-4-maverick-17b-128e-instruct",
            messages: [systemPrompt, ...history],
            tools: tools,
            tool_choice: "auto",
          }),
        });

        const toolData = await toolResponse.json();
        generated = toolData.choices?.[0]?.message?.content?.trim() || "Error al procesar tool.";
      } else {
        generated = message?.content?.trim() || "Lo siento, hubo un error.";
      }

      generated = generated.replace(/^"(.+)"$/, '$1').trim();

      const botMsg = {
        id: Date.now() + 1,
        text: generated,
        sender: 'bot',
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          text: "Lo siento, hubo un error al procesar tu mensaje. Intenta de nuevo.",
          sender: 'bot',
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && activeTab === 'chat') {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {!isAuthPage && (
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`
          fixed bottom-6 right-6 z-50
          w-12 h-12 rounded-full bg-violet-500 text-white
          flex items-center justify-center shadow-lg
          hover:bg-violet-700 hover:scale-110 active:scale-95
          transition-all duration-300
          shadow-violet-500/50 hover:shadow-violet-600/60
        `}
          aria-label={isOpen ? "Cerrar" : "Abrir chat / sugerencias"}
        >
          <AnimatePresence mode="wait">
            {isOpen ? (
              <motion.div
                key="x"
                initial={{ rotate: -90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: 90, opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <X className="w-5 h-5" />
              </motion.div>
            ) : (
              <motion.div
                key="msg"
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.6, opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <MessageSquare className="w-5 h-5" />
              </motion.div>
            )}
          </AnimatePresence>
        </button>
      )}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.94 }}
            className={`
              fixed bottom-24 right-6 z-40
              w-80 sm:w-96 h-[520px] max-h-[82vh]
              bg-white shadow-2xl border border-slate-200
              rounded-2xl overflow-hidden flex flex-col
              contenedorCosas
            `}
          >
            <div className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white">
              <div className="px-0 pt-2 flex items-center justify-between"></div>
              <div className="flex border-b border-white/20 px-2">
                <button
                  onClick={() => setActiveTab('chat')}
                  className={`
                    flex-1 py-2.5 text-sm font-medium transition-colors
                    ${activeTab === 'chat' ? 'text-white border-b-2 border-white' : 'text-white/70 hover:text-white/90'}
                  `}
                >
                  Chat
                </button>
                <button
                  onClick={() => setActiveTab('suggestions')}
                  className={`
                    flex-1 py-2.5 text-sm font-medium transition-colors
                    ${activeTab === 'suggestions' ? 'text-white border-b-2 border-white' : 'text-white/70 hover:text-white/90'}
                  `}
                >
                  Sugerencias
                </button>
              </div>
            </div>

            <div className="flex-1 flex flex-col bg-slate-50/70 overflow-hidden text-slate-900">
              <AnimatePresence mode="wait">
                {activeTab === 'chat' ? (
                  <motion.div
                    key="chat"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    transition={{ duration: 0.18 }}
                    className="flex flex-col min-h-0 flex-1"
                  >
                    <div className="flex-1 text-left overflow-y-auto px-4 pt-4 pb-0 space-y-3 scrollbar-thin scrollbar-thumb-slate-300">
                      {messages.map((msg) => {
                        const isUser = msg.sender === 'user';

                        return (
                          <div
                            key={msg.id}
                            className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} gap-0.5`}
                          >
                            {/* Mensaje primero */}
                            <div className="max-w-[75%]">
                              <div
                                className={`
            px-4 py-3 text-sm rounded-xl leading-relaxed shadow-sm
            ${isUser
                                    ? 'bg-violet-600 text-white rounded-br-none'
                                    : 'bg-white border border-slate-200 text-slate-900 rounded-bl-none'}
          `}
                              >
                                <MessageContent text={msg.text} isUser={isUser} />
                              </div>
                            </div>

                            {/* Avatar + hora ABAJO, alineado según el lado */}
                            <div className={`flex items-center gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
                              {isUser ? (
                                <>
                                  <span className="text-[9px] text-slate-500 font-light opacity-80">
                                    {formatTime(msg.timestamp)}
                                  </span>
                                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gradient-to-br overflow-hidden border-2 border-white shadow-sm">
                                    <User className="w-full h-full p-1 text-violet-600 bg-violet-100" />
                                  </div>
                                </>
                              ) : (
                                <>
                                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gradient-to-br overflow-hidden border-2 border-white shadow-sm">
                                    <Bot className="w-full h-full p-1 text-indigo-600 bg-indigo-100" />
                                  </div>
                                  <span className="text-[9px] text-slate-500 font-light opacity-80">
                                    {formatTime(msg.timestamp)}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}

                      {isTyping && (
                        <div className="flex items-start gap-2 justify-start">
                          <div className="flex flex-col items-center">
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 overflow-hidden border-2 border-white shadow-sm">
                              <Bot className="w-full h-full p-1.5 text-indigo-600" />
                            </div>
                          </div>
                          <div className="max-w-[75%] px-4 py-3 text-sm rounded-2xl leading-relaxed bg-white border border-slate-200 shadow-sm">
                            <div className="flex items-center space-x-2">
                              <div className="w-2 h-2 bg-violet-500 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
                              <div className="w-2 h-2 bg-violet-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                              <div className="w-2 h-2 bg-violet-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                            </div>
                          </div>
                        </div>
                      )}

                      <div ref={messagesEndRef} className="min-h-[1px]" />
                    </div>

                    <div className="shrink-0 pl-4 pr-4 pt-4 pb-3 border-t border-slate-200 bg-white">
                      <div className="relative">
                        <textarea
                          value={input}
                          onChange={(e) => setInput(e.target.value)}
                          onKeyDown={handleKeyDown}
                          placeholder="Escribe tu mensaje..."
                          rows={1}
                          className="
                            w-full px-4 py-2.5 pr-12 text-sm border border-slate-300 rounded-full
                            focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-300
                            resize-none min-h-[44px] max-h-[120px] overflow-hidden
                            text-slate-900 bg-slate-100 placeholder-slate-500 contenedorCosas
                          "
                        />
                        <button
                          onClick={handleSend}
                          disabled={!input.trim() || isTyping}
                          className={`
                            absolute right-3 top-6 -translate-y-1/2 p-1.5 rounded-full transition-colors
                            ${input.trim() && !isTyping
                              ? 'text-violet-600 hover:text-violet-800 hover:bg-violet-50'
                              : 'text-slate-400 cursor-not-allowed'}
                          `}
                        >
                          <Send className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="suggestions"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.18 }}
                    className="flex-1 overflow-y-auto"
                  >
                    <FeedbackFormContent onClose={() => setIsOpen(false)} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}