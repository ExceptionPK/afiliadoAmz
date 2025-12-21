const STORAGE_KEY = 'amazon-affiliate-history';
const TITLE_CACHE_KEY = 'amazon-title-cache';

const getTitleCache = () => {
    try {
        const data = localStorage.getItem(TITLE_CACHE_KEY);
        return data ? JSON.parse(data) : {};
    } catch {
        return {};
    }
};

const saveTitleCache = (cache) => {
    try {
        localStorage.setItem(TITLE_CACHE_KEY, JSON.stringify(cache));
    } catch { }
};

export const getHistory = () => {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    } catch {
        return [];
    }
};

export const addToHistory = (entry) => {
    const history = getHistory();
    const exists = history.some(h => h.asin === entry.asin && h.domain === entry.domain);
    if (exists) return;

    // Título por defecto seguro
    let productTitle = `Producto ${entry.asin}`;
    try {
        const urlObj = new URL(entry.originalUrl);
        const path = urlObj.pathname;
        const slugMatch = path.match(/\/([^\/]+)\/dp\/([A-Z0-9]{10})/i);
        if (slugMatch?.[1]) {
            const slug = decodeURIComponent(slugMatch[1]).trim();
            if (slug && slug.length > 3 && !/dp|gp|product|ref/i.test(slug)) {
                productTitle = slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()).trim();
            }
        }
    } catch { }

    const newEntry = {
        ...entry,
        id: Date.now() + '-' + Math.random().toString(36).substring(2, 9),
        timestamp: new Date().toISOString(),
        productTitle: productTitle.slice(0, 120),
        price: null,            // Último precio conocido (se actualiza con el tiempo)
        originalPrice: null,    // Precio inicial (nunca cambia)
        prices: [],             // Array de { timestamp: string, price: string }
        lastUpdate: null,       // Fecha de la última vez que se intentó actualizar
    };

    history.unshift(newEntry);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));

    // === FETCH REAL DATA EN SEGUNDO PLANO ===
    setTimeout(() => fetchRealData(newEntry), 500);
};

// FUNCIÓN PRINCIPAL DE SCRAPING Y ACTUALIZACIÓN DE DATOS
export const fetchRealData = async (entry) => {
    const proxies = [
        'https://corsproxy.io/?',                  // Primero: más estable ahora
        'https://api.codetabs.com/v1/proxy?quest=', // Segundo: muy fiable
        'https://api.allorigins.win/raw?url=',     // Tercero: si sigue vivo
        'https://cors.lol/',                       // Cuarto: por si acaso
    ];

    let html = null;
    for (const proxy of proxies) {
        try {
            let proxyUrl = proxy + encodeURIComponent(entry.originalUrl);

            // Especial para codetabs (no necesita encode completo)
            if (proxy.includes('codetabs')) {
                proxyUrl = proxy + entry.originalUrl;
            }

            // Especial para cors.lol (solo añade al final)
            if (proxy.includes('cors.lol')) {
                proxyUrl = proxy + entry.originalUrl.replace(/^https?:\/\//, '');
            }

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 14000);

            const res = await fetch(proxyUrl, {
                signal: controller.signal,
                headers: {
                    'X-Requested-With': 'XMLHttpRequest',
                }
            });

            clearTimeout(timeoutId);
            if (!res.ok) continue;

            html = await res.text();

            if (html && html.length > 2000 && /amazon/i.test(html)) break;
        } catch (e) {
            console.warn(`Proxy falló: ${proxy}`, e);
        }
    }

    if (!html) return;

    // ==================== TÍTULO LIMPIO ====================
    let realTitle = entry.productTitle;
    const titleMatch = html.match(/<title[^>]*>([^<]{10,})<\/title>/i);
    if (titleMatch?.[1]) {
        realTitle = titleMatch[1]
            .split(/ - Amazon\.| : | \| | – /)[0]
            .replace(/\s*\([^)]*(oferta|descuento|prime|ahorro|cupón|envío|[0-9]+ ?€|envio)[^)]*\)/gi, '')
            .replace(/\s*\[.*?\]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    // ==================== PRECIO REAL ====================
    let price = null;

    const toNumber = (str) => parseFloat(String(str).replace(/[^0-9,]/g, '').replace(',', '.')) || 0;

    const symbol = html.match(/class=["']a-price-symbol["'][^>]*>([^<]*)</i)?.[1]?.trim() || '€';
    const whole = html.match(/class=["']a-price-whole["'][^>]*>([^<]*)</i)?.[1]?.replace(/\.\s*/g, '') || '';
    const fraction = (html.match(/class=["']a-price-fraction["'][^>]*>([^<]*)</i)?.[1] || '00').padEnd(2, '0').slice(0, 2);

    if (whole && toNumber(whole) > 10) {
        price = `${symbol}${whole},${fraction}`;
    }

    if (!price) {
        const jsonMatch = html.match(/"priceAmount"\s*:\s*"([^"]+)"|"(?:displayPrice|landingPrice|priceToPay)Amount"\s*:\s*"([^"]+)"/i);
        if (jsonMatch) {
            const candidate = jsonMatch[1] || jsonMatch[2];
            if (candidate && toNumber(candidate) > 10) {
                price = candidate.trim();
            }
        }
    }

    if (!price) {
        const offscreenPrices = [...html.matchAll(/<span[^>]+class=["'][^"']*a-offscreen[^"']*["'][^>]*>([^<]+)</gi)]
            .map(m => m[1].trim())
            .filter(txt => {
                const val = toNumber(txt);
                const text = txt.toLowerCase();
                // NUEVO: solo aceptar si contiene € (euro)
                return txt.includes('€') &&
                    val > 15 &&
                    !text.includes('ahorro') &&
                    !text.includes('cupón') &&
                    !text.includes('descuento') &&
                    !text.includes('envío') &&
                    !text.includes('gastos de envío') &&
                    !text.includes('prime') &&
                    !text.includes('suscríbete y ahorra');
            });

        if (offscreenPrices.length > 0) {
            // Ordenar por valor numérico y coger el menor
            const sorted = offscreenPrices.sort((a, b) => toNumber(a) - toNumber(b));
            const lowestTxt = sorted[0];
            const lowestVal = toNumber(lowestTxt);
            if (lowestVal > 15) {
                price = lowestTxt;
            }
        }
    }

    // Formatear precio bonito (español)
    if (price) {
        let cleaned = price.replace(/\s+/g, '').trim();
        cleaned = cleaned.replace(/\.(?=\d{3})/g, '');
        cleaned = cleaned.replace('.', ',');

        const hasEuroAtStart = cleaned.startsWith('€');
        const hasEuroAtEnd = cleaned.endsWith('€');

        if (hasEuroAtStart) {
            cleaned = cleaned.replace(/^€/, '') + ' €';
        } else if (hasEuroAtEnd) {
            cleaned = cleaned.replace(/€$/, ' €');
        } else if (!cleaned.includes('€')) {
            cleaned = cleaned + ' €';
        } else {
            cleaned = cleaned.replace(/€/g, '') + ' €';
        }

        price = cleaned.trim();
    }

    // ==================== ACTUALIZAR HISTORIAL ====================
    const now = new Date().toISOString();
    const history = getHistory();

    const updatedHistory = history.map(h => {
        if (h.asin === entry.asin && h.domain === entry.domain) {
            let newPrices = [...(h.prices || [])];

            // Si encontramos precio y es diferente al último conocido
            if (price && (!newPrices.length || newPrices[newPrices.length - 1].price !== price)) {
                newPrices.push({ timestamp: now, price });
            }

            return {
                ...h,
                price: price || h.price, // Último precio
                originalPrice: h.originalPrice || price, // Fijamos el original la primera vez
                prices: newPrices,
                lastUpdate: now, // Siempre actualizamos esta fecha (incluso si no hay precio nuevo)
            };
        }
        return h;
    });

    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedHistory));
    window.dispatchEvent(new Event('amazon-history-updated'));

    // Guardar título en caché
    if (realTitle.length > 5) {
        const cache = getTitleCache();
        cache[entry.asin] = realTitle.slice(0, 120);
        saveTitleCache(cache);
    }

    // ==================== RECOMENDACIONES ====================
    let recommended = [];

    const sponsored = html.matchAll(/data-asin=["']([A-Z0-9]{10})["'].*?title=["']([^"']{10,200})[^"']*["']/gi);
    for (const m of sponsored) {
        const asin = m[1];
        const titleRaw = m[2].replace(/&quot;|&#039;|\s+/g, ' ').trim();
        if (asin && titleRaw && !recommended.some(r => r.asin === asin)) {
            recommended.push({ asin, title: titleRaw.slice(0, 100) });
        }
    }

    if (recommended.length < 3) {
        const related = html.matchAll(/\/dp\/([A-Z0-9]{10}).*?alt=["']([^"']{10,200})[^"']*["']/gi);
        for (const m of related) {
            const asin = m[1];
            const titleRaw = m[2].replace(/&quot;|&#039;|\s+/g, ' ').trim();
            if (asin && titleRaw && asin !== entry.asin && !recommended.some(r => r.asin === asin)) {
                recommended.push({ asin, title: titleRaw.slice(0, 100) });
                if (recommended.length >= 6) break;
            }
        }
    }

    if (recommended.length > 0) {
        const finalHistory = getHistory().map(h =>
            h.asin === entry.asin && h.domain === entry.domain
                ? { ...h, recommended: recommended.slice(0, 8) }
                : h
        );
        localStorage.setItem(STORAGE_KEY, JSON.stringify(finalHistory));
        window.dispatchEvent(new Event('amazon-history-updated'));
    }
};

export const removeFromHistory = (id) => {
    const history = getHistory().filter(h => h.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
};

export const clearHistory = () => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(TITLE_CACHE_KEY);
};

export const exportHistory = () => {
    const history = getHistory();
    const data = JSON.stringify(history, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `amazon-affiliate-history-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
};

// utils/storage.js → FUNCIÓN importHistory CORREGIDA (VERSIÓN FINAL)
export const importHistory = (file, callback) => {
    const reader = new FileReader();

    reader.onload = (e) => {
        const content = e.target.result.trim();

        try {
            let importedItems = [];

            // -------------------------------------------------
            // 1. INTENTAR COMO JSON (sin cambios)
            // -------------------------------------------------
            if (
                file.type === "application/json" ||
                file.name.endsWith(".json") ||
                content.startsWith("[") ||
                content.startsWith("{")
            ) {
                const data = JSON.parse(content);

                if (Array.isArray(data)) {
                    importedItems = data.map(item => ({
                        ...item,
                        id: item.id || Date.now() + Math.random(),
                        timestamp: item.timestamp || new Date().toISOString(),
                        productTitle: item.productTitle || `Producto ${item.asin || "sin ASIN"}`,
                        price: item.price || null,
                        // === NUEVOS CAMPOS: compatibilidad hacia atrás ===
                        originalPrice: item.originalPrice || item.price || null,
                        prices: Array.isArray(item.prices) ? item.prices : (
                            item.price ? [{ timestamp: item.timestamp || new Date().toISOString(), price: item.price }] : []
                        ),
                        lastUpdate: item.lastUpdate || (item.price ? item.timestamp || new Date().toISOString() : null),
                        domain: item.domain || "amazon.es",
                        affiliateUrl: item.affiliateUrl || "",
                        originalUrl: item.originalUrl || item.affiliateUrl || "",
                        asin: item.asin || "UNKNOWN",
                    }));
                }
            }

            // -------------------------------------------------
            // 2. CSV CON FECHAS ESPAÑOLAS + HORA (CORREGIDO)
            // -------------------------------------------------
            if (importedItems.length === 0) {
                const lines = content.split(/\r\n|\n|\r/).map(l => l.trim()).filter(Boolean);
                if (lines.length === 0) throw new Error("Archivo vacío");

                const sampleLine = lines[0];
                const delimiter = sampleLine.includes(";") ? ";" : ",";

                const hasHeader = /fecha|título|precio|dominio|url|asin/i.test(lines[0]);
                const startIndex = hasHeader ? 1 : 0;

                const parseSpanishDate = (dateStr) => {
                    if (!dateStr || typeof dateStr !== 'string') return null;
                    let clean = dateStr.trim().replace(/,\s*/, ' ');
                    const dateTimeParts = clean.split(' ');
                    const datePart = dateTimeParts[0];
                    const match = datePart.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
                    if (!match) return null;
                    const [, day, month, year] = match;
                    const dayPadded = day.padStart(2, '0');
                    const monthPadded = month.padStart(2, '0');
                    const isoDateStr = dateTimeParts.length >= 2
                        ? `${year}-${monthPadded}-${dayPadded} ${dateTimeParts[1]}`
                        : `${year}-${monthPadded}-${dayPadded} 00:00:00`;
                    const date = new Date(isoDateStr);
                    return !isNaN(date.getTime()) ? date : null;
                };

                const imported = [];

                for (let i = startIndex; i < lines.length; i++) {
                    const line = lines[i];
                    if (!line.trim()) continue;

                    const rawCols = line.split(delimiter);
                    const cols = rawCols.map(col =>
                        col.replace(/^"|"$/g, "").replace(/""/g, '"').trim()
                    );

                    let fechaStr = "", titulo = "", precioOriginal = "", precioActual = "", dominio = "", urlAfiliado = "", asin = "";

                    if (cols.length >= 7) {
                        [fechaStr, titulo, precioOriginal, precioActual, dominio, urlAfiliado, asin] = cols;
                    } else if (cols.length >= 6) {
                        [fechaStr, titulo, precioActual, dominio, urlAfiliado, asin] = cols;
                        precioOriginal = "";
                    } else if (cols.length >= 5) {
                        [fechaStr, titulo, dominio, urlAfiliado, asin] = cols;
                        precioActual = "";
                        precioOriginal = "";
                    } else if (cols.length === 1 && cols[0].includes("amazon")) {
                        urlAfiliado = cols[0];
                        asin = urlAfiliado.match(/\/dp\/([A-Z0-9]{10})/i)?.[1] || "UNKNOWN";
                        dominio = new URL(urlAfiliado).hostname.replace("www.", "").split(".")[0] || "amazon";
                        titulo = `Producto ${asin}`;
                        fechaStr = new Date().toLocaleString("es-ES");
                        precioActual = "";
                        precioOriginal = "";
                    } else {
                        continue;
                    }

                    if (!asin && urlAfiliado) {
                        asin = urlAfiliado.match(/\/dp\/([A-Z0-9]{10})/i)?.[1] || "UNKNOWN";
                    }
                    if (!dominio && urlAfiliado) {
                        try {
                            dominio = new URL(urlAfiliado).hostname.replace("www.", "").split(".")[0] || "amazon";
                        } catch { }
                    }

                    const item = {
                        id: `csv-import-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
                        timestamp: (() => {
                            const parsed = parseSpanishDate(fechaStr);
                            return parsed ? parsed.toISOString() : new Date().toISOString();
                        })(),
                        productTitle: (titulo || `Producto ${asin}`).slice(0, 120),
                        price: precioActual && precioActual.trim() ? precioActual.trim() : null,
                        originalPrice: precioOriginal && precioOriginal.trim()
                            ? precioOriginal.trim()
                            : (precioActual && precioActual.trim() ? precioActual.trim() : null),
                        prices: (precioActual && precioActual.trim())
                            ? [{
                                timestamp: (() => {
                                    const parsed = parseSpanishDate(fechaStr);
                                    return parsed ? parsed.toISOString() : new Date().toISOString();
                                })(),
                                price: precioActual.trim()
                            }]
                            : [],
                        lastUpdate: precioActual && precioActual.trim()
                            ? (() => {
                                const parsed = parseSpanishDate(fechaStr);
                                return parsed ? parsed.toISOString() : new Date().toISOString();
                            })()
                            : null,
                        domain: dominio || "amazon.es",
                        affiliateUrl: urlAfiliado || "",
                        originalUrl: urlAfiliado || "",
                        asin: asin || "UNKNOWN",
                    };

                    imported.push(item);
                }

                importedItems = imported;
            }

            if (importedItems.length === 0) throw new Error("No se encontraron enlaces válidos");

            // ==================== MERGE INTELIGENTE CON ORDEN RESPETADO ====================
            const currentHistory = getHistory();
            const historyMap = new Map();
            currentHistory.forEach(item => {
                historyMap.set(`${item.asin}-${item.domain}`, item);
            });

            let addedCount = 0;
            const mergedHistory = [...currentHistory]; // Copia del historial actual
            const newItemsToAdd = []; // Acumulamos aquí los nuevos en orden original

            importedItems.forEach(newItem => {
                const key = `${newItem.asin}-${newItem.domain}`;

                if (historyMap.has(key)) {
                    const existingIndex = mergedHistory.findIndex(h => `${h.asin}-${h.domain}` === key);
                    const existing = mergedHistory[existingIndex];

                    // Comparar timestamps: usar el más reciente como base
                    const existingTime = new Date(existing.timestamp).getTime();
                    const newTime = new Date(newItem.timestamp).getTime();

                    if (newTime > existingTime) {
                        // El importado es más nuevo → sobrescribir, pero mantener datos avanzados del existente
                        mergedHistory[existingIndex] = {
                            ...existing,              // Mantenemos originalPrice, prices, lastUpdate, etc.
                            ...newItem,               // Actualizamos título, precio básico, timestamp
                            timestamp: newItem.timestamp,  // Prioridad al más nuevo
                            id: existing.id
                        };
                    } else {
                        // El existente es más nuevo o igual → NO sobrescribir nada
                        // Simplemente ignoramos el duplicado
                    }
                } else {
                    // Nuevo producto → añadir al principio
                    newItemsToAdd.push({
                        ...newItem,
                        id: Date.now() + '-' + Math.random().toString(36).substring(2, 9),
                        // Inicializamos campos nuevos si no vienen
                        originalPrice: newItem.originalPrice || newItem.price || null,
                        prices: newItem.prices || (newItem.price ? [{ timestamp: newItem.timestamp, price: newItem.price }] : []),
                        lastUpdate: newItem.lastUpdate || newItem.timestamp,
                    });
                    addedCount++;
                    historyMap.set(key, newItem);
                }
            });

            // Añadimos todos los nuevos de golpe al principio → mantiene el orden del archivo
            if (newItemsToAdd.length > 0) {
                mergedHistory.unshift(...newItemsToAdd);
            }

            // Guardamos el resultado final
            localStorage.setItem(STORAGE_KEY, JSON.stringify(mergedHistory));

            // Feedback según el estado previo
            let toastMessage;
            let useInfoToast = false;

            if (currentHistory.length === 0) {
                toastMessage = "Historial importado";
            } else if (addedCount === 0) {
                toastMessage = "No hay elementos nuevos";
                useInfoToast = true;
            } else {
                toastMessage = `+${addedCount} elementos añadidos`;
            }

            callback(true, toastMessage, useInfoToast);

            // Notificamos a la UI
            window.dispatchEvent(new Event('amazon-history-updated'));

        } catch (err) {
            console.error("Error importando archivo:", err);
            callback(false);
        }
    };

    reader.onerror = () => callback(false);
    reader.readAsText(file, "UTF-8");
};