import React, { useState } from "react";
import {
  Link as LinkIcon,
  Copy,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ExternalLink
} from "lucide-react";

// === Componentes simples ===
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
    className={`rounded-3xl bg-white p-8 shadow-xl shadow-slate-200/50 border border-slate-100 ${className}`}
  >
    {children}
  </div>
);

// === ID de afiliado de Amazon ===
const AFFILIATE_ID = "dekolaps-21";

export default function AmazonAffiliate() {
  const [inputUrl, setInputUrl] = useState("");
  const [affiliateUrl, setAffiliateUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  // === Funciones seguras ===
  const extractASIN = (url) => {
    const patterns = [
      /\/dp\/([A-Z0-9]{10})/i,
      /\/gp\/product\/([A-Z0-9]{10})/i,
      /\/product\/([A-Z0-9]{10})/i,
      /\/exec\/obidos\/ASIN\/([A-Z0-9]{10})/i,
    ];
    for (const p of patterns) {
      const m = url.match(p);
      if (m) return m[1];
    }
    return null;
  };

  const getDomainFromUrl = (url) => {
    const match = url.match(/https?:\/\/([^/]+)/i);
    return match ? match[1] : "www.amazon.es";
  };

  const isAmazonUrl = (url) => /amazon\./i.test(url);

  const canUseClipboard = !!navigator.clipboard && window.isSecureContext;

  // === Lógica principal ===
  const generateAffiliateLink = () => {
    setError("");
    setAffiliateUrl("");
    setCopied(false);

    if (!inputUrl.trim()) {
      setError("Por favor, introduce una URL de Amazon");
      return;
    }

    if (!isAmazonUrl(inputUrl)) {
      setError("La URL introducida no es válida. Debe ser de Amazon.");
      return;
    }

    const asin = extractASIN(inputUrl);
    if (!asin) {
      setError("No se encontró el código ASIN del producto.");
      return;
    }

    setIsLoading(true);
    setTimeout(() => {
      const domain = getDomainFromUrl(inputUrl);
      const newAffiliateUrl = `https://${domain}/dp/${asin}/ref=nosim?tag=${AFFILIATE_ID}`;
      setAffiliateUrl(newAffiliateUrl);
      setIsLoading(false);
    }, 400);
  };

  const copyToClipboard = async () => {
    if (!canUseClipboard) {
      setError("Tu navegador no permite copiar automáticamente. Copia el texto manualmente.");
      return;
    }
    try {
      await navigator.clipboard.writeText(affiliateUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("No se pudo copiar. Copia el enlace manualmente.");
    }
  };

  const handleReset = () => {
    setInputUrl("");
    setAffiliateUrl("");
    setError("");
    setCopied(false);
  };

  // === Render ===
  return (
    <div className="min-h-screen bg-gradient-to-b from-violet-50 to-white flex flex-col justify-center items-center px-4 py-12">
      <div className="max-w-3xl w-full">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-white px-4 py-2 rounded-full border border-violet-100 shadow-sm mb-4">
            <Sparkles className="w-4 h-4 text-violet-500" />
            <span className="text-sm font-medium text-slate-700">Made by PKM</span>
          </div>
          <h1 className="text-3xl md:text-5xl font-bold text-slate-900 mb-2">
            Convierte tus enlaces de{" "}
            <span className="bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
              Amazon
            </span>
          </h1>
          <p className="text-slate-600">Transforma cualquier URL de Amazon en un enlace de afiliado.</p>
        </div>

        <Card>
          <div className="space-y-4">
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
                disabled={isLoading}
              />
              {inputUrl && (
                <button
                  onClick={handleReset}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  ✕
                </button>
              )}
            </div>

            {error && (
              <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-100 rounded-lg">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <Button onClick={generateAffiliateLink} disabled={isLoading || !inputUrl}>
              {isLoading ? "Generando..." : "Generar enlace"}
            </Button>

            {affiliateUrl && (
              <div className="space-y-3 pt-4">
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="font-medium">¡Enlace generado correctamente!</span>
                </div>

                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <Input value={affiliateUrl} readOnly />
                    <a
                      href={affiliateUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-violet-500 hover:text-violet-700"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                  <Button onClick={copyToClipboard}>
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
  );
}
