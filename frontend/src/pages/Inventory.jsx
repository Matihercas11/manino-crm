import { useEffect, useMemo, useState } from "react";
import { api, formatCRC, formatDate } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import { Modal } from "@/pages/Clients";
import { toast } from "sonner";
import { Plus, Edit2, Trash2, AlertTriangle, Tag, X as XIcon, Search, Truck, CheckCircle2, Bell, Sparkles } from "lucide-react";

const EMPTY_PRODUCT = { name: "", category_id: "", price: 0, cost: 0, stock: 0, low_stock_threshold: 5, unit: "u", description: "" };
const EMPTY_SO = {
  product_id: "",
  product_name: "",
  quantity: 1,
  supplier_id: "",
  supplier_name: "",
  order_date: new Date().toISOString().slice(0, 10),
  notes: "",
};

function UtilityBreakdown({ price, cost }) {
  const p = Number(price) || 0;
  const c = Number(cost) || 0;
  if (p <= 0 || c <= 0) return null;
  const utility = p - c;
  if (utility <= 0) return null;
  return (
    <div className="mt-4 p-3 rounded-sm" style={{ background: "var(--m-sidebar)", border: "1px solid var(--m-border)" }}>
      <div className="eyebrow mb-2" style={{ fontSize: 9 }}>Desglose de utilidad</div>
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-xs">Utilidad bruta</span>
        <span className="font-mono text-sm font-medium">{formatCRC(utility)}</span>
      </div>
      <div className="space-y-1.5">
        {[
          { label: "Salario (10%)", pct: 0.10, color: "#4A7C6F" },
          { label: "Fondos (20%)", pct: 0.20, color: "#8A9A83" },
          { label: "Reinversión (70%)", pct: 0.70, color: "#9C4936" },
        ].map(({ label, pct, color }) => (
          <div key={label} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ background: color }} />
              <span style={{ color: "var(--m-ink-2)" }}>{label}</span>
            </div>
            <span className="font-mono" style={{ color }}>{formatCRC(utility * pct)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Inventory() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [supplierOrders, setSupplierOrders] = useState([]);
  const [alerts, setAlerts] = useState([]);

  const [query, setQuery] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [productDialog, setProductDialog] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_PRODUCT);
  const [categoryDialog, setCategoryDialog] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");

  const [soDialog, setSoDialog] = useState(false);
  const [editingSoId, setEditingSoId] = useState(null);
  const [soForm, setSoForm] = useState(EMPTY_SO);
  const [recommendation, setRecommendation] = useState(null);

  const load = async () => {
    const [p, c, s, so, stats] = await Promise.all([
      api.get("/products"),
      api.get("/categories"),
      api.get("/suppliers"),
      api.get("/supplier-orders"),
      api.get("/dashboard/stats"),
    ]);
    setProducts(p.data); setCategories(c.data); setSuppliers(s.data); setSupplierOrders(so.data);
    setAlerts(stats.data.supplier_order_alerts || []);
  };
  useEffect(() => { load(); }, []);

  const filtered = products.filter(p => {
    const q = query.toLowerCase().trim();
    if (q && !p.name.toLowerCase().includes(q) && !(p.category_name||"").toLowerCase().includes(q)) return false;
    if (catFilter !== "all" && p.category_id !== catFilter) return false;
    return true;
  });

  const openCreate = () => { setEditingId(null); setForm(EMPTY_PRODUCT); setProductDialog(true); };
  const openEdit = (p) => {
    setEditingId(p.id);
    setForm({ name: p.name, category_id: p.category_id||"", price: p.price, cost: p.cost||0, stock: p.stock, low_stock_threshold: p.low_stock_threshold, unit: p.unit||"u", description: p.description||"" });
    setProductDialog(true);
  };

  const saveProduct = async () => {
    if (!form.name.trim()) { toast.error("Nombre requerido"); return; }
    const payload = { ...form, price: Number(form.price)||0, cost: Number(form.cost)||0, stock: Number(form.stock)||0, low_stock_threshold: Number(form.low_stock_threshold)||0, category_id: form.category_id||null };
    try {
      if (editingId) { await api.put(`/products/${editingId}`, payload); toast.success("Producto actualizado"); }
      else { await api.post("/products", payload); toast.success("Producto creado"); }
      setProductDialog(false); await load();
    } catch { toast.error("Error al guardar"); }
  };

  const removeProduct = async (p) => {
    if (!window.confirm(`¿Eliminar ${p.name}?`)) return;
    try { await api.delete(`/products/${p.id}`); toast.success("Producto eliminado"); await load(); }
    catch { toast.error("Error al eliminar"); }
  };

  const createCategory = async () => {
    if (!newCategoryName.trim()) return;
    try { await api.post("/categories", { name: newCategoryName.trim() }); toast.success("Categoría creada"); setNewCategoryName(""); await load(); }
    catch { toast.error("Error al crear"); }
  };

  const removeCategory = async (c) => {
    if (!window.confirm(`¿Eliminar categoría "${c.name}"?`)) return;
    try { await api.delete(`/categories/${c.id}`); toast.success("Categoría eliminada"); await load(); }
    catch (e) { toast.error(e.response?.data?.detail || "Error al eliminar"); }
  };

  // ---- Pedidos a proveedores ----
  const openSoCreate = () => {
    setEditingSoId(null);
    setSoForm({ ...EMPTY_SO, order_date: new Date().toISOString().slice(0, 10) });
    setRecommendation(null);
    setSoDialog(true);
  };
  const openSoEdit = (so) => {
    setEditingSoId(so.id);
    setSoForm({
      product_id: so.product_id || "",
      product_name: so.product_name || "",
      quantity: so.quantity,
      supplier_id: so.supplier_id || "",
      supplier_name: so.supplier_name || "",
      order_date: (so.order_date || "").slice(0, 10),
      notes: so.notes || "",
    });
    setRecommendation(null);
    setSoDialog(true);
  };

  const onSelectProductForSo = async (productId) => {
    const prod = products.find(p => p.id === productId);
    setSoForm(f => ({ ...f, product_id: productId, product_name: prod ? prod.name : f.product_name }));
    if (productId) {
      try {
        const r = await api.get(`/supplier-orders/recommendation?product_id=${productId}&coverage_days=14`);
        setRecommendation(r.data);
      } catch { setRecommendation(null); }
    } else { setRecommendation(null); }
  };

  const onSelectSupplierForSo = (supplierId) => {
    const sup = suppliers.find(s => s.id === supplierId);
    setSoForm(f => ({ ...f, supplier_id: supplierId, supplier_name: sup ? sup.name : f.supplier_name }));
  };

  const saveSo = async () => {
    if (!soForm.product_name.trim()) { toast.error("Producto requerido"); return; }
    if (Number(soForm.quantity) <= 0) { toast.error("Cantidad inválida"); return; }
    if (!soForm.order_date) { toast.error("Fecha requerida"); return; }
    const payload = {
      product_id: soForm.product_id || null,
      product_name: soForm.product_name.trim(),
      quantity: Number(soForm.quantity),
      supplier_id: soForm.supplier_id || null,
      supplier_name: soForm.supplier_name || "",
      order_date: soForm.order_date,
      status: "pendiente",
      notes: soForm.notes || "",
    };
    try {
      if (editingSoId) await api.put(`/supplier-orders/${editingSoId}`, payload);
      else await api.post("/supplier-orders", payload);
      toast.success(editingSoId ? "Pedido actualizado" : "Pedido registrado");
      setSoDialog(false); await load();
    } catch (e) { toast.error(e.response?.data?.detail || "Error al guardar"); }
  };

  const completeSo = async (so) => {
    try {
      await api.put(`/supplier-orders/${so.id}/status`, { status: "completado" });
      toast.success("Pedido marcado como completado");
      await load();
    } catch { toast.error("Error al actualizar"); }
  };

  const removeSo = async (so) => {
    if (!window.confirm(`¿Eliminar pedido a ${so.supplier_name || "proveedor"}?`)) return;
    try { await api.delete(`/supplier-orders/${so.id}`); toast.success("Pedido eliminado"); await load(); }
    catch { toast.error("Error al eliminar"); }
  };

  const useRecommended = () => {
    if (recommendation) setSoForm(f => ({ ...f, quantity: recommendation.recommended_qty }));
  };

  const lowStockCount = products.filter(p => p.stock <= (p.low_stock_threshold||0)).length;
  const pendingSos = useMemo(() => supplierOrders.filter(s => s.status === "pendiente"), [supplierOrders]);
  const completedSos = useMemo(() => supplierOrders.filter(s => s.status === "completado"), [supplierOrders]);

  return (
    <div>
      <PageHeader eyebrow="Catálogo" title="Inventario"
        subtitle={`${products.length} productos en ${categories.length} categorías${lowStockCount > 0 ? ` · ${lowStockCount} con stock bajo` : ""}`}
        actions={
          <div className="flex items-center gap-2">
            <button onClick={() => setCategoryDialog(true)} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-sm text-sm border" style={{ borderColor: "var(--m-border)" }}><Tag className="w-4 h-4" /> Categorías</button>
            <button onClick={openCreate} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-sm text-sm text-white" style={{ background: "var(--m-terracotta)" }}><Plus className="w-4 h-4" /> Nuevo producto</button>
          </div>
        } />
      <div className="px-8 lg:px-12 py-8 space-y-8">

        {/* Banner de alertas: pedidos próximos a vencer */}
        {alerts.length > 0 && (
          <div className="rounded-sm border p-5" style={{ borderColor: "#9C4936", background: "#FDF4F0" }}>
            <div className="flex items-center gap-2 mb-3">
              <Bell className="w-5 h-5" style={{ color: "#9C4936" }} />
              <span className="font-medium text-sm" style={{ color: "#9C4936" }}>
                {alerts.length} pedido{alerts.length > 1 ? "s" : ""} a proveedor próximo{alerts.length > 1 ? "s" : ""} (24h o menos)
              </span>
            </div>
            <ul className="divide-y" style={{ borderColor: "#F0D5CC" }}>
              {alerts.map(a => (
                <li key={a.id} className="py-2.5 flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium" style={{ color: "#6B2D20" }}>
                      {a.product_name}
                      {a.supplier_name && <span className="font-normal ml-1.5" style={{ color: "#9C4936" }}>· {a.supplier_name}</span>}
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: "#9C4936" }}>
                      {a.hours_until <= 0
                        ? `Vencido hace ${Math.abs(a.hours_until).toFixed(1)}h · ${formatDate(a.order_date)}`
                        : `Faltan ${a.hours_until.toFixed(1)}h · ${formatDate(a.order_date)}`}
                      {" · "}stock actual {a.current_stock}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-sm font-medium"
                      style={{ background: "#FFE8DE", color: "#6B2D20" }}>
                      <Sparkles className="w-3 h-3" />
                      Pedir <span className="font-mono">{a.recommended_qty}</span>
                    </div>
                    <div className="text-[10px] mt-0.5" style={{ color: "#9C4936" }}>
                      vel. {a.avg_daily_sales}/día
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Productos */}
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 flex-1 min-w-[240px] border-b pb-1" style={{ borderColor: "var(--m-border)" }}>
              <Search className="w-4 h-4" style={{ color: "var(--m-muted)" }} />
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar producto…" className="w-full bg-transparent outline-none text-sm py-1" />
            </div>
            <div className="flex flex-wrap items-center gap-1">
              <button onClick={() => setCatFilter("all")} className="px-3 py-1.5 text-xs rounded-sm border"
                style={{ borderColor: catFilter==="all"?"var(--m-terracotta)":"var(--m-border)", color: catFilter==="all"?"var(--m-terracotta)":"var(--m-ink-2)", background: catFilter==="all"?"#FFF":"transparent" }}>Todas</button>
              {categories.map(c => (
                <button key={c.id} onClick={() => setCatFilter(c.id)} className="px-3 py-1.5 text-xs rounded-sm border"
                  style={{ borderColor: catFilter===c.id?"var(--m-terracotta)":"var(--m-border)", color: catFilter===c.id?"var(--m-terracotta)":"var(--m-ink-2)", background: catFilter===c.id?"#FFF":"transparent" }}>
                  {c.name}
                </button>
              ))}
            </div>
          </div>
          <div className="card-base overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr style={{ borderBottom: "1px solid var(--m-border)" }}>
                <th className="eyebrow py-4 px-6 text-left">Producto</th>
                <th className="eyebrow py-4 px-6 text-left">Categoría</th>
                <th className="eyebrow py-4 px-6 text-right">Precio</th>
                <th className="eyebrow py-4 px-6 text-right">Costo</th>
                <th className="eyebrow py-4 px-6 text-right">Utilidad</th>
                <th className="eyebrow py-4 px-6 text-right">Stock</th>
                <th className="eyebrow py-4 px-6 text-right">Alerta</th>
                <th className="py-4 px-6 w-20"></th>
              </tr></thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={8} className="py-16 text-center text-sm" style={{ color: "var(--m-ink-2)" }}>
                    {products.length === 0 ? "Aún sin productos. Agrega el primero." : "Sin resultados con los filtros actuales."}
                  </td></tr>
                ) : filtered.map(p => {
                  const low = p.stock <= (p.low_stock_threshold||0);
                  const cost = p.cost || 0;
                  const utility = cost > 0 ? p.price - cost : null;
                  return (
                    <tr key={p.id} style={{ borderBottom: "1px solid var(--m-border)" }}>
                      <td className="py-3.5 px-6">
                        <div className="font-medium flex items-center gap-2">
                          {p.name}{low && <AlertTriangle className="w-3.5 h-3.5" style={{ color: "var(--m-warning)" }} />}
                        </div>
                        {p.description && <div className="text-xs mt-0.5" style={{ color: "var(--m-ink-2)" }}>{p.description}</div>}
                      </td>
                      <td className="py-3.5 px-6 text-sm" style={{ color: "var(--m-ink-2)" }}>{p.category_name || "—"}</td>
                      <td className="py-3.5 px-6 mono text-right">{formatCRC(p.price)}</td>
                      <td className="py-3.5 px-6 mono text-right" style={{ color: "var(--m-ink-2)" }}>{cost > 0 ? formatCRC(cost) : "—"}</td>
                      <td className="py-3.5 px-6 mono text-right"
                        style={{ color: utility !== null ? (utility > 0 ? "#4A7C6F" : "var(--m-danger)") : "var(--m-muted)" }}>
                        {utility !== null ? formatCRC(utility) : "—"}
                      </td>
                      <td className="py-3.5 px-6 mono text-right" style={{ color: low ? "var(--m-warning)" : "inherit" }}>{p.stock} {p.unit}</td>
                      <td className="py-3.5 px-6 mono text-right" style={{ color: "var(--m-muted)" }}>{p.low_stock_threshold}</td>
                      <td className="py-3.5 px-6">
                        <div className="flex items-center gap-2 justify-end">
                          <button onClick={() => openEdit(p)} className="p-1.5 hover:bg-[color:var(--m-sidebar)] rounded-sm"><Edit2 className="w-3.5 h-3.5" /></button>
                          <button onClick={() => removeProduct(p)} className="p-1.5 rounded-sm" style={{ color: "var(--m-danger)" }}><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pedidos a proveedores */}
        <div>
          <div className="flex items-end justify-between mb-4">
            <div>
              <div className="eyebrow">Subsección</div>
              <h2 className="font-serif text-2xl mt-1">Pedidos a proveedores</h2>
              <p className="text-xs mt-1" style={{ color: "var(--m-ink-2)" }}>
                Registrá los pedidos que vas a hacerle a tus proveedores. 24h antes se mostrará una alerta con la cantidad recomendada según ventas históricas.
              </p>
            </div>
            <button onClick={openSoCreate}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-sm text-sm text-white"
              style={{ background: "var(--m-terracotta)" }}>
              <Plus className="w-4 h-4" /> Nuevo pedido a proveedor
            </button>
          </div>

          <div className="card-base overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr style={{ borderBottom: "1px solid var(--m-border)" }}>
                <th className="eyebrow py-4 px-6 text-left">Fecha</th>
                <th className="eyebrow py-4 px-6 text-left">Producto</th>
                <th className="eyebrow py-4 px-6 text-left">Proveedor</th>
                <th className="eyebrow py-4 px-6 text-right">Cantidad</th>
                <th className="eyebrow py-4 px-6 text-left">Estado</th>
                <th className="py-4 px-6 w-32"></th>
              </tr></thead>
              <tbody>
                {supplierOrders.length === 0 ? (
                  <tr><td colSpan={6} className="py-16 text-center text-sm" style={{ color: "var(--m-ink-2)" }}>
                    <Truck className="w-6 h-6 mx-auto mb-2 opacity-40" />
                    Aún no hay pedidos a proveedores registrados.
                  </td></tr>
                ) : (
                  <>
                    {pendingSos.map(so => (
                      <tr key={so.id} style={{ borderBottom: "1px solid var(--m-border)" }}>
                        <td className="py-3.5 px-6 text-xs" style={{ color: "var(--m-ink-2)" }}>{formatDate(so.order_date)}</td>
                        <td className="py-3.5 px-6">
                          <div className="font-medium">{so.product_name}</div>
                          {so.notes && <div className="text-xs mt-0.5" style={{ color: "var(--m-ink-2)" }}>{so.notes}</div>}
                        </td>
                        <td className="py-3.5 px-6 text-sm" style={{ color: "var(--m-ink-2)" }}>{so.supplier_name || "—"}</td>
                        <td className="py-3.5 px-6 mono text-right">{so.quantity}</td>
                        <td className="py-3.5 px-6">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] rounded-sm font-medium"
                            style={{ background: "#F4E9D8", color: "#8A5A1F" }}>Pendiente</span>
                        </td>
                        <td className="py-3.5 px-6">
                          <div className="flex items-center gap-1 justify-end">
                            <button onClick={() => completeSo(so)} className="p-1.5 rounded-sm hover:bg-[color:var(--m-sidebar)]" title="Marcar completado">
                              <CheckCircle2 className="w-3.5 h-3.5" style={{ color: "#4A7C6F" }} />
                            </button>
                            <button onClick={() => openSoEdit(so)} className="p-1.5 rounded-sm hover:bg-[color:var(--m-sidebar)]">
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => removeSo(so)} className="p-1.5 rounded-sm" style={{ color: "var(--m-danger)" }}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {completedSos.map(so => (
                      <tr key={so.id} style={{ borderBottom: "1px solid var(--m-border)", opacity: 0.6 }}>
                        <td className="py-3.5 px-6 text-xs" style={{ color: "var(--m-ink-2)" }}>{formatDate(so.order_date)}</td>
                        <td className="py-3.5 px-6">{so.product_name}</td>
                        <td className="py-3.5 px-6 text-sm" style={{ color: "var(--m-ink-2)" }}>{so.supplier_name || "—"}</td>
                        <td className="py-3.5 px-6 mono text-right">{so.quantity}</td>
                        <td className="py-3.5 px-6">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] rounded-sm font-medium"
                            style={{ background: "#EFF6F4", color: "#4A7C6F" }}>Completado</span>
                        </td>
                        <td className="py-3.5 px-6">
                          <button onClick={() => removeSo(so)} className="p-1.5 rounded-sm ml-auto block" style={{ color: "var(--m-danger)" }}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {productDialog && (
        <Modal title={editingId ? "Editar producto" : "Nuevo producto"} onClose={() => setProductDialog(false)}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <F label="Nombre *"><input className="m-input" value={form.name} onChange={e => setForm({...form, name: e.target.value})} /></F>
            <F label="Categoría">
              <select className="m-input" value={form.category_id} onChange={e => setForm({...form, category_id: e.target.value})}>
                <option value="">Sin categoría</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </F>
            <F label="Precio de venta (₡) *"><input type="number" className="m-input mono" value={form.price} onChange={e => setForm({...form, price: e.target.value})} /></F>
            <F label="Costo (₡)"><input type="number" className="m-input mono" value={form.cost} onChange={e => setForm({...form, cost: e.target.value})} /></F>
            <F label="Unidad"><input placeholder="u, kg, lb, g…" className="m-input" value={form.unit} onChange={e => setForm({...form, unit: e.target.value})} /></F>
            <F label="Stock inicial"><input type="number" className="m-input mono" value={form.stock} onChange={e => setForm({...form, stock: e.target.value})} /></F>
            <F label="Alerta de stock bajo"><input type="number" className="m-input mono" value={form.low_stock_threshold} onChange={e => setForm({...form, low_stock_threshold: e.target.value})} /></F>
            <div className="md:col-span-2"><F label="Descripción"><textarea rows={2} className="m-input resize-none" value={form.description} onChange={e => setForm({...form, description: e.target.value})} /></F></div>
          </div>
          <UtilityBreakdown price={form.price} cost={form.cost} />
          <div className="mt-6 flex justify-end gap-2">
            <button onClick={() => setProductDialog(false)} className="px-5 py-2 rounded-sm text-sm border" style={{ borderColor: "var(--m-border)" }}>Cancelar</button>
            <button onClick={saveProduct} className="px-5 py-2 rounded-sm text-sm text-white" style={{ background: "var(--m-terracotta)" }}>Guardar</button>
          </div>
        </Modal>
      )}

      {categoryDialog && (
        <Modal title="Categorías" onClose={() => setCategoryDialog(false)}>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <input value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} placeholder="Nueva categoría (p. ej. Merch, Brew bar)" className="m-input flex-1" />
              <button onClick={createCategory} className="px-4 py-2 rounded-sm text-sm text-white" style={{ background: "var(--m-terracotta)" }}>Agregar</button>
            </div>
            <ul className="divide-y" style={{ borderColor: "var(--m-border)" }}>
              {categories.map(c => (
                <li key={c.id} className="py-3 flex items-center justify-between">
                  <span className="text-sm">{c.name}</span>
                  <button onClick={() => removeCategory(c)} className="p-1.5 rounded-sm" style={{ color: "var(--m-danger)" }}><XIcon className="w-3.5 h-3.5" /></button>
                </li>
              ))}
              {categories.length === 0 && <li className="py-4 text-sm" style={{ color: "var(--m-ink-2)" }}>Aún no hay categorías.</li>}
            </ul>
          </div>
        </Modal>
      )}

      {soDialog && (
        <Modal title={editingSoId ? "Editar pedido a proveedor" : "Nuevo pedido a proveedor"} onClose={() => setSoDialog(false)}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <F label="Producto del catálogo">
              <select className="m-input" value={soForm.product_id}
                onChange={e => onSelectProductForSo(e.target.value)}>
                <option value="">— Selecciona —</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </F>
            <F label="O nombre libre (si no está en catálogo)">
              <input className="m-input" value={soForm.product_name}
                onChange={e => setSoForm({ ...soForm, product_name: e.target.value })}
                disabled={!!soForm.product_id} placeholder="Nombre del producto" />
            </F>
            <F label="Cantidad *">
              <input type="number" className="m-input mono" value={soForm.quantity}
                onChange={e => setSoForm({ ...soForm, quantity: e.target.value })} />
            </F>
            <F label="Fecha de envío del pedido *">
              <input type="date" className="m-input" value={soForm.order_date}
                onChange={e => setSoForm({ ...soForm, order_date: e.target.value })} />
            </F>
            <F label="Proveedor">
              <select className="m-input" value={soForm.supplier_id}
                onChange={e => onSelectSupplierForSo(e.target.value)}>
                <option value="">— Selecciona —</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </F>
            <F label="O nombre libre">
              <input className="m-input" value={soForm.supplier_name}
                onChange={e => setSoForm({ ...soForm, supplier_name: e.target.value })}
                disabled={!!soForm.supplier_id} placeholder="Nombre del proveedor" />
            </F>
            <div className="md:col-span-2">
              <F label="Notas">
                <textarea rows={2} className="m-input resize-none" value={soForm.notes}
                  onChange={e => setSoForm({ ...soForm, notes: e.target.value })} />
              </F>
            </div>
          </div>

          {recommendation && soForm.product_id && (
            <div className="mt-4 p-4 rounded-sm" style={{ background: "#FDF4F0", border: "1px solid #F0D5CC" }}>
              <div className="flex items-start gap-3">
                <Sparkles className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "#9C4936" }} />
                <div className="flex-1">
                  <div className="text-xs font-medium mb-1" style={{ color: "#6B2D20" }}>
                    Recomendación según ventas
                  </div>
                  <div className="text-xs space-y-0.5" style={{ color: "#9C4936" }}>
                    <div>Velocidad promedio: <span className="font-mono">{recommendation.avg_daily_sales}</span> unidades/día</div>
                    <div>Stock actual: <span className="font-mono">{recommendation.current_stock}</span></div>
                    <div>Necesidad proyectada ({recommendation.coverage_days} días): <span className="font-mono">{recommendation.projected_need}</span></div>
                    <div className="font-medium mt-1" style={{ color: "#6B2D20" }}>
                      Cantidad sugerida: <span className="font-mono">{recommendation.recommended_qty}</span>
                    </div>
                  </div>
                  <button onClick={useRecommended}
                    className="mt-2 inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-sm font-medium"
                    style={{ background: "#9C4936", color: "#fff" }}>
                    Usar cantidad sugerida
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="mt-6 flex justify-end gap-2">
            <button onClick={() => setSoDialog(false)} className="px-5 py-2 rounded-sm text-sm border" style={{ borderColor: "var(--m-border)" }}>Cancelar</button>
            <button onClick={saveSo} className="px-5 py-2 rounded-sm text-sm text-white" style={{ background: "var(--m-terracotta)" }}>Guardar</button>
          </div>
        </Modal>
      )}
      <style>{`.m-input{width:100%;background:transparent;border:none;border-bottom:1px solid var(--m-border);padding:6px 0;font-size:14px;outline:none;color:var(--m-ink);font-family:inherit}.m-input:focus{border-bottom-color:var(--m-terracotta)}.m-input:disabled{opacity:.5;cursor:not-allowed}`}</style>
    </div>
  );
}

const F = ({ label, children }) => (<div><label className="eyebrow block mb-1" style={{ fontSize: 10 }}>{label}</label>{children}</div>);
