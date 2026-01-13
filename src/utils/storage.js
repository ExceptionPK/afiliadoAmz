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

export const addToHistory = async (entry) => {
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

    let customSlug = null;

    if (productTitle && productTitle.length > 5) {
        const cleanTitle = productTitle
            .toLowerCase()
            .replace(/\s*$$   [^)]*   $$/g, '')
            .replace(/prime|oferta|descuento|rebajado/gi, '')
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 35);

        if (cleanTitle.length >= 5) {
            customSlug = `p-${cleanTitle}`;
        }
    }

    if (!customSlug) {
        const slugBase = entry.asin.toLowerCase();
        customSlug = `p-${slugBase}`;
    }

    const shortLink = await shortenWithShortGy(entry.affiliateUrl, customSlug);

    const newEntry = {
        ...entry,
        id: Date.now() + '-' + Math.random().toString(36).substring(2, 9),
        timestamp: new Date().toISOString(),
        productTitle: productTitle.slice(0, 120),
        shortLink,
        price: null,
        originalPrice: null,
        prices: [],
        lastUpdate: null,
    };

    history.unshift(newEntry);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    window.dispatchEvent(new Event('amazon-history-updated'));

    setTimeout(() => fetchRealData(newEntry), 500);
};


// FUNCIÓN PRINCIPAL DE SCRAPING Y ACTUALIZACIÓN DE DATOS (versión mejorada 2026)
export const fetchRealData = async (entry) => {
    try {
        const res = await fetch('/api/scrape-amazon', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                url: entry.originalUrl,
                asin: entry.asin  // ← enviado correctamente al backend
            })
        });

        if (!res.ok) {
            throw new Error(`Backend scraping falló: ${res.status} - ${res.statusText}`);
        }

        const data = await res.json();

        if (!data.success) {
            console.warn('Backend devolvió error:', data.error);
            return;
        }

        const realTitle = data.realTitle || entry.productTitle;
        const price = data.price;
        const recommended = data.recommended || [];

        // ==================== ACTUALIZAR HISTORIAL ====================
        const now = new Date().toISOString();
        const history = getHistory();

        const updatedHistory = history.map(h => {
            if (h.asin === entry.asin && h.domain === entry.domain) {
                let newPrices = [...(h.prices || [])];

                if (price && (!newPrices.length || newPrices[newPrices.length - 1].price !== price)) {
                    newPrices.push({ timestamp: now, price });
                }

                let finalTitle = h.productTitle;
                const isDefaultTitle = h.productTitle.startsWith("Producto ") || h.productTitle.length < 10;
                const isGoodNewTitle = realTitle && realTitle.length > 10 && realTitle.length <= 120;

                if (isDefaultTitle && isGoodNewTitle) {
                    finalTitle = realTitle;
                }

                return {
                    ...h,
                    productTitle: finalTitle,
                    price: price || h.price,
                    originalPrice: h.originalPrice || price,
                    prices: newPrices,
                    lastUpdate: now,
                    recommended: recommended.length > 0 ? recommended : (h.recommended || [])
                };
            }
            return h;
        });

        localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedHistory));
        window.dispatchEvent(new Event('amazon-history-updated'));

        // Caché de título
        if (realTitle.length > 5) {
            const cache = getTitleCache();
            cache[entry.asin] = realTitle.slice(0, 120);
            saveTitleCache(cache);
        }

    } catch (err) {
        console.error('Error al obtener datos reales desde backend:', err);
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

// utils/storage.js → FUNCIÓN importHistory MEJORADA CON NOMBRE DE ARCHIVO EN TOAST
export const importHistory = (file, callback) => {
    const reader = new FileReader();

    reader.onload = (e) => {
        const content = e.target.result.trim();

        // Obtenemos el nombre del archivo sin extensión para mostrarlo bonito
        const fileName = file.name.replace(/\.(json|csv)$/i, '').trim();
        const displayName = fileName || "archivo importado";

        try {
            let importedItems = [];

            // -------------------------------------------------
            // 1. INTENTAR COMO JSON
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
            // 2. CSV (mismo código que tenías)
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

            // ==================== MERGE INTELIGENTE ====================
            const currentHistory = getHistory();
            const historyMap = new Map();
            currentHistory.forEach(item => {
                historyMap.set(`${item.asin}-${item.domain}`, item);
            });

            let addedCount = 0;
            const mergedHistory = [...currentHistory];
            const newItemsToAdd = [];

            importedItems.forEach(newItem => {
                const key = `${newItem.asin}-${newItem.domain}`;

                if (historyMap.has(key)) {
                    const existingIndex = mergedHistory.findIndex(h => `${h.asin}-${h.domain}` === key);
                    const existing = mergedHistory[existingIndex];

                    const existingTime = new Date(existing.timestamp).getTime();
                    const newTime = new Date(newItem.timestamp).getTime();

                    if (newTime > existingTime) {
                        mergedHistory[existingIndex] = {
                            ...existing,
                            ...newItem,
                            timestamp: newItem.timestamp,
                            id: existing.id
                        };
                    }
                } else {
                    newItemsToAdd.push({
                        ...newItem,
                        id: Date.now() + '-' + Math.random().toString(36).substring(2, 9),
                        originalPrice: newItem.originalPrice || newItem.price || null,
                        prices: newItem.prices || (newItem.price ? [{ timestamp: newItem.timestamp, price: newItem.price }] : []),
                        lastUpdate: newItem.lastUpdate || newItem.timestamp,
                    });
                    addedCount++;
                    historyMap.set(key, newItem);
                }
            });

            if (newItemsToAdd.length > 0) {
                mergedHistory.unshift(...newItemsToAdd);
            }

            localStorage.setItem(STORAGE_KEY, JSON.stringify(mergedHistory));

            // ==================== MENSAJES PERSONALIZADOS CON NOMBRE DEL ARCHIVO ====================
            let toastMessage;
            let useInfoToast = false;

            if (currentHistory.length === 0) {
                toastMessage = `"${displayName}" se ha importado`;
            } else if (addedCount === 0) {
                toastMessage = `Nada nuevo en "${displayName}"`;
                useInfoToast = true;
            } else {
                toastMessage = `+${addedCount} añadidos de "${displayName}"`;
            }

            callback(true, toastMessage, useInfoToast);

            window.dispatchEvent(new Event('amazon-history-updated'));

        } catch (err) {
            console.error("Error importando archivo:", err);
            callback(false, "Error al leer el archivo");
        }
    };

    reader.onerror = () => callback(false, "Error leyendo el archivo");
    reader.readAsText(file, "UTF-8");
};

// === FUNCIÓN PARA ACTUALIZACIÓN MANUAL DE PRECIOS (SOLO CUENTA ÉXITOS CON PRECIO NUEVO) ===
export const updateOutdatedPricesManually = async () => {
    const history = getHistory();
    if (history.length === 0) {
        return { status: "empty", message: "No hay productos en el historial" };
    }

    const twentyFourHours = 24 * 60 * 60 * 1000;
    const now = Date.now();

    const outdated = history.filter(item => {
        const last = item.lastUpdate ? new Date(item.lastUpdate).getTime() : 0;
        return now - last > twentyFourHours;
    });

    if (outdated.length === 0) {
        return { status: "up_to_date", message: "Todos los precios están al día" };
    }

    const toUpdate = outdated.slice(0, 10);

    let realSuccessCount = 0;
    let attemptedCount = 0;
    let consecutiveFailures = 0;
    const MAX_CONSECUTIVE_FAILURES = 3;

    for (const item of toUpdate) {
        attemptedCount++;

        if (attemptedCount > 1) {
            await new Promise(resolve => setTimeout(resolve, 1800));
        }

        const previousPrice = item.price;

        let hadNetworkError = false;

        try {
            await fetchRealData(item);
            consecutiveFailures = 0;
        } catch (err) {
            console.warn(`Error actualizando ${item.asin}:`, err);

            const isNetworkError =
                err.name === 'TypeError' && err.message.includes('Failed to fetch') ||
                err.message.includes('net::ERR') ||
                err.message.includes('CORS') ||
                err.name === 'AbortError';

            if (isNetworkError) {
                hadNetworkError = true;
                consecutiveFailures++;
            }

            if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
                console.warn("Cancelando actualización: múltiples fallos de proxy/red consecutivos");
                window.dispatchEvent(new Event('amazon-history-updated'));

                return {
                    status: "proxy_failed",
                    updated: realSuccessCount,
                    attempted: attemptedCount,
                    message: "Actualización cancelada por problemas graves con los proxies"
                };
            }
        }

        const currentHistory = getHistory();
        const updatedItem = currentHistory.find(
            h => h.asin === item.asin && h.domain === item.domain
        );

        if (updatedItem) {
            const newPrice = updatedItem.price;

            if (
                (newPrice && !previousPrice) ||
                (newPrice && previousPrice && newPrice !== previousPrice)
            ) {
                realSuccessCount++;
            }
        }
    }

    window.dispatchEvent(new Event('amazon-history-updated'));

    return {
        status: "completed",
        updated: realSuccessCount,
        attempted: attemptedCount,
        total: toUpdate.length,
        hadAnySuccess: realSuccessCount > 0,
        message: realSuccessCount === 0
            ? "No se obtuvo precio nuevo en ningún producto"
            : realSuccessCount === toUpdate.length
                ? "¡Todos los precios actualizados correctamente!"
                : `Precios actualizados en ${realSuccessCount} de ${toUpdate.length} productos`
    };
};

// === FUNCIÓN PARA ACORTAR ENLACES CON SHORT.IO (tu subdominio amazon-dks.short.gy) ===
export const shortenWithShortGy = async (longUrl, customSlug = null) => {
    try {
        const res = await fetch('/api/shorten', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                originalURL: longUrl,
                path: customSlug,
                title: 'Producto Amazon'
            })
        })

        if (!res.ok) {
            throw new Error(`Error ${res.status}`)
        }

        const { shortURL } = await res.json()
        return shortURL
    } catch (err) {
        console.error('Fallo al acortar con el endpoint propio:', err)
        return longUrl
    }
}

