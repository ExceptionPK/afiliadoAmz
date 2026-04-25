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
  // ROTACIÓN DE KEYS
  // =========================
  const keys = [
    process.env.TAVILY_API_KEY_1,
    process.env.TAVILY_API_KEY_2,
    process.env.TAVILY_API_KEY_3,
  ].filter(Boolean);

  if (keys.length === 0) {
    return res.status(500).json({
      result: "No hay API keys configuradas",
      results: [],
      answer: null,
    });
  }

  const normalizeAmazonUrl = (url = "") => {
    return url
      .replace("amazon.com.mx", "amazon.es")
      .replace("amazon.com", "amazon.es")
      .replace("amazon.co.uk", "amazon.es")
      .replace("amazon.de", "amazon.es")
      .replace("amazon.fr", "amazon.es");
  };

  // =========================
  // FUNCIÓN DE FETCH CON KEY ROTATIVA
  // =========================
  const fetchWithKeyRotation = async () => {
    let lastError = null;

    for (let i = 0; i < keys.length; i++) {
      const apiKey = keys[i];

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);

        const response = await fetch("https://api.tavily.com/search", {
          method: "POST",
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            api_key: apiKey,
            query: q,
            search_depth: "advanced",
            include_answer: true,
            include_results: true,
            max_results: 5,
            include_raw_content: false,
          }),
        });

        clearTimeout(timeout);

        if (!response.ok) {
          const text = await response.text();
          console.error(`Tavily error con key ${i}:`, text);
          lastError = text;
          continue; // 🔥 prueba siguiente key
        }

        return await response.json();
      } catch (err) {
        console.error(`Error con key ${i}:`, err);
        lastError = err;
        continue;
      }
    }

    throw lastError || new Error("Todas las keys fallaron");
  };

  try {
    let data = await fetchWithKeyRotation();

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
          .filter((r) => r.url.includes("amazon.es"))
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

    return res.status(200).json({
      answer: data?.answer || null,
      results: sorted,
      result: llmText,
    });
  } catch (error) {
    console.error("Tavily exception:", error);

    return res.status(200).json({
      result: "Error interno en búsqueda",
      results: [],
      answer: null,
    });
  }
}