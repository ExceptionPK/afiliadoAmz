// api/shorten.js

export default async function handler(req, res) {
  // Solo aceptamos POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' })
  }

  try {
    const body = req.body

    if (!body.originalURL) {
      return res.status(400).json({ error: 'Falta originalURL' })
    }

    const response = await fetch('https://api.short.io/links', {
      method: 'POST',
      headers: {
        'Authorization': process.env.SHORT_IO_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        originalURL: body.originalURL,
        domain: 'amazon-dks.short.gy',
        path: body.path || undefined,
        title: body.title || 'Producto Amazon'
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return res.status(response.status).json({
        error: 'Error en Short.io',
        details: errorData
      })
    }

    const data = await response.json()
    return res.status(200).json({ shortURL: data.shortURL })
  } catch (err) {
    console.error('Error en shorten handler:', err)
    return res.status(500).json({ error: 'Error interno al acortar enlace' })
  }
}