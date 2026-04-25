export default async function handler(req, res) {
  const { q } = req.query;

  // =========================
  // VALIDACIÓN
  // =========================
  if (!q || typeof q !== "string") {
    return res.status(400).json({
      result: "Falta query válida",
      results: [],
      answer: null,
    });
  }

  // =========================
  // FORZAR AMAZON ESPAÑA
  // =========================
  const normalizeAmazonUrl = (url = "") => {
    return url
      .replace("amazon.com.mx", "amazon.es")
      .replace("amazon.com", "amazon.es")
      .replace("amazon.co.uk", "amazon.es")
      .replace("amazon.de", "amazon.es")
      .replace("amazon.fr", "amazon.es");
  };

  try {
    // =========================
    // TIMEOUT SAFE (Vercel friendly)
    // =========================
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        api_key: process.env.TAVILY_API_KEY_1,
        query: q,

        search_depth: "advanced",
        include_answer: true,
        include_results: true,
        max_results: 5,
        include_raw_content: false,
      }),
    });

    clearTimeout(timeout);

    // =========================
    // SI TAVILY FALLA
    // =========================
    if (!response.ok) {
      const text = await response.text();
      console.error("Tavily error:", text);

      return res.status(200).json({
        result: "Error en búsqueda externa",
        results: [],
        answer: null,
      });
    }

    let data;
    try {
      data = await response.json();
    } catch (e) {
      console.error("Tavily JSON parse error:", e);
      return res.status(200).json({
        result: "Respuesta inválida de búsqueda",
        results: [],
        answer: null,
      });
    }

    // =========================
    // SANITIZAR RESULTS
    // =========================
    const results = Array.isArray(data?.results)
      ? data.results
          .map((r) => ({
            title: r?.title || "Sin título",
            url: normalizeAmazonUrl(r?.url || ""),
            content: (r?.content || "").slice(0, 200),
            score: r?.score || 0,
          }))
          .filter(r => r.url.includes("amazon.es")) // evita basura
      : [];

    // =========================
    // ORDENAR POR RELEVANCIA
    // =========================
    const sorted = results.sort((a, b) => b.score - a.score);

    // =========================
    // FORMATO PARA LLM
    // =========================
    const llmText = sorted.length
      ? sorted
          .map(
            (r) =>
              `Título: ${r.title}\nURL: ${r.url}\nInfo: ${r.content}`
          )
          .join("\n\n")
      : "Sin resultados relevantes";

    // =========================
    // RESPUESTA FINAL
    // =========================
    return res.status(200).json({
      answer: data?.answer || null,
      results: sorted,
      result: llmText,
    });
  } catch (error) {
    console.error("Tavily exception:", error);

    // 🔥 nunca romper frontend
    return res.status(200).json({
      result: "Error interno en búsqueda",
      results: [],
      answer: null,
    });
  }
}