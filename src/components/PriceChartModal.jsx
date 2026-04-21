// components/PriceChartModal.jsx
import React, { useState, useMemo, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, ExternalLink, TrendingUp, ChevronDown } from "lucide-react";
import {
    AreaChart,
    Area,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend,
} from "recharts";

const CustomSelect = ({ options, value, onChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const selected = options.find((opt) => opt.value === value);

    return (
        <div className="relative w-full sm:w-56" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="contenedorCosas w-full bg-white border border-slate-300 hover:border-violet-400 px-4 py-2.5 text-sm font-medium text-slate-900 flex items-center justify-between transition-all active:scale-[0.985]"
            >
                <span className="truncate">{selected?.label}</span>
                <ChevronDown
                    className={`w-4 h-4 text-slate-400 transition-transform duration-300 flex-shrink-0 ${isOpen ? "rotate-180" : ""
                        }`}
                />
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-full bg-white contenedorCosas border border-slate-200 contenedorCosas shadow-2xl overflow-hidden z-50 
                        animate-in fade-in slide-in-from-top-2 duration-200 origin-top scale-95 transition-all">
                    <div className="py-0 max-h-[260px] overflow-auto">
                        {options.map((option) => (
                            <button
                                key={option.value}
                                onClick={() => {
                                    onChange(option.value);
                                    setIsOpen(false);
                                }}
                                className={`w-full px-5 py-3 text-left text-sm hover:bg-violet-50 transition-colors 
                  ${option.value === value ? 'bg-violet-100 text-violet-700 font-medium' : 'text-slate-700'}
                  ${option.value === value ? '' : 'hover:bg-violet-50'}`}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

const PriceChartModal = ({ product, isOpen, onClose }) => {
    if (!isOpen || !product) return null;

    const [selectedPeriod, setSelectedPeriod] = useState("all");
    const [viewMode, setViewMode] = useState("both");
    const [chartType, setChartType] = useState("line");

    // ====================== FUNCIÓN EXPORTAR CSV ======================
    // Reemplaza tu función exportToCSV actual por esta:
    const exportToCSV = () => {
        const history = product.prices_history || product.prices || [];

        if (!history || history.length === 0) {
            alert("No hay datos históricos disponibles para exportar.");
            return;
        }

        const rows = history.map((entry) => {
            const date = new Date(entry.timestamp);

            // Manejo más robusto del precio
            const precioActualStr = entry.price || "";
            const precioActual = parseFloat(precioActualStr.replace(/[^0-9.,]/g, "").replace(",", ".")) || 0;

            // Soporta tanto "originalPrice" como "original_price"
            let precioOriginal = 0;
            if (entry.originalPrice) {
                precioOriginal = parseFloat(entry.originalPrice.replace(/[^0-9.,]/g, "").replace(",", ".")) || 0;
            } else if (entry.original_price) {
                precioOriginal = parseFloat(entry.original_price.replace(/[^0-9.,]/g, "").replace(",", ".")) || 0;
            } else {
                precioOriginal = precioActual;
            }

            const diferencia = precioActual - precioOriginal;
            const diferenciaPorcentaje = precioOriginal > 0
                ? ((diferencia / precioOriginal) * 100).toFixed(2)
                : "0.00";

            return {
                Fecha: date.toLocaleDateString("es-ES", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric"
                }),
                Hora: date.toLocaleTimeString("es-ES", {
                    hour: "2-digit",
                    minute: "2-digit"
                }),
                "Precio Actual (€)": precioActual.toFixed(2),
                "Precio Original (€)": precioOriginal.toFixed(2),
                "Diferencia (€)": diferencia.toFixed(2),
                "Diferencia (%)": `${diferenciaPorcentaje}%`,
                Tipo: entry.type || "scrape",
                Nota: entry.note || ""
            };
        });

        // Crear CSV
        const headers = Object.keys(rows[0]);
        const csvContent = [
            headers.join(";"),
            ...rows.map(row =>
                headers.map(header => {
                    const value = row[header] ?? "";
                    return `"${String(value).replace(/"/g, '""')}"`;
                }).join(";")
            )
        ].join("\n");

        // Descargar
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        const fileName = `historial_precios_${product.asin || "producto"}_${new Date().toISOString().slice(0, 10)}.csv`;

        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };
    // ================================================================

    const prepareChartData = (pricesHistory) => {
        if (!Array.isArray(pricesHistory) || pricesHistory.length === 0) return [];

        let data = pricesHistory.map((entry) => {
            const date = new Date(entry.timestamp);

            const precioActual = parseFloat(
                (entry.price || "").replace(/[^0-9.,]/g, "").replace(",", ".")
            ) || 0;

            // Soporte para original_price y originalPrice
            let precioOriginal = null;
            if (entry.original_price) {
                precioOriginal = parseFloat(
                    entry.original_price.replace(/[^0-9.,]/g, "").replace(",", ".")
                ) || null;
            } else if (entry.originalPrice) {
                precioOriginal = parseFloat(
                    entry.originalPrice.replace(/[^0-9.,]/g, "").replace(",", ".")
                ) || null;
            }

            return {
                timestamp: date.getTime(),
                dateObj: date,
                Precio: precioActual,
                "Precio Original": precioOriginal,        // puede ser null
                fullLabel: date.toLocaleString("es-ES", {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                }),
            };
        });

        data.sort((a, b) => a.timestamp - b.timestamp);
        return data;
    };

    const rawData = prepareChartData(product.prices_history || product.prices || []);

    const filteredData = useMemo(() => {
        if (selectedPeriod === "all") return rawData;

        const now = Date.now();
        let days = 30;

        switch (selectedPeriod) {
            case "7d": days = 7; break;
            case "30d": days = 30; break;
            case "90d": days = 90; break;
            case "180d": days = 180; break;
            case "1y": days = 365; break;
            default: days = 30;
        }

        const cutoff = now - days * 24 * 60 * 60 * 1000;

        const filtered = rawData.filter((item) => item.timestamp >= cutoff);

        // DEBUG: Muestra en consola cuántos datos quedan después del filtro
        console.log(`Período: ${selectedPeriod} | Datos después del filtro: ${filtered.length}`);

        return filtered;
    }, [rawData, selectedPeriod]);

    const chartData = useMemo(() => {
        return filteredData.map((item) => ({
            // Formato corto: "07/2025", "02/2026"
            date: item.dateObj.toLocaleDateString("es-ES", {
                month: "2-digit",
                year: "numeric"
            }).replace("/", "/"),   // 07/2025

            fullLabel: item.fullLabel,
            Precio: item.Precio,
            "Precio Original": item["Precio Original"] !== null && item["Precio Original"] !== undefined
                ? item["Precio Original"]
                : null,

            // Para el tooltip (más legible)
            fullDate: item.dateObj.toLocaleDateString("es-ES", {
                day: "2-digit",
                month: "long",
                year: "numeric"
            }) + " " + item.dateObj.toLocaleTimeString("es-ES", {
                hour: "2-digit",
                minute: "2-digit"
            })
        }));
    }, [filteredData]);

    useEffect(() => {
        if (!isOpen) return;

        const handleContextMenu = (e) => {
            // Si el clic derecho ocurre DENTRO del modal, bloqueamos SOLO el menú de tu app
            if (e.target.closest('.price-chart-modal-content')) {
                // Permitimos el menú nativo del navegador, pero detenemos la propagación
                // hacia el HistoryItem
                e.stopPropagation();
                // NO hacemos preventDefault() para que aparezca el menú del navegador
            }
        };

        document.addEventListener('contextmenu', handleContextMenu, true); // capture phase

        return () => {
            document.removeEventListener('contextmenu', handleContextMenu, true);
        };
    }, [isOpen]);

    const periods = [
        { value: "7d", label: "7 días" },
        { value: "30d", label: "1 mes" },
        { value: "180d", label: "6 meses" },
        { value: "1y", label: "1 año" },
        { value: "all", label: "Desde siempre" },
    ];

    const viewOptions = [
        { value: "both", label: "Ambos" },
        { value: "price", label: "Precio" },
        { value: "original", label: "Original" },
    ];

    const chartTypeOptions = [
        { value: "line", label: "Gráfico de líneas" },
        { value: "bar", label: "Gráfico de barras" },
    ];

    const CustomTooltip = ({ active, payload }) => {
        if (!active || !payload || payload.length === 0) return null;
        return (
            <div className="bg-white border border-slate-200 contenedorCosas shadow-2xl p-4 text-sm min-w-[200px]">
                <p className="font-medium text-slate-500 mb-3 border-b pb-2">{payload[0].payload.fullLabel}</p>
                {payload.map((entry) => (
                    <div key={entry.name} className="flex justify-between items-center gap-6 py-1">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 contenedorCosas" style={{ backgroundColor: entry.color }} />
                            <span className="text-slate-700">{entry.name}</span>
                        </div>
                        <span className="font-semibold text-slate-900">{entry.value.toFixed(2)} €</span>
                    </div>
                ))}
            </div>
        );
    };

    const showPrice = viewMode === "both" || viewMode === "price";
    const showOriginal = viewMode === "both" || viewMode === "original";

    return createPortal(
        <div className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-xl flex items-center justify-center p-4"
            onContextMenu={(e) => e.stopPropagation()}>
            <div className="bg-white contenedorCosas rounded-3xl shadow-2xl w-full max-w-7xl max-h-[94vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-300 origin-center">

                {/* Header */}
                <div className="bg-gradient-to-r from-violet-600 to-purple-600 text-white px-6 py-5 flex items-center relative">
                    <div className="flex-1 text-center">
                        <p className="font-mono text-xs tracking-widest opacity-90">{product.asin}</p>
                        <h2 className="text-2xl font-semibold mt-1 leading-tight px-8">
                            {product.productTitle}
                        </h2>
                    </div>

                    <button
                        onClick={onClose}
                        className="absolute right-2 top-8 md:right-4 md:top-1/2 -translate-y-1/2 p-3 hover:bg-white/20 contenedorCosas transition-colors"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="flex-1 overflow-auto p-6 md:p-8">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10">

                        {/* Panel izquierdo */}
                        <div className="lg:col-span-4 bg-slate-50 contenedorCosas rounded-3xl p-6 lg:p-8 flex flex-col">
                            <h3 className="text-sm text-center uppercase tracking-widest text-slate-500 font-medium mb-6">PRECIOS</h3>

                            <div className="space-y-5 flex-1">
                                <div className="flex justify-between items-center bg-white contenedorCosas px-5 py-4 shadow-sm">
                                    <span className="text-slate-600 text-[15px]">Actual</span>
                                    <span className="font-semibold text-emerald-600 text-2xl tracking-tight">
                                        {product.price || "—"}
                                    </span>
                                </div>

                                <div className="flex justify-between items-center bg-white contenedorCosas px-5 py-4 shadow-sm">
                                    <span className="text-slate-600 text-[15px]">Original</span>
                                    <span className="font-semibold text-slate-700 text-2xl tracking-tight line-through">
                                        {product.originalPrice || "—"}
                                    </span>
                                </div>

                                <div className="flex justify-between items-center bg-white contenedorCosas px-5 py-4 shadow-sm">
                                    <span className="text-slate-600 text-[15px]">Primero</span>
                                    <span className="font-semibold text-amber-600 text-2xl tracking-tight">
                                        {product.first_ever_price || "—"}
                                    </span>
                                </div>
                            </div>

                            {/* Botones de acción */}
                            <div className="mt-auto pt-8 flex flex-col gap-3">
                                <button
                                    onClick={exportToCSV}
                                    className="w-full flex items-center justify-center gap-2 bg-white hover:bg-slate-50 border border-slate-300 hover:border-slate-400 text-slate-700 font-medium py-3 px-6 contenedorCosas transition-all active:scale-[0.985]"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17l-4-4m0 0l-4 4m4-4v12M3 7h18" />
                                    </svg>
                                    Exportar seguimiento
                                </button>

                                <a
                                    href={product.affiliateUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center justify-center gap-2 text-violet-600 hover:text-violet-700 font-medium transition py-3"
                                >
                                    Ver en Amazon
                                    <ExternalLink className="w-4 h-4" />
                                </a>
                            </div>
                        </div>

                        {/* Gráfico */}
                        <div className="lg:col-span-8 flex flex-col">
                            <div className="grid grid-cols-3 gap-2 mb-8 px-2">
                                <CustomSelect options={viewOptions} value={viewMode} onChange={setViewMode} />
                                <CustomSelect options={chartTypeOptions} value={chartType} onChange={setChartType} />
                                <CustomSelect options={periods} value={selectedPeriod} onChange={setSelectedPeriod} />
                            </div>

                            {chartData.length >= 1 ? (
                                <div className="flex-1 bg-white contenedorCosas rounded-3xl p-0 md:p-0 min-h-[480px] lg:min-h-[520px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        {chartType === "line" ? (
                                            <AreaChart data={chartData} margin={{ top: 0, right: 10, left: -35, bottom: -20 }}>
                                                <defs>
                                                    <linearGradient id="colorPrecio" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.32} />
                                                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.08} />
                                                    </linearGradient>
                                                    <linearGradient id="colorOriginal" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.06} />
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} />
                                                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} />
                                                <Tooltip content={<CustomTooltip />} />
                                                <Legend verticalAlign="bottom" height={45} wrapperStyle={{ fontSize: '13px', color: '#475569' }} />

                                                {/* Precio Actual - Siempre se muestra */}
                                                {showPrice && (
                                                    <Area
                                                        type="natural"
                                                        dataKey="Precio"
                                                        stroke="#8b5cf6"
                                                        strokeWidth={3.5}
                                                        fill="url(#colorPrecio)"
                                                        name="Precio"
                                                        dot={false}
                                                    />
                                                )}

                                                {/* Precio Original - Solo se muestra si hay datos reales de original_price */}
                                                {showOriginal && chartData.some(item => item["Precio Original"] !== null) && (
                                                    <Area
                                                        type="natural"
                                                        dataKey="Precio Original"
                                                        stroke="#3b82f6"
                                                        strokeWidth={3}
                                                        fill="url(#colorOriginal)"
                                                        name="Precio Original"
                                                        dot={false}
                                                    />
                                                )}
                                            </AreaChart>
                                        ) : (
                                            <BarChart data={chartData} margin={{ top: 0, right: 10, left: -35, bottom: -20 }}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} />
                                                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} />
                                                <Tooltip content={<CustomTooltip />} />
                                                <Legend verticalAlign="bottom" height={45} wrapperStyle={{ fontSize: '13px', color: '#475569' }} />

                                                {showOriginal && <Bar dataKey="Precio Original" fill="#3b82f6" name="Precio Original" radius={[2, 2, 0, 0]} />}
                                                {showPrice && <Bar dataKey="Precio" fill="#8b5cf6" name="Precio" radius={[2, 2, 0, 0]} />}
                                            </BarChart>
                                        )}
                                    </ResponsiveContainer>
                                </div>
                            ) : (
                                <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 contenedorCosas rounded-3xl border border-dashed border-slate-300 min-h-[519px]">
                                    <TrendingUp className="w-20 h-20 text-slate-300 mb-4" />
                                    <p className="text-slate-500 text-lg">No hay datos en el período seleccionado</p>
                                    <p className="text-slate-400 text-sm mt-1 text-center max-w-[280px]">
                                        Prueba seleccionando "Desde siempre" o un período más amplio.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default PriceChartModal;