import { useEffect, useMemo, useState, Fragment } from "react";
import { api, formatCRC, formatDate, formatDateTime, STATUS_LABEL } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { ChevronDown, ChevronRight, Trash2, ArrowUpRight, Calendar as CalendarIcon, X } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [rangeFilter, setRangeFilter] = useState("all");
  const [dateRange, setDateRange] = useState({ from: undefined, to: undefined });
  const [expanded, setExpanded] = useState({});

  const load = async () => { const r = await api.get("/orders"); setOrders(r.data); };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => orders.filter(o => {
    if (statusFilter !== "all" && o.status !== statusFilter) return false;
    const t = new Date(o.created_at).getTime();
    if (rangeFilter === "custom") {
      if (dateRange.from && t < dateRange.from.setHours(0,0,0,0)) return false;
      if (dateRange.to && t > new Date(dateRange.to).setHours(23,59,59,999)) return false;
    } else if (rangeFilter !== "all") {
      const days = parseInt(rangeFilter);
      if (t < Date.now() - days*86400*1000) return false;
    }
    return true;
  }), [orders, statusFilter, rangeFilter, dateRange]);

  const setStatus = async (orderId, status) => {
    try { await api.put(`/orders/${orderId}/status`, { status }); toast.success(`Pedido marcado como ${STATUS_LABEL[status].toLowerCase()}`); await load(); }
    catch { toast.error("Error al actualizar"); }
  };

  const remove = async (o) => {
    if (!window.confirm("¿Eliminar pedido? El stock será restaurado.")) return;
    try { await api.delete(`/orders/${o.id}`); toast.success("Pedido eliminado · stock restaurado"); await load(); }
    catch { toast.error("Error al eliminar"); }
  };

  const totalAmount = filtered.reduce((a, b) => a + b.total, 0);

  return (
    <div>
      <PageHeader eyebrow="Pedidos" title="Historial y pipeline"
        subtitle="Filtra por estado y fecha. Cambia el estado de un pedido con un clic."
        actions={<Link to="/pos" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-sm text-sm font-medium text-white" style={{ background: "var(--m-terracotta)" }}>Nueva compra <ArrowUpRight className="w-4 h-4" /></Link>} />
      <div className="px-8 lg:px-12 py-8 space-y-6">
        <div className="flex flex-wrap items-center gap-5 justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <span className="eyebrow">Estado:</span>
            {[{k:"all",label:"Todos"},{k:"pendiente",label:"Pendientes"},{k:"en_proceso",label:"En proceso"},{k:"entregado",label:"Entregados"}].map(s => (
              <button key={s.k} onClick={() => setStatusFilter(s.k)} className="px-3 py-1.5 text-xs rounded-sm border"
                style={{ borderColor: statusFilter===s.k?"var(--m-terracotta)":"var(--m-border)", color: statusFilter===s.k?"var(--m-terracotta)":"var(--m-ink-2)", background: statusFilter===s.k?"#FFF":"transparent" }}>
                {s.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="eyebrow">Rango:</span>
            {[{k:"all",label:"Todo"},{k:"7",label:"7d"},{k:"30",label:"30d"},{k:"90",label:"90d"}].map(s => (
              <button key={s.k} onClick={() => setRangeFilter(s.k)} className="px-3 py-1.5 text-xs rounded-sm border"
                style={{ borderColor: rangeFilter===s.k?"var(--m-terracotta)":"var(--m-border)", color: rangeFilter===s.k?"var(--m-terracotta)":"var(--m-ink-2)", background: rangeFilter===s.k?"#FFF":"transparent" }}>
                {s.label}
              </button>
            ))}
            <Popover>
              <PopoverTrigger asChild>
                <button onClick={() => setRangeFilter("custom")}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-sm border"
                  style={{ borderColor: rangeFilter==="custom"?"var(--m-terracotta)":"var(--m-border)", color: rangeFilter==="custom"?"var(--m-terracotta)":"var(--m-ink-2)", background: rangeFilter==="custom"?"#FFF":"transparent" }}>
                  <CalendarIcon className="w-3.5 h-3.5" />
                  {rangeFilter==="custom" && (dateRange.from||dateRange.to) ?
                    `${dateRange.from?formatDate(dateRange.from):"…"} → ${dateRange.to?formatDate(dateRange.to):"…"}` : "Personalizado"}
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-auto p-0 bg-white" style={{ border: "1px solid var(--m-border)", borderRadius: 4 }}>
                <Calendar mode="range" selected={dateRange}
                  onSelect={r => { setRangeFilter("custom"); setDateRange(r || { from: undefined, to: undefined }); }}
                  numberOfMonths={2} initialFocus />
                <div className="flex items-center justify-between p-3" style={{ borderTop: "1px solid var(--m-border)" }}>
                  <span className="text-xs" style={{ color: "var(--m-ink-2)" }}>
                    {dateRange.from && !dateRange.to ? "Selecciona fecha final" :
                     dateRange.from && dateRange.to ? `${formatDate(dateRange.from)} → ${formatDate(dateRange.to)}` : "Selecciona un rango"}
                  </span>
                  <button onClick={() => { setDateRange({from:undefined,to:undefined}); setRangeFilter("all"); }}
                    className="inline-flex items-center gap-1 text-xs" style={{ color: "var(--m-danger)" }}>
                    <X className="w-3 h-3" /> Limpiar
                  </button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
        <div className="flex items-baseline gap-8 pb-4" style={{ borderBottom: "1px solid var(--m-border)" }}>
          <div><div className="eyebrow">Pedidos mostrados</div><div className="font-mono text-2xl mt-1">{filtered.length}</div></div>
          <div><div className="eyebrow">Volumen</div><div className="font-mono text-2xl mt-1">{formatCRC(totalAmount)}</div></div>
        </div>
        <div className="card-base overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr style={{ borderBottom: "1px solid var(--m-border)" }}>
              <th className="w-8 py-4 px-2"></th>
              <th className="eyebrow py-4 px-4 text-left">Fecha</th>
              <th className="eyebrow py-4 px-4 text-left">Cliente</th>
              <th className="eyebrow py-4 px-4 text-left">Artículos</th>
              <th className="eyebrow py-4 px-4 text-left">Estado</th>
              <th className="eyebrow py-4 px-4 text-right">Total</th>
              <th className="py-4 px-4 w-10"></th>
            </tr></thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="py-16 text-center text-sm" style={{ color: "var(--m-ink-2)" }}>
                  {orders.length === 0 ? "Aún sin pedidos registrados." : "Sin resultados con los filtros actuales."}
                </td></tr>
              ) : filtered.map(o => {
                const isOpen = expanded[o.id];
                const itemsCount = o.items.reduce((a, b) => a + b.quantity, 0);
                return (
                  <Fragment key={o.id}>
                    <tr style={{ borderBottom: "1px solid var(--m-border)" }}>
                      <td className="py-3.5 px-2 align-top">
                        <button onClick={() => setExpanded(e => ({...e, [o.id]: !e[o.id]}))} className="p-1">
                          {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </button>
                      </td>
                      <td className="py-3.5 px-4 text-xs" style={{ color: "var(--m-ink-2)" }}>{formatDateTime(o.created_at)}</td>
                      <td className="py-3.5 px-4"><Link to={`/clientes/${o.client_id}`} className="font-medium hover:underline">{o.client_name}</Link></td>
                      <td className="py-3.5 px-4 mono">{itemsCount}</td>
                      <td className="py-3.5 px-4">
                        <select value={o.status} onChange={e => setStatus(o.id, e.target.value)}
                          className="text-xs border rounded-sm px-2 py-1 bg-transparent" style={{ borderColor: "var(--m-border)" }}>
                          <option value="pendiente">Pendiente</option>
                          <option value="en_proceso">En proceso</option>
                          <option value="entregado">Entregado</option>
                        </select>
                      </td>
                      <td className="py-3.5 px-4 text-right mono">{formatCRC(o.total)}</td>
                      <td className="py-3.5 px-4">
                        <button onClick={() => remove(o)} className="p-1.5 rounded-sm" style={{ color: "var(--m-danger)" }}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr style={{ background: "var(--m-sidebar)" }}>
                        <td colSpan={7} className="py-4 px-8">
                          <div className="flex items-center gap-2 mb-2">
                            <StatusBadge status={o.status} />
                            {o.notes && <span className="text-xs" style={{ color: "var(--m-ink-2)" }}>· {o.notes}</span>}
                          </div>
                          <table className="w-full text-xs"><tbody>
                            {o.items.map(it => (
                              <tr key={it.product_id}>
                                <td className="py-1">{it.product_name}</td>
                                <td className="py-1 mono" style={{ color: "var(--m-ink-2)" }}>× {it.quantity}</td>
                                <td className="py-1 mono" style={{ color: "var(--m-ink-2)" }}>{formatCRC(it.unit_price)} c/u</td>
                                <td className="py-1 mono text-right">{formatCRC(it.subtotal)}</td>
                              </tr>
                            ))}
                          </tbody></table>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
