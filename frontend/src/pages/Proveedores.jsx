import { useEffect, useState } from "react";
import { api, formatDateTime } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import { Modal } from "@/pages/Clients";
import { toast } from "sonner";
import { Plus, Edit2, Trash2, Phone, Mail, Building2 } from "lucide-react";

const EMPTY = { name: "", contact_name: "", phone: "", email: "", notes: "" };

export default function Proveedores() {
  const [suppliers, setSuppliers] = useState([]);
  const [dialog, setDialog] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY);

  const load = async () => {
    const r = await api.get("/suppliers");
    setSuppliers(r.data);
  };
  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditingId(null); setForm(EMPTY); setDialog(true); };
  const openEdit = (s) => {
    setEditingId(s.id);
    setForm({ name: s.name, contact_name: s.contact_name || "", phone: s.phone || "", email: s.email || "", notes: s.notes || "" });
    setDialog(true);
  };

  const save = async () => {
    if (!form.name.trim()) { toast.error("Nombre requerido"); return; }
    try {
      if (editingId) {
        await api.put(`/suppliers/${editingId}`, form);
        toast.success("Proveedor actualizado");
      } else {
        await api.post("/suppliers", form);
        toast.success("Proveedor creado");
      }
      setDialog(false);
      await load();
    } catch { toast.error("Error al guardar"); }
  };

  const remove = async (s) => {
    if (!window.confirm(`¿Eliminar a ${s.name}?`)) return;
    try {
      await api.delete(`/suppliers/${s.id}`);
      toast.success("Proveedor eliminado");
      await load();
    } catch { toast.error("Error al eliminar"); }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Compras"
        title="Proveedores"
        subtitle={`${suppliers.length} proveedor${suppliers.length !== 1 ? "es" : ""} registrado${suppliers.length !== 1 ? "s" : ""}`}
        actions={
          <button onClick={openCreate}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-sm text-sm font-medium text-white"
            style={{ background: "var(--m-terracotta)" }}>
            <Plus className="w-4 h-4" /> Nuevo proveedor
          </button>
        }
      />

      <div className="px-8 lg:px-12 py-8">
        {suppliers.length === 0 ? (
          <div className="card-base p-16 text-center">
            <Building2 className="w-8 h-8 mx-auto mb-3" style={{ color: "var(--m-muted)" }} />
            <p className="text-sm" style={{ color: "var(--m-ink-2)" }}>
              Aún no hay proveedores. Agregá el primero.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {suppliers.map(s => (
              <div key={s.id} className="card-base p-5 hover-card">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 flex items-center justify-center rounded-sm flex-shrink-0"
                      style={{ background: "var(--m-sidebar)" }}>
                      <Building2 className="w-4 h-4" style={{ color: "var(--m-terracotta)" }} />
                    </div>
                    <div>
                      <div className="font-medium text-sm leading-tight">{s.name}</div>
                      {s.contact_name && (
                        <div className="text-xs mt-0.5" style={{ color: "var(--m-ink-2)" }}>{s.contact_name}</div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => openEdit(s)} className="p-1.5 rounded-sm hover:bg-[color:var(--m-sidebar)]">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => remove(s)} className="p-1.5 rounded-sm" style={{ color: "var(--m-danger)" }}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="mt-4 space-y-1.5">
                  {s.phone && (
                    <a href={`tel:${s.phone}`} className="flex items-center gap-2 text-xs hover:underline"
                      style={{ color: "var(--m-ink-2)" }}>
                      <Phone className="w-3.5 h-3.5 flex-shrink-0" />
                      {s.phone}
                    </a>
                  )}
                  {s.email && (
                    <a href={`mailto:${s.email}`} className="flex items-center gap-2 text-xs hover:underline"
                      style={{ color: "var(--m-ink-2)" }}>
                      <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                      {s.email}
                    </a>
                  )}
                  {s.notes && (
                    <p className="text-xs mt-2 pt-2" style={{ color: "var(--m-ink-2)", borderTop: "1px solid var(--m-border)" }}>
                      {s.notes}
                    </p>
                  )}
                </div>

                <div className="mt-3 pt-3 text-[10px]" style={{ borderTop: "1px solid var(--m-border)", color: "var(--m-muted)" }}>
                  Desde {formatDateTime(s.created_at)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {dialog && (
        <Modal title={editingId ? "Editar proveedor" : "Nuevo proveedor"} onClose={() => setDialog(false)}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <F label="Nombre del proveedor *">
                <input className="m-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ej: Cafetalera Las Nubes" />
              </F>
            </div>
            <F label="Persona de contacto">
              <input className="m-input" value={form.contact_name} onChange={e => setForm({ ...form, contact_name: e.target.value })} placeholder="Nombre del vendedor" />
            </F>
            <F label="Teléfono / WhatsApp">
              <input className="m-input" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="8888-8888" />
            </F>
            <div className="md:col-span-2">
              <F label="Email">
                <input type="email" className="m-input" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="proveedor@ejemplo.com" />
              </F>
            </div>
            <div className="md:col-span-2">
              <F label="Notas">
                <textarea rows={3} className="m-input resize-none" value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                  placeholder="Condiciones de pago, productos que ofrece, observaciones…" />
              </F>
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <button onClick={() => setDialog(false)} className="px-5 py-2 rounded-sm text-sm border" style={{ borderColor: "var(--m-border)" }}>Cancelar</button>
            <button onClick={save} className="px-5 py-2 rounded-sm text-sm text-white" style={{ background: "var(--m-terracotta)" }}>Guardar</button>
          </div>
        </Modal>
      )}
      <style>{`.m-input{width:100%;background:transparent;border:none;border-bottom:1px solid var(--m-border);padding:6px 0;font-size:14px;outline:none;color:var(--m-ink);font-family:inherit}.m-input:focus{border-bottom-color:var(--m-terracotta)}`}</style>
    </div>
  );
}

const F = ({ label, children }) => (
  <div><label className="eyebrow block mb-1" style={{ fontSize: 10 }}>{label}</label>{children}</div>
);
