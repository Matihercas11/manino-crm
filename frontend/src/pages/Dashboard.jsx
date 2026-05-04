import { useEffect, useState } from "react";
import { api, formatCRC } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import { LineChart, Line, BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { Link } from "react-router-dom";
import { ArrowUpRight, Coffee, AlertTriangle } from "lucide-react";

const Kpi = ({ label, value, hint }) => (
  <div className="card-base p-6 hover-card">
    <div className="eyebrow">{label}</div>
    <div className="mt-3 font-mono text-3xl lg:text-4xl tracking-tight">{value}</div>
    {hint && <div className="mt-2 text-xs" style={{ color: "var(--m-ink-2)" }}>{hint}</div>}
  </div>
);

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  useEffect(() => { api.get("/dashboard/stats").then((r) => setStats(r.data)); }, []);
  if (!stats) return <div className="p-12 text-sm" style={{ color: "var(--m-ink-2)" }}>Cargando panel…</div>;

  const { kpis, trend_14d, top_clients, top_products, low_stock, status_counts } = stats;

  return (
    <div>
      <PageHeader eyebrow="Panel operativo" title="Buen día, Manino."
        subtitle="Vista en tiempo real del negocio — ventas, pedidos y curaduría del inventario."
        actions={
          <Link to="/pos" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-sm text-sm font-medium text-white"
            style={{ background: "var(--m-terracotta)" }}>
            Registrar compra <ArrowUpRight className="w-4 h-4" />
          </Link>
        } />
      <div className="px-8 lg:px-12 py-10 space-y-10">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 stagger-in">
          <Kpi label="Ventas totales" value={formatCRC(kpis.total_sales)} hint={`Últimos 30 días · ${formatCRC(kpis.sales_30d)}`} />
          <Kpi label="Pedidos totales" value={kpis.total_orders} hint={`${kpis.orders_30d} en 30d`} />
          <Kpi label="Ticket promedio" value={formatCRC(kpis.avg_ticket)} />
          <Kpi label="Clientes" value={kpis.total_clients} hint={`Catálogo · ${kpis.total_products} productos`} />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 card-base p-6">
            <div className="flex items-baseline justify-between mb-6">
              <div>
                <div className="eyebrow">Tendencia · 14 días</div>
                <div className="font-serif text-2xl mt-1">Ventas diarias</div>
              </div>
              <div className="font-mono text-sm" style={{ color: "var(--m-ink-2)" }}>
                Σ {formatCRC(trend_14d.reduce((a, b) => a + b.sales, 0))}
              </div>
            </div>
            <div style={{ width: "100%", height: 260 }}>
              <ResponsiveContainer>
                <LineChart data={trend_14d} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
                  <CartesianGrid stroke="#EFEBE3" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={(d) => d.slice(5)} stroke="#A39891"
                    tick={{ fontSize: 11, fontFamily: "IBM Plex Mono" }} axisLine={false} tickLine={false} />
                  <YAxis stroke="#A39891" tick={{ fontSize: 11, fontFamily: "IBM Plex Mono" }}
                    axisLine={false} tickLine={false} tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)} />
                  <Tooltip contentStyle={{ background: "#fff", border: "1px solid #E6E2DA", borderRadius: 4, fontSize: 12 }}
                    formatter={(v) => formatCRC(v)} />
                  <Line type="monotone" dataKey="sales" stroke="#9C4936" strokeWidth={2}
                    dot={{ r: 3, fill: "#9C4936" }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="card-base p-6">
            <div className="eyebrow">Estado de pedidos</div>
            <div className="mt-5 space-y-4">
              {[
                { k: "pendiente", label: "Pendientes", color: "#D4A373" },
                { k: "en_proceso", label: "En proceso", color: "#8A9A83" },
                { k: "entregado", label: "Entregados", color: "#9C4936" },
              ].map((s) => {
                const count = status_counts[s.k] || 0;
                const total = Object.values(status_counts).reduce((a, b) => a + b, 0) || 1;
                const pct = Math.round((count / total) * 100);
                return (
                  <div key={s.k}>
                    <div className="flex items-baseline justify-between mb-1.5">
                      <span className="text-sm">{s.label}</span>
                      <span className="font-mono text-sm">{count}</span>
                    </div>
                    <div className="h-1 w-full" style={{ background: "#EFEBE3" }}>
                      <div className="h-1" style={{ width: `${pct}%`, background: s.color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="card-base p-6">
            <div className="eyebrow">Clientes frecuentes</div>
            <h3 className="font-serif text-xl mt-1 mb-4">Top compradores</h3>
            {top_clients.length === 0 ? <p className="text-sm" style={{ color: "var(--m-ink-2)" }}>Aún sin ventas registradas.</p> :
              <ul className="divide-y" style={{ borderColor: "var(--m-border)" }}>
                {top_clients.map((c, i) => (
                  <li key={c.client_id} className="py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs w-5 text-right" style={{ color: "var(--m-muted)" }}>{String(i + 1).padStart(2, "0")}</span>
                      <Link to={`/clientes/${c.client_id}`} className="text-sm hover:underline">{c.client_name}</Link>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-sm">{formatCRC(c.total)}</div>
                      <div className="text-[10px]" style={{ color: "var(--m-ink-2)" }}>{c.orders} pedidos</div>
                    </div>
                  </li>
                ))}
              </ul>}
          </div>
          <div className="card-base p-6">
            <div className="eyebrow">Más vendidos</div>
            <h3 className="font-serif text-xl mt-1 mb-4">Top productos</h3>
            {top_products.length === 0 ? <p className="text-sm" style={{ color: "var(--m-ink-2)" }}>Registra tu primera compra.</p> :
              <div style={{ width: "100%", height: 220 }}>
                <ResponsiveContainer>
                  <BarChart data={top_products} layout="vertical" margin={{ left: 0 }}>
                    <XAxis type="number" hide />
                    <YAxis dataKey="product_name" type="category" width={100} stroke="#A39891"
                      tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ background: "#fff", border: "1px solid #E6E2DA", borderRadius: 4, fontSize: 12 }}
                      formatter={(v) => formatCRC(v)} />
                    <Bar dataKey="revenue" fill="#8A9A83" radius={[0, 2, 2, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>}
          </div>
          <div className="card-base p-6">
            <div className="flex items-center justify-between mb-1">
              <div className="eyebrow">Inventario</div>
              <AlertTriangle className="w-4 h-4" style={{ color: "var(--m-warning)" }} />
            </div>
            <h3 className="font-serif text-xl mt-1 mb-4">Stock bajo</h3>
            {low_stock.length === 0 ?
              <div className="flex items-center gap-2 text-sm" style={{ color: "var(--m-ink-2)" }}><Coffee className="w-4 h-4" /> Todo en orden.</div> :
              <ul className="divide-y" style={{ borderColor: "var(--m-border)" }}>
                {low_stock.slice(0, 8).map((p) => (
                  <li key={p.id} className="py-2.5 flex items-center justify-between">
                    <span className="text-sm">{p.name}</span>
                    <span className="font-mono text-xs px-2 py-0.5 rounded-sm" style={{ background: "#F4E9D8", color: "#8A5A1F" }}>
                      {p.stock} / {p.threshold}
                    </span>
                  </li>
                ))}
              </ul>}
          </div>
        </div>
      </div>
    </div>
  );
}
