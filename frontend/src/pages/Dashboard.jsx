import { useCallback, useEffect, useMemo, useState } from "react";
import { api, formatCRC, formatDate } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import { LineChart, Line, BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";
import { Link } from "react-router-dom";
import { ArrowUpRight, Coffee, AlertTriangle, AlertCircle, Target, Edit3, Check, X, TrendingUp, TrendingDown, Wallet, FileBarChart, CalendarDays } from "lucide-react";

const Kpi = ({ label, value, hint }) => (
  <div className="card-base p-6 hover-card">
    <div className="eyebrow">{label}</div>
    <div className="mt-3 font-mono text-3xl lg:text-4xl tracking-tight">{value}</div>
    {hint && <div className="mt-2 text-xs" style={{ color: "var(--m-ink-2)" }}>{hint}</div>}
  </div>
);

function GoalCard({ totalSales }) {
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [target, setTarget] = useState(0);
  const [editing, setEditing] = useState(false);
  const [inputVal, setInputVal] = useState("");

  useEffect(() => {
    api.get(`/settings/goals?month=${month}`)
      .then(r => { setTarget(r.data.target || 0); setInputVal(String(r.data.target || "")); })
      .catch(() => {});
  }, [month]);

  const save = async () => {
    const val = Number(inputVal) || 0;
    await api.put("/settings/goals", { month, target: val });
    setTarget(val);
    setEditing(false);
  };

  const pct = target > 0 ? Math.min(Math.round((totalSales / target) * 100), 100) : 0;
  const monthLabel = now.toLocaleDateString("es-CR", { month: "long", year: "numeric" });
  const over = target > 0 && totalSales >= target;

  return (
    <div className="card-base p-6">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4" style={{ color: "var(--m-terracotta)" }} />
          <div className="eyebrow">Meta mensual · {monthLabel}</div>
        </div>
        {!editing && (
          <button onClick={() => { setInputVal(String(target || "")); setEditing(true); }}
            className="p-1.5 rounded-sm hover:bg-[color:var(--m-sidebar)]">
            <Edit3 className="w-3.5 h-3.5" style={{ color: "var(--m-ink-2)" }} />
          </button>
        )}
      </div>

      {editing ? (
        <div className="mt-3 flex items-center gap-2">
          <span className="text-sm">₡</span>
          <input type="number" value={inputVal} onChange={e => setInputVal(e.target.value)}
            onKeyDown={e => e.key === "Enter" && save()}
            className="flex-1 bg-transparent border-b outline-none font-mono text-lg py-1"
            style={{ borderColor: "var(--m-terracotta)" }}
            autoFocus placeholder="500000" />
          <button onClick={save} className="p-1.5 rounded-sm" style={{ color: "#4A7C6F" }}><Check className="w-4 h-4" /></button>
          <button onClick={() => setEditing(false)} className="p-1.5 rounded-sm" style={{ color: "var(--m-muted)" }}><X className="w-4 h-4" /></button>
        </div>
      ) : target === 0 ? (
        <button onClick={() => setEditing(true)}
          className="mt-3 text-sm underline" style={{ color: "var(--m-ink-2)" }}>
          + Definir meta para este mes
        </button>
      ) : (
        <div className="mt-4 space-y-3">
          <div className="flex items-baseline justify-between">
            <span className="font-mono text-2xl" style={{ color: over ? "#4A7C6F" : "var(--m-ink)" }}>
              {formatCRC(totalSales)}
            </span>
            <span className="text-sm" style={{ color: "var(--m-ink-2)" }}>de {formatCRC(target)}</span>
          </div>
          <div className="h-2 w-full rounded-full overflow-hidden" style={{ background: "#EFEBE3" }}>
            <div className="h-2 rounded-full transition-all duration-500"
              style={{ width: `${pct}%`, background: over ? "#4A7C6F" : "var(--m-terracotta)" }} />
          </div>
          <div className="flex items-center justify-between text-xs">
            <span style={{ color: over ? "#4A7C6F" : "var(--m-ink-2)" }}>
              {over ? "¡Meta alcanzada!" : `Falta ${formatCRC(target - totalSales)}`}
            </span>
            <span className="font-mono font-medium"
              style={{ color: over ? "#4A7C6F" : "var(--m-terracotta)" }}>{pct}%</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  useEffect(() => { api.get("/dashboard/stats").then((r) => setStats(r.data)); }, []);
  if (!stats) return <div className="p-12 text-sm" style={{ color: "var(--m-ink-2)" }}>Cargando panel…</div>;

  const { kpis, trend_14d, top_clients, top_products, low_stock, status_counts, morosos,
          expenses = { cancelled_total: 0, pending_total: 0 },
          balance = { net_profit: 0, salary_10: 0, funds_20: 0, reinvest_70: 0 },
          monthly_balance = [] } = stats;

  return (
    <div>
      <PageHeader eyebrow="Panel operativo" title="Buen día, Manino."
        subtitle="Vista en tiempo real del negocio — ventas cobradas, pedidos y curaduría del inventario."
        actions={
          <Link to="/pos" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-sm text-sm font-medium text-white"
            style={{ background: "var(--m-terracotta)" }}>
            Registrar compra <ArrowUpRight className="w-4 h-4" />
          </Link>
        } />
      <div className="px-8 lg:px-12 py-10 space-y-10">

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 stagger-in">
          <Kpi label="Ventas cobradas" value={formatCRC(kpis.total_sales)}
            hint={`Últimos 30d · ${formatCRC(kpis.sales_30d)} · solo pagados`} />
          <Kpi label="Pedidos totales" value={kpis.total_orders} hint={`${kpis.orders_30d} pagados en 30d`} />
          <Kpi label="Ticket promedio" value={formatCRC(kpis.avg_ticket)} hint="Sobre pedidos pagados" />
          <Kpi label="Clientes" value={kpis.total_clients} hint={`Catálogo · ${kpis.total_products} productos`} />
        </div>

        {/* Meta mensual */}
        <GoalCard totalSales={kpis.total_sales} />

        {/* Balance general */}
        <BalanceSection
          totalSales={kpis.total_sales}
          expenses={expenses}
          balance={balance}
          monthly={monthly_balance}
        />

        {/* Reporte semanal */}
        <WeeklyReportSection />

        {/* Alerta morosos */}
        {morosos.length > 0 && (
          <div className="rounded-sm border p-5" style={{ borderColor: "#C0392B", background: "#FDF2F2" }}>
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle className="w-5 h-5" style={{ color: "#C0392B" }} />
              <span className="font-medium text-sm" style={{ color: "#C0392B" }}>
                {morosos.length} cliente{morosos.length > 1 ? "s" : ""} con deuda vencida (+7 días)
              </span>
            </div>
            <ul className="divide-y" style={{ borderColor: "#F5C6C6" }}>
              {morosos.map((m) => (
                <li key={m.order_id} className="py-2.5 flex items-center justify-between">
                  <div>
                    <Link to={`/clientes/${m.client_id}`}
                      className="text-sm font-medium hover:underline" style={{ color: "#7B241C" }}>
                      {m.client_name}
                    </Link>
                    <div className="text-xs mt-0.5" style={{ color: "#922B21" }}>
                      Entregado hace {m.days_overdue} días · {formatDate(m.delivered_at)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-sm font-medium" style={{ color: "#7B241C" }}>
                      {formatCRC(m.total)}
                    </div>
                    <Link to="/pedidos" className="text-[10px] underline" style={{ color: "#922B21" }}>
                      ver pedido
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Gráfica + Estado pedidos */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 card-base p-6">
            <div className="flex items-baseline justify-between mb-6">
              <div>
                <div className="eyebrow">Tendencia · 14 días</div>
                <div className="font-serif text-2xl mt-1">Ventas cobradas diarias</div>
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
                { k: "paid", label: "Pagados", color: "#4A7C6F" },
              ].map((s) => {
                const count = status_counts[s.k] || 0;
                const base = s.k === "paid"
                  ? kpis.total_orders
                  : (status_counts.pendiente + status_counts.en_proceso + status_counts.entregado) || 1;
                const pct = Math.round((count / (base || 1)) * 100);
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

        {/* Top clientes + productos + stock */}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="card-base p-6">
            <div className="eyebrow">Clientes frecuentes</div>
            <h3 className="font-serif text-xl mt-1 mb-4">Top compradores</h3>
            {top_clients.length === 0 ? <p className="text-sm" style={{ color: "var(--m-ink-2)" }}>Aún sin ventas cobradas.</p> :
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

function BalanceSection({ totalSales, expenses, balance, monthly }) {
  const [view, setView] = useState("current"); // current | history
  const formatMonthLabel = (key) => {
    if (!key) return "";
    const [y, m] = key.split("-");
    return new Date(Number(y), Number(m) - 1).toLocaleDateString("es-CR", { month: "short", year: "numeric" });
  };

  const currentMonthKey = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }, []);
  const currentMonth = monthly.find(m => m.month === currentMonthKey);

  const breakdown = [
    { label: "Salario (10%)", value: balance.salary_10, color: "#4A7C6F", pct: 10 },
    { label: "Fondos (20%)", value: balance.funds_20, color: "#8A9A83", pct: 20 },
    { label: "Reinversión (70%)", value: balance.reinvest_70, color: "#9C4936", pct: 70 },
  ];

  const positiveMonths = monthly.filter(m => m.sales > 0 || m.expenses > 0);

  return (
    <div className="card-base p-6">
      <div className="flex items-end justify-between mb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Wallet className="w-4 h-4" style={{ color: "var(--m-terracotta)" }} />
            <div className="eyebrow">Balance general</div>
          </div>
          <h2 className="font-serif text-2xl">Ganancia neta</h2>
          <p className="text-xs mt-1" style={{ color: "var(--m-ink-2)" }}>
            Ingresos cobrados − gastos cancelados. Gastos pendientes no afectan este cálculo.
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setView("current")}
            className="px-3 py-1.5 text-xs rounded-sm border"
            style={{
              borderColor: view === "current" ? "var(--m-terracotta)" : "var(--m-border)",
              color: view === "current" ? "var(--m-terracotta)" : "var(--m-ink-2)",
              background: view === "current" ? "#FFF" : "transparent",
            }}>
            Vista actual
          </button>
          <button onClick={() => setView("history")}
            className="px-3 py-1.5 text-xs rounded-sm border"
            style={{
              borderColor: view === "history" ? "var(--m-terracotta)" : "var(--m-border)",
              color: view === "history" ? "var(--m-terracotta)" : "var(--m-ink-2)",
              background: view === "history" ? "#FFF" : "transparent",
            }}>
            Historial mensual
          </button>
        </div>
      </div>

      {view === "current" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <div className="grid grid-cols-3 gap-3">
              <BalanceTile label="Ingresos cobrados" value={totalSales} color="#4A7C6F" Icon={TrendingUp} />
              <BalanceTile label="Gastos cancelados" value={expenses.cancelled_total} color="#9C4936" Icon={TrendingDown} negative />
              <BalanceTile label="Ganancia neta" value={balance.net_profit}
                color={balance.net_profit >= 0 ? "#2C2420" : "#C0392B"} bold />
            </div>
            {expenses.pending_total > 0 && (
              <div className="mt-3 p-2.5 rounded-sm text-xs flex items-center gap-2"
                style={{ background: "#FFF8E8", border: "1px solid #F4E9D8", color: "#8A5A1F" }}>
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{formatCRC(expenses.pending_total)} en gastos pendientes (no descontados)</span>
              </div>
            )}
          </div>

          <div className="rounded-sm p-5" style={{ background: "var(--m-sidebar)", border: "1px solid var(--m-border)" }}>
            <div className="eyebrow mb-3">Desglose 10 / 20 / 70</div>
            <div className="space-y-2.5">
              {breakdown.map(b => (
                <div key={b.label}>
                  <div className="flex items-baseline justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ background: b.color }} />
                      <span className="text-sm">{b.label}</span>
                    </div>
                    <span className="font-mono text-sm font-medium" style={{ color: b.color }}>
                      {formatCRC(b.value)}
                    </span>
                  </div>
                  <div className="h-1 w-full" style={{ background: "#EFEBE3" }}>
                    <div className="h-1" style={{ width: `${b.pct}%`, background: b.color }} />
                  </div>
                </div>
              ))}
            </div>
            {balance.net_profit <= 0 && (
              <p className="text-xs mt-3" style={{ color: "var(--m-muted)" }}>
                Sin ganancia neta — el desglose se mostrará en cero hasta que las ventas superen los gastos cancelados.
              </p>
            )}
          </div>
        </div>
      )}

      {view === "history" && (
        <div>
          {positiveMonths.length === 0 ? (
            <div className="text-center py-12 rounded-sm" style={{ background: "var(--m-sidebar)" }}>
              <p className="text-sm" style={{ color: "var(--m-ink-2)" }}>Aún no hay movimientos para mostrar.</p>
            </div>
          ) : (
            <>
              <div style={{ width: "100%", height: 220 }}>
                <ResponsiveContainer>
                  <BarChart data={positiveMonths} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
                    <CartesianGrid stroke="#EFEBE3" vertical={false} />
                    <XAxis dataKey="month" tickFormatter={formatMonthLabel} stroke="#A39891"
                      tick={{ fontSize: 11, fontFamily: "IBM Plex Mono" }} axisLine={false} tickLine={false} />
                    <YAxis stroke="#A39891" tick={{ fontSize: 11, fontFamily: "IBM Plex Mono" }}
                      axisLine={false} tickLine={false} tickFormatter={(v) => (Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)} />
                    <Tooltip contentStyle={{ background: "#fff", border: "1px solid #E6E2DA", borderRadius: 4, fontSize: 12 }}
                      formatter={(v) => formatCRC(v)} labelFormatter={formatMonthLabel} />
                    <Bar dataKey="sales" fill="#4A7C6F" name="Ingresos" radius={[2,2,0,0]} />
                    <Bar dataKey="expenses" fill="#9C4936" name="Gastos" radius={[2,2,0,0]} />
                    <Bar dataKey="net" fill="#2C2420" name="Neto" radius={[2,2,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-5 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr style={{ borderBottom: "1px solid var(--m-border)" }}>
                    <th className="eyebrow py-3 px-3 text-left">Mes</th>
                    <th className="eyebrow py-3 px-3 text-right">Ingresos</th>
                    <th className="eyebrow py-3 px-3 text-right">Gastos</th>
                    <th className="eyebrow py-3 px-3 text-right">Neto</th>
                    <th className="eyebrow py-3 px-3 text-right">Salario 10%</th>
                    <th className="eyebrow py-3 px-3 text-right">Fondos 20%</th>
                    <th className="eyebrow py-3 px-3 text-right">Reinv. 70%</th>
                  </tr></thead>
                  <tbody>
                    {[...positiveMonths].reverse().map(m => (
                      <tr key={m.month} style={{ borderBottom: "1px solid var(--m-border)" }}>
                        <td className="py-2.5 px-3 text-sm">{formatMonthLabel(m.month)}</td>
                        <td className="py-2.5 px-3 mono text-right" style={{ color: "#4A7C6F" }}>{formatCRC(m.sales)}</td>
                        <td className="py-2.5 px-3 mono text-right" style={{ color: "#9C4936" }}>{formatCRC(m.expenses)}</td>
                        <td className="py-2.5 px-3 mono text-right font-medium"
                          style={{ color: m.net >= 0 ? "var(--m-ink)" : "#C0392B" }}>{formatCRC(m.net)}</td>
                        <td className="py-2.5 px-3 mono text-right text-xs" style={{ color: "#4A7C6F" }}>{formatCRC(m.salary_10)}</td>
                        <td className="py-2.5 px-3 mono text-right text-xs" style={{ color: "#8A9A83" }}>{formatCRC(m.funds_20)}</td>
                        <td className="py-2.5 px-3 mono text-right text-xs" style={{ color: "#9C4936" }}>{formatCRC(m.reinvest_70)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {currentMonth && (
                <div className="mt-3 text-xs" style={{ color: "var(--m-ink-2)" }}>
                  Mes en curso: {formatMonthLabel(currentMonth.month)} · neto {formatCRC(currentMonth.net)}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function BalanceTile({ label, value, color, Icon, bold, negative }) {
  return (
    <div className="rounded-sm p-4" style={{ border: "1px solid var(--m-border)" }}>
      <div className="flex items-center gap-1.5 mb-2">
        {Icon && <Icon className="w-3.5 h-3.5" style={{ color }} />}
        <div className="eyebrow" style={{ fontSize: 9 }}>{label}</div>
      </div>
      <div className="font-mono tracking-tight" style={{ color, fontSize: bold ? 22 : 18, fontWeight: bold ? 600 : 400 }}>
        {negative && value > 0 ? "−" : ""}{formatCRC(value)}
      </div>
    </div>
  );
}

function WeeklyReportSection() {
  const isSunday = useMemo(() => new Date().getDay() === 0, []);
  const [report, setReport] = useState(null);
  const [open, setOpen] = useState(isSunday);
  const [loading, setLoading] = useState(false);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get("/reports/weekly");
      setReport(r.data);
      setOpen(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isSunday) fetchReport();
  }, [isSunday, fetchReport]);

  const formatDateLong = (iso) => {
    if (!iso) return "";
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("es-CR", { day: "2-digit", month: "short" });
  };

  const dayLabel = (iso) => {
    if (!iso) return "";
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("es-CR", { weekday: "short", day: "2-digit" });
  };

  return (
    <div className="card-base p-6" style={isSunday ? { borderColor: "var(--m-terracotta)", borderWidth: 2 } : undefined}>
      <div className="flex items-end justify-between flex-wrap gap-3 mb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <FileBarChart className="w-4 h-4" style={{ color: "var(--m-terracotta)" }} />
            <div className="eyebrow">Reporte semanal</div>
            {isSunday && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] rounded-sm font-medium"
                style={{ background: "var(--m-terracotta)", color: "#FFF" }}>
                <CalendarDays className="w-3 h-3" /> Domingo · cierre de semana
              </span>
            )}
          </div>
          <h2 className="font-serif text-2xl">Resumen de la semana</h2>
          <p className="text-xs mt-1" style={{ color: "var(--m-ink-2)" }}>
            Lunes a domingo de la semana en curso. Solo informativo — no ejecuta pagos.
            {report && (
              <span className="ml-1 font-mono">
                {formatDateLong(report.start)} → {formatDateLong(report.end)}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {open && report && (
            <button onClick={() => setOpen(false)}
              className="px-3 py-1.5 text-xs rounded-sm border"
              style={{ borderColor: "var(--m-border)", color: "var(--m-ink-2)" }}>
              Ocultar
            </button>
          )}
          <button onClick={fetchReport} disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-sm text-sm font-medium text-white disabled:opacity-50"
            style={{ background: "var(--m-terracotta)" }}>
            <FileBarChart className="w-4 h-4" />
            {loading ? "Cargando…" : (report ? "Actualizar" : "Generar Reporte")}
          </button>
        </div>
      </div>

      {open && report && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <BalanceTile label="Ingresos semana" value={report.income_total} color="#4A7C6F" Icon={TrendingUp} />
            <BalanceTile label="Gastos semana" value={report.expense_total} color="#9C4936" Icon={TrendingDown} negative />
            <BalanceTile
              label="Ganancia neta"
              value={report.net_profit}
              color={report.net_profit >= 0 ? "#2C2420" : "#C0392B"}
              Icon={Wallet}
              bold
            />
            <div className="rounded-sm p-4" style={{ border: "1px solid var(--m-border)" }}>
              <div className="eyebrow mb-2" style={{ fontSize: 9 }}>Volumen</div>
              <div className="text-sm">
                <div className="font-mono">{report.orders_count} pedido{report.orders_count !== 1 ? "s" : ""}</div>
                <div className="font-mono text-xs mt-0.5" style={{ color: "var(--m-ink-2)" }}>
                  {report.expenses_count} gasto{report.expenses_count !== 1 ? "s" : ""}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="rounded-sm p-5" style={{ background: "var(--m-sidebar)", border: "1px solid var(--m-border)" }}>
              <div className="eyebrow mb-3">Desglose 10 / 20 / 70 sobre neto</div>
              {report.net_profit > 0 ? (
                <div className="space-y-3">
                  {[
                    { label: "Salario (10%)", value: report.breakdown.salary_10, color: "#4A7C6F", pct: 10 },
                    { label: "Fondos (20%)", value: report.breakdown.funds_20, color: "#8A9A83", pct: 20 },
                    { label: "Reinversión (70%)", value: report.breakdown.reinvest_70, color: "#9C4936", pct: 70 },
                  ].map(b => (
                    <div key={b.label}>
                      <div className="flex items-baseline justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ background: b.color }} />
                          <span className="text-sm">{b.label}</span>
                        </div>
                        <span className="font-mono text-sm font-medium" style={{ color: b.color }}>
                          {formatCRC(b.value)}
                        </span>
                      </div>
                      <div className="h-1 w-full" style={{ background: "#EFEBE3" }}>
                        <div className="h-1" style={{ width: `${b.pct}%`, background: b.color }} />
                      </div>
                    </div>
                  ))}
                  <p className="text-[10px] mt-3" style={{ color: "var(--m-muted)" }}>
                    Cálculo informativo · este reporte no mueve dinero ni registra movimientos.
                  </p>
                </div>
              ) : (
                <p className="text-sm" style={{ color: "var(--m-ink-2)" }}>
                  Sin ganancia neta en la semana — el desglose 10/20/70 se mostrará cuando los ingresos superen a los gastos cancelados.
                </p>
              )}
            </div>

            <div>
              <div className="eyebrow mb-3">Movimiento diario</div>
              <div style={{ width: "100%", height: 220 }}>
                <ResponsiveContainer>
                  <BarChart data={report.daily} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
                    <CartesianGrid stroke="#EFEBE3" vertical={false} />
                    <XAxis dataKey="date" tickFormatter={dayLabel} stroke="#A39891"
                      tick={{ fontSize: 10, fontFamily: "IBM Plex Mono" }} axisLine={false} tickLine={false} />
                    <YAxis stroke="#A39891" tick={{ fontSize: 10, fontFamily: "IBM Plex Mono" }}
                      axisLine={false} tickLine={false}
                      tickFormatter={(v) => (Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)} />
                    <Tooltip contentStyle={{ background: "#fff", border: "1px solid #E6E2DA", borderRadius: 4, fontSize: 12 }}
                      formatter={(v) => formatCRC(v)} labelFormatter={dayLabel} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="income" name="Ingresos" fill="#4A7C6F" radius={[2,2,0,0]} />
                    <Bar dataKey="expense" name="Gastos" fill="#9C4936" radius={[2,2,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr style={{ borderBottom: "1px solid var(--m-border)" }}>
                <th className="eyebrow py-2.5 px-3 text-left">Día</th>
                <th className="eyebrow py-2.5 px-3 text-right">Ingresos</th>
                <th className="eyebrow py-2.5 px-3 text-right">Gastos</th>
                <th className="eyebrow py-2.5 px-3 text-right">Neto</th>
              </tr></thead>
              <tbody>
                {report.daily.map(d => (
                  <tr key={d.date} style={{ borderBottom: "1px solid var(--m-border)" }}>
                    <td className="py-2 px-3 text-sm">{dayLabel(d.date)}</td>
                    <td className="py-2 px-3 mono text-right" style={{ color: "#4A7C6F" }}>{formatCRC(d.income)}</td>
                    <td className="py-2 px-3 mono text-right" style={{ color: "#9C4936" }}>{formatCRC(d.expense)}</td>
                    <td className="py-2 px-3 mono text-right font-medium"
                      style={{ color: d.net >= 0 ? "var(--m-ink)" : "#C0392B" }}>{formatCRC(d.net)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: "var(--m-sidebar)" }}>
                  <td className="py-2.5 px-3 eyebrow">Total</td>
                  <td className="py-2.5 px-3 mono text-right font-medium" style={{ color: "#4A7C6F" }}>{formatCRC(report.income_total)}</td>
                  <td className="py-2.5 px-3 mono text-right font-medium" style={{ color: "#9C4936" }}>{formatCRC(report.expense_total)}</td>
                  <td className="py-2.5 px-3 mono text-right font-medium"
                    style={{ color: report.net_profit >= 0 ? "var(--m-ink)" : "#C0392B" }}>{formatCRC(report.net_profit)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {open && !report && !loading && (
        <div className="text-center py-10 rounded-sm" style={{ background: "var(--m-sidebar)" }}>
          <p className="text-sm" style={{ color: "var(--m-ink-2)" }}>
            Pulsá <span className="font-medium">Generar Reporte</span> para ver el resumen de la semana en curso.
          </p>
        </div>
      )}
    </div>
  );
}
