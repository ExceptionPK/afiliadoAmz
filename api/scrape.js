export default async function handler(req, res) {
  console.log('[Vercel Proxy] Petición recibida en /api/scrape');

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'Falta parámetro url' });
  }

  const apiKey = process.env.SCRAPEDO_API_KEY;

  if (!apiKey) {
    console.error('[Vercel Proxy] No se encontró SCRAPEDO_API_KEY');
    return res.status(500).json({ error: 'Clave API no configurada' });
  }

  const scrapeUrl = `https://api.scrape.do/scratch?api_key=${apiKey}&url=${encodeURIComponent(url)}&geo=es&render_js=false`;

  try {
    console.log('[Vercel Proxy] Llamando Scrape.do:', scrapeUrl);

    const response = await fetch(scrapeUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
    });

    const text = await response.text();

    console.log('[Vercel Proxy] Scrape.do status:', response.status, 'longitud respuesta:', text.length);

    if (!response.ok) {
      console.error('[Vercel Proxy] Scrape.do error:', text.slice(0, 300));
      return res.status(response.status).send(text);
    }

    res.setHeader('Content-Type', 'text/html');
    res.status(200).send(text);

  } catch (err) {
    console.error('[Vercel Proxy] Error:', err.message);
    res.status(500).json({ error: 'Error al obtener datos: ' + err.message });
  }
}