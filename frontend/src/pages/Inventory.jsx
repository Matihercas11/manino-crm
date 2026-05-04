import { useEffect, useState } from "react";
import { api, formatCRC } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import { Modal } from "@/pages/Clients";
import { toast } from "sonner";
import { Plus, Edit2, Trash2, AlertTriangle, Tag, X as XIcon, Search } from "lucide-react";

const EMPTY_PRODUCT = { name: "", category_id: "", price: 0, stock: 0, low_stock_threshold: 5, unit: "u", description: "" };

export default function Inventory() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [query, setQuery] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [productDialog, setProductDialog] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_PRODUCT);
  const [categoryDialog, setCategoryDialog] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");

  const load = async () => {
    const [p, c] = await Promise.all([api.get("/products"), api.get("/categories")]);
    setProducts(p.data); setCategories(c.data);
  };
  useEffect(() => { load(); }, []);

  const filtered = products.filter(p => {
    const q = query.toLowerCase().trim();
    if (q && !p.name.toLowerCase().includes(q) && !(p.category_name||"").toLowerCase().includes(q)) return false;
    if (catFilter !== "all" && p.category_id !== catFilter) return false;
    return true;
  });

  const openCreate = () => { setEditingId(null); setForm(EMPTY_PRODUCT); setProductDialog(true); };
  const openEdit = (p) => { setEditingId(p.id); setForm({ name: p.name, category_id: p.category_id||"", price: p.price, stock: p.stock, low_stock_threshold: p.low_stock_threshold, unit: p.unit||"u", description: p.description||"" }); setProductDialog(true); };

  const saveProduct = async () => {
    if (!form.name.trim()) { toast.error("Nombre requerido"); return; }
    const payload = { ...form, price: Number(form.price)||0, stock: Number(form.stock)||0, low_stock_threshold: Number(form.low_stock_threshold)||0, category_id: form.category_id||null };
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

  const lowStockCount = products.filter(p => p.stock <= (p.low_stock_threshold||0)).length;

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
      <div className="px-8 lg:px-12 py-8 space-y-6">
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
              <th className="eyebrow py-4 px-6 text-left">Producto</th><th className="eyebrow py-4 px-6 text-left">Categoría</th>
              <th className="eyebrow py-4 px-6 text-right">Precio</th><th className="eyebrow py-4 px-6 text-right">Stock</th>
              <th className="eyebrow py-4 px-6 text-right">Alerta</th><th className="py-4 px-6 w-20"></th>
            </tr></thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="py-16 text-center text-sm" style={{ color: "var(--m-ink-2)" }}>
                  {products.length === 0 ? "Aún sin productos. Agrega el primero." : "Sin resultados con los filtros actuales."}
                </td></tr>
              ) : filtered.map(p => {
                const low = p.stock <= (p.low_stock_threshold||0);
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
            <F label="Precio (₡) *"><input type="number" className="m-input mono" value={form.price} onChange={e => setForm({...form, price: e.target.value})} /></F>
            <F label="Unidad"><input placeholder="u, kg, lb, g…" className="m-input" value={form.unit} onChange={e => setForm({...form, unit: e.target.value})} /></F>
            <F label="Stock inicial"><input type="number" className="m-input mono" value={form.stock} onChange={e => setForm({...form, stock: e.target.value})} /></F>
            <F label="Alerta de stock bajo"><input type="number" className="m-input mono" value={form.low_stock_threshold} onChange={e => setForm({...form, low_stock_threshold: e.target.value})} /></F>
            <div className="md:col-span-2"><F label="Descripción"><textarea rows={2} className="m-input resize-none" value={form.description} onChange={e => setForm({...form, description: e.target.value})} /></F></div>
          </div>
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
      <style>{`.m-input{width:100%;background:transparent;border:none;border-bottom:1px solid var(--m-border);padding:6px 0;font-size:14px;outline:none;color:var(--m-ink);font-family:inherit}.m-input:focus{border-bottom-color:var(--m-terracotta)}`}</style>
    </div>
  );
}

const F = ({ label, children }) => (<div><label className="eyebrow block mb-1" style={{ fontSize: 10 }}>{label}</label>{children}</div>);
