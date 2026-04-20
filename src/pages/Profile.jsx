// pages/Profile.jsx
import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "../utils/supabaseClient";
import MagicParticles from "../components/MagicParticles";
import { getUserHistory } from "../utils/supabaseStorage";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Package, ExternalLink, Star } from "lucide-react";

const Profile = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [timeRange, setTimeRange] = useState("all"); // all, 7d, 30d, 90d, 180d, 1y

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const data = await getUserHistory(2000);
      setProducts(data);
      setLoading(false);
    };
    loadData();
  }, []);

  const filteredProducts = useMemo(() => {
    if (!search.trim()) return products;
    const term = search.toLowerCase();
    return products.filter(
      (p) =>
        p.productTitle?.toLowerCase().includes(term) ||
        p.asin?.toLowerCase().includes(term)
    );
  }, [products, search]);

  // Preparar datos del gráfico según el rango seleccionado
  const prepareChartData = (pricesHistory, firstEverPrice) => {
    if (!Array.isArray(pricesHistory) || pricesHistory.length === 0) return [];

    let data = pricesHistory.map((entry) => ({
      timestamp: new Date(entry.timestamp).getTime(),
      date: new Date(entry.timestamp),
      price: parseFloat(entry.price?.replace(/[^0-9.,]/g, "").replace(",", ".")) || 0,
      fullDate: new Date(entry.timestamp),
    }));

    // Ordenar por fecha
    data.sort((a, b) => a.timestamp - b.timestamp);

    // Filtrar según rango seleccionado
    const now = Date.now();
    let filteredData = data;

    if (timeRange !== "all") {
      let days = 0;
      if (timeRange === "7d") days = 7;
      else if (timeRange === "30d") days = 30;
      else if (timeRange === "90d") days = 90;
      else if (timeRange === "180d") days = 180;
      else if (timeRange === "1y") days = 365;

      const cutoff = now - days * 24 * 60 * 60 * 1000;
      filteredData = data.filter((item) => item.timestamp >= cutoff);
    }

    // Si no hay datos después del filtro, devolvemos vacío
    if (filteredData.length === 0) return [];

    return filteredData.map((item) => ({
      date: item.fullDate.toLocaleDateString("es-ES", { day: "2-digit", month: "short" }),
      hour: item.fullDate.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }),
      price: item.price,
      fullLabel: item.fullDate.toLocaleString("es-ES", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }),
    }));
  };

  const timeRangeOptions = [
    { value: "all", label: "Todo" },
    { value: "7d", label: "7 días" },
    { value: "30d", label: "1 mes" },
    { value: "90d", label: "3 meses" },
    { value: "180d", label: "6 meses" },
    { value: "1y", label: "1 año" },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-50 to-white">
        <MagicParticles />
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-violet-600 border-t-transparent rounded-full mx-auto"></div>
          <p className="mt-4 text-slate-600 font-medium">Cargando tu dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <MagicParticles />
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white pt-20 pb-12">
        <div className="max-w-7xl mx-auto px-4">
          <h1 className="text-4xl font-bold text-slate-900 tracking-tight mb-2">
            Evolución de precios
          </h1>
          <p className="text-slate-600 text-lg mb-10">
            {products.length} productos • Historial completo
          </p>

          {/* Search + Time Range */}
          <div className="flex flex-col md:flex-row gap-4 mb-10">
            <input
              type="text"
              placeholder="Buscar por producto o ASIN..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 px-6 py-4 bg-white border border-slate-200 focus:border-violet-500 rounded-3xl text-lg placeholder-slate-400 focus:outline-none shadow-sm"
            />

            <div className="flex gap-2 flex-wrap">
              {timeRangeOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setTimeRange(option.value)}
                  className={`px-5 py-3 text-sm font-medium rounded-2xl transition-all ${
                    timeRange === option.value
                      ? "bg-violet-600 text-white shadow"
                      : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Grid de productos */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredProducts.map((product) => {
              const chartData = prepareChartData(product.prices, product.first_ever_price);

              return (
                <div
                  key={product.id}
                  className="bg-white border border-slate-200 contenedorCosas rounded-3xl overflow-hidden shadow-xl hover:shadow-2xl transition-all duration-300 flex flex-col h-full"
                >
                  {/* Cabecera */}
                  <div className="p-6 border-b">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="font-mono text-xs text-slate-500 tracking-widest">
                          {product.asin}
                        </p>
                        <h3 className="font-semibold text-xl text-slate-900 leading-tight mt-1 line-clamp-2">
                          {product.productTitle}
                        </h3>
                      </div>
                      {product.isFavorite && <Star className="w-5 h-5 text-violet-600 fill-current" />}
                    </div>

                    {/* Precios claros */}
                    <div className="grid grid-cols-3 gap-4 mt-6 text-center">
                      <div>
                        <span className="text-xs font-medium text-slate-500 block">Primer precio</span>
                        <p className="text-xl font-semibold text-amber-600 mt-1">
                          {product.first_ever_price || "—"}
                        </p>
                      </div>
                      <div>
                        <span className="text-xs font-medium text-slate-500 block">Actual</span>
                        <p className="text-xl font-bold text-emerald-600 mt-1">
                          {product.price || "—"}
                        </p>
                      </div>
                      <div>
                        <span className="text-xs font-medium text-slate-500 block">Original</span>
                        <p className="text-xl font-semibold text-slate-700 line-through mt-1">
                          {product.originalPrice || "—"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Gráfico */}
                  <div className="flex-1 px-6 pt-6 pb-4 min-h-[280px]">
                    {chartData.length > 1 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData}>
                          <defs>
                            <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#64748b" }} />
                          <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />

                          <Tooltip
                            contentStyle={{
                              background: "#fff",
                              border: "1px solid #cbd5e1",
                              borderRadius: "10px",
                              padding: "10px 14px",
                              boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                              fontSize: "13px",
                            }}
                            labelStyle={{ color: "#475569", fontWeight: 500 }}
                            itemStyle={{ color: "#1e2937", fontWeight: 600 }}
                            formatter={(value) => [`${value} €`, "Precio"]}
                            labelFormatter={(label, payload) => {
                              if (payload?.[0]?.payload?.fullLabel) {
                                return payload[0].payload.fullLabel;
                              }
                              return label;
                            }}
                          />

                          <Area
                            type="monotone"
                            dataKey="price"
                            stroke="#8b5cf6"
                            strokeWidth={3}
                            fill="url(#colorPrice)"
                            dot={false}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-slate-400">
                        No hay suficientes datos para mostrar la gráfica
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="px-6 py-5 border-t bg-slate-50 flex justify-end">
                    <a
                      href={product.affiliateUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm font-medium text-violet-600 hover:text-violet-700 transition"
                    >
                      Ver en Amazon <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredProducts.length === 0 && (
            <div className="text-center py-20">
              <Package className="w-16 h-16 mx-auto text-slate-300" />
              <p className="mt-6 text-slate-500 font-medium">No se encontraron productos</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default Profile;