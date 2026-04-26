import React, { useState, useEffect } from "react";
import { Sparkles, Plus } from "lucide-react";
import { toast } from "sonner";

const RecommendedProducts = ({
    asin,
    domain,
    setInputUrl,
    setAffiliateUrl,
    setLastProcessedUrl,
    addToHistory,
    AFFILIATE_ID = "dekolaps-21"
}) => {
    const [recs, setRecs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [hasFailed, setHasFailed] = useState(false);

    useEffect(() => {
        setLoading(true);
        setHasFailed(false);
        setRecs([]);

        let timeoutId = null;

        // Función que recibe los recomendados del evento
        const handleRecommendedLoaded = (event) => {
            const { asin: eventAsin, domain: eventDomain, recommended } = event.detail;

            // Solo procesamos si coincide con el producto actual
            if (eventAsin === asin && eventDomain === domain && recommended?.length > 0) {
                const filtered = recommended
                    .filter(r => {
                        const title = (r.title || "").toLowerCase();
                        return (
                            r.title &&
                            r.title.length > 10 &&
                            r.asin &&
                            r.asin !== asin &&
                            !title.includes("valoración del anuncio") &&
                            !title.includes("patrocinado") &&
                            !title.includes("anuncio") &&
                            !title.includes("prime") &&
                            !title.includes("oferta") &&
                            !title.includes("descuento") &&
                            !title.includes("envío") &&
                            !title.includes("ahorro")
                        );
                    })
                    .slice(0, 4);

                if (filtered.length > 0) {
                    setRecs(filtered);
                    setLoading(false);
                    setHasFailed(false);
                    if (timeoutId) clearTimeout(timeoutId);
                }
            }
        };

        // Listener para los recomendados temporales
        window.addEventListener('recommended-products-loaded', handleRecommendedLoaded);

        // Timeout de seguridad (15 segundos)
        timeoutId = setTimeout(() => {
            if (loading && recs.length === 0) {
                setLoading(false);
                setHasFailed(true);
            }
        }, 15000);

        // Limpieza
        return () => {
            window.removeEventListener('recommended-products-loaded', handleRecommendedLoaded);
            if (timeoutId) clearTimeout(timeoutId);
        };
    }, [asin, domain]);

    const openInNewTab = (recAsin) => {
        const affiliateUrl = `https://${domain}/dp/${recAsin}/ref=nosim?tag=${AFFILIATE_ID}`;
        window.open(affiliateUrl, '_blank', 'noopener,noreferrer');
    };

    const addToAffiliate = (r) => {
        const baseUrl = `https://${domain}/dp/${r.asin}`;
        const affiliateUrl = `${baseUrl}/ref=nosim?tag=${AFFILIATE_ID}`;

        setInputUrl(baseUrl);
        setAffiliateUrl(affiliateUrl);
        setLastProcessedUrl(baseUrl);

        addToHistory({
            originalUrl: baseUrl,
            affiliateUrl,
            asin: r.asin,
            domain,
        });

        toast.success("Producto añadido a tu lista");
    };

    return (
        <div className="-mt-4 animate-fade-in-up">
            <div className="text-center mb-4">
            </div>

            {/* ESTADO DE CARGA */}
            {loading && (
                <div className="text-center py-8">
                    <div className="inline-flex items-center gap-2 text-slate-600">
                        <div className="flex gap-1">
                            <div className="w-2 h-2 bg-violet-600 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></div>
                            <div className="w-2 h-2 bg-violet-600 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></div>
                            <div className="w-2 h-2 bg-violet-600 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></div>
                        </div>
                        <span className="text-sm ml-2">Buscando productos similares...</span>
                    </div>
                </div>
            )}

            {/* ESTADO DE ERROR / NO DISPONIBLE */}
            {hasFailed && !loading && (
                <div className="text-center py-8">
                    <p className="text-sm text-slate-500">
                        No se pudieron cargar productos similares en este momento.
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                        Inténtalo de nuevo más tarde.
                    </p>
                </div>
            )}

            {/* PRODUCTOS REALES */}
            {!loading && !hasFailed && recs.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {recs.map((r) => (
                        <div
                            key={r.asin}
                            className="relative bg-white border border-slate-200 contenedorCosas p-3 text-left hover:shadow-lg hover:border-violet-400 transition-all duration-300 text-xs flex flex-col justify-between min-h-[140px]"
                        >
                            <div
                                onClick={() => openInNewTab(r.asin)}
                                className="cursor-pointer flex-1"
                            >
                                <div className="font-medium text-slate-700 line-clamp-3 leading-tight mb-2">
                                    {r.title}
                                </div>
                                <div className="text-slate-500 font-mono text-[10px] opacity-70">
                                    {r.asin}
                                </div>
                            </div>

                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    addToAffiliate(r);
                                }}
                                className="absolute bottom-3 right-3 p-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-full contenedorCosas transition-all shadow-md flex items-center justify-center"
                                title="Añadir como afiliado"
                            >
                                <Plus className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Mensaje cuando no hay recomendados después de cargar */}
            {!loading && !hasFailed && recs.length === 0 && (
                <div className="text-center py-6 text-slate-500 text-sm">
                    No se encontraron productos similares para este artículo.
                </div>
            )}
        </div>
    );
};

export default RecommendedProducts;