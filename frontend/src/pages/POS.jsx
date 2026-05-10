import { useEffect, useMemo, useState } from "react";
import { api, formatCRC, formatDateTime } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Search, Plus, Minus, Trash2, UserPlus, Coffee, Check, FileText, X } from "lucide-react";

export function generateInvoicePDF(order, client) {
  const logoUrl = `${window.location.origin}/logo.png`;
  const items = order.items.map(it => `
    <tr>
      <td style="padding:10px 8px;border-bottom:1px solid #EFEBE3">${it.product_name}</td>
      <td style="padding:10px 8px;text-align:center;border-bottom:1px solid #EFEBE3;font-family:'Courier New',monospace">${it.quantity}</td>
      <td style="padding:10px 8px;text-align:right;border-bottom:1px solid #EFEBE3;font-family:'Courier New',monospace">${formatCRC(it.unit_price)}</td>
      <td style="padding:10px 8px;text-align:right;border-bottom:1px solid #EFEBE3;font-family:'Courier New',monospace;font-weight:600">${formatCRC(it.subtotal)}</td>
    </tr>`).join("");

  const clientLines = client ? [
    client.business_name,
    client.contact_name,
    client.phone,
    client.email,
    client.location,
  ].filter(Boolean) : [order.client_name];

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Factura · Manino Coffee · ${order.client_name}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Georgia',serif;color:#2C2420;max-width:800px;margin:0 auto;padding:40px;background:#fff}
    .header{display:flex;align-items:flex-start;justify-content:space-between;padding-bottom:24px;border-bottom:2px solid #2C2420;margin-bottom:32px}
    .brand{display:flex;align-items:center;gap:16px}
    .brand img{width:80px;height:80px;object-fit:contain}
    .brand-text h1{font-size:32px;font-weight:700;letter-spacing:-0.5px;line-height:1}
    .brand-text p{font-size:10px;letter-spacing:3px;color:#9C4936;margin-top:6px;text-transform:uppercase;font-family:'IBM Plex Mono',monospace}
    .doc-meta{text-align:right;font-size:12px}
    .doc-meta .label{font-size:9px;letter-spacing:2px;color:#8A8079;text-transform:uppercase;margin-bottom:4px}
    .doc-meta h2{font-size:20px;font-weight:600;margin-bottom:12px;letter-spacing:-0.3px}
    .doc-meta .date{font-family:'IBM Plex Mono',monospace;color:#5C5249;font-size:11px}
    .doc-meta .id{font-family:'IBM Plex Mono',monospace;color:#9C4936;font-size:10px;margin-top:6px}
    .section{margin:24px 0}
    .section-title{font-size:9px;letter-spacing:3px;color:#9C4936;text-transform:uppercase;margin-bottom:10px;font-family:'IBM Plex Mono',monospace}
    .client-card{padding:18px;background:#F8F4ED;border-left:3px solid #9C4936}
    .client-card .name{font-size:16px;font-weight:600;margin-bottom:6px}
    .client-card .meta{font-size:12px;color:#5C5249;line-height:1.7}
    table{width:100%;border-collapse:collapse;margin-top:8px}
    thead tr{background:#2C2420;color:#fff}
    th{padding:12px 8px;text-align:left;font-size:10px;letter-spacing:2px;text-transform:uppercase;font-family:'IBM Plex Mono',monospace;font-weight:500}
    th:nth-child(2){text-align:center}
    th:nth-child(3),th:nth-child(4){text-align:right}
    .total-section{margin-top:24px;display:flex;justify-content:flex-end}
    .total-box{min-width:260px;padding:16px 20px;background:#9C4936;color:#fff}
    .total-box .label{font-size:9px;letter-spacing:3px;text-transform:uppercase;margin-bottom:4px;font-family:'IBM Plex Mono',monospace;opacity:0.85}
    .total-box .amount{font-size:28px;font-weight:700;font-family:'IBM Plex Mono',monospace;letter-spacing:-0.5px}
    .badges{margin-top:20px;display:flex;gap:10px;flex-wrap:wrap}
    .badge{display:inline-block;padding:6px 14px;font-size:10px;font-weight:600;letter-spacing:2px;text-transform:uppercase;font-family:'IBM Plex Mono',monospace}
    .b-entregado{background:#E8DBD6;color:#6B2D20}
    .b-pendiente{background:#F4E9D8;color:#8A5A1F}
    .b-pagado{background:#EFF6F4;color:#4A7C6F}
    .b-cobrar{background:#F4E9D8;color:#8A5A1F}
    .footer{margin-top:60px;padding-top:24px;border-top:1px solid #EFEBE3;text-align:center}
    .footer .pay{font-size:13px;font-weight:600;color:#2C2420;margin-bottom:8px}
    .footer .pay strong{color:#9C4936;font-family:'IBM Plex Mono',monospace;letter-spacing:1px}
    .footer .thanks{font-size:10px;color:#8A8079;letter-spacing:2px;text-transform:uppercase;margin-top:14px;font-family:'IBM Plex Mono',monospace}
    .actions{margin-top:36px;display:flex;gap:12px;justify-content:center}
    .btn{padding:12px 24px;font-size:13px;font-weight:600;cursor:pointer;border:none;letter-spacing:1px;font-family:inherit}
    .btn-primary{background:#9C4936;color:#fff}
    .btn-secondary{background:transparent;color:#5C5249;border:1px solid #E6E2DA}
    @media print{
      body{padding:24px}
      .actions{display:none}
      .footer{margin-top:40px}
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="brand">
      <img src="${logoUrl}" alt="Manino" onerror="this.style.display='none'" />
      <div class="brand-text">
        <h1>Manino</h1>
        <p>Coffee · Dealer · Curator</p>
      </div>
    </div>
    <div class="doc-meta">
      <div class="label">Factura</div>
      <h2>Comprobante de venta</h2>
      <div class="date">${formatDateTime(order.created_at)}</div>
      <div class="id">№ ${order.id.slice(0, 8).toUpperCase()}</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Facturado a</div>
    <div class="client-card">
      <div class="name">${clientLines[0] || order.client_name}</div>
      ${clientLines.slice(1).length > 0 ? `<div class="meta">${clientLines.slice(1).join(" · ")}</div>` : ""}
    </div>
  </div>

  <div class="section">
    <div class="section-title">Detalle</div>
    <table>
      <thead>
        <tr>
          <th>Producto</th>
          <th>Cant.</th>
          <th>P/U</th>
          <th>Subtotal</th>
        </tr>
      </thead>
      <tbody>${items}</tbody>
    </table>
  </div>

  <div class="total-section">
    <div class="total-box">
      <div class="label">Total a cancelar</div>
      <div class="amount">${formatCRC(order.total)}</div>
    </div>
  </div>

  <div class="badges">
    <span class="badge ${order.status === "entregado" ? "b-entregado" : "b-pendiente"}">Entrega: ${order.status === "entregado" ? "Entregado" : "Pendiente"}</span>
    <span class="badge ${order.paid ? "b-pagado" : "b-cobrar"}">Cobro: ${order.paid ? "Pagado" : "No cobrado"}</span>
  </div>

  ${order.notes ? `<div class="section"><div class="section-title">Notas</div><p style="font-size:12px;color:#5C5249;line-height:1.6">${order.notes}</p></div>` : ""}

  <div class="footer">
    <div class="pay">Sinpe Móvil: <strong>8406-4260</strong> — Matías Hernández Castillo</div>
    <div class="thanks">Gracias por su preferencia · Manino Coffee</div>
  </div>

  <div class="actions">
    <button class="btn btn-primary" onclick="window.print()">Descargar PDF / Imprimir</button>
    <button class="btn btn-secondary" onclick="window.close()">Cerrar</button>
  </div>
</body>
</html>`;

  const win = window.open("", "_blank", "width=860,height=900");
  if (win) { win.document.write(html); win.document.close(); }
}

export default function POS() {
  const navigate = useNavigate();
  const [clients, setClients] = useState([]);
  const [products, setProducts] = useState([]);
  const [clientId, setClientId] = useState("");
  const [clientQuery, setClientQuery] = useState("");
  const [showNewClient, setShowNewClient] = useState(false);
  const [newClient, setNewClient] = useState({ business_name: "", contact_name: "", phone: "", email: "", location: "", client_type: "Particular" });
  const [productQuery, setProductQuery] = useState("");
  const [cart, setCart] = useState([]);
  const [delivery, setDelivery] = useState("pendiente"); // pendiente | entregado
  const [payment, setPayment] = useState("no_cobrado");  // pagado | no_cobrado
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [invoicePrompt, setInvoicePrompt] = useState(null); // {order, client} | null

  const load = async () => {
    const [c, p] = await Promise.all([api.get("/clients"), api.get("/products")]);
    setClients(c.data); setProducts(p.data);
  };
  useEffect(() => { load(); }, []);

  const filteredClients = useMemo(() => {
    const q = clientQuery.toLowerCase().trim();
    if (!q) return clients.slice(0, 8);
    return clients.filter(c => c.business_name.toLowerCase().includes(q) || (c.contact_name||"").toLowerCase().includes(q) || (c.phone||"").includes(q)).slice(0, 8);
  }, [clients, clientQuery]);

  const selectedClient = clients.find(c => c.id === clientId);

  const filteredProducts = useMemo(() => {
    const q = productQuery.toLowerCase().trim();
    if (!q) return products.slice(0, 12);
    return products.filter(p => p.name.toLowerCase().includes(q) || (p.category_name||"").toLowerCase().includes(q)).slice(0, 12);
  }, [products, productQuery]);

  const addToCart = (p) => {
    if (p.stock <= 0) { toast.error(`${p.name} · sin stock`); return; }
    setCart(prev => {
      const f = prev.find(x => x.product_id === p.id);
      if (f) {
        if (f.quantity + 1 > p.stock) { toast.error(`Stock máximo: ${p.stock}`); return prev; }
        return prev.map(x => x.product_id === p.id ? { ...x, quantity: x.quantity + 1 } : x);
      }
      return [...prev, { product_id: p.id, name: p.name, price: p.price, stock: p.stock, quantity: 1 }];
    });
  };

  const changeQty = (pid, delta) => {
    setCart(prev => prev.map(x => {
      if (x.product_id !== pid) return x;
      const q = x.quantity + delta;
      if (q > x.stock) { toast.error(`Stock máximo: ${x.stock}`); return x; }
      return { ...x, quantity: q };
    }).filter(x => x.quantity > 0));
  };

  const removeLine = (pid) => setCart(prev => prev.filter(x => x.product_id !== pid));
  const total = cart.reduce((a, b) => a + b.price * b.quantity, 0);

  const createClient = async () => {
    if (!newClient.business_name.trim()) { toast.error("Nombre del cliente es requerido"); return; }
    try {
      const r = await api.post("/clients", newClient);
      await load(); setClientId(r.data.id); setShowNewClient(false);
      setNewClient({ business_name: "", contact_name: "", phone: "", email: "", location: "", client_type: "Particular" });
      toast.success("Cliente creado");
    } catch { toast.error("Error al crear cliente"); }
  };

  const confirmPurchase = async () => {
    if (!clientId) { toast.error("Selecciona un cliente"); return; }
    if (cart.length === 0) { toast.error("Agrega al menos un producto"); return; }
    setSubmitting(true);
    try {
      const r = await api.post("/orders", {
        client_id: clientId,
        items: cart.map(x => ({ product_id: x.product_id, quantity: x.quantity })),
        status: delivery,
        paid: payment === "pagado",
        notes,
      });
      toast.success("Compra registrada · inventario actualizado");
      const order = r.data;
      const client = clients.find(c => c.id === clientId);
      setInvoicePrompt({ order, client });
      setCart([]); setNotes(""); await load();
    } catch (e) { toast.error(e.response?.data?.detail || "Error al crear pedido"); }
    finally { setSubmitting(false); }
  };

  const handleGenerateInvoice = () => {
    if (invoicePrompt) generateInvoicePDF(invoicePrompt.order, invoicePrompt.client);
    setInvoicePrompt(null);
    navigate("/pedidos");
  };

  const handleSkipInvoice = () => {
    setInvoicePrompt(null);
    navigate("/pedidos");
  };

  return (
    <div>
      <PageHeader eyebrow="Punto de venta · flujo rápido" title="Nueva compra"
        subtitle="Selecciona cliente, agrega productos y confirma. El inventario se actualiza automáticamente." />
      <div className="px-8 lg:px-12 py-10 grid grid-cols-1 lg:grid-cols-12 gap-8">
        <section className="lg:col-span-8 space-y-8">
          <div className="card-base p-6">
            <div className="flex items-center justify-between mb-4">
              <div><div className="eyebrow">Paso 1</div><h3 className="font-serif text-2xl mt-1">Cliente</h3></div>
              <button onClick={() => setShowNewClient(s => !s)}
                className="inline-flex items-center gap-2 text-sm px-3 py-2 rounded-sm border" style={{ borderColor: "var(--m-border)" }}>
                <UserPlus className="w-4 h-4" />{showNewClient ? "Cancelar" : "Nuevo cliente"}
              </button>
            </div>
            {!showNewClient && (selectedClient ? (
              <div className="flex items-center justify-between p-4 rounded-sm" style={{ background: "var(--m-sidebar)" }}>
                <div>
                  <div className="font-medium">{selectedClient.business_name}</div>
                  <div className="text-xs" style={{ color: "var(--m-ink-2)" }}>
                    {selectedClient.client_type}{selectedClient.phone ? ` · ${selectedClient.phone}` : ""}{selectedClient.location ? ` · ${selectedClient.location}` : ""}
                  </div>
                </div>
                <button onClick={() => setClientId("")} className="text-xs underline" style={{ color: "var(--m-ink-2)" }}>cambiar</button>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-2 border-b pb-2" style={{ borderColor: "var(--m-border)" }}>
                  <Search className="w-4 h-4" style={{ color: "var(--m-muted)" }} />
                  <input value={clientQuery} onChange={e => setClientQuery(e.target.value)}
                    placeholder="Buscar por nombre, contacto o teléfono…"
                    className="w-full bg-transparent outline-none text-sm py-1" />
                </div>
                <div className="mt-3 max-h-64 overflow-y-auto divide-y" style={{ borderColor: "var(--m-border)" }}>
                  {filteredClients.length === 0 ? (
                    <div className="p-6 text-center text-sm" style={{ color: "var(--m-ink-2)" }}>Sin resultados. Crea un nuevo cliente.</div>
                  ) : filteredClients.map(c => (
                    <button key={c.id} onClick={() => setClientId(c.id)}
                      className="w-full text-left py-3 hover:bg-[color:var(--m-sidebar)] px-2">
                      <div className="font-medium text-sm">{c.business_name}</div>
                      <div className="text-xs" style={{ color: "var(--m-ink-2)" }}>
                        {c.client_type}{c.contact_name ? ` · ${c.contact_name}` : ""}{c.phone ? ` · ${c.phone}` : ""}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {showNewClient && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <F label="Nombre del negocio / persona *"><input className="m-input" value={newClient.business_name}
                  onChange={e => setNewClient({...newClient, business_name: e.target.value})} /></F>
                <F label="Tipo"><select className="m-input" value={newClient.client_type}
                  onChange={e => setNewClient({...newClient, client_type: e.target.value})}><option>Particular</option><option>Empresa</option></select></F>
                <F label="Contacto"><input className="m-input" value={newClient.contact_name}
                  onChange={e => setNewClient({...newClient, contact_name: e.target.value})} /></F>
                <F label="Teléfono / WhatsApp"><input className="m-input" value={newClient.phone}
                  onChange={e => setNewClient({...newClient, phone: e.target.value})} /></F>
                <F label="Email"><input className="m-input" value={newClient.email}
                  onChange={e => setNewClient({...newClient, email: e.target.value})} /></F>
                <F label="Ubicación"><input className="m-input" value={newClient.location}
                  onChange={e => setNewClient({...newClient, location: e.target.value})} /></F>
                <div className="md:col-span-2 flex justify-end">
                  <button onClick={createClient} className="px-5 py-2 rounded-sm text-sm text-white" style={{ background: "var(--m-terracotta)" }}>Crear y seleccionar</button>
                </div>
              </div>
            )}
          </div>
          <div className="card-base p-6">
            <div className="flex items-baseline justify-between mb-4">
              <div><div className="eyebrow">Paso 2</div><h3 className="font-serif text-2xl mt-1">Productos</h3></div>
              <div className="flex items-center gap-2 border-b pb-1 w-full max-w-xs" style={{ borderColor: "var(--m-border)" }}>
                <Search className="w-4 h-4" style={{ color: "var(--m-muted)" }} />
                <input value={productQuery} onChange={e => setProductQuery(e.target.value)}
                  placeholder="Buscar producto o categoría…" className="w-full bg-transparent outline-none text-sm py-1" />
              </div>
            </div>
            {products.length === 0 ? (
              <div className="text-center p-12 rounded-sm" style={{ background: "var(--m-sidebar)" }}>
                <Coffee className="w-6 h-6 mx-auto" style={{ color: "var(--m-terracotta)" }} />
                <p className="mt-3 text-sm" style={{ color: "var(--m-ink-2)" }}>Sin productos. Agrega en Inventario para comenzar.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {filteredProducts.map(p => {
                  const inCart = cart.find(x => x.product_id === p.id);
                  const low = p.stock <= (p.low_stock_threshold || 0);
                  return (
                    <button key={p.id} onClick={() => addToCart(p)} disabled={p.stock <= 0}
                      className="text-left p-4 rounded-sm border hover:border-[color:var(--m-terracotta)] disabled:opacity-50"
                      style={{ borderColor: "var(--m-border)" }}>
                      <div className="eyebrow" style={{ fontSize: 9 }}>{p.category_name || "Sin categoría"}</div>
                      <div className="font-medium text-sm mt-1.5 leading-tight">{p.name}</div>
                      <div className="flex items-end justify-between mt-3">
                        <div className="font-mono text-sm">{formatCRC(p.price)}</div>
                        <div className="font-mono text-[10px]" style={{ color: low ? "var(--m-warning)" : "var(--m-muted)" }}>stock {p.stock}</div>
                      </div>
                      {inCart && <div className="mt-2 text-[10px] font-medium inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm"
                        style={{ background: "#E7ECE3", color: "#4E5B46" }}><Check className="w-3 h-3" /> {inCart.quantity} en carrito</div>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </section>
        <aside className="lg:col-span-4">
          <div className="card-base p-6 sticky top-6">
            <div className="eyebrow">Paso 3 · Carrito</div>
            <h3 className="font-serif text-2xl mt-1 mb-4">Resumen</h3>
            {cart.length === 0 ? (
              <div className="text-center p-8 rounded-sm" style={{ background: "var(--m-sidebar)" }}>
                <p className="text-sm" style={{ color: "var(--m-ink-2)" }}>Aún no has agregado productos.</p>
              </div>
            ) : (
              <ul className="divide-y" style={{ borderColor: "var(--m-border)" }}>
                {cart.map(x => (
                  <li key={x.product_id} className="py-3 flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm truncate">{x.name}</div>
                      <div className="font-mono text-xs" style={{ color: "var(--m-ink-2)" }}>{formatCRC(x.price)} × {x.quantity}</div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => changeQty(x.product_id, -1)} className="w-7 h-7 flex items-center justify-center border rounded-sm" style={{ borderColor: "var(--m-border)" }}><Minus className="w-3 h-3" /></button>
                      <span className="font-mono text-xs w-6 text-center">{x.quantity}</span>
                      <button onClick={() => changeQty(x.product_id, 1)} className="w-7 h-7 flex items-center justify-center border rounded-sm" style={{ borderColor: "var(--m-border)" }}><Plus className="w-3 h-3" /></button>
                      <button onClick={() => removeLine(x.product_id)} className="w-7 h-7 flex items-center justify-center" style={{ color: "var(--m-danger)" }}><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-5 pt-4" style={{ borderTop: "1px solid var(--m-border)" }}>
              <div className="flex items-baseline justify-between">
                <span className="eyebrow">Total</span>
                <span className="font-mono text-3xl">{formatCRC(total)}</span>
              </div>
            </div>
            <div className="mt-5 space-y-3">
              <F label="Estado de entrega">
                <div className="flex gap-2">
                  {[
                    { v: "pendiente", label: "Pendiente", color: "#D4A373" },
                    { v: "entregado", label: "Entregado", color: "#9C4936" },
                  ].map(s => (
                    <button key={s.v} onClick={() => setDelivery(s.v)}
                      className="flex-1 px-3 py-2 text-xs rounded-sm border transition-colors"
                      style={{
                        borderColor: delivery === s.v ? s.color : "var(--m-border)",
                        color: delivery === s.v ? "#fff" : "var(--m-ink-2)",
                        background: delivery === s.v ? s.color : "transparent",
                        fontWeight: delivery === s.v ? 600 : 400,
                      }}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </F>
              <F label="Estado de cobro">
                <div className="flex gap-2">
                  {[
                    { v: "no_cobrado", label: "No cobrado", bg: "#F4E9D8", fg: "#8A5A1F" },
                    { v: "pagado", label: "Pagado", bg: "#4A7C6F", fg: "#fff" },
                  ].map(s => (
                    <button key={s.v} onClick={() => setPayment(s.v)}
                      className="flex-1 px-3 py-2 text-xs rounded-sm border transition-colors"
                      style={{
                        borderColor: payment === s.v ? s.bg : "var(--m-border)",
                        color: payment === s.v ? s.fg : "var(--m-ink-2)",
                        background: payment === s.v ? s.bg : "transparent",
                        fontWeight: payment === s.v ? 600 : 400,
                      }}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </F>
              <F label="Notas (opcional)"><textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="m-input resize-none" /></F>
            </div>
            <button onClick={confirmPurchase} disabled={submitting || cart.length === 0 || !clientId}
              className="mt-5 w-full py-3 rounded-sm text-sm font-medium text-white disabled:opacity-50" style={{ background: "var(--m-terracotta)" }}>
              {submitting ? "Procesando…" : "Confirmar compra"}
            </button>
          </div>
        </aside>
      </div>

      {invoicePrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(44,36,32,0.4)" }}>
          <div className="bg-white rounded-sm max-w-md w-full p-8" style={{ border: "1px solid var(--m-border)" }}>
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 flex items-center justify-center rounded-sm flex-shrink-0" style={{ background: "var(--m-sidebar)" }}>
                <FileText className="w-5 h-5" style={{ color: "var(--m-terracotta)" }} />
              </div>
              <div className="flex-1">
                <div className="eyebrow">Compra registrada</div>
                <h3 className="font-serif text-xl mt-1">¿Generar factura?</h3>
              </div>
              <button onClick={handleSkipInvoice} className="p-1.5 rounded-sm" style={{ color: "var(--m-ink-2)" }}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm mb-6" style={{ color: "var(--m-ink-2)" }}>
              Se abrirá la factura en una pestaña nueva. Desde ahí podés descargar como PDF, imprimir o solo verla.
            </p>
            <div className="space-y-2">
              <button onClick={handleGenerateInvoice}
                className="w-full py-2.5 rounded-sm text-sm font-medium text-white" style={{ background: "var(--m-terracotta)" }}>
                Generar factura PDF
              </button>
              <button onClick={handleSkipInvoice}
                className="w-full py-2.5 rounded-sm text-sm border" style={{ borderColor: "var(--m-border)", color: "var(--m-ink-2)" }}>
                Omitir
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`.m-input{width:100%;background:transparent;border:none;border-bottom:1px solid var(--m-border);padding:6px 0;font-size:14px;outline:none;font-family:inherit;color:var(--m-ink)}.m-input:focus{border-bottom-color:var(--m-terracotta)}`}</style>
    </div>
  );
}

const F = ({ label, children }) => (
  <div><label className="eyebrow block mb-1" style={{ fontSize: 10 }}>{label}</label>{children}</div>
);
