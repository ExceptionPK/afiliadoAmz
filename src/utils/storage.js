const STORAGE_KEY = 'amazon-affiliate-history';
const TITLE_CACHE_KEY = 'amazon-title-cache';

const apiKey = import.meta.env.VITE_WEBSCRAPINGAPI_KEY;

import { supabase } from './supabaseClient';
import { saveToHistory } from './supabaseStorage';
import { getUserHistory } from './supabaseStorage';

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
    // Verificar que existe la clave API
    if (!apiKey) {
        console.error("Error: No se encontró VITE_WEBSCRAPINGAPI_KEY en .env.local");
        return;
    }

    const asin = entry.asin;
    if (!asin || asin.length !== 10) {
        console.warn("ASIN inválido o ausente:", entry.asin);
        return;
    }

    // Limpieza robusta del dominio
    let domainPart = (entry.domain || 'amazon.es')
        .replace(/^(https?:\/\/)?(www\.)?/i, '')     // quita protocolo y www.
        .replace(/^amazon\./i, '')                   // quita amazon. si ya está
        .split('.')[0]                               // toma solo la parte del país (es, com, de...)
        .toLowerCase();

    // Forzamos valores válidos conocidos si algo sale raro
    if (!['es', 'com', 'de', 'fr', 'it', 'co.uk', 'ca', 'com.mx', 'com.br', 'in', 'jp'].includes(domainPart)) {
        domainPart = 'es'; // fallback seguro a amazon.es
    }

    const amazonDomain = `amazon.${domainPart}`;

    const scraperUrl = `https://ecom.webscrapingapi.com/v1?api_key=${apiKey}&engine=amazon&type=product&product_id=${asin}&amazon_domain=${amazonDomain}`;

    console.log(`[fetchRealData] Intentando obtener datos para ASIN ${asin} → ${amazonDomain}`);
    console.log(`URL generada: ${scraperUrl}`);

    try {
        const res = await fetch(scraperUrl, {
            headers: {
                'Accept': 'application/json',
            },
        });

        if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            const errorMsg = errorData.error || errorData.message || `HTTP ${res.status}`;
            throw new Error(`WebScrapingAPI falló: ${errorMsg}`);
        }

        const data = await res.json();

        if (!data?.product_results) {
            console.warn("Respuesta sin 'product_results'", data);
            return;
        }

        const product = data.product_results;

        // Título
        let realTitle = product.title?.trim()
            || product.name?.trim()
            || entry.productTitle
            || `Producto ${asin}`;

        // Limpieza opcional del título (puedes quitar o ajustar)
        realTitle = realTitle
            .replace(/\s*\([^)]{5,}\)$/g, '')     // quita paréntesis largos al final
            .replace(/\s*[-–—]\s*Amazon\.es/gi, '') // quita " - Amazon.es" si aparece
            .trim();

        // Precio principal
        let price = null;
        if (product.price?.value) {
            const numeric = parseFloat(product.price.value);
            const currency = product.price.symbol || product.price.currency || '€';

            if (!isNaN(numeric)) {
                price = numeric.toLocaleString('es-ES', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                }) + ` ${currency}`;
            }
        }

        // Fallback: precio desde buybox si el principal falla
        if (!price && data.buybox?.price?.value) {
            const buyboxNumeric = parseFloat(data.buybox.price.value);
            if (!isNaN(buyboxNumeric)) {
                price = buyboxNumeric.toLocaleString('es-ES', { minimumFractionDigits: 2 }) + ' €';
            }
        }

        // Disponibilidad (opcional, para log o futuro uso)
        const availability = product.availability_description ||
            (product.available ? 'En stock' : 'No disponible');

        // ── Actualizar historial ──
        const now = new Date().toISOString();
        const history = getHistory();

        const updatedHistory = history.map(h => {
            if (h.asin === asin && h.domain === entry.domain) {
                let newPrices = [...(h.prices || [])];

                if (price && (!newPrices.length || newPrices[newPrices.length - 1].price !== price)) {
                    newPrices.push({ timestamp: now, price });
                }

                let finalTitle = h.productTitle;
                const isDefaultTitle = h.productTitle.startsWith("Producto ") || h.productTitle.length < 10;

                if (isDefaultTitle && realTitle.length > 10) {
                    finalTitle = realTitle;
                }

                return {
                    ...h,
                    productTitle: finalTitle.slice(0, 120),
                    price: price || h.price,
                    originalPrice: h.originalPrice || price || h.price,
                    prices: newPrices,
                    lastUpdate: now,
                    // Opcional: puedes guardar más si lo necesitas después
                    // availability,
                    // mainImage: product.main_image,
                    // rating: product.rating,
                };
            }
            return h;
        });

        localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedHistory));
        window.dispatchEvent(new Event('amazon-history-updated'));

        console.log(`[fetchRealData] ÉXITO ${asin}: ${realTitle} → ${price || 'sin precio'} (${availability})`);

    } catch (err) {
        console.error(`[fetchRealData] ERROR para ${asin}:`, err.message);
        // Opcional: podrías marcar el entry como "fallido" o reintentar más tarde
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
export const importHistory = async (file, callback) => {
    const reader = new FileReader();

    reader.onload = async (e) => {
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
            // 2. CSV (tu lógica original intacta)
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

            // Detectar sesión
            const { data: { user } } = await supabase.auth.getUser();
            const isLoggedIn = !!user;

            let addedCount = 0;
            let updatedCount = 0;
            let skippedCount = 0;

            // Declaramos antes para que estén disponibles en los mensajes
            let currentHistory = [];
            let currentItems = [];

            if (isLoggedIn) {
                currentItems = await getUserHistory(1000); // límite alto para no perder items
                const historyMap = new Map();
                currentItems.forEach(item => {
                    const key = `${item.asin}-${item.domain}`;
                    historyMap.set(key, item);
                });

                for (const newItem of importedItems) {
                    const key = `${newItem.asin}-${newItem.domain}`;
                    const existing = historyMap.get(key);

                    if (existing) {
                        const existingTime = new Date(existing.timestamp).getTime();
                        const newTime = new Date(newItem.timestamp).getTime();

                        if (newTime > existingTime) {
                            await saveToHistory({
                                ...existing,
                                ...newItem,
                                timestamp: newItem.timestamp,
                                id: existing.id // mantenemos el ID de Supabase
                            });
                            updatedCount++;
                        } else {
                            skippedCount++;
                        }
                    } else {
                        await saveToHistory(newItem);
                        addedCount++;
                    }
                }
            } else {
                currentHistory = getHistory();
                const historyMap = new Map();
                currentHistory.forEach(item => {
                    historyMap.set(`${item.asin}-${item.domain}`, item);
                });

                const mergedHistory = [...currentHistory];

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
                            updatedCount++;
                        } else {
                            skippedCount++;
                        }
                    } else {
                        mergedHistory.unshift({
                            ...newItem,
                            id: Date.now() + '-' + Math.random().toString(36).substring(2, 9),
                            originalPrice: newItem.originalPrice || newItem.price || null,
                            prices: newItem.prices || (newItem.price ? [{ timestamp: newItem.timestamp, price: newItem.price }] : []),
                            lastUpdate: newItem.lastUpdate || newItem.timestamp,
                        });
                        addedCount++;
                    }
                });

                localStorage.setItem(STORAGE_KEY, JSON.stringify(mergedHistory));
            }

            // Mensaje final - natural, bonito y con tu texto preferido para la primera vez
            let toastMessage = "";
            let useInfoToast = false;

            const totalChanges = addedCount + updatedCount;
            const wasEmpty = (isLoggedIn ? currentItems.length : currentHistory.length) === 0;

            if (totalChanges === 0) {
                toastMessage = `Nada nuevo de «${displayName}».`;
                useInfoToast = true;
            } else if (wasEmpty) {
                // Primera importación (historial vacío)
                toastMessage = `Se ha importado «${displayName}»`;
            } else {
                // Importaciones posteriores
                if (addedCount > 0 && updatedCount === 0) {
                    toastMessage = `+${addedCount} producto${addedCount === 1 ? '' : 's'} nuevo${addedCount === 1 ? '' : 's'} de «${displayName}»`;
                } else if (addedCount === 0 && updatedCount > 0) {
                    toastMessage = `Se han actualizado ${updatedCount} producto${updatedCount === 1 ? '' : 's'} de «${displayName}»`;
                } else {
                    toastMessage = `«${displayName}»: +${addedCount} nuevos, ${updatedCount} actualizados`;
                }
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
    // 1. Detectar si hay sesión activa
    const { data: { user } } = await supabase.auth.getUser();
    const isAuthenticated = !!user?.id;

    // 2. Cargar el historial desde la fuente correcta
    let history = [];
    try {
        if (isAuthenticated) {
            history = await getUserHistory(500); // límite alto para no quedarnos cortos
        } else {
            history = getHistory();
        }
    } catch (err) {
        console.error("Error al cargar historial para actualización de precios:", err);
        return {
            status: "error",
            message: "No se pudo cargar el historial"
        };
    }

    if (!history || history.length === 0) {
        return {
            status: "empty",
            message: "No hay productos en el historial"
        };
    }

    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
    const now = Date.now();

    // Filtrar los que llevan más de 24h sin actualizar
    const outdated = history.filter(item => {
        const last = item.lastUpdate ? new Date(item.lastUpdate).getTime() : 0;
        return now - last > TWENTY_FOUR_HOURS;
    });

    if (outdated.length === 0) {
        return {
            status: "up_to_date",
            message: "Todos los precios están al día"
        };
    }

    // Limitamos a 10 para no saturar la API en una sola pasada
    const toUpdate = outdated.slice(0, 10);

    let realSuccessCount = 0;
    let attemptedCount = 0;
    let consecutiveFailures = 0;
    const MAX_CONSECUTIVE_FAILURES = 3;

    for (const item of toUpdate) {
        attemptedCount++;

        // Pequeña espera entre peticiones para evitar bloqueos
        if (attemptedCount > 1) {
            await new Promise(resolve => setTimeout(resolve, 1800));
        }

        const previousPrice = item.price;

        try {
            await fetchRealData(item);
            consecutiveFailures = 0;
        } catch (err) {
            console.warn(`Error actualizando ${item.asin} (${item.domain}):`, err.message);

            const isNetworkError =
                err.name === 'TypeError' && err.message.includes('Failed to fetch') ||
                err.message.includes('net::ERR') ||
                err.message.includes('CORS') ||
                err.name === 'AbortError';

            if (isNetworkError) {
                consecutiveFailures++;
            }

            if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
                console.warn("Cancelando actualización: múltiples fallos consecutivos de red/proxy");
                window.dispatchEvent(new Event('amazon-history-updated'));
                return {
                    status: "proxy_failed",
                    updated: realSuccessCount,
                    attempted: attemptedCount,
                    message: "Actualización cancelada por problemas graves con los proxies"
                };
            }

            // Continuamos con el siguiente aunque uno falle
            continue;
        }

        // 3. Comprobar si realmente cambió el precio → desde la fuente correcta
        let updatedItem;
        try {
            if (isAuthenticated) {
                const freshHistory = await getUserHistory(500);
                updatedItem = freshHistory.find(
                    h => h.asin === item.asin && h.domain === item.domain
                );
            } else {
                const currentHistory = getHistory();
                updatedItem = currentHistory.find(
                    h => h.asin === item.asin && h.domain === item.domain
                );
            }
        } catch (refreshErr) {
            console.warn("No se pudo recargar historial para verificar cambio:", refreshErr);
            continue;
        }

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

    // Disparamos el evento para que History.jsx recargue desde la fuente correcta
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

