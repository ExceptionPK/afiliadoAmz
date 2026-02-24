const STORAGE_KEY = 'amazon-affiliate-history';
const TITLE_CACHE_KEY = 'amazon-title-cache';

import { supabase } from './supabaseClient';
import { saveToHistory, updateHistoryPositions, getUserHistory } from './supabaseStorage';


const API_KEYS = [
    import.meta.env.VITE_SCRAPERAPI_KEY_1?.trim(),
    import.meta.env.VITE_SCRAPERAPI_KEY_2?.trim(),
    // puedes añadir más
].filter(Boolean);

if (API_KEYS.length === 0) {
    console.error("No se encontró NINGUNA API key de ScraperAPI en las variables de entorno");
}

const LAST_GOOD_KEY_INDEX = 'scraperapi_last_good_key_index';

const getLastGoodKeyIndex = () => {
    const val = localStorage.getItem(LAST_GOOD_KEY_INDEX);
    const idx = val ? parseInt(val, 10) : 0;
    return (idx >= 0 && idx < API_KEYS.length) ? idx : 0;
};

const setLastGoodKeyIndex = (idx) => {
    localStorage.setItem(LAST_GOOD_KEY_INDEX, idx.toString());
};

/**
 * Intenta fetch con rotación de keys en caso de error de cuota (401 o 429)
 * @param {string} targetUrl - la URL de Amazon a scrapear
 * @returns {Promise<string>} HTML obtenido
 * @throws Error si todas las keys fallan
 */
async function fetchWithFallback(targetUrl) {
    if (API_KEYS.length === 0) {
        throw new Error("No hay claves configuradas para ScraperAPI");
    }

    let startIdx = getLastGoodKeyIndex();
    let lastError = null;

    for (let i = 0; i < API_KEYS.length; i++) {
        const keyIdx = (startIdx + i) % API_KEYS.length;
        const key = API_KEYS[keyIdx];

        const scraperUrl = `https://api.scraperapi.com?api_key=${key}&url=${encodeURIComponent(targetUrl)}`;

        console.log(`[fetchRealData] Probando clave ScraperAPI #${keyIdx + 1} → ${targetUrl}`);

        try {
            const res = await fetch(scraperUrl, {
                headers: { 'Accept': 'text/html' },
            });

            if (res.ok) {
                setLastGoodKeyIndex(keyIdx);
                const html = await res.text();
                console.log(`[ScraperAPI] Éxito con clave #${keyIdx + 1} - longitud HTML: ${html.length}`);
                return html;
            }

            let errText = '';
            try {
                errText = await res.text();
            } catch {}

            const status = res.status;

            // Errores típicos de ScraperAPI (basado en su documentación actual)
            const isQuotaOrAuthError =
                status === 401 ||           // clave inválida o sin créditos
                status === 429 ||           // rate limit
                status === 403 ||           // forbidden (p.ej. costo excedido si usas max_cost, o bloqueo temporal)
                errText.toLowerCase().includes('credit') ||
                errText.toLowerCase().includes('quota') ||
                errText.toLowerCase().includes('exceeded') ||
                errText.toLowerCase().includes('limit') ||
                errText.toLowerCase().includes('no credits');

            if (isQuotaOrAuthError) {
                console.warn(`[ScraperAPI] Clave #${keyIdx + 1} → problema de cuota/autorización (${status}) - ${errText.slice(0,120)}`);
                lastError = new Error(`Problema con clave #${keyIdx + 1}: ${status}`);
                continue;
            }

            // Otros errores → lanzamos directamente
            throw new Error(`ScraperAPI error ${status}: ${errText.slice(0, 180)}`);

        } catch (err) {
            lastError = err;
            console.warn(`[fetchRealData] Fallo con clave ScraperAPI #${keyIdx + 1}: ${err.message}`);
        }
    }

    throw lastError || new Error("Todas las claves de ScraperAPI fallaron (cuota agotada, clave inválida u otro error persistente)");
}
/*-------------------------------------------------------------------------------------------------------------------*/

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

let isMassImportInProgress = false;

export const setMassImportInProgress = (value) => {
    isMassImportInProgress = !!value;
};

export const getMassImportInProgress = () => isMassImportInProgress;

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


// FUNCIÓN PRINCIPAL DE SCRAPING Y ACTUALIZACIÓN DE DATOS
export const fetchRealData = async (entry) => {
    if (getMassImportInProgress()) {
        console.log(`[fetchRealData] SKIPPED - importación masiva en curso - ASIN ${entry.asin}`);
        return;
    }

    const asin = entry.asin?.trim();
    if (!asin || asin.length !== 10) {
        console.warn("Invalid ASIN:", entry.asin);
        return;
    }

    let domainPart = (entry.domain || 'amazon.es')
        .replace(/^(https?:\/\/)?(www\.)?/i, '')
        .replace(/^amazon\./i, '')
        .split('.')[0]
        .toLowerCase();

    if (!['es', 'com', 'de', 'fr', 'it', 'co.uk', 'ca', 'com.mx', 'com.br', 'in', 'jp'].includes(domainPart)) {
        domainPart = 'es';
    }

    const targetUrl = `https://www.amazon.${domainPart}/dp/${asin}`;

    console.log(`[fetchRealData] Intentando scrape para ASIN ${asin} → ${targetUrl}`);

    try {
        const html = await fetchWithFallback(targetUrl);

        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // Título real
        let realTitle =
            doc.querySelector('#productTitle')?.textContent?.trim() ||
            doc.querySelector('title')?.textContent?.split('|')[0]?.trim() ||
            entry.productTitle ||
            `Producto ${asin}`;

        realTitle = realTitle
            .replace(/\s*\([^)]{5,}\)$/g, '')
            .replace(/\s*[-–—]\s*Amazon\.[a-z.]+/gi, '')
            .trim()
            .slice(0, 120);

        // ── Extracción de precio ──
        let price = null;

        // 1. Input displayString
        const priceDisplayInput = doc.querySelector('input[name="items[0.base][customerVisiblePrice][displayString]"]');
        if (priceDisplayInput?.value?.trim()) {
            price = priceDisplayInput.value.trim();
        }

        // 2. Input amount
        if (!price) {
            const priceAmountInput = doc.querySelector('input[name="items[0.base][customerVisiblePrice][amount]"]');
            if (priceAmountInput?.value) {
                const numeric = parseFloat(priceAmountInput.value);
                if (!isNaN(numeric)) {
                    price = numeric.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
                }
            }
        }

        // 3. Span visible
        if (!price) {
            const priceSpan = doc.querySelector('.a-price .a-offscreen') ||
                doc.querySelector('span.a-offscreen') ||
                doc.querySelector('.a-price-whole');
            if (priceSpan?.textContent) {
                let text = priceSpan.textContent.trim().replace(/\s+/g, '');
                const numeric = parseFloat(text.replace(/[^0-9.,]/g, '').replace(',', '.'));
                if (!isNaN(numeric)) {
                    price = numeric.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
                }
            }
        }

        // 4. Regex fallback
        if (!price) {
            const regex = /(\d{1,3}(?:[.,\s]?\d{3})*[.,]\d{2})\s*€?/;
            const match = html.match(regex);
            if (match) {
                price = match[1].replace(/\s/g, '').replace(',', '.') + ' €';
            }
        }

        const { data: { user } } = await supabase.auth.getUser();
        const isLoggedIn = !!user?.id;
        const now = new Date().toISOString();
        const domain = entry.domain || domainPart;

        // ───────────────────────────────────────────────────────────────
        // OBTENEMOS EL ESTADO ANTERIOR
        // ───────────────────────────────────────────────────────────────
        let previousPrice = null;
        let previousPricesHistory = [];
        let previousOriginalPrice = null;
        let previousTitle = entry.productTitle;
        let titleIsCustom = false;

        if (isLoggedIn) {
            const { data: current, error: fetchErr } = await supabase
                .from('affiliate_history')
                .select('price, original_price, prices_history, product_title, title_is_custom')
                .eq('user_id', user.id)
                .eq('asin', asin)
                .eq('dominio', domain)
                .single();

            if (!fetchErr) {
                previousPrice = current?.price || null;
                previousOriginalPrice = current?.original_price || null;
                previousPricesHistory = current?.prices_history || [];
                previousTitle = current?.product_title || previousTitle;
                titleIsCustom = current?.title_is_custom ?? false;
            }
        } else {
            const history = getHistory();
            const existing = history.find(h => h.asin === asin && h.domain === domain);
            if (existing) {
                previousPrice = existing.price || null;
                previousOriginalPrice = existing.originalPrice || null;
                previousPricesHistory = existing.prices || [];
                previousTitle = existing.productTitle || previousTitle;
                titleIsCustom = existing.title_is_custom ?? false;
            }
        }

        // ───────────────────────────────────────────────────────────────
        // LÓGICA DE ACTUALIZACIÓN SELECTIVA
        // ───────────────────────────────────────────────────────────────
        let updateData = {};

        // Título: solo si no es custom y conseguimos uno mejor
        let shouldUpdateTitle = false;
        let newTitleValue = undefined;

        if (realTitle.length > 10 && !titleIsCustom) {
            if (
                !previousTitle ||
                previousTitle.startsWith("Producto ") ||
                previousTitle.length <= 12 ||
                previousTitle.trim() === "" ||
                /amazon|oferta|descuento|prime/i.test(previousTitle) ||
                previousTitle === `p-${asin.toLowerCase()}`
            ) {
                shouldUpdateTitle = true;
                newTitleValue = realTitle;
            }
        }

        if (shouldUpdateTitle) {
            updateData.product_title = newTitleValue;
            updateData.title_is_custom = true;
        }

        // Precio: SOLO actualizamos si conseguimos precio NUEVO y VÁLIDO
        let shouldUpdatePrice = false;
        let newPricesHistory = [...previousPricesHistory];

        if (price && price.trim() !== '') {
            // Comparamos con el último precio conocido
            const lastKnownPrice = previousPricesHistory.length > 0
                ? previousPricesHistory[previousPricesHistory.length - 1]?.price
                : previousPrice;

            if (lastKnownPrice !== price) {
                shouldUpdatePrice = true;
                newPricesHistory.push({ timestamp: now, price });
            }
        }

        if (shouldUpdatePrice) {
            updateData.price = price;
            updateData.original_price = previousOriginalPrice || price; // preservamos original si ya existía
            updateData.prices_history = newPricesHistory;
            updateData.last_update = now;
        }
        // ← Si NO hay precio nuevo → NO tocamos price, original_price, prices_history ni last_update

        // ───────────────────────────────────────────────────────────────
        // Guardamos SOLO si hay algo que actualizar
        // ───────────────────────────────────────────────────────────────
        if (Object.keys(updateData).length > 0) {
            if (isLoggedIn) {
                const { error: updateErr } = await supabase
                    .from('affiliate_history')
                    .update(updateData)
                    .eq('user_id', user.id)
                    .eq('asin', asin)
                    .eq('dominio', domain);

                if (updateErr) throw updateErr;

                console.log(`[fetchRealData] ÉXITO Supabase ${asin}: título ${shouldUpdateTitle ? 'actualizado' : 'mantenido'}, precio ${shouldUpdatePrice ? 'actualizado → ' + price : 'mantenido'}`);
            } else {
                // localStorage
                const history = getHistory();
                const updatedHistory = history.map(h => {
                    if (h.asin === asin && h.domain === domain) {
                        let final = { ...h };

                        if (shouldUpdateTitle) {
                            final.productTitle = newTitleValue;
                            final.title_is_custom = true;
                        }

                        if (shouldUpdatePrice) {
                            final.price = price;
                            final.originalPrice = previousOriginalPrice || price;
                            final.prices = newPricesHistory;
                            final.lastUpdate = now;
                        }

                        return final;
                    }
                    return h;
                });

                localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedHistory));
                console.log(`[fetchRealData] ÉXITO local ${asin}: título ${shouldUpdateTitle ? 'actualizado' : 'mantenido'}, precio ${shouldUpdatePrice ? 'actualizado → ' + price : 'mantenido'}`);
            }

            window.dispatchEvent(new Event('amazon-history-updated'));
        } else {
            console.log(`[fetchRealData] ${asin} → sin cambios relevantes`);
        }

    } catch (err) {
        console.error(`[fetchRealData] ERROR general para ${asin}:`, err.message);
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

export const importHistory = async (file, callback) => {
    const reader = new FileReader();

    reader.onload = async (e) => {
        const content = e.target.result.trim();

        // Nombre bonito para mensajes
        const fileName = file.name.replace(/\.(json|csv)$/i, '').trim();
        const displayName = fileName || "archivo importado";

        try {
            setMassImportInProgress(true);

            let importedItems = [];

            // 1. INTENTAR COMO JSON
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
                        title_is_custom: true,
                        price: item.price || null,
                        originalPrice: item.originalPrice || item.price || null,
                        prices: Array.isArray(item.prices) ? item.prices : (
                            item.price ? [{ timestamp: item.timestamp || new Date().toISOString(), price: item.price }] : []
                        ),
                        lastUpdate: item.lastUpdate || (item.price ? item.timestamp || new Date().toISOString() : null),
                        domain: item.domain || item.dominio || "amazon.es",
                        affiliateUrl: item.affiliateUrl || "",
                        originalUrl: item.originalUrl || item.affiliateUrl || "",
                        asin: item.asin || "UNKNOWN",
                    }));
                }
            }

            // 2. CSV (lógica original mantenida)
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
                        title_is_custom: true,
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

            // ── ASIGNAMOS POSICIÓN SEGÚN ORDEN EN EL ARCHIVO ──
            const orderedImported = importedItems.map((item, idx) => ({
                ...item,
                position: idx + 1,  // 1, 2, 3... según aparecen en el archivo
            }));

            const totalItems = orderedImported.length;
            let processed = 0;

            window.dispatchEvent(new CustomEvent('import-progress', {
                detail: { processed: 0, total: totalItems, percent: 0 }
            }));

            const { data: { user } } = await supabase.auth.getUser();
            const isLoggedIn = !!user?.id;

            let addedCount = 0;
            let updatedCount = 0;
            let skippedCount = 0;

            if (isLoggedIn) {
                // ── SUPABASE ───────────────────────────────────────────────
                const currentItems = await getUserHistory(1000);
                const historyMap = new Map();
                currentItems.forEach(item => {
                    const key = `${item.asin}-${item.domain}`;
                    historyMap.set(key, item);
                });

                // Fase 1: guardar/actualizar items
                for (const newItem of orderedImported) {
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
                                id: existing.id,
                                position: newItem.position   // ← respetamos orden del import
                            });
                            updatedCount++;
                        } else {
                            skippedCount++;
                        }
                    } else {
                        await saveToHistory({
                            ...newItem,
                            position: newItem.position
                        });
                        addedCount++;
                    }

                    processed++;
                    const percent = Math.min(100, Math.round((processed / totalItems) * 100));
                    window.dispatchEvent(new CustomEvent('import-progress', {
                        detail: { processed, total: totalItems, percent }
                    }));
                }

                // Fase 2: reordenar TODO el historial final
                const freshAfterImport = await getUserHistory(1000);

                const desiredPosition = new Map();
                orderedImported.forEach(imp => {
                    const key = `${imp.asin}-${imp.domain}`;
                    desiredPosition.set(key, imp.position);
                });

                const positionsToUpdate = freshAfterImport.map(item => {
                    const key = `${item.asin}-${item.domain}`;
                    const wantedPos = desiredPosition.get(key);
                    return {
                        asin: item.asin,
                        dominio: item.domain || item.dominio || 'amazon.es',
                        position: wantedPos ?? (10000 + freshAfterImport.indexOf(item)) // items no importados → muy al final
                    };
                });

                if (positionsToUpdate.length > 0) {
                    await updateHistoryPositions(user.id, positionsToUpdate);
                }

            } else {
                // ── LOCALSTORAGE ───────────────────────────────────────────
                let currentHistory = getHistory();
                const historyMap = new Map();
                currentHistory.forEach(item => {
                    historyMap.set(`${item.asin}-${item.domain}`, item);
                });

                const merged = [];

                // Primero los del import (en su orden original)
                for (const newItem of orderedImported) {
                    const key = `${newItem.asin}-${newItem.domain}`;

                    if (historyMap.has(key)) {
                        const existing = historyMap.get(key);
                        const existingTime = new Date(existing.timestamp).getTime();
                        const newTime = new Date(newItem.timestamp).getTime();

                        if (newTime > existingTime) {
                            merged.push({
                                ...existing,
                                ...newItem,
                                timestamp: newItem.timestamp,
                                id: existing.id,
                                position: newItem.position
                            });
                            updatedCount++;
                            historyMap.delete(key); // ya procesado
                        } else {
                            skippedCount++;
                            merged.push(existing);
                            historyMap.delete(key);
                        }
                    } else {
                        merged.push({
                            ...newItem,
                            id: Date.now() + '-' + Math.random().toString(36).substring(2, 9),
                            position: newItem.position
                        });
                        addedCount++;
                    }
                }

                // Luego los que ya estaban y NO venían en el import
                historyMap.forEach(existing => {
                    merged.push({
                        ...existing,
                        position: merged.length + 1
                    });
                });

                // Ordenamos explícitamente por position
                merged.sort((a, b) => (a.position || 999999) - (b.position || 999999));

                localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
            }

            // Pequeño margen para que terminen las escrituras
            await new Promise(r => setTimeout(r, 1200));

            setMassImportInProgress(false);

            let toastMessage = "";
            let useInfoToast = false;

            const totalChanges = addedCount + updatedCount;
            const wasEmpty = (isLoggedIn ? (await getUserHistory(1)).length : getHistory().length) === 0;

            if (totalChanges === 0) {
                toastMessage = `Nada nuevo de «${displayName}».`;
                useInfoToast = true;
            } else if (wasEmpty) {
                toastMessage = `Se ha importado «${displayName}»`;
            } else {
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

            window.dispatchEvent(new CustomEvent('import-progress', {
                detail: { processed: totalItems, total: totalItems, percent: 100 }
            }));

        } catch (err) {
            setMassImportInProgress(false);
            console.error("Error importando archivo:", err);
            callback(false, "Error al leer el archivo");

            window.dispatchEvent(new CustomEvent('import-progress', {
                detail: { processed: 0, total: 0, percent: 0 }
            }));
        }
    };

    reader.onerror = () => {
        setMassImportInProgress(false);
        callback(false, "Error leyendo el archivo");
        window.dispatchEvent(new CustomEvent('import-progress', {
            detail: { processed: 0, total: 0, percent: 0 }
        }));
    };

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
                ? "Precios actualizados"
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

/**
 * Actualiza los precios de una lista específica de productos (por sus IDs)
 * @param {string[]} selectedIds - Array de IDs de los items a actualizar
 * @returns {Promise<{status: string, updated: number, attempted: number, message: string}>}
 */
export const updateSelectedPrices = async (selectedIds) => {
    if (!Array.isArray(selectedIds) || selectedIds.length === 0) {
        return {
            status: "empty_selection",
            updated: 0,
            attempted: 0,
            message: "No se seleccionaron productos"
        };
    }

    // 1. Detectar autenticación
    const { data: { user } } = await supabase.auth.getUser();
    const isAuthenticated = !!user?.id;

    // 2. Cargar historial completo (necesitamos los items completos)
    let history = [];
    try {
        if (isAuthenticated) {
            history = await getUserHistory(1000); // límite alto
        } else {
            history = getHistory();
        }
    } catch (err) {
        console.error("Error al cargar historial para actualización selectiva:", err);
        return {
            status: "load_error",
            updated: 0,
            attempted: 0,
            message: "No se pudo cargar el historial"
        };
    }

    // 3. Filtrar solo los items que coincidan con los IDs seleccionados
    const toUpdate = history.filter(item => selectedIds.includes(item.id));

    if (toUpdate.length === 0) {
        return {
            status: "no_match",
            updated: 0,
            attempted: 0,
            message: "Ningún producto seleccionado encontrado en el historial"
        };
    }

    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
    const now = Date.now();

    let realSuccessCount = 0;
    let attemptedCount = 0;
    let consecutiveFailures = 0;
    const MAX_CONSECUTIVE_FAILURES = 3;

    for (const item of toUpdate) {
        attemptedCount++;

        // Pequeña espera anti-bloqueo
        if (attemptedCount > 1) {
            await new Promise(r => setTimeout(r, 1800));
        }

        const previousPrice = item.price;

        try {
            // Reutilizamos fetchRealData (que ya maneja Supabase o local)
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
                console.warn("Cancelando actualización selectiva: múltiples fallos consecutivos");
                return {
                    status: "proxy_failed",
                    updated: realSuccessCount,
                    attempted: attemptedCount,
                    message: "Actualización cancelada por problemas graves con proxies"
                };
            }
            continue;
        }

        // Verificar si realmente cambió el precio
        let updatedItem;
        try {
            if (isAuthenticated) {
                const fresh = await getUserHistory(1000);
                updatedItem = fresh.find(h => h.id === item.id);
            } else {
                const current = getHistory();
                updatedItem = current.find(h => h.id === item.id);
            }
        } catch (refreshErr) {
            console.warn("No se pudo verificar cambio:", refreshErr);
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

    // Disparamos evento para recargar UI
    window.dispatchEvent(new Event('amazon-history-updated'));

    return {
        status: "completed",
        updated: realSuccessCount,
        attempted: attemptedCount,
        total: toUpdate.length,
        hadAnySuccess: realSuccessCount > 0,
        message: realSuccessCount === 0
            ? "No se obtuvieron nuevos precios"
            : realSuccessCount === toUpdate.length
                ? "Precios actualizados"
                : `Precios actualizados en ${realSuccessCount} de ${toUpdate.length} seleccionados`
    };
};