import { useEffect, useMemo, useState, Fragment } from "react";
import { api, formatCRC, formatDate, formatDateTime, STATUS_LABEL } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { ChevronDown, ChevronRight, Trash2, ArrowUpRight, Calendar as CalendarIcon, X, CheckCircle2, Circle, Printer, Download } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";

function printReceipt(order) {
  const items = order.items.map(it => `
    <tr>
      <td style="padding:6px 4px">${it.product_name}</td>
      <td style="padding:6px 4px;text-align:center">${it.quantity}</td>
      <td style="padding:6px 4px;text-align:right">${formatCRC(it.unit_price)}</td>
      <td style="padding:6px 4px;text-align:right;font-weight:600">${formatCRC(it.subtotal)}</td>
    </tr>`).join("");

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Recibo · ${order.client_name}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Courier New',monospace;max-width:420px;margin:0 auto;padding:32px 24px;color:#2C2420}
    .logo{text-align:center;margin-bottom:20px}
    .logo h1{font-size:22px;letter-spacing:2px;font-weight:700}
    .logo p{font-size:10px;letter-spacing:3px;color:#888;margin-top:2px}
    hr{border:none;border-top:2px solid #2C2420;margin:16px 0}
    hr.thin{border-top:1px dashed #ccc}
    .meta{font-size:12px;line-height:1.8;margin:12px 0}
    .meta strong{display:inline-block;width:80px}
    table{width:100%;border-collapse:collapse;font-size:12px;margin:12px 0}
    thead tr{border-bottom:1px solid #ccc}
    th{padding:6px 4px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:1px;font-weight:600}
    th:last-child,th:nth-child(3),th:nth-child(2){text-align:right}
    .total-row{margin-top:8px;font-size:16px;font-weight:700;display:flex;justify-content:space-between}
    .badge{display:inline-block;padding:2px 8px;border-radius:2px;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase}
    .paid{background:#EFF6F4;color:#4A7C6F}
    .unpaid{background:#F4E9D8;color:#8A5A1F}
    .footer{text-align:center;font-size:10px;color:#888;margin-top:24px;line-height:1.8}
    .btn{display:block;width:100%;padding:12px;margin-top:24px;background:#9C4936;color:#fff;border:none;font-size:14px;font-weight:600;cursor:pointer;letter-spacing:1px}
    @media print{.btn{display:none}body{padding:16px}}
  </style>
</head>
<body>
  <div class="logo">
    <h1>MANINO</h1>
    <p>COFFEE · DEALER · CURATOR</p>
  </div>
  <hr>
  <div class="meta">
    <div><strong>Cliente:</strong> ${order.client_name}</div>
    <div><strong>Fecha:</strong> ${formatDateTime(order.created_at)}</div>
    <div><strong>Entrega:</strong> ${STATUS_LABEL[order.status]}</div>
    <div><strong>Pago:</strong> <span class="badge ${order.paid ? "paid" : "unpaid"}">${order.paid ? "Pagado" : "Pendiente"}</span></div>
    ${order.notes ? `<div><strong>Notas:</strong> ${order.notes}</div>` : ""}
  </div>
  <hr class="thin">
  <table>
    <thead><tr><th>Producto</th><th style="text-align:center">Cant</th><th style="text-align:right">P/U</th><th style="text-align:right">Total</th></tr></thead>
    <tbody>${items}</tbody>
  </table>
  <hr>
  <div class="total-row"><span>TOTAL</span><span>${formatCRC(order.total)}</span></div>
  <hr class="thin" style="margin-top:16px">
  <div class="footer">
    Gracias por su preferencia<br>
    Manino Coffee · v1.0
  </div>
  <button class="btn" onclick="window.print()">Imprimir / Guardar PDF</button>
</body>
</html>`;

  const win = window.open("", "_blank", "width=520,height=720");
  if (win) { win.document.write(html); win.document.close(); }
}

function exportCSV(orders) {
  const headers = ["Fecha", "Cliente", "Artículos", "Total (₡)", "Entrega", "Pagado"];
  const rows = orders.map(o => [
    formatDateTime(o.created_at),
    o.client_name,
    o.items.map(it => `${it.product_name} x${it.quantity}`).join(" | "),
    o.total,
    STATUS_LABEL[o.status],
    o.paid ? "Sí" : "No",
  ]);
  const csv = [headers, ...rows]
    .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `pedidos-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [paidFilter, setPaidFilter] = useState("all");
  const [rangeFilter, setRangeFilter] = useState("all");
  const [dateRange, setDateRange] = useState({ from: undefined, to: undefined });
  const [expanded, setExpanded] = useState({});

  const load = async () => { const r = await api.get("/orders"); setOrders(r.data); };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => orders.filter(o => {
    if (statusFilter !== "all" && o.status !== statusFilter) return false;
    if (paidFilter === "paid" && !o.paid) return false;
    if (paidFilter === "unpaid" && o.paid) return false;
    const t = new Date(o.created_at).getTime();
    if (rangeFilter === "custom") {
      if (dateRange.from && t < dateRange.from.setHours(0,0,0,0)) return false;
      if (dateRange.to && t > new Date(dateRange.to).setHours(23,59,59,999)) return false;
    } else if (rangeFilter !== "all") {
      const days = parseInt(rangeFilter);
      if (t < Date.now() - days*86400*1000) return false;
    }
    return true;
  }), [orders, statusFilter, paidFilter, rangeFilter, dateRange]);

  const setStatus = async (orderId, status) => {
    try { await api.put(`/orders/${orderId}/status`, { status }); toast.success(`Estado: ${STATUS_LABEL[status]}`); await load(); }
    catch { toast.error("Error al actualizar"); }
  };

  const togglePaid = async (o) => {
    try { await api.put(`/orders/${o.id}/paid`, { paid: !o.paid }); toast.success(o.paid ? "Marcado como no cobrado" : "Marcado como pagado"); await load(); }
    catch { toast.error("Error al actualizar"); }
  };

  const remove = async (o) => {
    if (!window.confirm("¿Eliminar pedido? El stock será restaurado.")) return;
    try { await api.delete(`/orders/${o.id}`); toast.success("Pedido eliminado · stock restaurado"); await load(); }
    catch { toast.error("Error al eliminar"); }
  };

  const totalAmount = filtered.reduce((a, b) => a + b.total, 0);
  const paidAmount = filtered.filter(o => o.paid).reduce((a, b) => a + b.total, 0);

  return (
    <div>
      <PageHeader eyebrow="Pedidos" title="Historial y pipeline"
        subtitle="Filtra por estado y fecha. Cambia estado de entrega, marcá como pagado o imprimí el recibo."
        actions={
          <div className="flex gap-2">
            <button onClick={() => exportCSV(filtered)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-sm text-sm border"
              style={{ borderColor: "var(--m-border)" }}>
              <Download className="w-4 h-4" /> Exportar CSV
            </button>
            <Link to="/pos" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-sm text-sm font-medium text-white"
              style={{ background: "var(--m-terracotta)" }}>
              Nueva compra <ArrowUpRight className="w-4 h-4" />
            </Link>
          </div>
        } />
      <div className="px-8 lg:px-12 py-8 space-y-6">

        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-5 justify-between">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="eyebrow">Entrega:</span>
              {[{k:"all",label:"Todos"},{k:"pendiente",label:"Pendiente"},{k:"entregado",label:"Entregado"}].map(s => (
                <button key={s.k} onClick={() => setStatusFilter(s.k)} className="px-3 py-1.5 text-xs rounded-sm border"
                  style={{ borderColor: statusFilter===s.k?"var(--m-terracotta)":"var(--m-border)", color: statusFilter===s.k?"var(--m-terracotta)":"var(--m-ink-2)", background: statusFilter===s.k?"#FFF":"transparent" }}>
                  {s.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="eyebrow">Cobro:</span>
              {[{k:"all",label:"Todos"},{k:"paid",label:"Pagados"},{k:"unpaid",label:"No cobrados"}].map(s => (
                <button key={s.k} onClick={() => setPaidFilter(s.k)} className="px-3 py-1.5 text-xs rounded-sm border"
                  style={{ borderColor: paidFilter===s.k?"#4A7C6F":"var(--m-border)", color: paidFilter===s.k?"#4A7C6F":"var(--m-ink-2)", background: paidFilter===s.k?"#EFF6F4":"transparent" }}>
                  {s.label}
                </button>
              ))}
            </div>
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

        {/* Resumen */}
        <div className="flex items-baseline gap-8 pb-4" style={{ borderBottom: "1px solid var(--m-border)" }}>
          <div><div className="eyebrow">Pedidos</div><div className="font-mono text-2xl mt-1">{filtered.length}</div></div>
          <div><div className="eyebrow">Volumen total</div><div className="font-mono text-2xl mt-1">{formatCRC(totalAmount)}</div></div>
          <div><div className="eyebrow">Cobrado</div><div className="font-mono text-2xl mt-1" style={{ color: "#4A7C6F" }}>{formatCRC(paidAmount)}</div></div>
          <div><div className="eyebrow">Por cobrar</div><div className="font-mono text-2xl mt-1" style={{ color: "var(--m-warning)" }}>{formatCRC(totalAmount - paidAmount)}</div></div>
        </div>

        {/* Tabla */}
        <div className="card-base overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr style={{ borderBottom: "1px solid var(--m-border)" }}>
              <th className="w-8 py-4 px-2"></th>
              <th className="eyebrow py-4 px-4 text-left">Fecha</th>
              <th className="eyebrow py-4 px-4 text-left">Cliente</th>
              <th className="eyebrow py-4 px-4 text-left">Art.</th>
              <th className="eyebrow py-4 px-4 text-left">Entrega</th>
              <th className="eyebrow py-4 px-4 text-left">Cobro</th>
              <th className="eyebrow py-4 px-4 text-right">Total</th>
              <th className="py-4 px-4 w-20"></th>
            </tr></thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="py-16 text-center text-sm" style={{ color: "var(--m-ink-2)" }}>
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
                        <select value={o.status === "en_proceso" ? "pendiente" : o.status} onChange={e => setStatus(o.id, e.target.value)}
                          className="text-xs border rounded-sm px-2 py-1 bg-transparent" style={{ borderColor: "var(--m-border)" }}>
                          <option value="pendiente">Pendiente</option>
                          <option value="entregado">Entregado</option>
                        </select>
                      </td>
                      <td className="py-3.5 px-4">
                        <button onClick={() => togglePaid(o)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-sm font-medium"
                          style={o.paid ? { background: "#EFF6F4", color: "#4A7C6F" } : { background: "#F4E9D8", color: "#8A5A1F" }}>
                          {o.paid ? <><CheckCircle2 className="w-3.5 h-3.5" /> Pagado</> : <><Circle className="w-3.5 h-3.5" /> Cobrar</>}
                        </button>
                      </td>
                      <td className="py-3.5 px-4 text-right mono">{formatCRC(o.total)}</td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1">
                          <button onClick={() => printReceipt(o)} className="p-1.5 rounded-sm hover:bg-[color:var(--m-sidebar)]"
                            title="Imprimir recibo">
                            <Printer className="w-3.5 h-3.5" style={{ color: "var(--m-ink-2)" }} />
                          </button>
                          <button onClick={() => remove(o)} className="p-1.5 rounded-sm" style={{ color: "var(--m-danger)" }}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr style={{ background: "var(--m-sidebar)" }}>
                        <td colSpan={8} className="py-4 px-8">
                          <div className="flex items-center gap-2 mb-2">
                            <StatusBadge status={o.status} />
                            {o.paid && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] rounded-sm font-medium"
                                style={{ background: "#EFF6F4", color: "#4A7C6F" }}>
                                <CheckCircle2 className="w-3 h-3" /> Pagado
                              </span>
                            )}
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
