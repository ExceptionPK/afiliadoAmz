// pages/History.jsx
import React, { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "../utils/supabaseClient";
import MagicParticles from "../components/MagicParticles";
import { toast } from "sonner";
import { createPortal } from "react-dom";
import { Send } from "lucide-react";

import {
    Search,
    ExternalLink,
    Trash2,
    Download,
    Upload,
    Calendar,
    Globe,
    Package,
    Copy,
    X,
    RefreshCw,
    Check,
    Bot
} from "lucide-react";
import {
    getHistory,
    removeFromHistory,
    fetchRealData,
    updateOutdatedPricesManually,
    importHistory
} from "../utils/storage";

import {
    getUserHistory,
    updateHistoryItem,
    deleteFromHistory,
    clearUserHistory,
    saveToHistory,
    updateHistoryPositions
} from "../utils/supabaseStorage";

const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY || "";

const HistoryItem = ({
    item: propItem,
    onDelete,
    setHistory,
    index,
    moveItem,
    isDragging,
    isDragOver,
    isAuthenticated
}) => {
    const [editingId, setEditingId] = useState(null);
    const [editTitle, setEditTitle] = useState("");
    const [localTitle, setLocalTitle] = useState(propItem.productTitle);
    const [editingPriceId, setEditingPriceId] = useState(null);
    const [editPrice, setEditPrice] = useState("");
    const [editOriginalPrice, setEditOriginalPrice] = useState("");
    const [editFocus, setEditFocus] = useState("current");
    const priceInputRef = useRef(null);
    const inputRef = useRef(null);
    const [showShareModal, setShowShareModal] = useState(false);
    const [customMessage, setCustomMessage] = useState("");
    const [selectedOption, setSelectedOption] = useState("none");
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
    }, [showShareModal]);

    useEffect(() => {
        if (editingPriceId === propItem.id && priceInputRef.current) {
            const timer = setTimeout(() => {
                priceInputRef.current.focus();
                priceInputRef.current.select();
            }, 10);

            return () => clearTimeout(timer);
        }
    }, [editingPriceId, propItem.id]);

    const startEditing = (e) => {
        e.stopPropagation();
        setEditingId(propItem.id);
        setEditTitle(localTitle);
        setTimeout(() => inputRef.current?.focus(), 50);
    };

    const saveTitle = async () => {
        const newTitle = editTitle.trim().slice(0, 120);
        if (!newTitle || newTitle === localTitle) {
            setEditingId(null);
            return;
        }

        const updatedEntry = { ...propItem, productTitle: newTitle };

        if (isAuthenticated) {
            await updateHistoryItem(updatedEntry);
        } else {
            // Lógica local antigua
            const history = getHistory();
            const updated = history.map(h =>
                h.id === propItem.id ? { ...h, productTitle: newTitle } : h
            );
            localStorage.setItem('amazon-affiliate-history', JSON.stringify(updated));
            window.dispatchEvent(new Event('amazon-history-updated'));
        }

        setLocalTitle(newTitle);
        setHistory(prev => prev.map(h => h.id === propItem.id ? updatedEntry : h));
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

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            inputRef.current?.blur();
        } else if (e.key === 'Escape') {
            setEditingId(null);
            setEditTitle("");
        }
    };

    const handleDragStart = (e) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', index.toString());
        e.currentTarget.classList.add('dragging');
    };

    const handleDragEnd = (e) => {
        e.currentTarget.classList.remove('dragging', 'drag-over');
        document.querySelectorAll('.history-item').forEach(el => {
            el.classList.remove('drag-over');
        });
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.currentTarget.classList.add('drag-over');
    };

    const handleDragEnter = (e) => {
        e.preventDefault();
        e.currentTarget.classList.add('drag-over');
    };

    const handleDragLeave = (e) => {
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

    const handleShare = async () => {
        let message = "";
        if (selectedOption === "quick") {
            message = customMessage || "Mira este producto en Amazon:";
        } else if (selectedOption === "custom") {
            message = customMessage.trim();
        }

        // Priorizamos shortLink si existe, si no → generamos uno ahora
        let linkToShare = propItem.shortLink;

        if (!linkToShare) {
            try {
                const { shortenWithShortGy } = await import("../utils/storage");

                const slugBase = propItem.asin.toLowerCase();
                const customSlug = `p-${slugBase}`;

                linkToShare = await shortenWithShortGy(propItem.affiliateUrl, customSlug);

                const history = getHistory();
                const updated = history.map(h =>
                    h.id === propItem.id ? { ...h, shortLink: linkToShare } : h
                );
                localStorage.setItem('amazon-affiliate-history', JSON.stringify(updated));
                setHistory(updated);
            } catch (err) {
                console.error("Error generando short link on-demand:", err);
                linkToShare = propItem.affiliateUrl; // fallback
            }
        }

        const text = encodeURIComponent(
            message ? `${message} ${linkToShare}` : linkToShare
        );
        const whatsappUrl = `https://api.whatsapp.com/send?text=${text}`;
        window.open(whatsappUrl, "_blank");

        setShowShareModal(false);
        setSelectedOption("none");
        setCustomMessage("");
        setShowQuickDropdown(false);
    };

    const formatPrice = (raw) => {
        if (!raw || !raw.trim()) return null;

        let cleaned = raw.trim().replace(' €', '').replace(/\s/g, '');

        let decimalSeparator = ',';
        let thousandsSeparator = '.';

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

        if (thousandsSeparator) {
            cleaned = cleaned.replace(new RegExp('\\' + thousandsSeparator, 'g'), '');
        }

        if (decimalSeparator && decimalSeparator !== '.') {
            cleaned = cleaned.replace(decimalSeparator, '.');
        }

        let num = parseFloat(cleaned);
        if (isNaN(num)) return null;

        let parts = num.toFixed(2).split('.');
        let integerPart = parts[0];
        let decimalPart = parts[1];

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

    const finishPriceEditing = async () => {
        const formattedCurrent = editPrice.trim() ? formatPrice(editPrice) : null;
        const formattedOriginal = editOriginalPrice.trim() ? formatPrice(editOriginalPrice) : null;

        const updatedEntry = {
            ...propItem,
            price: formattedCurrent,
            originalPrice: formattedOriginal,
        };

        if (isAuthenticated) {
            await updateHistoryItem(updatedEntry);
        } else {
            const history = getHistory();
            const updated = history.map(h =>
                h.id === propItem.id ? updatedEntry : h
            );
            localStorage.setItem('amazon-affiliate-history', JSON.stringify(updated));
            window.dispatchEvent(new Event('amazon-history-updated'));
        }

        setHistory(prev => prev.map(h => h.id === propItem.id ? updatedEntry : h));
        setEditingPriceId(null);
    };

    const markAsVisited = async (asin, domain) => {
        const key = `visited_${asin}_${domain}`;
        const timestamp = Date.now();
        localStorage.setItem(key, timestamp.toString());

        const user = await getCurrentUser();
        if (user?.id) {
            supabase
                .from('affiliate_history')
                .update({ last_visited: new Date(timestamp).toISOString() })
                .eq('user_id', user.id)
                .eq('asin', asin)
                .eq('dominio', domain)
                .then(({ error }) => {
                    if (error) console.warn("No se pudo guardar last_visited", error);
                });
        }
    };

    const wasVisitedRecently = (item) => {
        // 1. Prioridad máxima: caché local (muy rápido)
        const key = `visited_${item.asin}_${item.domain}`;
        const localTs = localStorage.getItem(key);
        if (localTs) {
            const ts = parseInt(localTs, 10);
            if (Date.now() - ts < 24 * 60 * 60 * 1000) return true;
        }

        // 2. Si no hay caché reciente → mirar Supabase
        if (item.lastVisited) {
            return Date.now() - item.lastVisited < 24 * 60 * 60 * 1000;
        }

        return false;
    };

    const generateShareMessage = async () => {
        const title = propItem.productTitle?.trim() || "este producto";
        const hasDiscount = propItem.originalPrice && propItem.price &&
            parseFloat(propItem.price.replace(/[^0-9,]/g, '').replace(',', '.')) <
            parseFloat(propItem.originalPrice.replace(/[^0-9,]/g, '').replace(',', '.'));

        const priceMention = hasDiscount
            ? `, ahora a un precio más bajo (${propItem.price})`
            : propItem.price
                ? ` (${propItem.price})`
                : "";

        setCustomMessage("Generando mensaje...");

        try {
            const prompt = `Eres una persona real (de España, adulta, con buen criterio) que acaba de ver un producto en Amazon y se lo quiere pasar por WhatsApp a un amigo o conocido para interesarle y que lo compre.

            Producto: "${title}"${priceMention}.

            Instrucciones clave:
            - Usa español natural de España, puedes cometer errores leves y naturales.
            - A veces usa contracciones informales: "q" en vez de "que", "xq" en vez de "porque".
            - No inventes ninguna característica del producto.
            - Tono natural, profesional y calmado (como un amigo o colega con buen gusto).
            - NUNCA uses emojis ni exclamaciones excesivas.
            - NO inventes características del producto.
            - Varía pero siempre suena humano y nunca suenes como un anuncio o como una IA.
            - Varía mucho el estilo: puedes mencionar o no el nombre del producto, el precio o el descuento según te parezca natural en ese momento.
            - Si hay descuento importante, puedes resaltarlo con naturalidad pero no siempre (ej: "está bastante rebajado", "lo vi más barato de lo normal").
            - Crea interés sutil: curiosidad, oportunidad, utilidad, pensamiento en la otra persona.
            - Máximo 3-5 líneas cortas.
            - Termina siempre invitando suavemente a mirar el enlace.

            Ejemplos de mensajes reales que podrías enviar (varía siempre, no copies literalmente):
            He visto este producto que me ha parecido interesante, le echas un vistazo?
            Mira lo que encontré, creo que puede valer la pena
            Acabo de ver ${title}${priceMention ? priceMention : ""} y me pareció una buena opción
            Te paso este enlace por si te interesa
            He encontrado ${title} a un precio reducido. Quizás te resulte útil.
            Encontré esto que te interesaba, echale un vistazo
            Por cierto, encontré esto en Amazon y me pareció buena opción.
            Hola, mira buscando encontre esto que la verdad esta bastante bien y te puede interesar
            Hola, he encontrado esto que me parece de buena calidad y en tu caso puede serte útil

            Genera un mensaje único y natural. Responde SOLO el texto del mensaje.`;

            const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${GROQ_API_KEY}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: "llama-3.1-8b-instant",
                    messages: [{ role: "user", content: prompt }],
                    temperature: 1,
                    max_tokens: 100
                })
            });

            if (!response.ok) throw new Error("Error Groq");

            const data = await response.json();
            let generated = data.choices[0]?.message?.content?.trim() || "";

            generated = generated
                .replace(/^"(.+)"$/, '$1')
                .replace(/^“(.+)”$/, '$1')
                .replace(/^«(.+)»$/, '$1')
                .replace(/^'(.+)'$/, '$1')
                .replace(/^`(.+)`$/, '$1')
                .trim();

            if (generated && generated.length > 15 && generated.length < 300) {
                setCustomMessage(generated);
            } else {
                const fallbacks = [
                    "He encontrado este producto en Amazon que me ha parecido interesante. ¿Le echas un vistazo?",
                    "Mira este enlace de Amazon, creo que puede resultarte útil.",
                    title.length < 60 ? `Te paso ${title}. Lo vi en Amazon y me pareció una buena opción.` : "Te paso este enlace de Amazon por si te interesa.",
                    hasDiscount ? `He visto ${title} con un descuento notable. Quizás valga la pena.` : "Acabo de ver este producto en Amazon. Me llamó la atención.",
                    "Encontré esto en Amazon y pensé que podría interesarte.",
                    "Mira esto que encontré en Amazon. Parece interesante."
                ];
                const randomFallback = fallbacks[Math.floor(Math.random() * fallbacks.length)];
                setCustomMessage(randomFallback);
            }
        } catch (err) {
            console.error("Error generando mensaje:", err);
            // Fallback seguro y profesional
            setCustomMessage("He encontrado este producto en Amazon que me ha parecido interesante. ¿Le echas un vistazo?");
        }
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
                                        finishPriceEditing();
                                    }
                                }}
                            >
                                {/* Precio Original */}
                                <div className="flex items-center gap-1">
                                    <span className="text-xs text-slate-500">Original:</span>
                                    <input
                                        type="text"
                                        value={editOriginalPrice}
                                        onChange={(e) => {
                                            let value = e.target.value
                                                .replace(/[^0-9,.]/g, '')
                                                .replace(/\./g, ',');
                                            const parts = value.split(',');
                                            if (parts.length > 2) value = parts[0] + ',' + parts.slice(1).join('');
                                            if (parts[1] && parts[1].length > 2) value = parts[0] + ',' + parts[1].slice(0, 2);
                                            setEditOriginalPrice(value);
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === 'Escape') {
                                                e.preventDefault();
                                                if (e.key === 'Enter') {
                                                    // Pasar al siguiente input (opcional)
                                                    priceInputRef.current?.focus();
                                                } else {
                                                    finishPriceEditing();
                                                }
                                            }
                                            if (e.key === '.') {
                                                e.preventDefault();
                                                setEditOriginalPrice(prev => prev + ',');
                                            }
                                        }}
                                        onFocus={(e) => e.target.select()}
                                        className="w-16 px-2 py-1 text-xs font-medium text-slate-700 bg-slate-50 border border-slate-300 contenedorCosas focus:outline-none focus:ring-1 focus:ring-violet-500"
                                        placeholder="0,00 €"
                                    />
                                </div>

                                {/* Precio Actual */}
                                <div className="flex items-center gap-1">
                                    <span className="text-xs text-slate-500">Actual:</span>
                                    <input
                                        type="text"
                                        value={editPrice}
                                        onChange={(e) => {
                                            let value = e.target.value
                                                .replace(/[^0-9,.]/g, '')
                                                .replace(/\./g, ',');
                                            const parts = value.split(',');
                                            if (parts.length > 2) value = parts[0] + ',' + parts.slice(1).join('');
                                            if (parts[1] && parts[1].length > 2) value = parts[0] + ',' + parts[1].slice(0, 2);
                                            setEditPrice(value);
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === 'Escape') {
                                                e.preventDefault();
                                                finishPriceEditing();
                                            }
                                            if (e.key === '.') {
                                                e.preventDefault();
                                                setEditPrice(prev => prev + ',');
                                            }
                                        }}
                                        onFocus={(e) => e.target.select()}
                                        className="w-16 px-2 py-1 text-xs font-bold bg-emerald-50 border border-emerald-400 contenedorCosas focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                        placeholder="0,00 €"
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
                        onClick={() => {
                            markAsVisited(propItem.asin, propItem.domain);

                            // Opcional: actualizar UI inmediatamente (optimista)
                            setHistory(prev =>
                                prev.map(it =>
                                    it.id === propItem.id
                                        ? { ...it, lastVisited: Date.now() }
                                        : it
                                )
                            );
                        }}
                        className="p-2 -mt-2 contenedorCosas hover:bg-slate-100 transition group"
                        title="Abrir en Amazon"
                    >
                        {wasVisitedRecently(propItem) ? (
                            <Check className="w-4 h-4 text-emerald-600" />
                        ) : (
                            <ExternalLink className="w-4 h-4 text-slate-600 group-hover:text-slate-800" />
                        )}
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
                        onClick={() => onDelete(propItem.id, propItem.asin, propItem.domain)}
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
                                    setShowQuickDropdown(false);
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
                                        setShowQuickDropdown(false);
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
                                    <div className="px-0 animate-in fade-in slide-in-from-top-2 duration-300 relative">
                                        <textarea
                                            value={customMessage}
                                            onChange={(e) => setCustomMessage(e.target.value)}
                                            placeholder="Escribe tu mensaje aquí..."
                                            rows="4"
                                            autoFocus
                                            className="w-full px-4 py-3 pr-12 text-sm text-slate-800 bg-slate-50/50 border border-violet-300 contenedorCosas resize-none focus:outline-none transition shadow-sm"
                                        />
                                        <button
                                            onClick={async (e) => {
                                                e.stopPropagation();
                                                await generateShareMessage();
                                                const textarea = document.querySelector('#share-modal textarea');
                                                if (textarea) {
                                                    textarea.focus();
                                                    textarea.selectionStart = textarea.selectionEnd = textarea.value.length;
                                                }
                                            }}
                                            disabled={selectedOption !== "custom"}
                                            className={`absolute top-1 right-1 p-1.5 rounded-lg transition-all duration-200 contenedorCosas ${selectedOption === "custom"
                                                ? "text-violet-600 hover:text-violet-800 hover:bg-violet-100 cursor-pointer"
                                                : "text-slate-300 cursor-not-allowed opacity-50"
                                                }`}
                                            title="Generar mensaje con IA"
                                        >
                                            <Bot className="w-7 h-7" />
                                        </button>
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
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [animatedItems, setAnimatedItems] = useState(new Set());
    const [isUpdatingPrices, setIsUpdatingPrices] = useState(false);
    const [showExportModal, setShowExportModal] = useState(false);
    const [exportFormat, setExportFormat] = useState(null);
    const [exportFilename, setExportFilename] = useState("");
    const [deletedItem, setDeletedItem] = useState(null);
    const undoTimeoutRef = useRef(null);
    const lastDeletedRef = useRef(null);

    // 1. Detectar si hay sesión activa
    useEffect(() => {
        const checkAuth = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            setIsAuthenticated(!!user);
        };
        checkAuth();

        // Escuchar cambios de auth en tiempo real
        const { data: authListener } = supabase.auth.onAuthStateChange((_, session) => {
            setIsAuthenticated(!!session?.user);
        });

        return () => {
            authListener?.subscription?.unsubscribe();
        };
    }, []);


    useEffect(() => {
        const timer = setTimeout(() => {
            isInitialLoad.current = false;
        }, 50);

        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        if (showExportModal && exportInputRef.current) {
            setTimeout(() => {
                exportInputRef.current.focus();
                exportInputRef.current.select();
            }, 100);
        }
    }, [showExportModal]);

    // 2. Cargar historial usando la función unificada
    useEffect(() => {
        console.log("[HISTORY LOAD] useEffect disparado. isAuthenticated =", isAuthenticated);

        const loadHistory = async () => {
            setIsLoading(true);
            console.log("[HISTORY LOAD] Intentando cargar historial... Fuente esperada:",
                isAuthenticated ? "Supabase" : "localStorage");

            try {
                const data = await getUserHistory(100);
                console.log("[HISTORY LOAD] Datos obtenidos:",
                    data?.length || 0, "items | Primera entrada:", data?.[0]?.asin || "vacío");
                setHistory(data || []);
            } catch (err) {
                console.error("[HISTORY LOAD] ERROR CRÍTICO:", err);
                toast.error("Error al cargar historial. Refresca manualmente.");
                setHistory([]); // Forzamos vacío en caso de fallo
            } finally {
                setIsLoading(false);
            }
        };

        loadHistory();

        const handleUpdate = () => {
            console.log("[HISTORY EVENT] amazon-history-updated recibido → recargando");
            loadHistory();
        };

        window.addEventListener('amazon-history-updated', handleUpdate);

        return () => {
            window.removeEventListener('amazon-history-updated', handleUpdate);
        };
    }, [isAuthenticated]);

    // Añade este useEffect nuevo (puede ir justo después del useEffect principal de carga)
    useEffect(() => {
        const handleWindowFocus = () => {
            console.log("[WINDOW FOCUS] Volviste a la pestaña → recargando historial si autenticado");

            if (isAuthenticated) {
                const reload = async () => {
                    try {
                        const freshData = await getUserHistory(100);
                        console.log("[WINDOW FOCUS] Datos frescos:", freshData?.length || 0, "items");

                        setHistory(prev => {
                            if (prev.length === freshData.length &&
                                prev[0]?.asin === freshData[0]?.asin) {
                                console.log("[WINDOW FOCUS] Datos iguales → no actualizamos UI");
                                return prev;
                            }
                            return freshData || [];
                        });
                    } catch (err) {
                        console.error("[WINDOW FOCUS] Error:", err);
                    }
                };

                reload();
            }
        };

        window.addEventListener('focus', handleWindowFocus);

        return () => {
            window.removeEventListener('focus', handleWindowFocus);
        };
    }, [isAuthenticated]);  // Dependencia importante

    useEffect(() => {
        if (showConfirmModal) {
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

    const handleClickOutside = (e) => {
        if (exportButtonRef.current && !exportButtonRef.current.contains(e.target)) {
            setShowExportMenu(false);
        }
    };

    useEffect(() => {
        if (!showExportMenu) return;

        const handler = (e) => handleClickOutside(e);
        document.addEventListener("click", handler);
        return () => document.removeEventListener("click", handler);
    }, [showExportMenu]);

    const filtered = useMemo(() => {
        if (!search.trim()) return history;

        const normalize = (str) =>
            str
                .toLowerCase()
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .replace(/[^a-z0-9\s]/g, "")
                .trim();

        const searchLower = normalize(search);

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
                titleNorm.includes(searchLower)
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

    const handleDelete = async (id, asin, domain) => {
        const currentHistory = [...history];
        const itemIndex = currentHistory.findIndex(item => item.id === id);
        const itemToDelete = currentHistory[itemIndex];

        if (!itemToDelete) return;

        lastDeletedRef.current = {
            item: itemToDelete,
            originalIndex: itemIndex,
            originalHistoryLength: currentHistory.length
        };

        try {
            if (isAuthenticated) {
                await deleteFromHistory(id, asin, domain);
            } else {
                removeFromHistory(id);
            }

            const updatedHistory = await getUserHistory();
            setHistory(updatedHistory);

            toast(
                <div className="relative w-full pt-3 pb-3 px-3">
                    <div className="flex items-center justify-between">
                        <span className="font-medium text-slate-100">Enlace eliminado</span>
                        <button
                            onClick={async () => {
                                const deleted = lastDeletedRef.current;
                                if (!deleted) return;

                                try {
                                    if (isAuthenticated) {
                                        // Restaurar en Supabase
                                        await saveToHistory(deleted.item);
                                    } else {
                                        // Restaurar local
                                        const currentFullHistory = getHistory();
                                        let insertAt = deleted.originalIndex;
                                        if (insertAt > currentFullHistory.length) {
                                            insertAt = currentFullHistory.length;
                                        }
                                        const newHistory = [
                                            ...currentFullHistory.slice(0, insertAt),
                                            deleted.item,
                                            ...currentFullHistory.slice(insertAt)
                                        ];
                                        localStorage.setItem('amazon-affiliate-history', JSON.stringify(newHistory));
                                    }

                                    // Recargar el historial actualizado
                                    const refreshed = await getUserHistory();
                                    setHistory(refreshed);

                                    lastDeletedRef.current = null;
                                    toast.dismiss("undo-delete");
                                    toast.info("Acción deshecha");
                                } catch (err) {
                                    console.error("Error al deshacer:", err);
                                    toast.error("No se pudo deshacer la eliminación");
                                }
                            }}
                            className="px-4 py-1.5 text-sm font-semibold text-slate-900 bg-white hover:bg-slate-100 contenedorCosas transition shadow-md"
                        >
                            Deshacer
                        </button>
                    </div>
                    <div className="absolute left-0 right-0 bottom-0 h-0.5 bg-slate-800/50">
                        <div
                            className="h-full bg-white origin-left"
                            style={{ animation: 'shrink 5s linear forwards' }}
                        />
                    </div>
                </div>,
                {
                    id: "undo-delete",
                    duration: 5000,
                    position: "bottom-center",
                    style: {
                        background: '#0f172a',
                        color: '#f1f5f9',
                        borderRadius: '.5rem',
                        padding: 0,
                        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
                        maxWidth: '420px',
                        overflow: 'hidden',
                    },
                    className: 'font-medium',
                    onAutoClose: () => {
                        lastDeletedRef.current = null;
                    },
                    onDismiss: () => {
                        lastDeletedRef.current = null;
                    }
                }
            );
        } catch (err) {
            console.error("Error al borrar:", err);
            toast.error("No se pudo eliminar el producto");
        }
    };

    const handleClear = () => {
        setShowConfirmModal(true);
    };

    const confirmClear = async () => {
        try {
            if (isAuthenticated) {
                await clearUserHistory();
            } else {
                localStorage.removeItem('amazon-affiliate-history');
                window.dispatchEvent(new Event('amazon-history-updated'));
            }
            setHistory([]);
            toast.success("Historial vaciado");
        } catch (err) {
            toast.error("Error al vaciar el historial");
        }
        setShowConfirmModal(false);
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

                const longDuration = 5000;

                if (useInfoToast) {
                    toast.info(message, { duration: longDuration });
                } else {
                    toast.success(message, { duration: longDuration });
                }

                if (fileInputRef.current) {
                    fileInputRef.current.value = null;
                }
            } else {
                toast.error(message || "Archivo inválido", { duration: 6000 });
                if (fileInputRef.current) {
                    fileInputRef.current.value = null;
                }
            }
        });
    };

    const handleExportFormat = (format) => {
        const defaultName = format === "csv"
            ? "historialUrlAmazon"
            : "amazon-affiliate-history";

        const suggestedName = `${defaultName}_${new Date().toISOString().split('T')[0]}`;

        setExportFormat(format);
        setExportFilename(suggestedName);
        setShowExportModal(true);
        setShowExportMenu(false);
    };

    const performExport = async () => {
        if (!exportFormat) return;

        let data;
        if (isAuthenticated) {
            data = await getUserHistory(1000);
        } else {
            data = getHistory();
        }

        if (!data?.length) {
            toast.error("No hay datos para exportar");
            return;
        }

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
                    item.domain || "amazon.es",
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

        // Intentar usar File System Access API (mejor experiencia en Chrome/Edge)
        if ("showSaveFilePicker" in window) {
            try {
                const handle = await window.showSaveFilePicker({
                    suggestedName: filename,
                    types: [{
                        description: exportFormat.toUpperCase() + ' File',
                        accept: { [mimeType]: [`.${exportFormat}`] },
                    }],
                });
                const writable = await handle.createWritable();
                await writable.write(blob);
                await writable.close();
                toast.success(`Guardado como ${filename}`);
                setShowExportModal(false);
                return;
            } catch (err) {
                if (err.name !== 'AbortError') {
                    console.warn("File System Access API falló, usando descarga normal", err);
                }
            }
        }

        // Fallback clásico: descarga mediante enlace
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


    const moveItem = async (fromIndex, toIndex) => {
        if (fromIndex === toIndex) return;

        const newHistory = [...history];
        const [movedItem] = newHistory.splice(fromIndex, 1);
        newHistory.splice(toIndex, 0, movedItem);

        setHistory(newHistory);

        if (!isAuthenticated) {
            localStorage.setItem('amazon-affiliate-history', JSON.stringify(newHistory));
            toast.success("Orden cambiado (local)");
            return;
        }

        // Obtenemos el usuario directamente aquí
        const { data: { user } } = await supabase.auth.getUser();

        if (!user?.id) {
            toast.warning("No se detectó sesión activa");
            return;
        }

        const positionsToUpdate = newHistory.map((item, idx) => ({
            asin: item.asin,
            dominio: item.domain || item.dominio || 'amazon.es',
            position: idx + 1,
        }));

        try {
            const success = await updateHistoryPositions(user.id, positionsToUpdate);

            if (success) {
                toast.success("Orden guardado");
            } else {
                toast.warning("Fallo al reordenar en nube");
            }
        } catch (err) {
            console.error("Error al guardar nuevo orden:", err);
            toast.error("No se pudo guardar el nuevo orden");
        }
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
                                                onClick={async () => {
                                                    setShowExportMenu(false);

                                                    let data;
                                                    try {
                                                        if (isAuthenticated) {
                                                            data = await getUserHistory(1000);
                                                        } else {
                                                            data = getHistory();
                                                        }
                                                    } catch (err) {
                                                        console.error("Error al obtener datos para exportar:", err);
                                                        toast.error("No se pudieron cargar los datos para exportar");
                                                        return;
                                                    }

                                                    if (!data?.length) {
                                                        toast.error("No hay datos para exportar");
                                                        return;
                                                    }

                                                    // === EXPORTAR DIRECTO CON FILE SYSTEM ACCESS API (JSON o CSV) ===
                                                    if ("showSaveFilePicker" in window) {
                                                        let content = "";
                                                        let mimeType = "";
                                                        let defaultExtension = "";
                                                        let defaultBaseName = "";

                                                        if (opt.format === "json") {
                                                            content = JSON.stringify(data, null, 2);
                                                            mimeType = "application/json";
                                                            defaultExtension = ".json";
                                                            defaultBaseName = "amazon-affiliate-history";
                                                        } else if (opt.format === "csv") {
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
                                                                item.domain || item.dominio || "amazon.es",
                                                                item.affiliateUrl || item.affiliate_url || "",
                                                                item.asin || ""
                                                            ]);
                                                            const BOM = "\uFEFF";
                                                            content = BOM + [headers, ...rows]
                                                                .map(row => row.join(";"))
                                                                .join("\r\n");
                                                            mimeType = "text/csv";
                                                            defaultExtension = ".csv";
                                                            defaultBaseName = "historialUrlAmazon";
                                                        }

                                                        const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });

                                                        const today = new Date().toISOString().split('T')[0];
                                                        const defaultName = `${defaultBaseName}_${today}${defaultExtension}`;

                                                        try {
                                                            const handle = await window.showSaveFilePicker({
                                                                suggestedName: defaultName,
                                                                types: [{
                                                                    description: opt.format === "json" ? 'Archivo JSON' : 'Archivo CSV',
                                                                    accept: { [mimeType]: [defaultExtension] },
                                                                }],
                                                            });

                                                            const fileName = handle.name;

                                                            const writable = await handle.createWritable();
                                                            await writable.write(blob);
                                                            await writable.close();

                                                            toast.success(`Guardado como "${fileName}"`, {
                                                                duration: 5000
                                                            });
                                                        } catch (err) {
                                                            if (err.name !== 'AbortError') {
                                                                console.warn("File System Access API falló", err);
                                                                toast.error("No se pudo guardar directamente. Usa descarga normal.");

                                                                const suggestedName = `${defaultBaseName}_${today}`;
                                                                setExportFormat(opt.format);
                                                                setExportFilename(suggestedName.replace(defaultExtension, ''));
                                                                setShowExportModal(true);
                                                            }
                                                        }
                                                    } else {
                                                        const defaultBaseName = opt.format === "csv" ? "historialUrlAmazon" : "amazon-affiliate-history";
                                                        const suggestedName = `${defaultBaseName}_${new Date().toISOString().split('T')[0]}`;
                                                        setExportFormat(opt.format);
                                                        setExportFilename(suggestedName);
                                                        setShowExportModal(true);
                                                    }
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
                                    {[...Array(6)].map((_, i) => (
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
                                            isAuthenticated={isAuthenticated}
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
                                bg-violet-500 text-white
                                w-12 h-12 rounded-full
                                transition-all duration-300
                                shadow-lg flex items-center justify-center
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
                                className={`w-5 h-5 ${isUpdatingPrices ? 'animate-spin' : ''}`}
                            />
                        </button>
                    </div>
                );
            })()}
        </>
    );
}