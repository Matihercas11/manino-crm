import { useEffect, useMemo, useState } from "react";
import { api, formatCRC } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Search, Plus, Minus, Trash2, UserPlus, Coffee, Check } from "lucide-react";

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
  const [status, setStatus] = useState("pendiente");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

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
      await api.post("/orders", {
        client_id: clientId,
        items: cart.map(x => ({ product_id: x.product_id, quantity: x.quantity })),
        status, notes,
      });
      toast.success("Compra registrada · inventario actualizado");
      setCart([]); setNotes(""); await load(); navigate("/pedidos");
    } catch (e) { toast.error(e.response?.data?.detail || "Error al crear pedido"); }
    finally { setSubmitting(false); }
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
              <F label="Estado inicial">
                <select value={status} onChange={e => setStatus(e.target.value)} className="m-input">
                  <option value="pendiente">Pendiente</option>
                  <option value="en_proceso">En proceso</option>
                  <option value="entregado">Entregado</option>
                </select>
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
      <style>{`.m-input{width:100%;background:transparent;border:none;border-bottom:1px solid var(--m-border);padding:6px 0;font-size:14px;outline:none;font-family:inherit;color:var(--m-ink)}.m-input:focus{border-bottom-color:var(--m-terracotta)}`}</style>
    </div>
  );
}

const F = ({ label, children }) => (
  <div><label className="eyebrow block mb-1" style={{ fontSize: 10 }}>{label}</label>{children}</div>
);
