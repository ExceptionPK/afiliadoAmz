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

    useEffect(() => {
        const check = () => {
            const history = getHistory();
            const item = history.find(h => h.asin === asin && h.domain === domain);
            if (item?.recommended?.length > 0) {
                // Filtramos títulos basura y cogemos solo 4 buenos
                const filtered = item.recommended
                    .filter(r => {
                        const title = r.title.toLowerCase();
                        return (
                            r.title &&
                            r.title.length > 10 &&
                            r.asin &&
                            r.asin !== asin && // no mostrar el producto actual
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
                    .slice(0, 4); // Solo 4 productos

                setRecs(filtered);
            }
        };

        check();
        const handler = () => check();
        window.addEventListener('amazon-history-updated', handler);
        return () => window.removeEventListener('amazon-history-updated', handler);
    }, [asin, domain]);

    if (recs.length === 0) return null;

    const openInNewTab = (asin) => {
        const url = `https://${domain}/dp/${asin}`;
        window.open(url, '_blank', 'noopener,noreferrer');
        toast.info("Abriendo en Amazon...");
    };

    const addToAffiliate = (r) => {
        const url = `https://${domain}/dp/${r.asin}`;
        const affiliateUrl = `${url}/ref=nosim?tag=${AFFILIATE_ID}`;
        
        setInputUrl(url);
        setAffiliateUrl(affiliateUrl);
        setLastProcessedUrl(url);
        
        addToHistory({
            originalUrl: url,
            affiliateUrl,
            asin: r.asin,
            domain,
        });
        
        toast.success("Producto añadido");
    };

    return (
        <div className="-mt-4 animate-fade-in-up">
            <div className="text-center mb-4">
                <h3 className="text-lg font-semibold text-slate-800 flex items-center justify-center gap-2">
                    Otros productos
                </h3>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {recs.map((r, i) => (
                    <div
                        key={i}
                        className="relative bg-white border border-slate-200 contenedorCosas p-3 text-left hover:shadow-lg hover:border-violet-400 transition-all duration-300 contenedorCosas text-xs flex flex-col justify-between"
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
                        
                        {/* Botón Añadir */}
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
        </div>
    );
};

export default RecommendedProducts;