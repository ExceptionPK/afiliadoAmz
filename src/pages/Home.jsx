import React, { useState, useEffect } from "react";
import MagicParticles from "../components/MagicParticles";
import RecommendedProducts from "../components/RecommendedProducts";
import { toast } from "sonner";
import {
  Link as LinkIcon,
  Copy,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import { saveToHistory } from '../utils/supabaseStorage';

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
    className={`md:min-w-[680px] min-w-[375px] w-full bg-white md:p-8 p-5 shadow-2xl shadow-slate-900/10 backdrop-blur-sm border border-slate-200/70 contenedorCosas transition-all duration-500 ${className}`}
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

  // ← Ahora es async porque saveToHistory es async
  const generateAffiliateLink = async () => {
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
        setError("La URL no es válida. Debe ser un enlace de Amazon.");
        return;
      }

      const asin = extractASIN(inputUrl);
      if (!asin) {
        setError("No se pudo encontrar el ASIN del producto.");
        return;
      }

      const domain = getAmazonDomain(inputUrl);
      const newAffiliateUrl = `https://${domain}/dp/${asin}/ref=nosim?tag=${AFFILIATE_ID}`;

      setAffiliateUrl(newAffiliateUrl);
      setLastProcessedUrl(inputUrl);

      // Cambio principal: usamos saveToHistory en lugar de addToHistory
      await saveToHistory({
        originalUrl: inputUrl,
        affiliateUrl: newAffiliateUrl,
        asin,
        domain,
        // Opcional: puedes añadir más campos si ya los tienes disponibles
        // productTitle: "...",
        // shortLink: "...",
        // price: "...",
        // etc.
      });

      toast.success("Producto guardado", { duration: 1500 });
    } catch (err) {
      console.error("Error al generar/guardar enlace:", err);
      setError("Ocurrió un error al procesar la URL.");
      toast.error("Error al guardar el producto");
    }
  };

  const copyToClipboard = async () => {
    if (copied) return;

    const textToCopy = affiliateUrl;

    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(textToCopy);
        setCopied(true);
        toast.success("¡Enlace copiado al portapapeles!", { duration: 2000 });
        setTimeout(() => setCopied(false), 2000);
        return;
      } catch (err) {
        console.log("Clipboard API falló", err);
      }
    }

    // fallback antiguo...
    const textArea = document.createElement("textarea");
    textArea.value = textToCopy;
    textArea.style.position = "fixed";
    textArea.style.left = "-999999px";
    textArea.style.top = "-999999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    textArea.setSelectionRange(0, 99999);

    try {
      const successful = document.execCommand("copy");
      if (successful) {
        setCopied(true);
        toast.success("¡Enlace copiado!", { duration: 2000 });
        setTimeout(() => setCopied(false), 2000);
      } else {
        throw new Error("execCommand falló");
      }
    } catch (err) {
      const waText = encodeURIComponent(`Enlace de Amazon:\n${textToCopy}`);
      window.open(`https://api.whatsapp.com/send?text=${waText}`, "_blank");
      toast.info("Abierto en WhatsApp para copiar");
      setCopied(true);
    } finally {
      document.body.removeChild(textArea);
    }
  };

  const openInRealBrowser = (url) => {
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true ||
      document.referrer.includes("android-app://");

    if (!isStandalone) {
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }

    const a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.dispatchEvent(
      new MouseEvent("click", {
        view: window,
        bubbles: true,
        cancelable: true,
        buttons: 1,
      })
    );

    setTimeout(() => {
      try {
        window.location.href = `intent:${url}#Intent;scheme=https;package=com.android.chrome;end`;
      } catch (e) {
        window.location.href = `googlechrome://${url.replace(/^https?:\/\//, "")}`;
      }
    }, 300);
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

      <div className="min-h-screen">
        <div className="relative z-10 container mx-auto px-0 py-[200px] md:py-40">
          <div
            className="text-center mb-2 md:mb-2 opacity-0 animate-fade-in-down"
            style={{ animationDelay: "0.3s" }}
          >
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                openInRealBrowser("https://www.amazon.es/ref=nosim?tag=dekolaps-21");
              }}
              className="inline-block transition-all duration-300 hover:scale-105 active:scale-100 focus:outline-none group"
              aria-label="Ir a Amazon.es"
            >
              <img
                src="../amazon.svg"
                alt="Amazon"
                className="h-20 md:h-20 lg:h-20 amazon-morado amazon-glass"
              />
            </button>
          </div>

          <div
            className="max-w-3xl mx-auto contenedorCosas opacity-0 animate-fade-in-up"
            style={{ animationDelay: "0.3s" }}
          >
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
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <line x1="18" y1="6" x2="6" y2="18"></line>
                          <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                      </button>
                    )}
                  </div>
                </div>

                {/* Error */}
                <div
                  className={`overflow-hidden transition-all duration-300 ${
                    showError ? "max-h-40 opacity-100" : "max-h-0 opacity-0"
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
                  Guardar producto
                </Button>

                {/* Separador mágico */}
                <div
                  className={`overflow-hidden transition-all duration-700 ${
                    showResult ? "max-h-32 opacity-100" : "max-h-0 opacity-0"
                  }`}
                >
                  <div className="relative pt-14 animate-fade-in-down">
                    <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-px bg-gradient-to-r from-transparent via-violet-300 to-transparent" />
                    <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-px bg-gradient-to-r from-transparent via-violet-500 to-transparent opacity-50 blur-sm" />
                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                      <div className="w-10 h-10 contenedorCosas bg-violet-100 border-4 border-white shadow-lg flex items-center justify-center">
                        <Sparkles className="w-5 h-5 text-violet-600" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* PRODUCTOS RECOMENDADOS */}
                <div
                  className={`overflow-hidden transition-all duration-700 ${
                    showResult ? "max-h-screen opacity-100" : "max-h-0 opacity-0"
                  }`}
                >
                  <div className="mt-0 pt-3">
                    {affiliateUrl && lastProcessedUrl && (
                      <RecommendedProducts
                        asin={extractASIN(lastProcessedUrl)}
                        domain={getAmazonDomain(lastProcessedUrl)}
                        setInputUrl={setInputUrl}
                        setAffiliateUrl={setAffiliateUrl}
                        setLastProcessedUrl={setLastProcessedUrl}
                        addToHistory={saveToHistory}
                        AFFILIATE_ID={AFFILIATE_ID}
                      />
                    )}
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}