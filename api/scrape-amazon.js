// api/scrape-amazon.js

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método no permitido' });
    }

    const { url, asin: mainAsin } = req.body;

    if (!url || typeof url !== 'string' || !url.includes('amazon')) {
        return res.status(400).json({ error: 'URL inválida o no es de Amazon' });
    }

    // Log temporal para debug (borrar cuando esté estable)
    console.log('Main ASIN recibido:', mainAsin);
    console.log('URL solicitada:', url);

    const proxies = [
        'https://api.codetabs.com/v1/proxy?quest=',
        'https://cors.x2u.in/',
        'https://www.thebugging.com/apis/cors-proxy/?url=',
        'https://corsproxy.io/?',
        'https://proxy.cors.sh/',
        'https://test.cors.workers.dev/?url=',
        'https://cors-anywhere.herokuapp.com/',
        'https://cors.bridged.cc/',
        'https://api.allorigins.win/get?url=',
        'https://cors.lol/',
        // Recomendado extra (más estable para raw HTML):
        'https://api.allorigins.win/raw?url=',
    ];

    const userAgents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0',
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
        'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
    ];

    const randomUA = userAgents[Math.floor(Math.random() * userAgents.length)];
    const shuffledProxies = [...proxies].sort(() => 0.5 - Math.random());

    let html = null;

    for (const proxy of shuffledProxies) {
        try {
            let proxyUrl = proxy + encodeURIComponent(url);

            if (proxy.includes('allorigins.win/get')) {
                proxyUrl = proxy + encodeURIComponent(url) + '&callback=';
            } else if (proxy.includes('allorigins.win/raw')) {
                proxyUrl = proxy + encodeURIComponent(url);
            }

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 20000);

            const response = await fetch(proxyUrl, {
                method: 'GET',
                signal: controller.signal,
                headers: {
                    'User-Agent': randomUA,
                    'Accept-Language': 'es-ES,es;q=0.9',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'X-Requested-With': 'XMLHttpRequest',
                },
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                console.warn(`Proxy ${proxy} respondió ${response.status}`);
                continue;
            }

            const contentType = response.headers.get('content-type') || '';
            let data;

            if (contentType.includes('application/json')) {
                data = await response.json();
                html = data.contents || data.html || data.body || data.data || null;
            } else {
                html = await response.text();
            }

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

            if (html && html.length > 2000 && /amazon/i.test(html)) {
                break;
            }
        } catch (e) {
            console.warn(`Proxy falló: ${proxy}`, e.message);
        }
    }

    if (!html) {
        return res.status(503).json({
            error: 'No se pudo obtener el HTML válido (todos los proxies fallaron)',
            details: 'Intenta con proxies más nuevos o considera proxies pagos/residenciales',
        });
    }

    // ==================== EXTRACCIÓN DE TÍTULO ====================
    let realTitle = 'Producto sin título';

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
    if (realTitle === 'Producto sin título' || realTitle.length < 15) {
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
    if (realTitle === 'Producto sin título' || realTitle.length < 15) {
        const prodTitleMatch = html.match(/id=["']productTitle["'][^>]*>([\s\S]*?)<\/span>/i);
        if (prodTitleMatch?.[1]) {
            realTitle = prodTitleMatch[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
        }
    }

    // ==================== EXTRACCIÓN DE PRECIO ====================
    let price = null;
    const toNumber = (str) => parseFloat(String(str).replace(/[^0-9,]/g, '').replace(',', '.')) || 0;

    // Intento 1: JSON embebido
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

    // Intento 2: Selectores clásicos
    if (!price) {
        const symbol = html.match(/class=["']a-price-symbol["'][^>]*>([^<]*)</i)?.[1]?.trim() || '€';
        const whole = html.match(/class=["']a-price-whole["'][^>]*>([^<]*)</i)?.[1]?.replace(/\.\s*/g, '') || '';
        const fraction = (html.match(/class=["']a-price-fraction["'][^>]*>([^<]*)</i)?.[1] || '00').padEnd(2, '0').slice(0, 2);

        if (whole && toNumber(whole) > 10) {
            price = `${symbol}${whole},${fraction}`;
        }
    }

    // Intento 3: Offscreen prices
    if (!price) {
        const offscreenPrices = [...html.matchAll(/<span[^>]+class=["'][^"']*a-offscreen[^"']*["'][^>]*>([^<]+)<\/span>/gi)]
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

    // Formateo final del precio
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
    }

    // ==================== RECOMENDACIONES ====================
    let recommended = [];

    // 1. Sponsored products
    const sponsoredRegex = /data-asin=["']([A-Z0-9]{10})["'][^>]*?title=["']([^"']{10,250})[^"']*["']/gi;
    let match;
    while ((match = sponsoredRegex.exec(html)) !== null) {
        const asin = match[1];
        let title = match[2]
            .replace(/&quot;|&#039;|&amp;/g, "'")
            .replace(/\s+/g, ' ')
            .trim();
        if (
            asin !== mainAsin &&
            title.length > 15 &&
            !recommended.some(r => r.asin === asin) &&
            !/patrocinado|sponsored|ad|anuncio|prime/i.test(title.toLowerCase())
        ) {
            recommended.push({ asin, title: title.slice(0, 120) });
        }
    }

    // 2. Carruseles "Customers also viewed", etc.
    const carouselRegex = /<div[^>]*data-asin=["']([A-Z0-9]{10})["'][^>]*?>([\s\S]*?)<(?:img|span)[^>]*alt=["']([^"']{10,250})[^"']*["']|title=["']([^"']{10,250})[^"']*["']/gi;
    for (const m of html.matchAll(carouselRegex)) {
        const asin = m[1];
        let title = (m[3] || m[4] || '').replace(/&quot;|&#039;|&amp;/g, "'").replace(/\s+/g, ' ').trim();

        if (
            asin !== mainAsin &&
            title.length > 15 &&
            !recommended.some(r => r.asin === asin) &&
            !/patrocinado|sponsored|ad|anuncio|prime|oferta/i.test(title.toLowerCase())
        ) {
            recommended.push({ asin, title: title.slice(0, 120) });
            if (recommended.length >= 10) break;
        }
    }

    // 3. Fallback amplio
    if (recommended.length < 4) {
        const fallbackRegex = /data-asin=["']([A-Z0-9]{10})["'].*?alt=["']([^"']{10,250})[^"']*["']/gi;
        for (const m of html.matchAll(fallbackRegex)) {
            const asin = m[1];
            let title = m[2]
                .replace(/&quot;|&#039;|&amp;/g, "'")
                .replace(/\s+/g, ' ')
                .trim();

            if (
                asin !== mainAsin &&
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
        .filter(r => r.title && r.title.length > 15);

    // Log temporal para debug (borrar cuando esté estable)
    console.log('Recomendaciones encontradas:', recommended.length);

    // Respuesta final
    res.status(200).json({
        success: true,
        realTitle: realTitle.trim().slice(0, 120),
        price: price,
        recommended: recommended.slice(0, 8)
    });
}