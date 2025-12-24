// pages/History.jsx
import React, { useState, useEffect, useMemo, useRef } from "react";
import MagicParticles from "../components/MagicParticles";
import { toast } from "sonner";
import { createPortal } from "react-dom";
import { Send } from "lucide-react";


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
    RefreshCw
} from "lucide-react";
import {
    getHistory,
    removeFromHistory,
    clearHistory,
    importHistory,
    fetchRealData,
    updateOutdatedPricesManually
} from "../utils/storage";

const HistoryItem = ({
    item: propItem,
    onDelete,
    setHistory,
    index,
    moveItem,
    isDragging,
    isDragOver
}) => {
    const [copied, setCopied] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [editTitle, setEditTitle] = useState("");
    const [localTitle, setLocalTitle] = useState(propItem.productTitle);
    const [editingPriceId, setEditingPriceId] = useState(null);
    const [editPrice, setEditPrice] = useState("");
    const [editOriginalPrice, setEditOriginalPrice] = useState("");
    const [editFocus, setEditFocus] = useState("current"); // 'original' o 'current'
    const priceInputRef = useRef(null);
    const inputRef = useRef(null);
    const [showShareModal, setShowShareModal] = useState(false);
    const [customMessage, setCustomMessage] = useState("");
    const [selectedOption, setSelectedOption] = useState("none"); // "none", "quick", "custom"
    const [showQuickDropdown, setShowQuickDropdown] = useState(false);

    useEffect(() => {
        setLocalTitle(propItem.productTitle);
    }, [propItem.productTitle]);

    useEffect(() => {
        if (showShareModal) {
            const scrollY = window.scrollY;

            document.body.style.position = 'fixed';
            document.body.style.top = `-${scrollY}px`;
            document.body.style.width = '100%';
            document.body.style.overflowY = 'scroll';

            // También bloqueamos html por si acaso
            document.documentElement.style.overflow = 'hidden';
        } else {
            // Restauramos el scroll
            const scrollY = document.body.style.top;
            document.body.style.position = '';
            document.body.style.top = '';
            document.body.style.width = '';
            document.body.style.overflowY = '';

            document.documentElement.style.overflow = '';

            // Volvemos a la posición anterior
            if (scrollY) {
                window.scrollTo(0, parseInt(scrollY || '0') * -1);
            }
        }
    }, [showShareModal]);

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

    const startEditingPrice = (e) => {
        e.stopPropagation();

        let priceToEdit = (propItem.price || '').replace(' €', '');

        if (priceToEdit.endsWith(',00')) {
            priceToEdit = priceToEdit.replace(',00', '');
        }

        setEditPrice(priceToEdit);
        setEditingPriceId(propItem.id);

        setTimeout(() => {
            if (priceInputRef.current) {
                priceInputRef.current.focus();
                priceInputRef.current.select();
            }
        }, 50);
    };

    const savePrice = () => {
        let newPrice = editPrice.trim().replace(/\s/g, '');

        // *** LÓGICA DE FORMATEO DE PRECIO ***
        if (newPrice) {
            // Si es un número entero → formatear con puntos de miles y añadir ,00
            if (/^\d+$/.test(newPrice)) {
                // Convertir a número para formatear miles
                const num = parseInt(newPrice);
                newPrice = num.toLocaleString('es-ES') + ',00';
            }
            // Si ya tiene decimales → mantener como está (ya formateado o no)
        }

        // Añadir símbolo € si no lo tiene
        if (newPrice && !newPrice.includes('€')) {
            newPrice = newPrice + ' €';
        }

        // Si no ha cambiado realmente → cerrar
        if (newPrice === propItem.price) {
            setEditingPriceId(null);
            return;
        }

        // Guardar
        const history = getHistory();
        const updated = history.map(h =>
            h.id === propItem.id ? { ...h, price: newPrice || null } : h
        );
        localStorage.setItem('amazon-affiliate-history', JSON.stringify(updated));
        setHistory(updated);
        setEditingPriceId(null);
    };

    const handlePriceKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            priceInputRef.current?.blur();
        } else if (e.key === 'Escape') {
            setEditingPriceId(null);
            setEditPrice("");
        }
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

    const handleDragStart = (e) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', index.toString()); // Guardamos el índice
        e.currentTarget.classList.add('dragging');
    };

    const handleDragEnd = (e) => {
        e.currentTarget.classList.remove('dragging', 'drag-over');
        // Limpiar todas las clases drag-over de otros elementos
        document.querySelectorAll('.history-item').forEach(el => {
            el.classList.remove('drag-over');
        });
    };

    const handleDragOver = (e) => {
        e.preventDefault(); // Necesario para permitir drop
        e.currentTarget.classList.add('drag-over');
    };

    const handleDragEnter = (e) => {
        e.preventDefault();
        e.currentTarget.classList.add('drag-over');
    };

    const handleDragLeave = (e) => {
        // Solo remover si no hay otro elemento drag-over anidado
        if (!e.currentTarget.contains(e.relatedTarget)) {
            e.currentTarget.classList.remove('drag-over');
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.currentTarget.classList.remove('drag-over');

        const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
        const toIndex = index;

        if (fromIndex !== toIndex) {
            moveItem(fromIndex, toIndex);
        }
    };

    const handleShare = () => {
        let message = "";

        if (selectedOption === "quick") {
            message = customMessage || "Mira este producto en Amazon:"; // fallback por si no eligió
        } else if (selectedOption === "custom") {
            message = customMessage.trim();
        }

        const text = encodeURIComponent(
            message ? `${message} ${propItem.affiliateUrl}` : propItem.affiliateUrl
        );

        const whatsappUrl = `https://api.whatsapp.com/send?text=${text}`;
        window.open(whatsappUrl, "_blank");

        setShowShareModal(false);
        // Opcional: resetear al cerrar
        setSelectedOption("none");
        setCustomMessage("");
        setShowQuickDropdown(false);
    };

    const formatPrice = (raw) => {
        if (!raw || !raw.trim()) return null;

        let cleaned = raw.trim().replace(' €', '').replace(/\s/g, '');

        let decimalSeparator = ',';
        let thousandsSeparator = '.';

        // Detectar separadores
        if (cleaned.includes('.') && cleaned.includes(',')) {
            if (cleaned.lastIndexOf('.') > cleaned.lastIndexOf(',')) {
                decimalSeparator = '.';
                thousandsSeparator = ',';
            } else {
                decimalSeparator = ',';
                thousandsSeparator = '.';
            }
        } else if (cleaned.includes('.')) {
            const parts = cleaned.split('.');
            const afterDot = parts[1] ? parts[1].length : 0;
            if (afterDot === 1 || afterDot === 2) {
                decimalSeparator = '.';
                thousandsSeparator = null;
            } else {
                decimalSeparator = ',';
                thousandsSeparator = '.';
            }
        } else if (cleaned.includes(',')) {
            decimalSeparator = ',';
            thousandsSeparator = null;
        }
        // Sin separadores → entero

        // Quitar miles
        if (thousandsSeparator) {
            cleaned = cleaned.replace(new RegExp('\\' + thousandsSeparator, 'g'), '');
        }

        // Cambiar decimal a punto
        if (decimalSeparator && decimalSeparator !== '.') {
            cleaned = cleaned.replace(decimalSeparator, '.');
        }

        let num = parseFloat(cleaned);
        if (isNaN(num)) return null;

        // === FORMATEO MANUAL FORZADO (es-ES) ===
        // Asegurar 2 decimales
        let parts = num.toFixed(2).split('.');
        let integerPart = parts[0];
        let decimalPart = parts[1];

        // Añadir puntos de miles a la parte entera
        integerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

        return integerPart + ',' + decimalPart + ' €';
    };

    const updatePriceField = (field, newValue) => {
        const history = getHistory();
        const updated = history.map(h =>
            h.id === propItem.id ? { ...h, [field]: newValue || null } : h
        );
        localStorage.setItem('amazon-affiliate-history', JSON.stringify(updated));
        setHistory(updated);
    };

    return (
        <div
            className={`
        history-item bg-white border border-slate-200 contenedorCosas p-4 
        hover:shadow-md transition relative
        ${isDragging ? 'dragging drag-ghost' : ''}
        ${isDragOver ? 'drag-over' : ''}
        ${editingId === propItem.id || editingPriceId === propItem.id
                    ? 'editing-mode'
                    : ''
                }
    `}
            draggable={editingId !== propItem.id && editingPriceId !== propItem.id}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragOver={handleDragOver}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onTouchStart={(e) => {
                if (editingId === propItem.id || editingPriceId === propItem.id) {
                    e.stopPropagation();
                    return;
                }
            }}
        >
            <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1 text-xs text-slate-500 mb-2">
                        <Package className="w-3 h-3" />
                        <code className="font-mono">{propItem.asin}</code>

                        <span className="text-slate-400">·</span>

                        <Globe className="w-3 h-3" />
                        <span>{propItem.domain}</span>
                    </div>

                    <div className="min-h-6 relative">
                        {editingId === propItem.id ? (
                            window.innerWidth < 768 ? (
                                // VERSIÓN MÓVIL
                                <div
                                    contentEditable
                                    suppressContentEditableWarning
                                    onBlur={(e) => {
                                        const newText = e.currentTarget.textContent.trim().slice(0, 120);
                                        setEditTitle(newText);
                                        // Guardar como antes
                                        if (newText && newText !== localTitle) {
                                            const history = getHistory();
                                            const updated = history.map(h =>
                                                h.id === propItem.id ? { ...h, productTitle: newText } : h
                                            );
                                            localStorage.setItem('amazon-affiliate-history', JSON.stringify(updated));
                                            setHistory(updated);
                                            try {
                                                const cache = getTitleCache();
                                                cache[propItem.asin] = newText;
                                                saveTitleCache(cache);
                                            } catch (err) {
                                                console.warn("Error actualizando caché", err);
                                            }
                                        }
                                        setEditingId(null);
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            e.currentTarget.blur();
                                        }
                                        if (e.key === 'Escape') {
                                            e.currentTarget.textContent = localTitle;
                                            e.currentTarget.blur();
                                        }
                                    }}
                                    className="input-edit w-full px-2 py-0.5 text-sm font-medium text-slate-900 bg-violet-50 border border-violet-400 contenedorCosas focus:outline-none focus:ring-violet-500 transition"
                                    style={{
                                        WebkitOverflowScrolling: 'touch',
                                        scrollBehavior: 'smooth',
                                    }}
                                    dangerouslySetInnerHTML={{ __html: editTitle }}
                                    ref={(el) => el && el.focus()}
                                />
                            ) : (
                                // VERSIÓN ESCRITORIO
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={editTitle}
                                    onChange={(e) => setEditTitle(e.target.value)}
                                    onBlur={saveTitle}
                                    onKeyDown={handleKeyDown}
                                    className="input-edit w-full px-2 py-0.5 text-sm font-medium text-slate-900 bg-violet-50 border border-violet-400 contenedorCosas focus:outline-none focus:ring-violet-500 transition"
                                    style={{ animation: 'fadeInScale 0.15s ease-out forwards' }}
                                />
                            )
                        ) : (
                            <p
                                onClick={startEditing}
                                className="title-normal text-left text-sm font-medium text-slate-900 truncate cursor-pointer hover:text-violet-700 transition select-none block w-full"
                                title="Clic para renombrar"
                            >
                                {localTitle}
                            </p>
                        )}
                    </div>

                    <p className="text-xs text-slate-500 mt-1.5 flex items-center gap-1">
                        <span className="flex items-center gap-1 text-xs text-slate-500">
                            <Calendar className="w-3 h-3 -mt-0.5" />
                            <span className="font-medium">
                                {new Date(propItem.timestamp).toLocaleDateString("es-ES", {
                                    day: "2-digit",
                                    month: "2-digit",
                                    year: "numeric"
                                })}
                            </span>
                        </span>
                        <span className="text-slate-400">|</span>

                        {/* === EDICIÓN DE PRECIOS: DOS INPUTS === */}
                        {editingPriceId === propItem.id ? (
                            <div
                                className="flex items-center gap-3"
                                onBlur={(e) => {
                                    if (!e.currentTarget.contains(e.relatedTarget)) {
                                        // Guardar precio actual
                                        const formattedCurrent = formatPrice(editPrice);
                                        updatePriceField('price', formattedCurrent || null);

                                        // Guardar precio original (independiente)
                                        const formattedOriginal = formatPrice(editOriginalPrice);
                                        updatePriceField('originalPrice', formattedOriginal || null);

                                        setEditingPriceId(null);
                                    }
                                }}
                            >
                                {/* Precio Original */}
                                <div className="flex items-center gap-1">
                                    <span className="text-xs text-slate-500">Original:</span>
                                    <input
                                        type="text"
                                        value={editOriginalPrice}
                                        onChange={(e) => setEditOriginalPrice(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === '.') {
                                                e.preventDefault();
                                                const newValue = editOriginalPrice + ',';
                                                setEditOriginalPrice(newValue);
                                                setTimeout(() => {
                                                    const input = e.target;
                                                    input.selectionStart = newValue.length;
                                                    input.selectionEnd = newValue.length;
                                                }, 0);
                                            }

                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                const formatted = formatPrice(editOriginalPrice);
                                                updatePriceField('originalPrice', formatted || null);
                                                setEditingPriceId(null);
                                            }

                                            if (e.key === 'Escape') {
                                                setEditingPriceId(null);
                                            }
                                        }}
                                        onBlur={() => {
                                            const formatted = formatPrice(editPrice);
                                            if (formatted) {
                                                setEditPrice(formatted);
                                            } else {
                                                setEditPrice("");
                                            }
                                        }}
                                        onFocus={(e) => e.target.select()}
                                        className="w-16 px-2 py-1 text-xs font-medium text-slate-700 bg-slate-50 border border-slate-300 contenedorCosas focus:outline-none focus:ring-1 focus:ring-violet-500"
                                        placeholder="0,00 €"
                                        autoFocus={editFocus === 'original'}
                                    />
                                </div>

                                {/* Precio Actual */}
                                <div className="flex items-center gap-1">
                                    <span className="text-xs text-slate-500">Actual:</span>
                                    <input
                                        type="text"
                                        value={editPrice}
                                        onChange={(e) => setEditPrice(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === '.') {
                                                e.preventDefault();
                                                const newValue = editPrice + ',';
                                                setEditPrice(newValue);
                                                setTimeout(() => {
                                                    if (priceInputRef.current) {
                                                        priceInputRef.current.selectionStart = newValue.length;
                                                        priceInputRef.current.selectionEnd = newValue.length;
                                                    }
                                                }, 0);
                                            }
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                const formatted = formatPrice(editPrice);
                                                updatePriceField('price', formatted || null); // null si vacío
                                                setEditingPriceId(null);
                                            }
                                            if (e.key === 'Escape') {
                                                setEditingPriceId(null);
                                            }
                                        }}
                                        onBlur={() => {
                                            const formatted = formatPrice(editPrice);
                                            if (formatted) {
                                                setEditPrice(formatted);
                                            } else {
                                                setEditPrice("");
                                            }
                                        }}
                                        onFocus={(e) => e.target.select()}
                                        className="w-16 px-2 py-1 text-xs font-bold bg-emerald-50 border border-emerald-400 contenedorCosas focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                        placeholder="0,00 €"
                                        autoFocus={editFocus === 'current'}
                                        ref={priceInputRef}
                                    />
                                </div>
                            </div>
                        ) : (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();

                                    let cleanOriginal = propItem.originalPrice
                                        ? propItem.originalPrice.replace(' €', '').trim()
                                        : '';
                                    let cleanCurrent = propItem.price
                                        ? propItem.price.replace(' €', '').trim()
                                        : '';

                                    if (propItem.originalPrice && propItem.price) {
                                        const originalNum = parseFloat(propItem.originalPrice.replace(/[^0-9,]/g, '').replace(',', '.'));
                                        const currentNum = parseFloat(propItem.price.replace(/[^0-9,]/g, '').replace(',', '.'));

                                        if (originalNum === currentNum) {
                                            cleanCurrent = '';
                                        }
                                    }

                                    setEditOriginalPrice(cleanOriginal);
                                    setEditPrice(cleanCurrent);
                                    setEditFocus('current');
                                    setEditingPriceId(propItem.id);
                                }}
                                className="text-left text-xs font-bold contenedorCosas transition hover:text-violet-700 cursor-pointer whitespace-nowrap"
                                title="Editar precios"
                            >

                                {(() => {
                                    const hasOriginal = !!propItem.originalPrice;
                                    const hasCurrent = !!propItem.price;

                                    if (!hasOriginal && !hasCurrent) {
                                        return <span className="text-black italic">Sin precio</span>;
                                    }

                                    if (hasOriginal && hasCurrent) {
                                        const originalNum = parseFloat(propItem.originalPrice.replace(/[^0-9,]/g, '').replace(',', '.'));
                                        const currentNum = parseFloat(propItem.price.replace(/[^0-9,]/g, '').replace(',', '.'));

                                        if (originalNum === currentNum) {
                                            // Precios iguales → solo mostramos el original en negro
                                            return <span className="text-black">{propItem.originalPrice}</span>;
                                        }

                                        const isLower = currentNum < originalNum;
                                        const isHigher = currentNum > originalNum;

                                        return (
                                            <>
                                                <span className="text-black mr-2">
                                                    {propItem.originalPrice}
                                                </span>
                                                <span className={`
                    font-bold
                    ${isLower ? 'text-emerald-600' : isHigher ? 'text-red-600' : 'text-emerald-600'}
                `}>
                                                    {propItem.price}
                                                    {isLower && <span className="text-xs text-emerald-500 ml-1">↓</span>}
                                                    {isHigher && <span className="text-xs text-red-500 ml-1">↑</span>}
                                                </span>
                                            </>
                                        );
                                    }

                                    if (hasCurrent) {
                                        return (
                                            <>
                                                <span className="text-black italic mr-2">
                                                    Sin precio
                                                </span>
                                                <span className="font-bold text-emerald-600">
                                                    {propItem.price}
                                                </span>
                                            </>
                                        );
                                    }

                                    // Solo precio original → solo el original en negro
                                    return <span className="text-black">{propItem.originalPrice}</span>;
                                })()}
                            </button>
                        )}
                    </p>
                </div>

                <div className="flex gap-2 flex-shrink-0">
                    <a
                        href={propItem.affiliateUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 -mt-2 contenedorCosas hover:bg-slate-100 transition"
                        title="Abrir"
                    >
                        <ExternalLink className="w-4 h-4 text-slate-600" />
                    </a>
                    <button
                        onClick={() => {
                            setShowShareModal(true);
                            setSelectedOption("none");
                            setCustomMessage("");
                        }}
                        className="p-2 -mt-2 contenedorCosas hover:bg-slate-100 transition"
                        title="Compartir por WhatsApp"
                    >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="#25D366">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.626.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.890-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488" />
                        </svg>
                    </button>
                    <button
                        onClick={() => onDelete(propItem.id)}
                        className="p-2 -mt-2 contenedorCosas hover:bg-red-50 text-red-600 transition"
                        title="Eliminar"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            </div>
            {/* === MODAL DE COMPARTIR POR WHATSAPP === */}
            {showShareModal && createPortal(
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                        onClick={() => setShowShareModal(false)}
                    />

                    {/* Contenedor del modal */}
                    <div className="relative w-full overflow-hidden max-w-sm bg-white contenedorCosas shadow-2xl animate-in fade-in zoom-in-95 duration-300">
                        <div className="py-2 border-b border-slate-200 bg-slate-50">
                            <div className="flex justify-center">
                                <div className="p-2 bg-[#25D366] contenedorCosas shadow-lg">
                                    <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.626.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.890-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488" />
                                    </svg>
                                </div>
                            </div>
                        </div>

                        {/* Opciones */}
                        <div className="p-3 space-y-2">
                            {/* Mensaje rápido - con dropdown flotante toggle */}
                            <div className="relative">
                                <div
                                    className={`flex items-center gap-4 px-5 py-4 transition-all duration-200 cursor-pointer contenedorCosas ${selectedOption === "quick"
                                        ? "bg-violet-100/70 border border-violet-300 shadow-sm"
                                        : "hover:bg-violet-50/60 border border-transparent"
                                        }`}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedOption("quick");
                                        setShowQuickDropdown(prev => !prev); // Toggle
                                    }}
                                >
                                    <div className="flex-1">
                                        <div className={`font-semibold ${selectedOption === "quick" ? "text-violet-900" : "text-slate-800"}`}>
                                            Mensaje rápido
                                        </div>
                                        <div className="text-sm text-slate-500">
                                            {selectedOption === "quick" && customMessage ? customMessage : "Elige uno de los mensajes directos"}
                                        </div>
                                    </div>
                                    <div className={`transition-transform duration-200 ${showQuickDropdown && selectedOption === "quick" ? "rotate-180" : ""}`}>
                                        <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </div>
                                </div>

                                {/* Dropdown flotante */}
                                {showQuickDropdown && selectedOption === "quick" && (
                                    <div className="absolute top-full mt-2.5 z-10 animate-in fade-in slide-in-from-top-2 duration-200">
                                        <div
                                            className="bg-white border contenedorCosas shadow-lg overflow-hidden max-h-56 overflow-y-auto"
                                            onTouchMove={(e) => e.stopPropagation()}
                                            onWheel={(e) => e.stopPropagation()}
                                        >
                                            {[
                                                "Mira este producto en Amazon",
                                                "¡Oferta interesante en Amazon!",
                                                "Te puede interesar este artículo",
                                                "Echa un vistazo a esto en Amazon",
                                                "Recomendado en Amazon",
                                                "Buena opción en Amazon:",
                                                "Lo vi y pensé en ti",
                                                "¿Qué te parece este producto?",
                                                "Genial hallazgo en Amazon",
                                                "¡Mira qué chollo he encontrado!"
                                            ].map((msg, idx) => (
                                                <button
                                                    key={idx}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setCustomMessage(msg);
                                                        setShowQuickDropdown(false);
                                                    }}
                                                    className={`w-full px-4 py-3 text-left text-sm transition-all ${customMessage === msg
                                                        ? "bg-violet-100 text-violet-900 font-medium"
                                                        : "text-slate-700 hover:bg-violet-50"
                                                        } ${idx !== 0 ? "border-t border-slate-100" : ""}`}
                                                >
                                                    <span className="block truncate">{msg}</span>

                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Sin mensaje */}
                            <div
                                className={`flex items-center gap-4 px-5 py-4 transition-all duration-200 cursor-pointer contenedorCosas ${selectedOption === "none"
                                    ? "bg-violet-100/70 border border-violet-300 shadow-sm"
                                    : "hover:bg-violet-50/60 border border-transparent"
                                    }`}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedOption("none");
                                    setCustomMessage("");
                                    setShowQuickDropdown(false); // Cierra dropdown si estaba abierto
                                }}
                            >
                                <div className="flex-1">
                                    <div className={`font-semibold ${selectedOption === "none" ? "text-violet-900" : "text-slate-800"}`}>
                                        Sin mensaje
                                    </div>
                                    <div className="text-sm text-slate-500">
                                        Solo se enviará el enlace del producto.
                                    </div>
                                </div>
                            </div>

                            {/* Mensaje personalizado */}
                            <div className="space-y-2.5">
                                <div
                                    className={`flex items-center gap-4 px-5 py-4 transition-all duration-200 cursor-pointer contenedorCosas ${selectedOption === "custom"
                                        ? "bg-violet-100/70 border border-violet-300 shadow-sm"
                                        : "hover:bg-violet-50/60 border border-transparent"
                                        }`}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedOption("custom");
                                        setCustomMessage("");
                                        setShowQuickDropdown(false); // Cierra dropdown
                                    }}
                                >
                                    <div className="flex-1">
                                        <div className={`font-semibold ${selectedOption === "custom" ? "text-violet-900" : "text-slate-800"}`}>
                                            Mensaje personalizado
                                        </div>
                                        <div className="text-sm text-slate-500">
                                            Escribe lo que quieras acompañando el enlace
                                        </div>
                                    </div>
                                </div>

                                {selectedOption === "custom" && (
                                    <div className="px-0 animate-in fade-in slide-in-from-top-2 duration-300">
                                        <textarea
                                            value={customMessage}
                                            onChange={(e) => setCustomMessage(e.target.value)}
                                            placeholder="Escribe tu mensaje aquí..."
                                            rows="4"
                                            autoFocus
                                            className="w-full px-4 py-3 text-sm text-slate-800 bg-slate-50/50 border border-violet-300 contenedorCosas resize-none focus:outline-none transition shadow-sm"
                                        />
                                    </div>
                                )}
                            </div>
                        </div>


                        {/* Botones de acción */}
                        <div className="flex gap-3 -mt-2 p-3 border-t border-slate-200 bg-slate-50">
                            <button
                                onClick={() => setShowShareModal(false)}
                                className="flex-1 px-5 py-3 text-sm font-medium text-slate-700 bg-white border border-slate-300 contenedorCosas hover:bg-slate-100 transition contenedorCosas"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleShare}
                                className="flex-1 px-5 py-3 text-sm font-semibold text-white bg-[#25D366] contenedorCosas hover:bg-[#128C7E] transition flex items-center justify-center gap-2 shadow-lg"
                            >
                                <Send className="w-5 h-5" strokeWidth={2.5} />
                                Compartir
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default function HistoryPage() {
    const [history, setHistory] = useState([]);
    const [search, setSearch] = useState("");
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [showExportMenu, setShowExportMenu] = useState(false);
    const exportButtonRef = useRef(null);
    const fileInputRef = useRef(null);
    const isInitialLoad = useRef(true);
    const exportInputRef = useRef(null);
    const [isLoading, setIsLoading] = useState(true);
    const [animatedItems, setAnimatedItems] = useState(new Set());
    const [isUpdatingPrices, setIsUpdatingPrices] = useState(false);
    const [showExportModal, setShowExportModal] = useState(false);
    const [exportFormat, setExportFormat] = useState(null); // "json" o "csv"
    const [exportFilename, setExportFilename] = useState("");

    useEffect(() => {
        const timer = setTimeout(() => {
            isInitialLoad.current = false;
        }, 50);

        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        if (showExportModal && exportInputRef.current) {
            // Pequeño timeout para asegurar que el input está renderizado y enfocado
            setTimeout(() => {
                exportInputRef.current.focus();
                exportInputRef.current.select(); // ← Esto selecciona todo el texto
            }, 100);
        }
    }, [showExportModal]);

    // === ACTUALIZACIÓN EN TIEMPO REAL DEL HISTORIAL ===
    useEffect(() => {
        const loadHistory = () => {
            const data = getHistory();
            setHistory(data);
            setIsLoading(false);
        };

        loadHistory();

        // Solo recargamos cuando cambie el storage desde OTRA pestaña
        const handleStorageChange = (e) => {
            if (e.key === STORAGE_KEY || e.key === null) {
                loadHistory();
            }
        };

        // Para cambios locales (nuestra propia pestaña), solo actualizamos el estado directamente
        const handleLocalUpdate = () => {
            loadHistory();
        };

        window.addEventListener('storage', handleStorageChange);
        window.addEventListener('amazon-history-updated', handleLocalUpdate);

        return () => {
            window.removeEventListener('storage', handleStorageChange);
            window.removeEventListener('amazon-history-updated', handleLocalUpdate);
        };
    }, []);

    useEffect(() => {
        if (showConfirmModal) {
            const scrollY = window.scrollY;

            document.body.style.position = 'fixed';
            document.body.style.top = `-${scrollY}px`;
            document.body.style.width = '100%';
            document.body.style.overflowY = 'scroll';

            // También bloqueamos html por si acaso
            document.documentElement.style.overflow = 'hidden';
        } else {
            // Restauramos el scroll
            const scrollY = document.body.style.top;
            document.body.style.position = '';
            document.body.style.top = '';
            document.body.style.width = '';
            document.body.style.overflowY = '';

            document.documentElement.style.overflow = '';

            // Volvemos a la posición anterior
            if (scrollY) {
                window.scrollTo(0, parseInt(scrollY || '0') * -1);
            }
        }
    }, [showConfirmModal]);

    useEffect(() => {
        if (showExportModal) {
            const scrollY = window.scrollY;

            document.body.style.position = 'fixed';
            document.body.style.top = `-${scrollY}px`;
            document.body.style.width = '100%';
            document.body.style.overflowY = 'scroll';

            document.documentElement.style.overflow = 'hidden';
        } else {
            const scrollY = document.body.style.top;
            document.body.style.position = '';
            document.body.style.top = '';
            document.body.style.width = '';
            document.body.style.overflowY = '';

            document.documentElement.style.overflow = '';

            if (scrollY) {
                window.scrollTo(0, parseInt(scrollY || '0') * -1);
            }
        }
    }, [showExportModal]);

    const markAsAnimated = (id) => {
        setAnimatedItems(prev => new Set(prev).add(id));
    };

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

        const normalize = (str) =>
            str
                .toLowerCase()
                .normalize("NFD") // separa tildes
                .replace(/[\u0300-\u036f]/g, "") // elimina tildes
                .replace(/[^a-z0-9\s]/g, "") // quita símbolos raros
                .trim();

        const searchLower = normalize(search);

        // Mapeo de errores comunes (puedes añadir más)
        const commonReplacements = {
            xiomi: "xiaomi",
            xioami: "xiaomi",
            xaomi: "xiaomi",
            huawey: "huawei",
            huwei: "huawei",
            huaewi: "huawei",
            samsumg: "samsung",
            samgsung: "samsung",
        };

        const enhancedSearch = commonReplacements[searchLower] || searchLower;

        return history.filter((item) => {
            const titleNorm = normalize(item.productTitle || "");
            const asinNorm = item.asin.toLowerCase();
            const domainNorm = item.domain.toLowerCase();
            const urlNorm = item.originalUrl.toLowerCase();

            return (
                asinNorm.includes(searchLower) ||
                domainNorm.includes(searchLower) ||
                urlNorm.includes(searchLower) ||
                titleNorm.includes(enhancedSearch) ||
                titleNorm.includes(searchLower) // por si acaso el replacement no cubre todo
            );
        });
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
        setAnimatedItems(new Set());
        setShowConfirmModal(false);
        toast.success("Historial borrado");
    };

    const cancelClear = () => {
        setShowConfirmModal(false);
    };

    const handleImport = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        importHistory(file, (success, message, useInfoToast = false) => {
            if (success) {
                setHistory(getHistory());
                setAnimatedItems(new Set());

                if (useInfoToast) {
                    toast.info(message);
                } else {
                    toast.success(message);
                }

                if (fileInputRef.current) {
                    fileInputRef.current.value = null;
                }
            } else {
                toast.error(message || "Archivo inválido");

                if (fileInputRef.current) {
                    fileInputRef.current.value = null;
                }
            }
        });
    };

    // === NUEVA FUNCIÓN: EXPORTAR EN VARIOS FORMATOS ===
    const handleExportFormat = (format) => {
        const defaultName = format === "csv"
            ? "historialUrlAmazon"
            : "amazon-affiliate-history";

        const suggestedName = `${defaultName}_${new Date().toISOString().split('T')[0]}`;

        setExportFormat(format);
        setExportFilename(suggestedName);
        setShowExportModal(true);
        setShowExportMenu(false); // Cerramos el menú de exportar
    };

    const performExport = () => {
        const data = getHistory();
        if (!data.length || !exportFormat) return;

        let content = "";
        let mimeType = "text/plain";
        let extension = exportFormat;

        switch (exportFormat) {
            case "json":
                content = JSON.stringify(data, null, 2);
                mimeType = "application/json";
                break;

            case "csv":
                const headers = [
                    "Fecha",
                    "Título",
                    "Precio Original",
                    "Precio Actual",
                    "Dominio",
                    "URL Afiliado",
                    "ASIN"
                ];

                const rows = data.map(item => [
                    new Date(item.timestamp).toLocaleString("es-ES"),
                    `"${(item.productTitle || "").replace(/"/g, '""')}"`,
                    item.originalPrice ? `"${item.originalPrice.replace(/"/g, '""')}"` : '""',
                    item.price ? `"${item.price.replace(/"/g, '""')}"` : '""',
                    item.domain || "",
                    item.affiliateUrl || "",
                    item.asin || ""
                ]);

                const BOM = "\uFEFF";
                content = BOM + [headers, ...rows]
                    .map(row => row.join(";"))
                    .join("\r\n");

                mimeType = "text/csv";
                break;

            default:
                return;
        }

        const filename = exportFilename.trim()
            ? `${exportFilename.trim()}.${extension}`
            : `historial.${extension}`;

        const blob = new Blob([content], { type: mimeType + ";charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);

        toast.success(`Exportado como ${filename}`);
        setShowExportModal(false);
        setExportFilename("");
        setExportFormat(null);
    };


    const moveItem = (fromIndex, toIndex) => {
        const historyCopy = [...history];
        const [movedItem] = historyCopy.splice(fromIndex, 1);
        historyCopy.splice(toIndex, 0, movedItem);

        // Guardar en localStorage
        localStorage.setItem('amazon-affiliate-history', JSON.stringify(historyCopy));

        // Actualizar estado
        setHistory(historyCopy);

        toast.success("Orden cambiado");
    };


    return (
        <>
            <MagicParticles />

            {/* === MODAL DE CONFIRMACIÓN DE VACIAR HISTORIAL === */}
            {showConfirmModal && createPortal(
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                        onClick={cancelClear}
                    />

                    {/* Contenedor del modal */}
                    <div className="relative w-full max-w-sm bg-white contenedorCosas shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300">
                        {/* Cabecera con icono */}
                        <div className="py-2 border-b border-slate-200 bg-slate-50">
                            <div className="flex justify-center">
                                <div className="p-2 bg-red-600 contenedorCosas shadow-lg">
                                    <Trash2 className="w-7 h-7 text-white" strokeWidth={2.5} />
                                </div>
                            </div>
                        </div>

                        {/* Contenido */}
                        <div className="p-6 space-y-4 text-center">
                            <h3 className="text-lg font-semibold text-slate-900">
                                ¿Borrar todo el historial?
                            </h3>
                            <p className="text-sm text-slate-600 max-w-xs mx-auto">
                                Esta acción no se puede deshacer. Se eliminarán todos los enlaces generados.
                            </p>
                        </div>

                        {/* Botones de acción */}
                        <div className="flex gap-3 p-3 border-t border-slate-200 bg-slate-50">
                            <button
                                onClick={cancelClear}
                                className="flex-1 px-5 py-3 text-sm font-medium text-slate-700 bg-white border border-slate-300 contenedorCosas hover:bg-slate-100 transition"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={confirmClear}
                                className="flex-1 px-5 py-3 text-sm font-semibold text-white bg-red-600 contenedorCosas hover:bg-red-700 transition flex items-center justify-center gap-2 shadow-lg"
                            >
                                <Trash2 className="w-5 h-5" strokeWidth={2.5} />
                                Vaciar
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* === MODAL PARA NOMBRAR ARCHIVO DE EXPORTACIÓN === */}
            {showExportModal && createPortal(
                <div className="fixed inset-0 z-50 flex items-center justify-center p-3">
                    <div
                        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                        onClick={() => {
                            setShowExportModal(false);
                            setExportFilename("");
                            setExportFormat(null);
                        }}
                    />

                    <div className="relative w-full max-w-sm bg-white contenedorCosas shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300">
                        <div className="py-2 border-b border-slate-200 bg-slate-50">
                            <div className="flex justify-center">
                                <div className="p-2.5 bg-violet-600 contenedorCosas shadow-lg">
                                    <Download className="w-8 h-8 text-white" />
                                </div>
                            </div>
                        </div>

                        <div className="p-4 space-y-3">
                            <h3 className="text-lg font-semibold text-center text-slate-900">
                                Archivo
                            </h3>

                            <div className="space-y-4">
                                <input
                                    type="text"
                                    value={exportFilename}
                                    onChange={(e) => setExportFilename(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                            e.preventDefault();
                                            performExport();
                                        } else if (e.key === "Escape") {
                                            setShowExportModal(false);
                                            setExportFilename("");
                                            setExportFormat(null);
                                        }
                                    }}
                                    ref={exportInputRef}
                                    className="w-full bg-white text-slate-900 px-4 py-3 text-sm border border-slate-300 contenedorCosas focus:outline-none focus:ring-1 focus:ring-violet-500 focus:border-transparent transition"
                                    placeholder="Ej: Mis compras"
                                />
                                <p className="text-xs text-center text-slate-500">
                                    Se guardará como: <strong>{exportFilename || "historial"}.{exportFormat}</strong>
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-3 p-3 border-t border-slate-200 bg-slate-50">
                            <button
                                onClick={() => {
                                    setShowExportModal(false);
                                    setExportFilename("");
                                    setExportFormat(null);
                                }}
                                className="flex-1 px-5 py-3 text-sm font-medium text-slate-700 bg-white border border-slate-300 contenedorCosas hover:bg-slate-100 transition"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={performExport}
                                className="flex-1 px-5 py-3 text-sm font-semibold text-white bg-violet-600 contenedorCosas hover:bg-violet-700 transition flex items-center justify-center gap-2 shadow-lg"
                            >
                                <Download className="w-5 h-5" />
                                Exportar
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            <div className="min-h-screen bg-gradient-to-b separacionArriba max-w-[658px]">
                <div className="containerHistory mx-auto px-0 max-w-3xl space-y-3">

                    {/* Search + Actions */}
                    <div className=" bg-white contenedorCosas shadow-sm p-4 mb-3 flex flex-col md:flex-row gap-3 opacity-0 animate-fade-in-up" style={{ animationDelay: "0.3s" }}>
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
                        <div className="grid grid-cols-3 gap-3 w-full md:w-auto md:flex md:gap-3">
                            {/* Importar */}
                            <label className="botonesImportarExportar cursor-pointer">
                                <Upload className="w-4 h-4" />
                                Importar
                                <input
                                    id="file-input"
                                    type="file"
                                    accept=".json,.csv,text/csv,application/json"
                                    onChange={handleImport}
                                    className="hidden"
                                    ref={fileInputRef}
                                />
                            </label>

                            {/* Exportar */}
                            <div className="relative">
                                <button
                                    onClick={() => history.length > 0 && setShowExportMenu(!showExportMenu)}
                                    disabled={history.length === 0}
                                    className={`botonesImportarExportar w-full flex items-center justify-center gap-2 transition-all ${history.length === 0
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
                                            { label: "CSV", format: "csv", icon: <Copy className="w-4 h-4 text-green-600" /> },
                                        ].map((opt) => (
                                            <button
                                                key={opt.format}
                                                onClick={() => {
                                                    handleExportFormat(opt.format);
                                                    setShowExportMenu(false);
                                                }}
                                                className={`w-full px-3 py-2.5 text-left text-sm flex items-center gap-3 transition contenedorCosas
                                                ${opt.format === "csv"
                                                        ? "text-green-700 hover:bg-green-50 hover:text-green-800"
                                                        : "text-slate-700 hover:bg-violet-50 hover:text-violet-700"
                                                    }`}
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
                            {/* Vaciar */}
                            <button
                                onClick={handleClear}
                                disabled={history.length === 0}
                                className={`borrarTodo w-full flex items-center justify-center gap-2 transition-all ${history.length === 0
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
                            {isLoading ? (
                                <div className="space-y-3">
                                    {[...Array(5)].map((_, i) => (
                                        <div
                                            key={i}
                                            className="bg-white border border-slate-200 contenedorCosas p-6 animate-pulse"
                                        >
                                            <div className="h-4 bg-slate-200 contenedorCosas w-3/4 mb-3"></div>
                                            <div className="h-3 bg-slate-200 contenedorCosas w-1/2"></div>
                                        </div>
                                    ))}
                                </div>
                            ) : filtered.length === 0 ? (
                                <div
                                    className={`
      bg-white border border-slate-200 contenedorCosas noResultado p-8 text-center text-slate-500
      transition-all duration-700
      ${history.length === 0 || !isLoading
                                            ? 'opacity-100 translate-y-0'
                                            : 'opacity-0 translate-y-8'
                                        }
    `}
                                    style={{
                                        animation: history.length === 0 || !isLoading
                                            ? 'fadeInUp 0.7s ease-out forwards'
                                            : 'none'
                                    }}
                                >
                                    <div className="max-w-sm mx-auto space-y-4">
                                        <div className="mx-auto w-16 h-16 bg-slate-100 contenedorCosas flex items-center justify-center">
                                            <Package className="w-8 h-8 text-slate-400" />
                                        </div>
                                        <p className="text-lg font-medium text-slate-600">
                                            {search ? "No se encontraron resultados" : "Aún no hay enlaces en el historial"}
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                filtered.map((item, index) => (
                                    <div
                                        key={item.id}
                                        className={`transition-all duration-500 ${!animatedItems.has(item.id)
                                            ? "opacity-0 translate-y-4"
                                            : "opacity-100 translate-y-0"
                                            }`}
                                        ref={(el) => {
                                            if (el && !animatedItems.has(item.id)) {
                                                el.getBoundingClientRect();
                                                markAsAnimated(item.id);
                                            }
                                        }}
                                        style={{
                                            transitionDelay: `${0.5 + index * 0.1}s`, // Suave escalonado
                                        }}
                                    >
                                        <HistoryItem
                                            item={item}
                                            onDelete={handleDelete}
                                            setHistory={setHistory}
                                            index={index}
                                            moveItem={moveItem}
                                        />
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
            {(() => {
                const [isMounted, setIsMounted] = useState(false);

                useEffect(() => {
                    // Pequeño retraso para forzar la animación incluso al navegar entre páginas
                    const timer = setTimeout(() => setIsMounted(true), 100);
                    return () => clearTimeout(timer);
                }, []);

                return (
                    <div
                        className={`
                fixed bottom-6 right-6 z-40
                transition-all duration-700 ease-out
                ${isMounted && history.length > 0
                                ? 'translate-y-0 opacity-100'
                                : 'translate-y-12 opacity-0 pointer-events-none'
                            }
            `}
                    >
                        <button
                            onClick={async () => {
                                if (isUpdatingPrices || history.length === 0) return;
                                setIsUpdatingPrices(true);

                                let hasShownEarlyWarning = false;

                                const earlyWarningTimer = setTimeout(() => {
                                    toast.error("Problemas con proxies...", {
                                        duration: 8000
                                    });
                                    hasShownEarlyWarning = true;
                                }, 15000);

                                const result = await updateOutdatedPricesManually();

                                clearTimeout(earlyWarningTimer);

                                if (result.status === "empty") {
                                    toast.info("No hay enlaces en el historial");
                                } else if (result.status === "up_to_date") {
                                    toast.success("Todos los precios están al día");
                                } else if (result.status === "proxy_failed") {
                                    toast.error("Actualización cancelada: proxies no funcionan", { duration: 4000 });
                                } else if (result.status === "completed") {
                                    if (result.updated === 0) {
                                        toast.warning(
                                            hasShownEarlyWarning
                                                ? "No se obtuvo ningún precio nuevo (problemas con proxies)"
                                                : "Se intentó actualizar pero no se obtuvo ningún precio nuevo",
                                            { duration: 4000 }
                                        );
                                    } else {
                                        toast.success(
                                            `¡Precios actualizados en ${result.updated} producto${result.updated > 1 ? 's' : ''}!`,
                                            { duration: 4000 }
                                        );
                                    }
                                }

                                setIsUpdatingPrices(false);
                                setHistory(getHistory());
                            }}
                            disabled={isUpdatingPrices || history.length === 0}
                            className={`
    w-14 h-14 rounded-full
    bg-violet-600 text-white
    shadow-lg flex items-center justify-center
    transition-all duration-300
    hover:bg-violet-700 hover:scale-110 active:scale-95
    ${isUpdatingPrices
                                    ? 'animate-pulse'
                                    : 'shadow-violet-500/50 hover:shadow-xl hover:shadow-violet-600/60'
                                }
    ${history.length === 0 ? 'opacity-60 cursor-not-allowed' : ''}
`}
                            title={history.length === 0
                                ? "No hay productos para actualizar"
                                : isUpdatingPrices
                                    ? "Actualizando precios..."
                                    : "Actualizar todos los precios"}
                            aria-label="Actualizar precios"
                        >
                            <RefreshCw
                                className={`w-6 h-6 ${isUpdatingPrices ? 'animate-spin' : ''}`}
                            />
                        </button>
                    </div>
                );
            })()}
        </>
    );
}