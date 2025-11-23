// utils/storage.js
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
    const exists = history.some(
        (h) => h.asin === entry.asin && h.domain === entry.domain
    );
    if (exists) return;

    // === TÍTULO SEGURO: NUNCA domain, NUNCA URL ===
    let productTitle = `Producto ${entry.asin}`; // ← Valor por defecto

    // 1. Intentar extraer slug del path
    try {
        const urlObj = new URL(entry.originalUrl);
        const path = urlObj.pathname;
        const slugMatch = path.match(/\/([^\/]+)\/dp\/([A-Z0-9]{10})/i);

        if (slugMatch && slugMatch[1]) {
            const slug = decodeURIComponent(slugMatch[1]).trim();
            if (
                slug &&
                slug.length >= 3 &&
                slug.length <= 200 &&
                !slug.includes('.') &&
                !slug.includes('?') &&
                !/^(dp|gp|product|ref|sspa|tag)$/i.test(slug)
            ) {
                productTitle = slug
                    .replace(/-/g, ' ')
                    .replace(/\b\w/g, l => l.toUpperCase())
                    .replace(/\s+/g, ' ')
                    .trim();
            }
        }
    } catch (e) {
        console.warn("Error parseando URL para slug:", e);
    }

    // 2. Usar caché solo si es válido
    const cache = getTitleCache();
    if (cache[entry.asin]) {
        const cached = cache[entry.asin];
        if (
            cached &&
            cached.length > 0 &&
            !cached.includes('amazon') &&
            !cached.includes('http') &&
            !cached.includes('.es') &&
            !cached.includes('.com')
        ) {
            productTitle = cached;
        }
    }

    // 3. Forzar título seguro
    if (!productTitle || productTitle.includes('amazon') || productTitle.length < 3) {
        productTitle = `Producto ${entry.asin}`;
    }

    // === GUARDAR ENTRADA INICIAL ===
    const newEntry = {
        ...entry,
        id: Date.now() + Math.random(),
        timestamp: new Date().toISOString(),
        productTitle: productTitle.slice(0, 120),
    };

    history.unshift(newEntry);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));

    // === GUARDAR EN CACHÉ INICIAL ===
    const newCache = { ...cache, [entry.asin]: productTitle.slice(0, 120) };
    saveTitleCache(newCache);

    // === 4. OBTENER TÍTULO REAL DESDE AMAZON (proxy FIABLE) ===
    const fetchRealTitle = async () => {
        try {
            const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(entry.originalUrl)}`;
            const response = await fetch(proxyUrl);

            if (!response.ok) return null;

            const data = await response.json();
            const html = data.contents;
            if (!html) return null;

            // Extraer <title>
            const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
            if (!titleMatch || !titleMatch[1]) return null;

            let realTitle = titleMatch[1]
                .replace(/ - Amazon\.(es|com|de|fr|it|co\.uk).*$/i, '')
                .replace(/:.*$/, '')
                .replace(/\|.*$/, '')
                .replace(/\s+/g, ' ')
                .trim();

            // Validar que sea un título real
            if (
                realTitle.length > 5 &&
                realTitle.length < 200 &&
                !realTitle.includes('Amazon') &&
                !realTitle.includes('dp/') &&
                !realTitle.includes('ref=')
            ) {
                return realTitle;
            }
        } catch (e) {
            console.warn("Error fetching título real:", e);
        }
        return null;
    };

    // Ejecutar en segundo plano (no bloquea UI)
    setTimeout(async () => {
        const realTitle = await fetchRealTitle();
        if (realTitle) {
            // Actualizar caché
            const updatedCache = { ...getTitleCache(), [entry.asin]: realTitle.slice(0, 120) };
            saveTitleCache(updatedCache);

            // Actualizar historial en tiempo real
            const currentHistory = getHistory();
            const updatedHistory = currentHistory.map(h =>
                h.asin === entry.asin && h.domain === entry.domain
                    ? { ...h, productTitle: realTitle.slice(0, 120) }
                    : h
            );
            localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedHistory));
        }
    }, 0);
};

export const removeFromHistory = (id) => {
    const history = getHistory().filter((h) => h.id !== id);
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

// utils/storage.js → NUEVA VERSIÓN DE importHistory
export const importHistory = (file, callback) => {
    const reader = new FileReader();

    reader.onload = (e) => {
        const content = e.target.result.trim();

        try {
            // -------------------------------------------------
            // 1. INTENTAR COMO JSON (formato original)
            // -------------------------------------------------
            if (
                file.type === "application/json" ||
                file.name.endsWith(".json") ||
                content.startsWith("[") ||
                content.startsWith("{")
            ) {
                const data = JSON.parse(content);

                if (Array.isArray(data)) {
                    // Aseguramos que cada item tenga ID (por si viene de exportación antigua)
                    const normalized = data.map(item => ({
                        ...item,
                        id: item.id || Date.now() + Math.random(),
                        timestamp: item.timestamp || new Date().toISOString(),
                        productTitle: item.productTitle || `Producto ${item.asin || "sin ASIN"}`
                    }));

                    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
                    callback(true);
                    return;
                }
            }

            // -------------------------------------------------
            // 2. INTENTAR COMO CSV
            // -------------------------------------------------
            const lines = content.split(/\r\n|\n|\r/).map(l => l.trim()).filter(Boolean);
            if (lines.length === 0) throw new Error("Archivo vacío");

            // Detectar separador: ; o ,
            const sampleLine = lines[0];
            const delimiter = sampleLine.includes(";") ? ";" : ",";

            // Detectar si tiene cabecera
            const hasHeader = /fecha|título|dominio|url|asin/i.test(lines[0]);
            const startIndex = hasHeader ? 1 : 0;

            const imported = [];

            for (let i = startIndex; i < lines.length; i++) {
                const line = lines[i];
                if (!line) continue;

                // Separar columnas (soporta comillas)
                const rawCols = line.split(delimiter);
                const cols = rawCols.map(col =>
                    col.replace(/^"|"$/g, "").replace(/""/g, '"').trim()
                );

                // Tu formato actual de exportación CSV:
                // Fecha, Título, Dominio, URL Afiliado, ASIN
                let [fechaStr, titulo = "", dominio = "", urlAfiliado = "", asin = ""] = cols;

                // Si no hay columnas suficientes, intentar parsear de forma más flexible
                if (cols.length === 1 && cols[0].includes("amazon")) {
                    urlAfiliado = cols[0];
                    asin = urlAfiliado.match(/\/dp\/([A-Z0-9]{10})/i)?.[1] || "UNKNOWN";
                    dominio = new URL(urlAfiliado).hostname.replace("www.", "").split(".")[0] || "amazon";
                    titulo = `Producto ${asin}`;
                    fechaStr = new Date().toLocaleString("es-ES");
                }

                // Validación mínima
                if (!asin && !urlAfiliado) continue;

                // Extraer ASIN si no viene explícito
                if (!asin && urlAfiliado) {
                    asin = urlAfiliado.match(/\/dp\/([A-Z0-9]{10})/i)?.[1] || "UNKNOWN";
                }

                // Extraer dominio si falta
                if (!dominio && urlAfiliado) {
                    try {
                        dominio = new URL(urlAfiliado).hostname.replace("www.", "").split(".")[0] || "amazon";
                    } catch {}
                }

                const item = {
                    id: Date.now() + Math.random() + i,
                    timestamp: fechaStr
                        ? isNaN(new Date(fechaStr).getTime())
                            ? new Date().toISOString()
                            : new Date(fechaStr).toISOString()
                        : new Date().toISOString(),
                    productTitle: (titulo || `Producto ${asin}`).slice(0, 120),
                    domain: dominio || "amazon",
                    affiliateUrl: urlAfiliado || "",
                    asin: asin || "UNKNOWN",
                    originalUrl: urlAfiliado || "",
                };

                imported.push(item);
            }

            if (imported.length === 0) throw new Error("No se encontraron enlaces válidos");

            // Opción: mezclar con el historial actual (recomendado)
            const current = getHistory();
            const merged = [...current, ...imported];

            localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
            callback(true);

        } catch (err) {
            console.error("Error importando archivo:", err);
            callback(false);
        }
    };

    reader.onerror = () => callback(false);
    reader.readAsText(file, "UTF-8");
};