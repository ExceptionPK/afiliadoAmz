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
        id: Date.now() + Math.random(),
        timestamp: new Date().toISOString(),
        productTitle: productTitle.slice(0, 120),
        price: null,
    };

    history.unshift(newEntry);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));

    // === FETCHREALDATA 100% FIABLE - NOVIEMBRE 2025 (versión definitiva) ===
    const fetchRealData = async () => {
        const proxies = [
            'https://corsproxy.io/?',
            'https://proxy.cors.sh/',
            'https://api.allorigins.win/raw?url=',
        ];

        let html = null;
        for (const proxy of proxies) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 14000);

                const res = await fetch(proxy + encodeURIComponent(entry.originalUrl), {
                    signal: controller.signal,
                    headers: {
                        'X-Requested-With': 'XMLHttpRequest',
                        ...(proxy.includes('cors.sh') && { 'x-cors-api-key': 'temp_anonymous' })
                    }
                });

                clearTimeout(timeoutId);
                if (!res.ok) continue;

                html = proxy.includes('allorigins')
                    ? (await res.json()).contents || ''
                    : await res.text();

                if (html && html.length > 2000 && /amazon/i.test(html)) break;
            } catch (e) { }
        }

        if (!html) return;

        // ==================== TÍTULO LIMPIO ====================
        let realTitle = productTitle;
        const titleMatch = html.match(/<title[^>]*>([^<]{10,})<\/title>/i);
        if (titleMatch?.[1]) {
            realTitle = titleMatch[1]
                .split(/ - Amazon\.| : | \| | – /)[0]
                .replace(/\s*\([^)]*(oferta|descuento|prime|ahorro|cupón|envío|[0-9]+ ?€|envio)[^)]*\)/gi, '')
                .replace(/\s*\[.*?\]/g, '')
                .replace(/\s+/g, ' ')
                .trim();
        }

        // ==================== PRECIO REAL (EL QUE PAGAS HOY) ====================
        let price = null;

        const toNumber = (str) => parseFloat(String(str).replace(/[^0-9,]/g, '').replace(',', '.')) || 0;

        // PRIORIDAD 1 → Precio visible grande (a-price-whole + fraction) → NUNCA falla
        const symbol = html.match(/class=["']a-price-symbol["'][^>]*>([^<]*)</i)?.[1]?.trim() || '€';
        const whole = html.match(/class=["']a-price-whole["'][^>]*>([^<]*)</i)?.[1]?.replace(/\.\s*/g, '') || '';
        const fraction = (html.match(/class=["']a-price-fraction["'][^>]*>([^<]*)</i)?.[1] || '00').padEnd(2, '0').slice(0, 2);

        if (whole && toNumber(whole) > 10) { // evita precios absurdos como envío de 5,99
            price = `${symbol}${whole},${fraction}`;
            console.log("Precio detectado (método 1 - más fiable):", price);
        }

        // PRIORIDAD 2 → Datos JSON incrustados (priceAmount, displayPrice, etc.)
        if (!price) {
            const jsonMatch = html.match(/"priceAmount"\s*:\s*"([^"]+)"|"(?:displayPrice|landingPrice|priceToPay)Amount"\s*:\s*"([^"]+)"/i);
            if (jsonMatch) {
                const candidate = jsonMatch[1] || jsonMatch[2];
                if (candidate && toNumber(candidate) > 10) {
                    price = candidate.trim();
                    console.log("Precio detectado (JSON):", price);
                }
            }
        }

        // PRIORIDAD 3 → Solo si los anteriores fallan: buscar en a-offscreen pero filtrar basura
        if (!price) {
            const offscreenPrices = [...html.matchAll(/<span[^>]+class=["'][^"']*a-offscreen[^"']*["'][^>]*>([^<]+)</gi)]
                .map(m => m[1].trim())
                .filter(txt => {
                    const val = toNumber(txt);
                    const text = txt.toLowerCase();
                    // Filtrar ahorro, envío, cupones pequeños, etc.
                    return val > 15 && // precios reales suelen ser >15€
                        !text.includes('ahorro') &&
                        !text.includes('cupón') &&
                        !text.includes('descuento') &&
                        !text.includes('envío') &&
                        !text.includes('gastos de envío') &&
                        !text.includes('prime') &&
                        !text.includes('suscríbete y ahorra');
                });

            if (offscreenPrices.length > 0) {
                // Coger el más bajo de los que pasan el filtro (suele ser el real)
                const validNums = offscreenPrices.map(toNumber).filter(n => n > 0);
                const lowest = Math.min(...validNums);
                const txt = offscreenPrices.find(t => toNumber(t) === lowest);
                if (lowest > 15) {
                    price = txt;
                    console.log("Precio detectado (a-offscreen filtrado):", price);
                }
            }
        }

        // Formatear bonito → formato español correcto: 85,69 €
        if (price) {
            // Quitar espacios y símbolos temporales
            let cleaned = price.replace(/\s+/g, '').trim();

            // Quitar puntos de miles
            cleaned = cleaned.replace(/\.(?=\d{3})/g, '');

            // Asegurar que la coma sea decimal
            cleaned = cleaned.replace('.', ',');

            // Extraer número y símbolo
            const hasEuroAtStart = cleaned.startsWith('€');
            const hasEuroAtEnd = cleaned.endsWith('€');

            if (hasEuroAtStart) {
                // Caso: €85,69 → 85,69 €
                cleaned = cleaned.replace(/^€/, '') + ' €';
            } else if (hasEuroAtEnd) {
                // Caso: 85,69€ → 85,69 €
                cleaned = cleaned.replace(/€$/, ' €');
            } else if (!cleaned.includes('€')) {
                // Caso: 85,69 → 85,69 €
                cleaned = cleaned + ' €';
            } else {
                // Caso raro: €85,69€ → 85,69 €
                cleaned = cleaned.replace(/€/g, '') + ' €';
            }

            price = cleaned.trim();
        }

        console.log("Título final →", realTitle.slice(0, 80) + (realTitle.length > 80 ? '...' : ''));
        console.log("Precio FINAL →", price || "No detectado");

        // ==================== GUARDAR ====================
        if (realTitle.length > 5 || price) {
            const updatedHistory = getHistory().map(h =>
                h.asin === entry.asin && h.domain === entry.domain
                    ? {
                        ...h,
                        productTitle: realTitle.length > 5 ? realTitle.slice(0, 120) : h.productTitle,
                        price: price || h.price,
                    }
                    : h
            );

            localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedHistory));

            window.dispatchEvent(new Event('amazon-history-updated'));

            if (realTitle.length > 5) {
                const cache = getTitleCache();
                cache[entry.asin] = realTitle.slice(0, 120);
                saveTitleCache(cache);
            }
        }

        let recommended = [];

        // 1. Carrusel "Productos patrocinados" (el más fiable y siempre tiene ASIN)
        const sponsored = html.matchAll(/data-asin=["']([A-Z0-9]{10})["'].*?title=["']([^"']{10,200})[^"']*["']/gi);
        for (const m of sponsored) {
            const asin = m[1];
            const titleRaw = m[2].replace(/&quot;|&#039;|\s+/g, ' ').trim();
            if (asin && titleRaw && !recommended.some(r => r.asin === asin)) {
                recommended.push({ asin, title: titleRaw.slice(0, 100) });
            }
        }

        // 2. Backup: "Los clientes también compraron" / "Productos relacionados"
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

        // Guardar recomendaciones en la entrada
        if (recommended.length > 0) {
            const updatedHistory = getHistory().map(h =>
                h.asin === entry.asin && h.domain === entry.domain
                    ? { ...h, recommended: recommended.slice(0, 8) }
                    : h
            );
            localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedHistory));
            window.dispatchEvent(new Event('amazon-history-updated'));
        }
    };

    // Ejecutar en segundo plano
    setTimeout(fetchRealData, 500);
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
                    const normalized = data.map(item => ({
                        ...item,
                        id: item.id || Date.now() + Math.random(),
                        timestamp: item.timestamp || new Date().toISOString(),
                        productTitle: item.productTitle || `Producto ${item.asin || "sin ASIN"}`,
                        price: item.price || null,
                    }));

                    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
                    callback(true);
                    return;
                }
            }

            // -------------------------------------------------
            // 2. CSV CON FECHAS ESPAÑOLAS + HORA (CORREGIDO)
            // -------------------------------------------------
            const lines = content.split(/\r\n|\n|\r/).map(l => l.trim()).filter(Boolean);
            if (lines.length === 0) throw new Error("Archivo vacío");

            // Detectar separador: ; o ,
            const sampleLine = lines[0];
            const delimiter = sampleLine.includes(";") ? ";" : ",";

            // Detectar si tiene cabecera
            const hasHeader = /fecha|título|precio|dominio|url|asin/i.test(lines[0]);
            const startIndex = hasHeader ? 1 : 0;

            // 🔥 FUNCIÓN PARA PARSEAR FECHAS ESPAÑOLAS CON HORA
            const parseSpanishDate = (dateStr) => {
                if (!dateStr || typeof dateStr !== 'string') return null;

                const trimmed = dateStr.trim();

                // Caso 1: "dd/mm/yyyy, HH:MM:SS" → convertir coma a espacio
                let clean = trimmed.replace(/,\s*/, ' ');  // "23/11/2025, 18:51:06" → "23/11/2025 18:51:06"

                // Extraer fecha y hora por separado
                const dateTimeParts = clean.split(' ');
                if (dateTimeParts.length < 1) return null;

                const datePart = dateTimeParts[0];

                // Validar formato dd/mm/yyyy
                const match = datePart.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
                if (!match) return null;

                const [, day, month, year] = match;
                const dayPadded = day.padStart(2, '0');
                const monthPadded = month.padStart(2, '0');

                // Construir fecha ISO completa
                let isoDateStr;
                if (dateTimeParts.length >= 2) {
                    // Con hora: "2025-11-23 18:51:06"
                    isoDateStr = `${year}-${monthPadded}-${dayPadded} ${dateTimeParts[1]}`;
                } else {
                    // Solo fecha: "2025-11-23 00:00:00"
                    isoDateStr = `${year}-${monthPadded}-${dayPadded} 00:00:00`;
                }

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

                // ORDEN CORRECTO: [Fecha, Título, Precio, Dominio, URL, ASIN]
                let fechaStr = "", titulo = "", precio = "", dominio = "", urlAfiliado = "", asin = "";

                if (cols.length >= 6) {
                    [fechaStr, titulo, precio, dominio, urlAfiliado, asin] = cols;
                } else if (cols.length >= 5) {
                    [fechaStr, titulo, dominio, urlAfiliado, asin] = cols;
                    precio = "";
                } else if (cols.length === 1 && cols[0].includes("amazon")) {
                    urlAfiliado = cols[0];
                    asin = urlAfiliado.match(/\/dp\/([A-Z0-9]{10})/i)?.[1] || "UNKNOWN";
                    dominio = new URL(urlAfiliado).hostname.replace("www.", "").split(".")[0] || "amazon";
                    titulo = `Producto ${asin}`;
                    fechaStr = new Date().toLocaleString("es-ES");
                    precio = "";
                } else {
                    continue;
                }

                // Extraer ASIN si no viene explícito
                if (!asin && urlAfiliado) {
                    asin = urlAfiliado.match(/\/dp\/([A-Z0-9]{10})/i)?.[1] || "UNKNOWN";
                }

                // Extraer dominio si falta
                if (!dominio && urlAfiliado) {
                    try {
                        dominio = new URL(urlAfiliado).hostname.replace("www.", "").split(".")[0] || "amazon";
                    } catch { }
                }

                const item = {
                    // ID único que mantiene orden del CSV
                    id: `csv-import-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,

                    // 🔥 TIMESTAMP CON FECHAS ESPAÑOLAS + HORA CORRECTAS
                    timestamp: (() => {
                        const parsed = parseSpanishDate(fechaStr);
                        return parsed ? parsed.toISOString() : new Date().toISOString();
                    })(),

                    productTitle: (titulo || `Producto ${asin}`).slice(0, 120),
                    price: precio && precio.trim() ? precio.trim() : null,
                    domain: dominio || "amazon",
                    affiliateUrl: urlAfiliado || "",
                    asin: asin || "UNKNOWN",
                    originalUrl: urlAfiliado || "",
                };

                imported.push(item);
            }

            if (imported.length === 0) throw new Error("No se encontraron enlaces válidos");

            // 🔥 GUARDAR MANTENIENDO ORDEN EXACTO DEL ARCHIVO
            localStorage.setItem(STORAGE_KEY, JSON.stringify(imported));
            callback(true);

        } catch (err) {
            console.error("Error importando archivo:", err);
            callback(false);
        }
    };

    reader.onerror = () => callback(false);
    reader.readAsText(file, "UTF-8");
};