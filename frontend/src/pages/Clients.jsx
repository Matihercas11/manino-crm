import { useEffect, useState } from "react";
import { api, formatDate } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Plus, Search, Edit2, Trash2, X } from "lucide-react";

const EMPTY = { business_name: "", contact_name: "", phone: "", email: "", location: "", client_type: "Particular", notes: "" };

export default function Clients() {
  const [clients, setClients] = useState([]);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY);

  const load = async () => { const r = await api.get("/clients"); setClients(r.data); };
  useEffect(() => { load(); }, []);

  const filtered = clients.filter(c => {
    const q = query.toLowerCase().trim();
    const matchQ = !q || c.business_name.toLowerCase().includes(q) || (c.contact_name||"").toLowerCase().includes(q) || (c.phone||"").includes(q) || (c.email||"").toLowerCase().includes(q);
    const matchT = typeFilter === "all" || c.client_type === typeFilter;
    return matchQ && matchT;
  });

  const openCreate = () => { setEditingId(null); setForm(EMPTY); setDialogOpen(true); };
  const openEdit = (c) => { setEditingId(c.id); setForm({ business_name: c.business_name||"", contact_name: c.contact_name||"", phone: c.phone||"", email: c.email||"", location: c.location||"", client_type: c.client_type||"Particular", notes: c.notes||"" }); setDialogOpen(true); };

  const save = async () => {
    if (!form.business_name.trim()) { toast.error("Nombre requerido"); return; }
    try {
      if (editingId) { await api.put(`/clients/${editingId}`, form); toast.success("Cliente actualizado"); }
      else { await api.post("/clients", form); toast.success("Cliente creado"); }
      setDialogOpen(false); await load();
    } catch { toast.error("Error al guardar"); }
  };

  const remove = async (c) => {
    if (!window.confirm(`¿Eliminar ${c.business_name}?`)) return;
    try { await api.delete(`/clients/${c.id}`); toast.success("Cliente eliminado"); await load(); }
    catch { toast.error("Error al eliminar"); }
  };

  return (
    <div>
      <PageHeader eyebrow="Directorio" title="Clientes"
        subtitle={`${clients.length} registros · Particulares y Empresas`}
        actions={
          <button onClick={openCreate} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-sm text-sm font-medium text-white" style={{ background: "var(--m-terracotta)" }}>
            <Plus className="w-4 h-4" /> Nuevo cliente
          </button>
        } />
      <div className="px-8 lg:px-12 py-8 space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-[240px] border-b pb-1" style={{ borderColor: "var(--m-border)" }}>
            <Search className="w-4 h-4" style={{ color: "var(--m-muted)" }} />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar cliente…" className="w-full bg-transparent outline-none text-sm py-1" />
          </div>
          <div className="flex items-center gap-1">
            {["all", "Particular", "Empresa"].map(t => (
              <button key={t} onClick={() => setTypeFilter(t)} className="px-3 py-1.5 text-xs rounded-sm border"
                style={{ borderColor: typeFilter===t?"var(--m-terracotta)":"var(--m-border)", color: typeFilter===t?"var(--m-terracotta)":"var(--m-ink-2)", background: typeFilter===t?"#FFF":"transparent" }}>
                {t === "all" ? "Todos" : t}
              </button>
            ))}
          </div>
        </div>
        <div className="card-base overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="text-left" style={{ borderBottom: "1px solid var(--m-border)" }}>
              <th className="eyebrow py-4 px-6">Nombre</th><th className="eyebrow py-4 px-6">Tipo</th>
              <th className="eyebrow py-4 px-6">Contacto</th><th className="eyebrow py-4 px-6">Teléfono</th>
              <th className="eyebrow py-4 px-6">Ubicación</th><th className="eyebrow py-4 px-6">Desde</th>
              <th className="py-4 px-6 w-20"></th>
            </tr></thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="py-16 text-center text-sm" style={{ color: "var(--m-ink-2)" }}>
                  {clients.length === 0 ? "Aún sin clientes. Crea el primero." : "Sin resultados para tu búsqueda."}
                </td></tr>
              ) : filtered.map(c => (
                <tr key={c.id} style={{ borderBottom: "1px solid var(--m-border)" }}>
                  <td className="py-3.5 px-6"><Link to={`/clientes/${c.id}`} className="font-medium hover:underline">{c.business_name}</Link></td>
                  <td className="py-3.5 px-6">
                    <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-sm"
                      style={{ background: c.client_type==="Empresa"?"#E8DBD6":"#E7ECE3", color: c.client_type==="Empresa"?"#6B2D20":"#4E5B46" }}>
                      {c.client_type}
                    </span>
                  </td>
                  <td className="py-3.5 px-6">{c.contact_name || "—"}</td>
                  <td className="py-3.5 px-6 mono">{c.phone || "—"}</td>
                  <td className="py-3.5 px-6">{c.location || "—"}</td>
                  <td className="py-3.5 px-6 text-xs" style={{ color: "var(--m-ink-2)" }}>{formatDate(c.created_at)}</td>
                  <td className="py-3.5 px-6">
                    <div className="flex items-center gap-2 justify-end">
                      <button onClick={() => openEdit(c)} className="p-1.5 hover:bg-[color:var(--m-sidebar)] rounded-sm"><Edit2 className="w-3.5 h-3.5" /></button>
                      <button onClick={() => remove(c)} className="p-1.5 rounded-sm" style={{ color: "var(--m-danger)" }}><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {dialogOpen && (
        <Modal title={editingId ? "Editar cliente" : "Nuevo cliente"} onClose={() => setDialogOpen(false)}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <F label="Nombre del negocio / persona *"><input className="m-input" value={form.business_name} onChange={e => setForm({...form, business_name: e.target.value})} /></F>
            <F label="Tipo"><select className="m-input" value={form.client_type} onChange={e => setForm({...form, client_type: e.target.value})}><option>Particular</option><option>Empresa</option></select></F>
            <F label="Contacto"><input className="m-input" value={form.contact_name} onChange={e => setForm({...form, contact_name: e.target.value})} /></F>
            <F label="Teléfono / WhatsApp"><input className="m-input" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} /></F>
            <F label="Email"><input className="m-input" value={form.email} onChange={e => setForm({...form, email: e.target.value})} /></F>
            <F label="Ubicación"><input className="m-input" value={form.location} onChange={e => setForm({...form, location: e.target.value})} /></F>
            <div className="md:col-span-2"><F label="Notas"><textarea rows={2} className="m-input resize-none" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} /></F></div>
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <button onClick={() => setDialogOpen(false)} className="px-5 py-2 rounded-sm text-sm border" style={{ borderColor: "var(--m-border)" }}>Cancelar</button>
            <button onClick={save} className="px-5 py-2 rounded-sm text-sm text-white" style={{ background: "var(--m-terracotta)" }}>Guardar</button>
          </div>
        </Modal>
      )}
      <style>{`.m-input{width:100%;background:transparent;border:none;border-bottom:1px solid var(--m-border);padding:6px 0;font-size:14px;outline:none;color:var(--m-ink);font-family:inherit}.m-input:focus{border-bottom-color:var(--m-terracotta)}`}</style>
    </div>
  );
}

const F = ({ label, children }) => (<div><label className="eyebrow block mb-1" style={{ fontSize: 10 }}>{label}</label>{children}</div>);

export const Modal = ({ title, onClose, children, size = "md" }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(44,36,32,0.4)" }} onClick={onClose}>
    <div onClick={e => e.stopPropagation()} className="card-base w-full bg-white" style={{ maxWidth: size === "lg" ? 820 : 600 }}>
      <div className="flex items-center justify-between p-5" style={{ borderBottom: "1px solid var(--m-border)" }}>
        <h3 className="font-serif text-2xl">{title}</h3>
        <button onClick={onClose} className="p-1 hover:bg-[color:var(--m-sidebar)] rounded-sm"><X className="w-4 h-4" /></button>
      </div>
      <div className="p-6">{children}</div>
    </div>
  </div>
);
