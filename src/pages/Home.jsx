import React, { useState } from "react";
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
    className={`rounded-3xl bg-white p-8 shadow-xl shadow-slate-200/50 border border-slate-100 contenedorCosas ${className}`}
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
  const [affiliateUrl, setAffiliateUrl] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

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

  // ✅ FIXED: SIN setTimeout, SIN isLoading
  const generateAffiliateLink = () => {
    try {
      setError("");
      setAffiliateUrl("");
      setCopied(false);

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

      // INSTANTÁNEO: Sin delay, sin loading
      const domain = getAmazonDomain(inputUrl);
      const newAffiliateUrl = `https://${domain}/dp/${asin}/ref=nosim?tag=${AFFILIATE_ID}`;
      setAffiliateUrl(newAffiliateUrl);
      
    } catch (err) {
      console.error("Error inesperado al generar enlace:", err);
      setError("Ocurrió un error al procesar la URL. Intenta con otro enlace.");
    }
  };

  const copyToClipboard = async () => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(affiliateUrl);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = affiliateUrl;
        textArea.style.position = "fixed";
        textArea.style.opacity = 0;
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }

      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Error al copiar:", err);
      alert("No se pudo copiar el enlace automáticamente. Cópialo manualmente.");
    }
  };

  const handleReset = () => {
    setInputUrl("");
    setAffiliateUrl("");
    setError("");
    setCopied(false);
  };

  return (
    <div className="min-h-screen contenedor-sombra">
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-20 -left-20 w-96 h-96 bg-violet-200/20 rounded-full blur-3xl" />
        <div className="absolute bottom-20 -right-20 w-96 h-96 bg-indigo-200/20 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 container mx-auto px-4 py-12 md:py-20">
        <div className="text-center mb-12 md:mb-16">
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

        <div className="max-w-3xl mx-auto contenedorCosas">
          <Card>
            <div className="space-y-3">
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
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-100 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <Button
                onClick={generateAffiliateLink}
                disabled={!inputUrl}
                className="boton-gradiente w-full"
              >
                <Sparkles className="w-5 h-5 mr-2" />
                Generar enlace
              </Button>

              {affiliateUrl && (
                <div className="space-y-4 pt-4">
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
                        <Input value={affiliateUrl} readOnly className="input-affiliate2" />
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
                        className={`boton ${copied ? "boton--copiado" : ""}`}
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
          </Card>
        </div>
      </div>
    </div>
  );
}