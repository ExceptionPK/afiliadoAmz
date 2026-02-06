// api/scrape.js
export default async function handler(req, res) {
  // Solo permitimos GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'Falta parámetro "url"' });
  }

  const apiKey = process.env.SCRAPEDO_API_KEY;

  if (!apiKey) {
    console.error('Falta SCRAPEDO_API_KEY en variables de entorno');
    return res.status(500).json({ error: 'Error interno del servidor' });
  }

  // Construye la URL de Scrape.do
  const scrapeUrl = `https://api.scrape.do/scratch?api_key=${apiKey}&url=${encodeURIComponent(url)}&geo=es&render_js=false`;

  try {
    const response = await fetch(scrapeUrl);
    const text = await response.text();

    if (!response.ok) {
      console.error(`Scrape.do error ${response.status}: ${text.slice(0, 200)}...`);
      return res.status(response.status).send(text);
    }

    // Devuelve el HTML directamente
    res.setHeader('Content-Type', 'text/html');
    res.status(200).send(text);

  } catch (err) {
    console.error('Error en proxy Scrape.do:', err.message);
    res.status(500).json({ error: 'Error al obtener datos' });
  }
}