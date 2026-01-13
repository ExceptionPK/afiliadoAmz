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
    const proxies = [
        'https://api.codetabs.com/v1/proxy?quest=',
        'https://cors.x2u.in/',
        'https://www.thebugging.com/apis/cors-proxy/?url=',
        'https://corsproxy.io/?',
        'https://proxy.cors.sh/',
        'https://test.cors.workers.dev/?url=',  // Nuevo (Cloudflare)
        'https://cors-anywhere.herokuapp.com/',  // Clásico, pero aún funciona en 2026 para testing
        'https://cors.bridged.cc/',  // Nuevo, soporta raw
        'https://api.allorigins.win/get?url=',  // Nuevo, devuelve JSON {contents: html}
        'https://cors.lol/'  // Nuevo, simple /url
    ];

    const userAgents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0',
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
        'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',  // Nuevo UA 2026
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36'  // Nuevo
    ];
    const randomUA = userAgents[Math.floor(Math.random() * userAgents.length)];

    const shuffledProxies = [...proxies].sort(() => 0.5 - Math.random());

    let html = null;

    for (const proxy of shuffledProxies) {
        try {
            let proxyUrl = proxy + encodeURIComponent(entry.originalUrl);

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 20000);  // Aumentado a 20s

            const res = await fetch(proxyUrl, {
                signal: controller.signal,
                headers: {
                    'X-Requested-With': 'XMLHttpRequest',
                    'User-Agent': randomUA,
                    'Accept-Language': 'es-ES,es;q=0.9'  // Añadido para .es
                },
            });

            clearTimeout(timeoutId);

            if (!res.ok) continue;

            // Manejo inteligente de respuesta (JSON o text)
            const contentType = res.headers.get('content-type');
            let responseData;
            if (contentType && contentType.includes('application/json')) {
                responseData = await res.json();
                html = responseData.contents || responseData.html || responseData.body || null;
            } else {
                html = await res.text();
            }

            // Filtramos páginas de bloqueo o error
            if (
                !html ||
                html.includes('Captcha') ||
                html.includes('sorry') ||
                html.includes('robot') ||
                html.includes('unusual traffic') ||
                html.includes('api-services-support@amazon.com') ||
                html.length < 5000
            ) {
                console.warn(`Proxy ${proxy} devolvió página bloqueada o inválida`);
                html = null;
                continue;
            }

            // Si tiene contenido real de Amazon, salimos
            if (html && html.length > 2000 && /amazon/i.test(html)) {
                break;
            }
        } catch (e) {
            console.warn(`Proxy falló: ${proxy}`, e.message);
        }
    }

    if (!html) {
        console.warn('Todos los proxies fallaron para:', entry.originalUrl);
        return;
    }

    // ==================== TÍTULO LIMPIO ====================
    let realTitle = entry.productTitle;

    // Prioridad 1: JSON-LD
    const ldMatches = html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi);
    for (const match of ldMatches) {
        try {
            const json = JSON.parse(match[1]);
            if (json.name && json.name.length > 10) {
                realTitle = json.name
                    .replace(/\s*\([^)]*(oferta|descuento|prime|ahorro|cupón|envío|[0-9]+ ?€|envio)[^)]*\)/gi, '')
                    .replace(/\s*\[.*?\]/g, '')
                    .replace(/\s+/g, ' ')
                    .trim();
                break;
            }
        } catch { }
    }

    // Prioridad 2: <title>
    if (!realTitle || realTitle.length < 15) {
        const titleMatch = html.match(/<title[^>]*>([^<]{20,})<\/title>/i);
        if (titleMatch?.[1]) {
            realTitle = titleMatch[1]
                .split(/[-:|–](?=\s*Amazon)/i)[0]
                .replace(/\s*\([^)]*\)/g, '')
                .replace(/\s+/g, ' ')
                .trim();
        }
    }

    // Prioridad 3: #productTitle
    if (!realTitle || realTitle.length < 15) {
        const prodTitleMatch = html.match(/id=["']productTitle["'][^>]*>([\s\S]*?)<\/span>/i);
        if (prodTitleMatch?.[1]) {
            realTitle = prodTitleMatch[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
        }
    }

    // ==================== PRECIO REAL ====================
    let price = null;
    const toNumber = (str) => parseFloat(String(str).replace(/[^0-9,]/g, '').replace(',', '.')) || 0;

    // Intento 1: JSON embebido (mejorado y prioritario)
    let priceFromJson = null;
    const jsonCandidates = html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi);

    for (const match of jsonCandidates) {
        try {
            const json = JSON.parse(match[1]);
            const candidate = json?.offers?.price || json?.offers?.lowPrice || json?.offers?.highPrice;
            if (candidate && toNumber(candidate) > 10) {
                priceFromJson = candidate;
                break;
            }
        } catch { }
    }

    if (!priceFromJson) {
        const scriptMatches = html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi);
        for (const m of scriptMatches) {
            const content = m[1];
            const priceMatch = content.match(/"priceAmount"\s*:\s*"([^"]+)"|"displayPriceAmount"\s*:\s*"([^"]+)"|"priceToPayAmount"\s*:\s*"([^"]+)"|"landingPriceAmount"\s*:\s*"([^"]+)"/i);
            if (priceMatch) {
                priceFromJson = priceMatch[1] || priceMatch[2] || priceMatch[3] || priceMatch[4];
                if (toNumber(priceFromJson) > 10) break;
            }
        }
    }

    if (priceFromJson) {
        let num = toNumber(priceFromJson);
        if (num > 10) {
            price = num.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
        }
    }

    // Intento 2: Selectores clásicos (si JSON falla)
    if (!price) {
        const symbol = html.match(/class=["']a-price-symbol["'][^>]*>([^<]*)</i)?.[1]?.trim() || '€';
        const whole = html.match(/class=["']a-price-whole["'][^>]*>([^<]*)</i)?.[1]?.replace(/\.\s*/g, '') || '';
        const fraction = (html.match(/class=["']a-price-fraction["'][^>]*>([^<]*)</i)?.[1] || '00').padEnd(2, '0').slice(0, 2);

        if (whole && toNumber(whole) > 10) {
            price = `${symbol}${whole},${fraction}`;
        }
    }

    // Intento 3: Offscreen prices (último recurso)
    if (!price) {
        const offscreenPrices = [...html.matchAll(/<span[^>]+class=["'][^"']*a-offscreen[^"']*["'][^>]*>([^<]+)</gi)]
            .map(m => m[1].trim())
            .filter(txt => {
                const val = toNumber(txt);
                const text = txt.toLowerCase();
                return (
                    txt.includes('€') &&
                    val > 15 &&
                    !text.includes('ahorro') &&
                    !text.includes('cupón') &&
                    !text.includes('descuento') &&
                    !text.includes('envío') &&
                    !text.includes('gastos de envío') &&
                    !text.includes('prime') &&
                    !text.includes('suscríbete y ahorra')
                );
            });

        if (offscreenPrices.length > 0) {
            const sorted = offscreenPrices.sort((a, b) => toNumber(a) - toNumber(b));
            const lowestTxt = sorted[0];
            const lowestVal = toNumber(lowestTxt);
            if (lowestVal > 15) {
                price = lowestTxt;
            }
        }
    }

    // Formateo bonito del precio (español)
    if (price) {
        let numericPart = price.replace(/[^0-9,.]/g, '').trim();

        if (numericPart.includes(',') && numericPart.includes('.')) {
            numericPart = numericPart.replace(/\./g, '');
        } else if (numericPart.includes('.')) {
            numericPart = numericPart.replace('.', ',');
        }

        if (!numericPart || parseFloat(numericPart.replace(',', '.')) < 1) {
            price = null;
        } else {
            const [whole, decimal = ''] = numericPart.split(',');
            const formattedWhole = parseInt(whole || '0').toLocaleString('es-ES');
            const formattedDecimal = decimal.padEnd(2, '0').slice(0, 2);
            price = `${formattedWhole},${formattedDecimal} €`;
        }
    } else {
        price = null;
    }

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

    // 1. Sponsored products (muy frecuente: data-asin + title en contenedores)
    const sponsoredRegex = /data-asin=["']([A-Z0-9]{10})["'][^>]*?title=["']([^"']{10,250})[^"']*["']/gi;
    let match;
    while ((match = sponsoredRegex.exec(html)) !== null) {
        const asin = match[1];
        let title = match[2]
            .replace(/&quot;|&#039;|&amp;/g, "'")
            .replace(/\s+/g, ' ')
            .trim();
        if (
            asin !== entry.asin &&
            title.length > 15 &&
            !recommended.some(r => r.asin === asin) &&
            !/patrocinado|sponsored|ad|anuncio|prime/i.test(title.toLowerCase())
        ) {
            recommended.push({ asin, title: title.slice(0, 120) });
        }
    }

    // 2. Carruseles "Customers also viewed", "Related", "Frequently bought together" (más moderno 2025-2026)
    const carouselRegex = /<div[^>]*data-asin=["']([A-Z0-9]{10})["'][^>]*?>([\s\S]*?)<(?:img|span)[^>]*alt=["']([^"']{10,250})[^"']*["']|title=["']([^"']{10,250})[^"']*["']/gi;
    for (const m of html.matchAll(carouselRegex)) {
        const asin = m[1];
        let title = (m[3] || m[4] || '').replace(/&quot;|&#039;|&amp;/g, "'").replace(/\s+/g, ' ').trim();

        if (
            asin !== entry.asin &&
            title.length > 15 &&
            !recommended.some(r => r.asin === asin) &&
            !/patrocinado|sponsored|ad|anuncio|prime|oferta/i.test(title.toLowerCase())
        ) {
            recommended.push({ asin, title: title.slice(0, 120) });
            if (recommended.length >= 10) break;  // Límite razonable
        }
    }

    // 3. Fallback amplio: cualquier data-asin con alt en img (muchos carruseles usan esto)
    if (recommended.length < 4) {
        const fallbackRegex = /data-asin=["']([A-Z0-9]{10})["'].*?alt=["']([^"']{10,250})[^"']*["']/gi;
        for (const m of html.matchAll(fallbackRegex)) {
            const asin = m[1];
            let title = m[2]
                .replace(/&quot;|&#039;|&amp;/g, "'")
                .replace(/\s+/g, ' ')
                .trim();

            if (
                asin !== entry.asin &&
                title.length > 15 &&
                !recommended.some(r => r.asin === asin) &&
                !/patrocinado|sponsored|ad|anuncio|prime|oferta/i.test(title.toLowerCase())
            ) {
                recommended.push({ asin, title: title.slice(0, 120) });
                if (recommended.length >= 8) break;
            }
        }
    }

    // 4. Limpieza final: eliminar duplicados y basura
    recommended = [...new Map(recommended.map(item => [item.asin, item])).values()]
        .filter(r => r.title && r.title.length > 15);  // Refiltro por longitud mínima

    // Guardar solo si hay algo útil
    if (recommended.length > 0) {
        const finalHistory = getHistory().map(h =>
            h.asin === entry.asin && h.domain === entry.domain
                ? { ...h, recommended: recommended.slice(0, 8) }  // Máximo 8 para no saturar
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
        return longUrl // fallback importante
    }
}

