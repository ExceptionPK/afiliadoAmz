export default async function handler(req, res) {
  const { q } = req.query;

  // =========================
  // VALIDACIÓN INICIAL
  // =========================
  if (!q || typeof q !== "string") {
    return res.status(400).json({
      result: "Falta query válida",
      results: [],
      answer: null,
    });
  }

  try {
    // =========================
    // TIMEOUT (evita cuelgues en Vercel)
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
        api_key: process.env.TAVILY_API_KEY,
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
    // VALIDAR STATUS (CRÍTICO)
    // =========================
    if (!response.ok) {
      const text = await response.text();
      console.error("Tavily error response:", text);

      return res.status(200).json({
        result: "Error en búsqueda externa",
        results: [],
        answer: null,
      });
    }

    const data = await response.json();

    // =========================
    // SANITIZAR RESULTS
    // =========================
    const results = Array.isArray(data.results)
      ? data.results.map((r) => ({
          title: r?.title || "Sin título",
          url: r?.url || "",
          content: (r?.content || "").slice(0, 200),
          score: r?.score || 0,
        }))
      : [];

    const sorted = results.sort((a, b) => b.score - a.score);

    // =========================
    // OUTPUT PARA LLM
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
    // RESPUESTA FINAL SIEMPRE JSON VÁLIDO
    // =========================
    return res.status(200).json({
      answer: data.answer || null,
      results: sorted,
      result: llmText,
    });
  } catch (error) {
    console.error("Tavily exception:", error);

    // =========================
    // SI FALLA TODO → NUNCA HTML
    // =========================
    return res.status(200).json({
      result: "Error interno en búsqueda",
      results: [],
      answer: null,
    });
  }
}