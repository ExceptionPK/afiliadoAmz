import React, { useState, useEffect } from "react";
import { Sparkles, ExternalLink, Plus } from "lucide-react";
import { getHistory } from "../utils/storage";
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
    const [loading, setLoading] = useState(true); // ← nuevo: estado de carga
    const [hasFailed, setHasFailed] = useState(false); // ← nuevo: si falló o timeout

    useEffect(() => {
        setLoading(true);
        setHasFailed(false);
        setRecs([]);

        let timeoutId = null;

        const check = () => {
            const history = getHistory();
            const item = history.find(h => h.asin === asin && h.domain === domain);

            if (item?.recommended?.length > 0) {
                const filtered = item.recommended
                    .filter(r => {
                        const title = r.title.toLowerCase();
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

        // Comprobación inmediata
        check();

        // Listener para actualizaciones
        const handler = () => check();
        window.addEventListener('amazon-history-updated', handler);

        // Timeout de seguridad: 20 segundos
        timeoutId = setTimeout(() => {
            if (loading && recs.length === 0) {
                setLoading(false);
                setHasFailed(true);
            }
        }, 10000); // 10 segundos

        return () => {
            window.removeEventListener('amazon-history-updated', handler);
            if (timeoutId) clearTimeout(timeoutId);
        };
    }, [asin, domain]);

    const openInNewTab = (asin) => {
        const affiliateUrl = `https://${domain}/dp/${asin}/ref=nosim?tag=${AFFILIATE_ID}`;
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
                <h3 className="text-lg font-semibold text-slate-800 flex items-center justify-center">
                    Productos similares
                </h3>
            </div>

            {/* ESTADO DE CARGA */}
            {loading && (
                <div className="text-center py-0">
                    <div className="inline-flex items-center gap-2 text-slate-600">
                        <div className="flex gap-1">
                            <div className="w-2 h-2 bg-violet-600 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></div>
                            <div className="w-2 h-2 bg-violet-600 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></div>
                            <div className="w-2 h-2 bg-violet-600 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></div>
                        </div>
                    </div>
                </div>
            )}

            {/* ESTADO DE ERROR / NO DISPONIBLE */}
            {hasFailed && !loading && (
                <div className="text-center py-0">
                    <p className="text-sm text-slate-500">
                        No se pudieron cargar productos similares en este momento.
                    </p>
                    <p className="text-xs text-slate-400 mt-0">
                        Puede volver a intentarlo más tarde.
                    </p>
                </div>
            )}

            {/* PRODUCTOS REALES */}
            {!loading && !hasFailed && recs.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {recs.map((r, i) => (
                        <div
                            key={r.asin}
                            className="relative bg-white border border-slate-200 contenedorCosas p-3 text-left hover:shadow-lg hover:border-violet-400 transition-all duration-300 text-xs flex flex-col justify-between"
                        >
                            <div
                                onClick={() => openInNewTab(r.asin)}
                                className="cursor-pointer"
                            >
                                <div className="font-medium text-slate-700 group-hover:text-violet-700 line-clamp-2 leading-tight">
                                    {r.title}
                                </div>
                                <div className="text-slate-500 mt-1 font-mono opacity-70">
                                    {r.asin}
                                </div>
                            </div>

                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    addToAffiliate(r);
                                }}
                                className="absolute bottom-2 right-2 p-1 botonesAniadirHome text-white contenedorCosas transition-all shadow-md flex items-center justify-center"
                                title="Añadir como afiliado"
                            >
                                <Plus className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default RecommendedProducts;