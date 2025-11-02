import React, { useState, useEffect } from "react";
import {
    Link as LinkIcon,
    Copy,
    CheckCircle2,
    AlertCircle,
    Sparkles,
    ExternalLink,
} from "lucide-react";

const Button = ({ className = "", children, ...props }) => (
    <button
        {...props}
        className={`inline-flex items-center justify-center rounded-xl px-4 py-2 font-semibold text-white bg-violet-600 hover:bg-violet-700 transition focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed ${className}`}
    >
        {children}
    </button>
);

const Input = ({ className = "", ...props }) => (
    <input
        {...props}
        className={`w-full px-4 py-2 border-2 border-slate-200 rounded-xl text-base focus:outline-none focus:border-violet-500 transition ${className}`}
    />
);

const Card = ({ className = "", children }) => (
    <div
        className={`rounded-3xl bg-white p-8 shadow-xl shadow-slate-200/50 border border-slate-100 contenedorCosas transition-all duration-500 ${className}`}
    >
        {children}
    </div>
);

const AFFILIATE_ID = "dekolaps-21";

const safeNewURL = (url) => {
    try {
        return new URL(url);
    } catch {
        try {
            const fixed = url.startsWith("http")
                ? url.split("?")[0]
                : "https://" + url.split("?")[0];
            return new URL(fixed);
        } catch {
            return null;
        }
    }
};

export default function AmazonAffiliate() {
    const [inputUrl, setInputUrl] = useState("");
    const [lastProcessedUrl, setLastProcessedUrl] = useState("");
    const [affiliateUrl, setAffiliateUrl] = useState("");
    const [error, setError] = useState("");
    const [copied, setCopied] = useState(false);
    const [showResult, setShowResult] = useState(false);
    const [showError, setShowError] = useState(false);

    // === Animaciones controladas con useEffect ===
    useEffect(() => {
        if (affiliateUrl) {
            setShowResult(true);
        } else {
            setShowResult(false);
        }
    }, [affiliateUrl]);

    useEffect(() => {
        if (error) {
            setShowError(true);
        } else {
            setShowError(false);
        }
    }, [error]);

    const extractASIN = (url) => {
        const patterns = [
            /\/dp\/([A-Z0-9]{10})/i,
            /\/gp\/product\/([A-Z0-9]{10})/i,
            /\/product\/([A-Z0-9]{10})/i,
            /\/exec\/obidos\/ASIN\/([A-Z0-9]{10})/i,
        ];
        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match && match[1]) return match[1];
        }
        return null;
    };

    const isAmazonUrl = (url) => {
        const urlObj = safeNewURL(url);
        if (!urlObj) return false;
        return /amazon\./i.test(urlObj.hostname);
    };

    const getAmazonDomain = (url) => {
        const urlObj = safeNewURL(url);
        if (!urlObj) return "amazon.es";
        return urlObj.hostname;
    };

    const generateAffiliateLink = () => {
        try {
            // Si la URL no cambió → no hacer nada
            if (inputUrl === lastProcessedUrl && affiliateUrl) {
                return; // ← MANTIENE EL RESULTADO
            }

            setError("");
            setCopied(false);
            setShowResult(false);

            if (!inputUrl.trim()) {
                setError("Por favor, introduce una URL de Amazon");
                return;
            }

            if (!isAmazonUrl(inputUrl)) {
                setError("La URL introducida no es válida. Debe ser un enlace de Amazon.");
                return;
            }

            const asin = extractASIN(inputUrl);
            if (!asin) {
                setError("No se pudo encontrar el código ASIN del producto. Verifica la URL.");
                return;
            }

            const domain = getAmazonDomain(inputUrl);
            const newAffiliateUrl = `https://${domain}/dp/${asin}/ref=nosim?tag=${AFFILIATE_ID}`;

            setAffiliateUrl(newAffiliateUrl);
            setLastProcessedUrl(inputUrl); // ← Guardamos la URL procesada
            setShowResult(true); // ← Forzamos mostrar (aunque ya esté visible)

        } catch (err) {
            console.error("Error inesperado al generar enlace:", err);
            setError("Ocurrió un error al procesar la URL. Intenta con otro enlace.");
        }
    };

    const copyToClipboard = async () => {
        // 1. Intento moderno (funciona en tu móvil)
        if (navigator.clipboard && window.isSecureContext) {
            try {
                await navigator.clipboard.writeText(affiliateUrl);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
                return;
            } catch (e) { console.log("Clipboard API falló:", e); }
        }

        // 2. TRUCO 2025: Usa un INPUT oculto + select() + Clipboard API fallback
        const hiddenInput = document.createElement('input');
        hiddenInput.value = affiliateUrl;
        hiddenInput.style.position = 'fixed';
        hiddenInput.style.opacity = '0';
        hiddenInput.style.pointerEvents = 'none';
        hiddenInput.style.left = '-9999px';
        document.body.appendChild(hiddenInput);

        // ¡CLAVE! Focus + select EN EL MISMO EVENTO
        hiddenInput.focus();
        hiddenInput.select();
        hiddenInput.setSelectionRange(0, 99999); // Para móviles

        try {
            // Intenta Clipboard API aunque no sea secure context
            await navigator.clipboard.writeText(affiliateUrl);
            console.log("Copiado con Clipboard API fallback");
        } catch {
            // Si falla, abre WhatsApp/Telegram con el enlace
            const text = encodeURIComponent(`🔗 Mi enlace de Amazon:\n${affiliateUrl}`);
            const wa = `https://api.whatsapp.com/send?text=${text}`;
            window.open(wa, '_blank');
            setCopied(true);
            alert("¡Abierto en WhatsApp! Copia desde ahí 📱");
        }

        document.body.removeChild(hiddenInput);
        setCopied(true);
        setTimeout(() => setCopied(false), 3000);
    };

    const handleReset = () => {
        setInputUrl("");
        setAffiliateUrl("");
        setError("");
        setCopied(false);
        setShowResult(false);
        setShowError(false);
    };

    return (
        <>
            {/* === ESTILOS DE ANIMACIÓN === */}
            <style jsx>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes fadeInDown {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .animate-fade-in-up {
          animation: fadeInUp 0.6s ease-out forwards;
        }

        .animate-fade-in-down {
          animation: fadeInDown 0.6s ease-out forwards;
        }

        .animate-fade-in {
          animation: fadeIn 0.4s ease-out forwards;
        }

        .opacity-0 {
          opacity: 0;
        }

        .transition-all {
          transition: all 0.3s ease;
        }
      `}</style>

            <div className="min-h-screen contenedor-sombra">
                <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                    <div className="absolute top-20 -left-20 w-96 h-96 bg-violet-200/20 rounded-full blur-3xl" />
                    <div className="absolute bottom-20 -right-20 w-96 h-96 bg-indigo-200/20 rounded-full blur-3xl" />
                </div>

                <div className="relative z-10 container mx-auto px-4 py-12 md:py-20">
                    {/* Header - Aparece suavemente */}
                    <div className="text-center mb-12 md:mb-16 opacity-0 animate-fade-in-down" style={{ animationDelay: "0.1s" }}>
                        <div className="inline-flex items-center gap-2 bg-white/80 backdrop-blur-sm px-4 py-2 rounded-full border border-violet-100 mb-6 shadow-sm">
                            <Sparkles className="w-4 h-4 text-violet-500" />
                            <span className="text-sm font-medium text-slate-700">Made by PKM</span>
                        </div>

                        <h1 className="text-2xl md:text-5xl font-bold text-slate-900 mb-4 tracking-tight">
                            Convierte tus enlaces de{" "}
                            <span className="bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
                                Amazon
                            </span>
                        </h1>

                        <p className="texto-descriptivo">
                            Transforma cualquier URL de Amazon en un enlace de afiliado.
                        </p>
                    </div>

                    {/* Tarjeta principal */}
                    <div className="max-w-3xl mx-auto contenedorCosas opacity-0 animate-fade-in-up" style={{ animationDelay: "0.3s" }}>
                        <Card>
                            <div className="space-y-3">
                                {/* Input */}
                                <div className="space-y-3">
                                    <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                                        <LinkIcon className="w-4 h-4 text-violet-500" />
                                        URL de Amazon
                                    </label>

                                    <div className="relative">
                                        <Input
                                            value={inputUrl}
                                            onChange={(e) => setInputUrl(e.target.value)}
                                            onKeyDown={(e) => e.key === "Enter" && generateAffiliateLink()}
                                            placeholder="https://www.amazon.es/dp/B0DYDJRD74/..."
                                            className="input-affiliate"
                                        />
                                        {inputUrl && (
                                            <button
                                                onClick={handleReset}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
                                            >
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                                </svg>
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Error - Aparece suavemente */}
                                <div
                                    className={`overflow-hidden transition-all duration-300 ${showError ? "max-h-40 opacity-100" : "max-h-0 opacity-0"
                                        }`}
                                >
                                    {error && (
                                        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-100 rounded-lg animate-fade-in">
                                            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                                            <p className="text-sm text-red-700">{error}</p>
                                        </div>
                                    )}
                                </div>

                                {/* Botón generar */}
                                <Button
                                    onClick={generateAffiliateLink}
                                    disabled={!inputUrl}
                                    className="boton-gradiente w-full transition-all duration-300 hover:scale-105"
                                >
                                    <Sparkles className="w-5 h-5 mr-2" />
                                    Generar enlace
                                </Button>

                                {/* Resultado - Aparece suavemente */}
                                <div
                                    className={`transition-all duration-500 overflow-hidden ${showResult ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
                                        }`}
                                >
                                    {affiliateUrl && (
                                        <div className="space-y-4 pt-4 animate-fade-in-up">
                                            <div className="flex items-center gap-2 text-green-600">
                                                <CheckCircle2 className="w-5 h-5" />
                                                <span className="font-medium">
                                                    ¡Enlace generado correctamente!
                                                </span>
                                            </div>

                                            <div className="space-y-3">
                                                <label className="text-sm font-medium text-slate-700">
                                                    Tu enlace de afiliado
                                                </label>

                                                <div className="flex gap-2">
                                                    <div className="flex-1 relative">
                                                        <Input value={affiliateUrl} readOnly className="input-affiliate2 pr-10" />
                                                        <a
                                                            href={affiliateUrl}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-violet-500 hover:text-violet-700 transition"
                                                        >
                                                            <ExternalLink className="w-4 h-4" />
                                                        </a>
                                                    </div>

                                                    <Button
                                                        onClick={copyToClipboard}
                                                        className={`boton transition-all duration-300 ${copied ? "bg-green-600 hover:bg-green-700 scale-105" : ""
                                                            }`}
                                                    >
                                                        {copied ? (
                                                            <>
                                                                <CheckCircle2 className="w-4 h-4 mr-2" /> Copiado
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Copy className="w-4 h-4 mr-2" /> Copiar
                                                            </>
                                                        )}
                                                    </Button>
                                                </div>
                                            </div>

                                            <div className="text-xs text-slate-500 pt-2 text-center">
                                                ID de afiliado:{" "}
                                                <code className="bg-slate-100 rounded px-2 py-1 text-violet-600 font-mono">
                                                    {AFFILIATE_ID}
                                                </code>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </Card>
                    </div>
                </div>
            </div>
        </>
    );
}