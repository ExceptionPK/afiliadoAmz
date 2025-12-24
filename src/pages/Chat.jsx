// src/pages/Chat.jsx
import React, { useState, useRef, useEffect, useLayoutEffect } from "react";
import MagicParticles from "../components/MagicParticles";
import { Send, Sparkles } from "lucide-react";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// ¡¡¡TU API KEY AQUÍ!!!
const GEMINI_API_KEY = ""; // ← Pega la que copiaste

const Chat = () => {
    const [messages, setMessages] = useState([
        {
            id: 1,
            role: "assistant",
            content: "¡Hola! 👋 ¿En qué te ayudo hoy?",
            timestamp: Date.now()
        }
    ]);
    const [input, setInput] = useState("");
    const [isTyping, setIsTyping] = useState(false);
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useLayoutEffect(() => {
        window.scrollTo(0, 0);
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;

        const timer = setTimeout(() => {
            scrollToBottom();
        }, 150);

        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim()) return;

        const userMessage = {
            id: Date.now(),
            role: "user",
            content: input.trim(),
            timestamp: Date.now()
        };

        setMessages(prev => [...prev, userMessage]);
        setInput("");
        setIsTyping(true);

        try {
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        contents: [
                            {
                                role: "user",
                                parts: [{ text: input.trim() }]
                            }
                        ],
                        generationConfig: {
                            temperature: 0.8,
                            maxOutputTokens: 2048,
                        }
                    })
                }
            );

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error?.message || `Error HTTP ${response.status}`);
            }

            const data = await response.json();
            const assistantText = data.candidates?.[0]?.content?.parts?.[0]?.text || "No pude generar respuesta.";

            const assistantMessage = {
                id: Date.now() + 1,
                role: "assistant",
                content: assistantText,
                timestamp: Date.now()
            };

            setMessages(prev => [...prev, assistantMessage]);
        } catch (error) {
            console.error("Error Gemini:", error);
            setMessages(prev => [...prev, {
                id: Date.now() + 1,
                role: "assistant",
                content: `⚠️ Error: ${error.message}\n\n• Verifica que tu API key sea correcta\n• Puede que hayas alcanzado el límite diario gratuito\n• Intenta de nuevo en unas horas`,
                timestamp: Date.now()
            }]);
        } finally {
            setIsTyping(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const formatTime = (timestamp) => {
        return new Date(timestamp).toLocaleTimeString("es-ES", {
            hour: "2-digit",
            minute: "2-digit"
        });
    };

    return (
        <>
            <MagicParticles />

            <div className="fixed inset-0 z-10 flex flex-col">
                <div className="h-20 md:h-15 flex-shrink-0" />

                <div className="flex-1 flex items-center justify-center px-4 pb-8">
                    <div className="w-full max-w-3xl h-full max-h-[85vh] flex flex-col">
                        <div className="amazon-glass shadow-2xl border border-white/20 flex flex-col h-full animate-chat-entry">
                            <div className="flex-1 overflow-y-auto px-0 py-6 space-y-4 custom-scrollbar">
                                {messages.map((msg) => (
                                    <div
                                        key={msg.id}
                                        className={`flex items-end gap-3 animate-fade-in ${msg.role === "user" ? "flex-row-reverse" : ""}`}
                                    >
                                        {msg.role === "assistant" && (
                                            <div className="w-9 h-9 bg-violet-100/80 backdrop-blur-sm flex items-center justify-center flex-shrink-0 mb-6 border border-violet-200/50 contenedorCosas">
                                                <Sparkles className="w-5 h-5 text-violet-600" />
                                            </div>
                                        )}
                                        {msg.role === "user" && <div className="w-9 flex-shrink-0" />}

                                        <div
                                            className={`relative max-w-xs md:max-w-md px-4 py-2 contenedorCosas shadow-sm backdrop-blur-sm ${msg.role === "user"
                                                ? "bg-violet-600 text-white"
                                                : "bg-white/90 text-slate-800 border border-slate-200/40"
                                                }`}
                                        >
                                            <div className="text-sm leading-relaxed text-left">
                                                <ReactMarkdown
                                                    remarkPlugins={[remarkGfm]}
                                                    components={{
                                                        // Títulos con menos margen inferior
                                                        h1: ({ children }) => <h1 className="text-lg font-bold mb-2">{children}</h1>,
                                                        h2: ({ children }) => <h2 className="text-base font-bold mb-2">{children}</h2>,
                                                        h3: ({ children }) => <h3 className="text-sm font-bold mb-1.5">{children}</h3>,

                                                        // ¡Clave! Márgenes reducidos y eliminados al final
                                                        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                                                        hr: () => (
                                                            <hr className="my-5 border-t border-gray-300/60" />
                                                        ),

                                                        ul: ({ children }) => <ul className="list-disc pl-5 mb-2 space-y-0.5">{children}</ul>,
                                                        ol: ({ children }) => <ol className="list-decimal pl-5 mb-2 space-y-0.5">{children}</ol>,
                                                        li: ({ children }) => <li className="mb-0.5 last:mb-0">{children}</li>,

                                                        blockquote: ({ children }) => (
                                                            <blockquote className="border-l-4 border-violet-500 pl-4 py-1 my-2 italic opacity-90 bg-violet-50/50 contenedorCosas">
                                                                {children}
                                                            </blockquote>
                                                        ),

                                                        code: ({ inline, children }) =>
                                                            inline ? (
                                                                <code className="px-1.5 py-0.5 bg-black/10 font-mono text-xs">
                                                                    {children}
                                                                </code>
                                                            ) : (
                                                                <pre className="block px-3 py-2 my-2 bg-slate-900/90 text-slate-100 contenedorCosas text-xs font-mono overflow-x-auto border border-slate-700/50">
                                                                    <code>{children}</code>
                                                                </pre>
                                                            ),

                                                        a: ({ href, children }) => (
                                                            <a href={href} target="_blank" rel="noopener noreferrer" className={`underline hover:opacity-80 font-medium ${msg.role === "user" ? "text-violet-200" : "text-violet-600"
                                                                }`}>
                                                                {children}
                                                            </a>
                                                        ),

                                                        table: ({ children }) => (
                                                            <div className="overflow-x-auto my-2 -mx-4">
                                                                <table className="min-w-full border border-slate-300 contenedorCosas text-xs">
                                                                    {children}
                                                                </table>
                                                            </div>
                                                        ),
                                                        thead: ({ children }) => <thead className="bg-slate-100">{children}</thead>,
                                                        th: ({ children }) => <th className="px-3 py-1.5 text-left font-medium border-b border-slate-300">{children}</th>,
                                                        td: ({ children }) => <td className="px-3 py-1.5 border-b border-slate-200">{children}</td>,

                                                        pre: "div",
                                                    }}
                                                >
                                                    {msg.content}
                                                </ReactMarkdown>
                                            </div>

                                            {/* Timestamp más pegado y discreto */}
                                            <span className="text-xs opacity-60 block text-right mt-0.5">
                                                {formatTime(msg.timestamp)}
                                            </span>

                                            {/* Cola del globo (sin cambios) */}
                                            <div className={`absolute bottom-0 w-3 h-3 ${msg.role === "user" ? "right-0 -mr-2 translate-x-1/2" : "left-0 -ml-2 -translate-x-1/2"}`}>
                                                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className={msg.role === "user" ? "rotate-90" : "-rotate-90"}>
                                                    <path
                                                        d="M0 12 C 4 8, 8 4, 12 0 L 12 12 Z"
                                                        fill={msg.role === "user" ? "#7c3aed" : "rgba(255,255,255,0.8)"}
                                                    />
                                                </svg>
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                {isTyping && (
                                    <div className="flex items-end gap-3 animate-fade-in">
                                        <div className="w-9 h-9 bg-violet-100/80 backdrop-blur-sm flex items-center justify-center flex-shrink-0 border border-violet-200/50 contenedorCosas">
                                            <Sparkles className="w-5 h-5 text-violet-600" />
                                        </div>
                                        <div className="relative bg-white/90 backdrop-blur-sm px-4 py-2 contenedorCosas shadow-sm border border-slate-200/40">
                                            <div className="flex items-center gap-1">
                                                <div className="w-2 h-2 bg-slate-400 contenedorCosas animate-bounce" style={{ animationDelay: "0ms" }}></div>
                                                <div className="w-2 h-2 bg-slate-400 contenedorCosas animate-bounce" style={{ animationDelay: "150ms" }}></div>
                                                <div className="w-2 h-2 bg-slate-400 contenedorCosas animate-bounce" style={{ animationDelay: "300ms" }}></div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div ref={messagesEndRef} />
                            </div>

                            <div className="border-t border-white/20 backdrop-blur-sm p-0 flex-shrink-0">
                                <div className="flex items-end gap-3 p-4">
                                    <textarea
                                        value={input}
                                        onChange={(e) => setInput(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                        placeholder="Escribe tu mensaje aquí..."
                                        rows={1}
                                        className="flex-1 px-4 py-3 text-base text-slate-900 bg-white/80 border border-slate-300/50 focus:border-violet-500 focus:outline-none resize-none transition-all duration-200 backdrop-blur-sm contenedorCosas"
                                        style={{ minHeight: "48px", maxHeight: "120px" }}
                                        onInput={(e) => {
                                            e.target.style.height = "auto";
                                            e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
                                        }}
                                    />
                                    <button
                                        onClick={handleSend}
                                        disabled={!input.trim() || isTyping}
                                        className="w-12 h-12 bg-violet-600 hover:bg-violet-700 disabled:opacity-60 disabled:cursor-not-allowed text-white flex items-center justify-center shadow-lg transition-all duration-300 hover:scale-105 active:scale-95 contenedorCosas"
                                    >
                                        <Send className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <style jsx>{`
                @keyframes chat-entry {
                    from {
                        opacity: 0;
                        transform: translateY(20px) scale(0.98);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0) scale(1);
                    }
                }

                .animate-chat-entry {
                    animation: chat-entry 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
                }

                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(139, 92, 246, 0.2);
                    border-radius: 1px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: rgba(139, 92, 246, 0.4);
                }
            `}</style>
        </>
    );
};

export default Chat;