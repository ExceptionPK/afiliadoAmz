// pages/History.jsx
import React, { useState, useEffect, useMemo, useRef } from "react";
import MagicParticles from "../components/MagicParticles";
import { toast } from "sonner";
import { createPortal } from "react-dom";
import {
    Search,
    Copy,
    ExternalLink,
    Trash2,
    Download,
    Upload,
    Calendar,
    Globe,
    Package,
    X,
} from "lucide-react";
import {
    getHistory,
    removeFromHistory,
    clearHistory,
    importHistory,
} from "../utils/storage";

const HistoryItem = ({ item: propItem, onDelete, setHistory }) => {
    const [copied, setCopied] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [editTitle, setEditTitle] = useState("");
    const [localTitle, setLocalTitle] = useState(propItem.productTitle);
    const inputRef = useRef(null);

    useEffect(() => {
        setLocalTitle(propItem.productTitle);
    }, [propItem.productTitle]);

    const startEditing = (e) => {
        e.stopPropagation();
        setEditingId(propItem.id);
        setEditTitle(localTitle);
        setTimeout(() => inputRef.current?.focus(), 50);
    };

    const saveTitle = () => {
        const newTitle = editTitle.trim().slice(0, 120);

        if (!newTitle || newTitle === localTitle) {
            setEditingId(null);
            return;
        }

        setLocalTitle(newTitle);

        const history = getHistory();
        const updated = history.map(h =>
            h.id === propItem.id ? { ...h, productTitle: newTitle } : h
        );
        localStorage.setItem('amazon-affiliate-history', JSON.stringify(updated));

        try {
            const cache = getTitleCache();
            cache[propItem.asin] = newTitle;
            saveTitleCache(cache);
        } catch (err) {
            console.warn("Error actualizando caché de títulos", err);
        }

        setHistory(updated);
        setEditingId(null);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            inputRef.current?.blur();
        } else if (e.key === 'Escape') {
            setEditingId(null);
            setEditTitle("");
        }
    };

    const share = (platform) => {
        const text = encodeURIComponent(`${propItem.affiliateUrl}`);
        const urls = {
            whatsapp: `https://api.whatsapp.com/send?text=${text}`,
            telegram: `https://t.me/share/url?url=${text}`,
        };
        window.open(urls[platform], "_blank");
    };

    return (
        <div className="bg-white border border-slate-200 contenedorCosas p-4 hover:shadow-md transition">
            <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1 text-xs text-slate-500 mb-1">
                        <Package className="w-3 h-3" />
                        <code className="font-mono">{propItem.asin}</code>

                        <span className="text-slate-400">·</span>   {/* separador */}

                        <Globe className="w-3 h-3" />
                        <span>{propItem.domain}</span>
                    </div>

                    <div className="min-h-6 relative">
                        {editingId === propItem.id ? (
                            <input
                                ref={inputRef}
                                type="text"
                                value={editTitle}
                                onChange={(e) => setEditTitle(e.target.value)}
                                onBlur={saveTitle}
                                onKeyDown={handleKeyDown}
                                className="input-edit w-full px-2 py-1 text-sm font-medium text-slate-900 bg-violet-50 border border-violet-400 contenedorCosas focus:outline-none focus:ring-violet-500 transition"
                                style={{ animation: 'fadeInScale 0.15s ease-out forwards' }}
                            />
                        ) : (
                            <p
                                onClick={startEditing}
                                className="title-normal text-sm font-medium text-slate-900 truncate cursor-pointer hover:text-violet-700 transition select-none"
                                title="Clic para renombrar"
                                style={{ animation: 'fadeIn 0.15s ease-out forwards' }}
                            >
                                {localTitle}
                            </p>
                        )}
                    </div>

                    <p className="text-xs text-slate-500 mt-1">
                        <Calendar className="w-3 h-3 inline mr-1" />
                        {new Date(propItem.timestamp).toLocaleString("es-ES")}
                    </p>
                </div>

                <div className="flex gap-1 flex-shrink-0">
                    <a
                        href={propItem.affiliateUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 contenedorCosas hover:bg-slate-100 transition"
                        title="Abrir"
                    >
                        <ExternalLink className="w-4 h-4 text-slate-600" />
                    </a>
                    <button
                        onClick={() => share("whatsapp")}
                        className="p-2 contenedorCosas hover:bg-slate-100 transition"
                        title="WhatsApp"
                    >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="#25D366">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.626.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.890-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488" />
                        </svg>
                    </button>
                    <button
                        onClick={() => onDelete(propItem.id)}
                        className="p-2 contenedorCosas hover:bg-red-50 text-red-600 transition"
                        title="Eliminar"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default function HistoryPage() {
    const [history, setHistory] = useState([]);
    const [search, setSearch] = useState("");
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [showExportMenu, setShowExportMenu] = useState(false);
    const exportButtonRef = useRef(null);

    useEffect(() => {
        setHistory(getHistory());
    }, []);

    // Cerrar menú al hacer clic fuera
    const handleClickOutside = (e) => {
        if (exportButtonRef.current && !exportButtonRef.current.contains(e.target)) {
            setShowExportMenu(false);
        }
    };

    // Usa "click" en vez de "mousedown" (más fiable)
    useEffect(() => {
        if (!showExportMenu) return;

        const handler = (e) => handleClickOutside(e);
        document.addEventListener("click", handler);
        return () => document.removeEventListener("click", handler);
    }, [showExportMenu]); // ← solo cuando se abre

    const filtered = useMemo(() => {
        if (!search.trim()) return history;
        const lower = search.toLowerCase();
        return history.filter(
            (item) =>
                item.asin.toLowerCase().includes(lower) ||
                item.originalUrl.toLowerCase().includes(lower) ||
                item.domain.toLowerCase().includes(lower)
        );
    }, [history, search]);

    const stats = useMemo(() => {
        const domains = [...new Set(history.map((h) => h.domain))];
        const last7days = history.filter(
            (h) => new Date(h.timestamp) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        ).length;
        return { total: history.length, domains: domains.length, last7days };
    }, [history]);

    const handleDelete = (id) => {
        removeFromHistory(id);
        setHistory(getHistory());
        toast.success("Enlace eliminado");
    };

    const handleClear = () => {
        setShowConfirmModal(true);
    };

    const confirmClear = () => {
        clearHistory();
        setHistory([]);
        setShowConfirmModal(false);
        toast.success("Historial borrado");
    };

    const cancelClear = () => {
        setShowConfirmModal(false);
    };

    const handleImport = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        importHistory(file, (success) => {
            if (success) {
                setHistory(getHistory());
                toast.success("Historial importado");
            } else {
                toast.error("Archivo inválido");
            }
        });
    };

    // === NUEVA FUNCIÓN: EXPORTAR EN VARIOS FORMATOS ===
    const handleExportFormat = (format) => {
        const data = getHistory();
        if (!data.length) return;

        let content = "";
        let filename = `amazon-affiliate-history.${format}`;
        let mimeType = "text/plain";

        switch (format) {
            case "json":
                content = JSON.stringify(data, null, 2);
                mimeType = "application/json";
                break;

            case "csv":
                const headers = ["ASIN", "Título", "Dominio", "URL Afiliado", "Fecha"];
                const rows = data.map(item => [
                    item.asin,
                    `"${(item.productTitle || "").replace(/"/g, '""')}"`,
                    item.domain,
                    item.affiliateUrl,
                    new Date(item.timestamp).toLocaleString("es-ES")
                ]);
                content = [headers, ...rows].map(row => row.join(",")).join("\n");
                mimeType = "text/csv";
                filename = "amazon-affiliate-history.csv";
                break;

            case "txt":
                content = data.map(item => item.affiliateUrl).join("\n");
                mimeType = "text/plain";
                filename = "amazon-affiliate-urls.txt";
                break;

            case "md":
                content = data
                    .map(item => `- [${item.productTitle || item.asin}](${item.affiliateUrl}) (${item.domain})`)
                    .join("\n");
                mimeType = "text/markdown";
                filename = "amazon-affiliate-history.md";
                break;

            default:
                return;
        }

        const blob = new Blob([content], { type: mimeType + ";charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);

        toast.success(`Exportado como ${format.toUpperCase()}`);
    };

    return (
        <>
            <MagicParticles />
            {/* === ESTILOS DE ANIMACIÓN === */}
            <style jsx>{`
                @keyframes fadeInUp {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes fadeInDown {
                    from { opacity: 0; transform: translateY(-20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                .animate-fade-in-up { animation: fadeInUp 0.5s ease-out forwards; }
                .animate-fade-in-down { animation: fadeInDown 0.5s ease-out forwards; }
                .animate-fade-in { animation: fadeIn 0.4s ease-out forwards; }
                .opacity-0 { opacity: 0; }
                
                .input-edit {
                    animation: fadeInScale 0.15s ease-out forwards;
                }
                .title-normal {
                    animation: fadeIn 0.15s ease-out forwards;
                }
                
                @keyframes fadeInScale {
                    from { opacity: 0; transform: scale(0.95); }
                    to { opacity: 1; transform: scale(1); }
                }

                @keyframes modalIn {
                    from {
                        opacity: 0;
                        transform: scale(0.9) translateY(-10px);
                    }
                    to {
                        opacity: 1;
                        transform: scale(1) translateY(0);
                    }
                }

                .animate-in {
                    animation-fill-mode: both;
                }

                .fade-in {
                    animation: fadeIn 0.3s ease-out;
                }

                .zoom-in-95 {
                    animation: modalIn 0.4s cubic-bezier(0.16, 1, 0.3, 1);
                }

                .opacity-0 { opacity: 0; }
            `}</style>

            {/* === MODAL DE CONFIRMACIÓN === */}
            {showConfirmModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black bg-opacity-0 transition-all duration-300 animate-in fade-in"
                        style={{ animation: 'fadeIn 0.3s ease-out forwards', backdropFilter: 'blur(8px)' }}
                    />
                    <div className="relative bg-white contenedorCosas shadow-xl max-w-sm w-full p-6 space-y-6 
                        animate-in fade-in zoom-in-95 duration-300"
                        style={{ animation: 'modalIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}>
                        <div className="flex flex-col items-center gap-3">
                            <div className="p-2 bg-red-100 contenedorCosas">
                                <Trash2 className="w-6 h-6 text-red-600" />
                            </div>
                            <h3 className="text-lg font-semibold text-slate-900">
                                ¿Borrar todo el historial?
                            </h3>
                        </div>
                        <p className="text-sm text-slate-600 max-w-xs mx-auto">
                            Esta acción no se puede deshacer. Se eliminarán todos los enlaces generados.
                        </p>
                        <div className="flex justify-between gap-3">
                            <button
                                onClick={cancelClear}
                                className="flex-1 px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 contenedorCosas transition"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={confirmClear}
                                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 contenedorCosas transition"
                            >
                                Sí, borrar todo
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="min-h-screen bg-gradient-to-b pt-16">
                <div className="containerHistory mx-auto px-4 max-w-3xl space-y-4">

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-4">
                        <div className="bg-white contenedorCosas p-4 text-center shadow-sm opacity-0 animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
                            <div className="text-2xl font-bold text-violet-600">{stats.total}</div>
                            <div className="text-xs text-slate-600">Total</div>
                        </div>
                        <div className="bg-white contenedorCosas p-4 text-center shadow-sm opacity-0 animate-fade-in-up" style={{ animationDelay: "0.3s" }}>
                            <div className="text-2xl font-bold text-indigo-600">{stats.domains}</div>
                            <div className="text-xs text-slate-600">Dominios</div>
                        </div>
                        <div className="bg-white contenedorCosas p-4 text-center shadow-sm opacity-0 animate-fade-in-up" style={{ animationDelay: "0.4s" }}>
                            <div className="text-2xl font-bold text-green-600">{stats.last7days}</div>
                            <div className="text-xs text-slate-600">Últimos 7 días</div>
                        </div>
                    </div>

                    {/* Search + Actions */}
                    <div className="bg-white contenedorCosas shadow-sm p-4 mb-6 flex flex-col md:flex-row gap-3 opacity-0 animate-fade-in-up" style={{ animationDelay: "0.5s" }}>
                        <div className="flex-1 relative min-w-0">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Buscar..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="input-historial"
                            />
                            {search && (
                                <button
                                    onClick={() => setSearch("")}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                        <div className="flex gap-1.5 sm:gap-2 md:gap-2 lg:gap-2 xl:gap-2">
                            <button
                                type="button"
                                onClick={() => document.getElementById('file-input').click()}
                                className="botonesImportarExportar"
                            >
                                <Upload className="w-4 h-4" />
                                Importar
                            </button>
                            <input
                                id="file-input"
                                type="file"
                                accept=".json"
                                onChange={handleImport}
                                className="hidden"
                            />

                            {/* === BOTÓN EXPORTAR CON PORTAL === */}
                            <div className="relative">
                                <button
                                    onClick={() => history.length > 0 && setShowExportMenu(!showExportMenu)}
                                    disabled={history.length === 0}
                                    className={`botonesImportarExportar flex items-center gap-2 transition-all ${history.length === 0
                                        ? 'opacity-60 cursor-not-allowed'
                                        : 'hover:bg-[#8575da]'
                                        }`}
                                    title={history.length === 0 ? "No hay enlaces para exportar" : "Exportar en varios formatos"}
                                    ref={exportButtonRef}
                                >
                                    <Download className="w-4 h-4" />
                                    Exportar
                                </button>
                            </div>

                            {/* === PORTAL: MENÚ FUERA DEL DOM === */}
                            {showExportMenu && history.length > 0 && createPortal(
                                <div
                                    className="fixed inset-0 z-[9999] pointer-events-none"
                                    onClick={() => setShowExportMenu(false)}
                                >
                                    <div
                                        className="absolute bg-white contenedorCosas shadow-xl border border-slate-200 w-48 pointer-events-auto animate-in fade-in zoom-in-95"
                                        style={{
                                            top: `${exportButtonRef.current?.getBoundingClientRect().bottom + 8}px`,
                                            left: `${exportButtonRef.current?.getBoundingClientRect().right - 192}px`, // 48*4 = 192px
                                            animation: 'modalIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards'
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        {[
                                            { label: "JSON", format: "json", icon: <Package className="w-4 h-4" /> },
                                            { label: "CSV", format: "csv", icon: <Copy className="w-4 h-4" /> },
                                            { label: "TXT (URLs)", format: "txt", icon: <ExternalLink className="w-4 h-4" /> },
                                            { label: "Markdown", format: "md", icon: <Globe className="w-4 h-4" /> },
                                        ].map((opt) => (
                                            <button
                                                key={opt.format}
                                                onClick={() => {
                                                    handleExportFormat(opt.format);
                                                    setShowExportMenu(false);
                                                }}
                                                className="w-full px-3 py-2.5 text-left text-sm flex items-center gap-3 text-slate-700 hover:bg-violet-50 hover:text-violet-700 transition contenedorCosas"
                                            >
                                                {opt.icon}
                                                <span>{opt.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>,
                                document.body
                            )}

                            {/* === BOTÓN BORRAR TODO === */}
                            <button
                                onClick={handleClear}
                                disabled={history.length === 0}
                                className={`borrarTodo flex items-center gap-2 transition-all ${history.length === 0
                                    ? 'opacity-60 cursor-not-allowed'
                                    : 'hover:bg-[#fecaca]'
                                    }`}
                                title={history.length === 0 ? "No hay enlaces para borrar" : "Borrar todo el historial"}
                            >
                                <Trash2 className="w-4 h-4" />
                                Vaciar
                            </button>
                        </div>
                    </div>

                    {/* List */}
                    <div className="w-full">
                        <div className="space-y-3">
                            {filtered.length === 0 ? (
                                <div className="bg-white border border-slate-200 contenedorCosas noResultado p-5 text-center text-slate-500 opacity-0 animate-fade-in" style={{ animationDelay: "0.5s" }}>
                                    {search ? "No se encontraron resultados" : "Aún no hay enlaces en el historial"}
                                </div>
                            ) : (
                                filtered.map((item, index) => (
                                    <div
                                        key={item.id}
                                        className="opacity-0 animate-fade-in-up"
                                        style={{ animationDelay: `${0.5 + index * 0.1}s` }}
                                    >
                                        <HistoryItem
                                            item={item}
                                            onDelete={handleDelete}
                                            setHistory={setHistory}
                                        />
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}