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
} from "lucide-react";
import {
    getHistory,
    removeFromHistory,
    clearHistory,
    importHistory,
    fetchRealData
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

                        {editingPriceId === propItem.id ? (
                            <input
                                ref={priceInputRef}
                                type="text"
                                value={editPrice}
                                onChange={(e) => {
                                    let value = e.target.value;
                                    value = value.replace(/[^0-9,.]/g, '');
                                    value = value.replace(/[,.]/g, match => match === ',' ? ',' : ',');
                                    value = value.replace(/,/g, (match, offset) =>
                                        value.indexOf(',') === offset ? match : ''
                                    );
                                    setEditPrice(value);
                                }}
                                onBlur={savePrice}
                                onKeyDown={handlePriceKeyDown}
                                className="w-24 px-3 py-1 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-400 contenedorCosas focus:outline-none focus:ring-0.5 focus:ring-emerald-500 transition"
                                placeholder="0,00"
                                style={{ animation: 'fadeInScale 0.15s ease-out forwards' }}
                            />
                        ) : (
                            <span className="flex flex-col">  {/* ← CAMBIO: span en lugar de div */}
                                <button
                                    onClick={startEditingPrice}
                                    className="text-left text-xs font-bold text-emerald-600 contenedorCosas transition hover:text-emerald-700 cursor-pointer whitespace-nowrap"
                                    title="Editar precio"
                                >
                                    {propItem.originalPrice && propItem.price && propItem.originalPrice !== propItem.price ? (
                                        <>
                                            <span className="text-slate-500 line-through mr-1">
                                                {propItem.originalPrice}
                                            </span>
                                            {/* Comparación inteligente: verde si baja, rojo si sube */}
                                            {(() => {
                                                const originalNum = parseFloat(propItem.originalPrice.replace(/[^0-9,.]/g, '').replace(',', '.'));
                                                const currentNum = parseFloat(propItem.price.replace(/[^0-9,.]/g, '').replace(',', '.'));

                                                const isLower = currentNum < originalNum;
                                                const isHigher = currentNum > originalNum;

                                                if (isLower) {
                                                    return (
                                                        <span className="text-emerald-600 font-bold">
                                                            {propItem.price}
                                                            <span className="text-xs text-emerald-500 ml-1">↓</span>
                                                        </span>
                                                    );
                                                } else if (isHigher) {
                                                    return (
                                                        <span className="text-red-600 font-bold">
                                                            {propItem.price}
                                                            <span className="text-xs text-red-500 ml-1">↑</span>
                                                        </span>
                                                    );
                                                }
                                                // Si son iguales (raro), mostrar normal
                                                return <span className="text-emerald-600 font-bold">{propItem.price}</span>;
                                            })()}
                                        </>
                                    ) : propItem.price ? (
                                        // Caso normal: hay precio pero NO hay originalPrice → verde como siempre
                                        <span className="text-emerald-600 font-bold">
                                            {propItem.price}
                                        </span>
                                    ) : (
                                        <span className="text-slate-400 italic">Sin precio</span>
                                    )}
                                </button>
                            </span>
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
                    <div className="relative w-full max-w-sm bg-white contenedorCosas shadow-2xl animate-in fade-in zoom-in-95 duration-300">
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
                                    <div className="absolute top-full mt-2 z-10 animate-in fade-in slide-in-from-top-2 duration-200">
                                        <div
                                            className="bg-white border contenedorCosas shadow-lg overflow-hidden max-h-56 overflow-y-auto"
                                            // Esto es clave: evita que el scroll burbujee al body
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
    const [isLoading, setIsLoading] = useState(true);
    const [animatedItems, setAnimatedItems] = useState(new Set());
    const [isUpdatingPrices, setIsUpdatingPrices] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => {
            isInitialLoad.current = false;
        }, 50);

        return () => clearTimeout(timer);
    }, []);

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

        // === ACTUALIZACIÓN DE PRECIOS EN BACKGROUND ===
        const updatePricesIfNeeded = async () => {
            const data = getHistory();
            const twelveHoursInMs = 12 * 60 * 60 * 1000;
            const now = Date.now();

            const itemsToUpdate = data.filter(item => {
                const lastUpdateTime = item.lastUpdate ? new Date(item.lastUpdate).getTime() : 0;
                return !item.lastUpdate || now - lastUpdateTime > twelveHoursInMs;
            });

            if (itemsToUpdate.length === 0) return;

            setIsUpdatingPrices(true);

            // Toast inicial con progreso
            toast.loading(`Actualizando ${itemsToUpdate.length} precio${itemsToUpdate.length > 1 ? 's' : ''}... (0/${itemsToUpdate.length})`, {
                id: "updating-prices-toast",
                duration: Infinity,
            });

            let updatedCount = 0;

            for (const item of itemsToUpdate) {
                await new Promise(resolve => setTimeout(resolve, 1500)); // 1.5s entre requests

                try {
                    await fetchRealData(item);
                    updatedCount++;

                    // Actualizamos el progreso en el mismo toast
                    toast.loading(
                        `Actualizando ${itemsToUpdate.length} precio${itemsToUpdate.length > 1 ? 's' : ''}... (${updatedCount}/${itemsToUpdate.length})`,
                        { id: "updating-prices-toast", duration: Infinity }
                    );
                } catch (err) {
                    console.warn(`Error actualizando ASIN ${item.asin}:`, err);
                    updatedCount++;
                    toast.loading(
                        `Actualizando... (${updatedCount}/${itemsToUpdate.length})`,
                        { id: "updating-prices-toast", duration: Infinity }
                    );
                }
            }

            // === SOLO CERRAMOS EL TOAST, SIN MENSAJE DE ÉXITO ===
            toast.dismiss("updating-prices-toast");

            setIsUpdatingPrices(false);
            loadHistory(); // recargamos el historial para reflejar cambios
        };

        updatePricesIfNeeded();

        return () => {
            window.removeEventListener('storage', handleStorageChange);
            window.removeEventListener('amazon-history-updated', handleLocalUpdate);
        };
    }, []); // ← Mantiene [] porque solo se ejecuta una vez al montar

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
                const headers = ["Fecha", "Título", "Precio", "Dominio", "URL Afiliado", "ASIN"];
                const rows = data.map(item => [
                    new Date(item.timestamp).toLocaleString("es-ES"),
                    `"${(item.productTitle || "").replace(/"/g, '""')}"`,
                    item.price ? `"${item.price.replace(/"/g, '""')}"` : '""', // con comillas por si tiene € o comas
                    item.domain || "",
                    item.affiliateUrl || "",
                    item.asin || ""
                ]);

                // BOM para que Excel entienda UTF-8 y tildes correctamente
                const BOM = "\uFEFF";
                content = BOM + [headers, ...rows]
                    .map(row => row.join(";"))
                    .join("\r\n");

                mimeType = "text/csv";
                filename = "historialUrlAmazon.csv";
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
        </>
    );
}