import { useEffect, useState } from "react";
import { api, formatCRC, formatDate } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { Link } from "react-router-dom";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

export default function Analytics() {
  const [data, setData] = useState(null);
  useEffect(() => { api.get("/analytics").then(r => setData(r.data)); }, []);
  if (!data) return <div className="p-12 text-sm" style={{ color: "var(--m-ink-2)" }}>Cargando análisis…</div>;

  const { client_stats, monthly, growth_pct, overall_avg_order_value, active_clients } = data;
  const GrowthIcon = growth_pct == null ? Minus : growth_pct >= 0 ? TrendingUp : TrendingDown;
  const growthColor = growth_pct == null ? "var(--m-ink-2)" : growth_pct >= 0 ? "var(--m-sage-dark)" : "var(--m-danger)";

  return (
    <div>
      <PageHeader eyebrow="Análisis de negocio" title="Patrones y crecimiento"
        subtitle="Frecuencia de compra, ticket promedio y crecimiento mensual. Identifica clientes clave." />
      <div className="px-8 lg:px-12 py-8 space-y-10">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 stagger-in">
          <div className="card-base p-6">
            <div className="eyebrow">Crecimiento mensual</div>
            <div className="mt-3 flex items-center gap-2">
              <GrowthIcon className="w-5 h-5" style={{ color: growthColor }} />
              <span className="font-mono text-3xl" style={{ color: growthColor }}>
                {growth_pct == null ? "—" : `${growth_pct > 0 ? "+" : ""}${growth_pct}%`}
              </span>
            </div>
            <div className="mt-1 text-xs" style={{ color: "var(--m-ink-2)" }}>vs. mes anterior</div>
          </div>
          <div className="card-base p-6"><div className="eyebrow">Ticket promedio</div><div className="mt-3 font-mono text-3xl">{formatCRC(overall_avg_order_value)}</div></div>
          <div className="card-base p-6">
            <div className="eyebrow">Clientes activos</div>
            <div className="mt-3 font-mono text-3xl">{active_clients}</div>
            <div className="mt-1 text-xs" style={{ color: "var(--m-ink-2)" }}>con al menos 1 compra</div>
          </div>
          <div className="card-base p-6">
            <div className="eyebrow">Compradores top</div>
            <div className="mt-3 font-mono text-3xl">{client_stats.slice(0, 3).length}</div>
            <div className="mt-1 text-xs" style={{ color: "var(--m-ink-2)" }}>representan el mayor volumen</div>
          </div>
        </div>
        <div className="card-base p-6">
          <div className="eyebrow">Evolución · últimos 6 meses</div>
          <h3 className="font-serif text-2xl mt-1 mb-6">Ventas mensuales</h3>
          <div style={{ width: "100%", height: 280 }}>
            <ResponsiveContainer>
              <BarChart data={monthly} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
                <CartesianGrid stroke="#EFEBE3" vertical={false} />
                <XAxis dataKey="month" stroke="#A39891" tick={{ fontSize: 11, fontFamily: "IBM Plex Mono" }} axisLine={false} tickLine={false} />
                <YAxis stroke="#A39891" tick={{ fontSize: 11, fontFamily: "IBM Plex Mono" }} axisLine={false} tickLine={false} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                <Tooltip contentStyle={{ background: "#fff", border: "1px solid #E6E2DA", borderRadius: 4, fontSize: 12 }}
                  formatter={(v, name) => name === "sales" ? formatCRC(v) : v} />
                <Bar dataKey="sales" fill="#9C4936" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div>
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="font-serif text-3xl">Clientes clave</h2>
            <span className="eyebrow">Ordenados por volumen</span>
          </div>
          <div className="card-base overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr style={{ borderBottom: "1px solid var(--m-border)" }}>
                <th className="eyebrow py-4 px-6 text-left">Cliente</th>
                <th className="eyebrow py-4 px-6 text-right">Pedidos</th>
                <th className="eyebrow py-4 px-6 text-right">Ticket promedio</th>
                <th className="eyebrow py-4 px-6 text-right">Frecuencia</th>
                <th className="eyebrow py-4 px-6 text-right">Última compra</th>
                <th className="eyebrow py-4 px-6 text-right">Total</th>
              </tr></thead>
              <tbody>
                {client_stats.length === 0 ? (
                  <tr><td colSpan={6} className="py-16 text-center text-sm" style={{ color: "var(--m-ink-2)" }}>Aún sin datos suficientes para analizar.</td></tr>
                ) : client_stats.map(c => (
                  <tr key={c.client_id} style={{ borderBottom: "1px solid var(--m-border)" }}>
                    <td className="py-3.5 px-6"><Link to={`/clientes/${c.client_id}`} className="font-medium hover:underline">{c.client_name}</Link></td>
                    <td className="py-3.5 px-6 mono text-right">{c.orders_count}</td>
                    <td className="py-3.5 px-6 mono text-right">{formatCRC(c.avg_order_value)}</td>
                    <td className="py-3.5 px-6 mono text-right" style={{ color: "var(--m-ink-2)" }}>{c.avg_days_between_orders ? `cada ${c.avg_days_between_orders}d` : "—"}</td>
                    <td className="py-3.5 px-6 text-xs text-right" style={{ color: "var(--m-ink-2)" }}>{formatDate(c.last_order_at)}</td>
                    <td className="py-3.5 px-6 mono text-right font-medium">{formatCRC(c.total_spent)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
