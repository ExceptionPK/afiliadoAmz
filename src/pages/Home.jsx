import React, { useState, useEffect } from "react";
import MagicParticles from "../components/MagicParticles";
import { toast } from "sonner";
import {
    Link as LinkIcon,
    Copy,
    CheckCircle2,
    AlertCircle,
    Sparkles,
    ExternalLink,
} from "lucide-react";
import { addToHistory } from '../utils/storage';

const Button = ({ className = "", children, ...props }) => (
    <button
        {...props}
        className={`inline-flex items-center justify-center contenedorCosas px-4 py-2 font-semibold text-white bg-violet-600 hover:bg-violet-700 transition focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed ${className}`}
    >
        {children}
    </button>
);

const Input = ({ className = "", ...props }) => (
    <input
        {...props}
        className={`w-full px-4 py-2 border-2 border-slate-200 contenedorCosas text-base focus:outline-none focus:border-violet-500 transition ${className}`}
    />
);

const Card = ({ className = "", children }) => (
    <div
        className={`contenedorCosas bg-white p-8 shadow-xl shadow-slate-200/50 border border-slate-100 contenedorCosas transition-all duration-500 ${className}`}
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
            if (inputUrl === lastProcessedUrl && affiliateUrl) {
                return;
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
            setLastProcessedUrl(inputUrl);

            // Guardar en historial
            addToHistory({
                originalUrl: inputUrl,
                affiliateUrl: newAffiliateUrl,
                asin,
                domain,
            });

            // Notificación bonita
            toast.success("Enlace de afiliado generado", {
                duration: 4000,
            });

        } catch (err) {
            console.error("Error inesperado al generar enlace:", err);
            setError("Ocurrió un error al procesar la URL. Intenta con otro enlace.");
            toast.error("Error al generar el enlace");
        }
    };

    const copyToClipboard = async () => {
        // Si ya está copiado recientemente, no hacer nada
        if (copied) return;

        const textToCopy = affiliateUrl;

        // 1. Intento con Clipboard API moderno (el bueno)
        if (navigator.clipboard && window.isSecureContext) {
            try {
                await navigator.clipboard.writeText(textToCopy);
                setCopied(true);
                toast.success("¡Enlace copiado al portapapeles!", { duration: 2000 });
                setTimeout(() => setCopied(false), 2000);
                return;
            } catch (err) {
                console.log("Clipboard API falló (normal en móvil):", err);
                // No hacemos nada aún, pasamos al método infalible
            }
        }

        // 2. MÉTODO INFALIBLE 2025 PARA MÓVILES (funciona en el 99.9% de casos)
        const textArea = document.createElement("textarea");
        textArea.value = textToCopy;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        textArea.style.top = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        textArea.setSelectionRange(0, 99999); // Para iOS

        try {
            const successful = document.execCommand('copy');
            if (successful) {
                setCopied(true);
                toast.success("¡Enlace copiado!", { duration: 2000 });
                setTimeout(() => setCopied(false), 2000);
            } else {
                throw new Error("execCommand falló");
            }
        } catch (err) {
            console.log("Método antiguo también falló, abriendo WhatsApp como último recurso");
            // Solo aquí abrimos WhatsApp como último recurso
            const waText = encodeURIComponent(`Enlace de Amazon:\n${textToCopy}`);
            window.open(`https://api.whatsapp.com/send?text=${waText}`, '_blank');
            toast.info("Abierto en WhatsApp para copiar");
            setCopied(true); // Aunque no se copió, evitamos bucle
        } finally {
            document.body.removeChild(textArea);
        }
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
            <MagicParticles />
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
          animation: fadeIn 0.6s ease-out forwards;
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
                    <div className="absolute top-20 -left-20 w-96 h-96 bg-violet-200/20 contenedorCosas blur-3xl" />
                    <div className="absolute bottom-20 -right-20 w-96 h-96 bg-indigo-200/20 contenedorCosas blur-3xl" />
                </div>

                <div className="relative z-10 container mx-auto px-0 py-60 md:py-40">
                    {/* Header - Aparece suavemente */}
                    <div className="text-center mb-4 md:mb-10 opacity-0 animate-fade-in-down" style={{ animationDelay: "0.1s" }}>

                        <h1 className="text-2xl md:text-5xl text-slate-900 mb-2 tracking-tight">
                            Convierte tus enlaces de{" "}
                            <a
                                href="https://www.amazon.es"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent inline-block hover:from-violet-700 hover:to-indigo-700 transition-all duration-200 underline decoration-violet-600 underline-offset-2 hover:decoration-violet-700"
                            >
                                AMZ
                            </a>
                        </h1>

                        {/* <p className="texto-descriptivo">
                            Transforma cualquier URL de Amazon en un enlace de afiliado.
                        </p> */}
                    </div>

                    {/* Tarjeta principal */}
                    <div className="max-w-3xl mx-auto contenedorCosas opacity-0 animate-fade-in-up" style={{ animationDelay: "0.3s" }}>
                        <Card>
                            <div className="space-y-1.5">
                                {/* Input */}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-700 flex items-center gap-1">
                                        <LinkIcon className="w-4 h-4 text-violet-500" />
                                        URL
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
                                        <div className="relative p-4 bg-red-50 border border-red-100 contenedorCosas animate-fade-in">
                                            <AlertCircle className="absolute left-4 top-4 w-5 h-5 text-red-500" />
                                            <p className="text-sm text-red-700 text-center pr-8 pl-12">
                                                {error}
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {/* Botón generar */}
                                <Button
                                    onClick={generateAffiliateLink}
                                    disabled={!inputUrl}
                                    className="boton-gradiente w-full transition-all duration-300"
                                >
                                    Generar enlace
                                </Button>

                                {/* Separador bonito con animación */}
                                <div
                                    className={`overflow-hidden transition-all duration-700 ${showResult ? "max-h-32 opacity-100" : "max-h-0 opacity-0"
                                        }`}
                                >
                                    <div className="relative pt-14 animate-fade-in-down">  {/* ← py-4 en vez de py-6 */}
                                        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-px bg-gradient-to-r from-transparent via-violet-300 to-transparent" />
                                        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-px bg-gradient-to-r from-transparent via-violet-500 to-transparent opacity-50 blur-sm" />
                                        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                                            <div className="w-10 h-10 contenedorCosas bg-violet-100 border-4 border-white shadow-lg flex items-center justify-center">
                                                <Sparkles className="w-5 h-5 text-violet-600" />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Resultado - Input con botones integrados */}
                                <div className={`transition-all duration-600 ${showResult ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
                                    {affiliateUrl && (
                                        <div className="space-y-4 -mt-3 animate-fade-in">
                                            <div className="space-y-2">
                                                <label className="text-sm font-medium text-slate-700 flex items-center gap-1">
                                                    <LinkIcon className="w-4 h-4 text-violet-500" />
                                                    Afiliado
                                                </label>

                                                <div className="relative">
                                                    {/* Input real (oculto en móviles, visible en desktop) */}
                                                    <Input
                                                        value={affiliateUrl}
                                                        readOnly
                                                        className="pr-32 input-affiliate2 hidden md:block"
                                                    />

                                                    {/* Texto truncado en móviles (pero sigue siendo input para copiar) */}
                                                    <Input
                                                        value={affiliateUrl}
                                                        readOnly
                                                        className="pr-32 input-affiliate2 block md:hidden truncate"
                                                        style={{
                                                            paddingRight: '80px',
                                                        }}
                                                    />

                                                    {/* Botones integrados dentro del input */}
                                                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                                                        <button
                                                            onClick={copyToClipboard}
                                                            className={`p-2 contenedorCosas transition-all ${copied
                                                                ? "bg-green-100 text-green-600"
                                                                : "bg-slate-100 hover:bg-slate-200 text-slate-600"
                                                                }`}
                                                            title={copied ? "¡Copiado!" : "Copiar enlace"}
                                                        >
                                                            {copied ? (
                                                                <CheckCircle2 className="w-4 h-4" />
                                                            ) : (
                                                                <Copy className="w-4 h-4" />
                                                            )}
                                                        </button>

                                                        {/* Botón WhatsApp */}
                                                        <button
                                                            onClick={() => window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(affiliateUrl)}`, '_blank')}
                                                            className="p-2 bg-green-500 hover:bg-green-600 text-white contenedorCosas transition-all"
                                                            title="Compartir en WhatsApp"
                                                        >
                                                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                                                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.626.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.890-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488" />
                                                            </svg>
                                                        </button>


                                                        {/* <a
                                                            href={affiliateUrl}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="p-2 bg-violet-100 hover:bg-violet-200 text-violet-600 contenedorCosas transition-all"
                                                            title="Abrir en Amazon"
                                                        >
                                                            <ExternalLink className="w-4 h-4" />
                                                        </a> */}

                                                        {/* Botón Copiar */}

                                                    </div>
                                                </div>

                                                <div className="text-xs text-slate-500 pt-2 text-center">
                                                    ID de afiliado: <code className="bg-slate-100 rounded px-2 py-1 text-violet-600 font-mono">{AFFILIATE_ID}</code>
                                                </div>
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