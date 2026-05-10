import { useEffect, useMemo, useState } from "react";
import { api, formatCRC, formatDate } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import { Modal } from "@/pages/Clients";
import { toast } from "sonner";
import { Plus, Edit2, Trash2, CheckCircle2, Circle, Receipt } from "lucide-react";

const EMPTY = {
  description: "",
  amount: 0,
  category: "",
  date: new Date().toISOString().slice(0, 10),
  status: "pendiente",
  notes: "",
};

const STATUS = {
  pendiente: { label: "Pendiente", bg: "#F4E9D8", fg: "#8A5A1F" },
  cancelado: { label: "Cancelado", bg: "#EFF6F4", fg: "#4A7C6F" },
};

export default function Gastos() {
  const [expenses, setExpenses] = useState([]);
  const [filter, setFilter] = useState("all");
  const [dialog, setDialog] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY);

  const load = async () => {
    const r = await api.get("/expenses");
    setExpenses(r.data);
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => expenses.filter(e => {
    if (filter === "all") return true;
    return e.status === filter;
  }), [expenses, filter]);

  const openCreate = () => { setEditingId(null); setForm({ ...EMPTY, date: new Date().toISOString().slice(0, 10) }); setDialog(true); };
  const openEdit = (e) => {
    setEditingId(e.id);
    setForm({
      description: e.description || "",
      amount: e.amount || 0,
      category: e.category || "",
      date: e.date || new Date().toISOString().slice(0, 10),
      status: e.status || "pendiente",
      notes: e.notes || "",
    });
    setDialog(true);
  };

  const save = async () => {
    if (!form.description.trim()) { toast.error("Descripción requerida"); return; }
    const amount = Number(form.amount);
    if (!amount || amount <= 0) { toast.error("Monto inválido"); return; }
    const payload = { ...form, amount };
    try {
      if (editingId) await api.put(`/expenses/${editingId}`, payload);
      else await api.post("/expenses", payload);
      toast.success(editingId ? "Gasto actualizado" : "Gasto registrado");
      setDialog(false); await load();
    } catch (err) { toast.error(err.response?.data?.detail || "Error al guardar"); }
  };

  const toggleStatus = async (e) => {
    const newStatus = e.status === "pendiente" ? "cancelado" : "pendiente";
    try {
      await api.put(`/expenses/${e.id}/status`, { status: newStatus });
      toast.success(`Marcado como ${STATUS[newStatus].label.toLowerCase()}`);
      await load();
    } catch { toast.error("Error al actualizar"); }
  };

  const remove = async (e) => {
    if (!window.confirm(`¿Eliminar gasto "${e.description}"?`)) return;
    try { await api.delete(`/expenses/${e.id}`); toast.success("Gasto eliminado"); await load(); }
    catch { toast.error("Error al eliminar"); }
  };

  const totalPending = expenses.filter(e => e.status === "pendiente").reduce((a, b) => a + (b.amount || 0), 0);
  const totalCancelled = expenses.filter(e => e.status === "cancelado").reduce((a, b) => a + (b.amount || 0), 0);

  return (
    <div>
      <PageHeader
        eyebrow="Finanzas"
        title="Gastos"
        subtitle="Registrá gastos del negocio. Los cancelados se descuentan de la ganancia neta; los pendientes no afectan el dashboard."
        actions={
          <button onClick={openCreate}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-sm text-sm font-medium text-white"
            style={{ background: "var(--m-terracotta)" }}>
            <Plus className="w-4 h-4" /> Nuevo gasto
          </button>
        }
      />
      <div className="px-8 lg:px-12 py-8 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card-base p-5">
            <div className="eyebrow">Total registrado</div>
            <div className="font-mono text-2xl mt-2">{formatCRC(totalPending + totalCancelled)}</div>
            <div className="text-xs mt-1" style={{ color: "var(--m-ink-2)" }}>{expenses.length} gasto{expenses.length !== 1 ? "s" : ""}</div>
          </div>
          <div className="card-base p-5">
            <div className="eyebrow">Pendientes</div>
            <div className="font-mono text-2xl mt-2" style={{ color: "#8A5A1F" }}>{formatCRC(totalPending)}</div>
            <div className="text-xs mt-1" style={{ color: "var(--m-ink-2)" }}>No afectan dashboard</div>
          </div>
          <div className="card-base p-5">
            <div className="eyebrow">Cancelados</div>
            <div className="font-mono text-2xl mt-2" style={{ color: "#4A7C6F" }}>{formatCRC(totalCancelled)}</div>
            <div className="text-xs mt-1" style={{ color: "var(--m-ink-2)" }}>Descontados de ganancia</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="eyebrow mr-1">Estado:</span>
          {[
            { k: "all", label: "Todos" },
            { k: "pendiente", label: "Pendientes" },
            { k: "cancelado", label: "Cancelados" },
          ].map(s => (
            <button key={s.k} onClick={() => setFilter(s.k)} className="px-3 py-1.5 text-xs rounded-sm border"
              style={{
                borderColor: filter === s.k ? "var(--m-terracotta)" : "var(--m-border)",
                color: filter === s.k ? "var(--m-terracotta)" : "var(--m-ink-2)",
                background: filter === s.k ? "#FFF" : "transparent",
              }}>
              {s.label}
            </button>
          ))}
        </div>

        <div className="card-base overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--m-border)" }}>
                <th className="eyebrow py-4 px-6 text-left">Fecha</th>
                <th className="eyebrow py-4 px-6 text-left">Descripción</th>
                <th className="eyebrow py-4 px-6 text-left">Categoría</th>
                <th className="eyebrow py-4 px-6 text-right">Monto</th>
                <th className="eyebrow py-4 px-6 text-left">Estado</th>
                <th className="py-4 px-6 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="py-16 text-center text-sm" style={{ color: "var(--m-ink-2)" }}>
                  <Receipt className="w-6 h-6 mx-auto mb-2 opacity-40" />
                  {expenses.length === 0 ? "Aún sin gastos registrados." : "Sin resultados."}
                </td></tr>
              ) : filtered.map(e => {
                const s = STATUS[e.status] || STATUS.pendiente;
                return (
                  <tr key={e.id} style={{ borderBottom: "1px solid var(--m-border)" }}>
                    <td className="py-3.5 px-6 text-xs" style={{ color: "var(--m-ink-2)" }}>{formatDate(e.date)}</td>
                    <td className="py-3.5 px-6">
                      <div className="font-medium">{e.description}</div>
                      {e.notes && <div className="text-xs mt-0.5" style={{ color: "var(--m-ink-2)" }}>{e.notes}</div>}
                    </td>
                    <td className="py-3.5 px-6 text-sm" style={{ color: "var(--m-ink-2)" }}>{e.category || "—"}</td>
                    <td className="py-3.5 px-6 text-right mono font-medium">{formatCRC(e.amount)}</td>
                    <td className="py-3.5 px-6">
                      <button onClick={() => toggleStatus(e)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-sm font-medium"
                        style={{ background: s.bg, color: s.fg }}>
                        {e.status === "cancelado" ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5" />}
                        {s.label}
                      </button>
                    </td>
                    <td className="py-3.5 px-6">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => openEdit(e)} className="p-1.5 rounded-sm hover:bg-[color:var(--m-sidebar)]">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => remove(e)} className="p-1.5 rounded-sm" style={{ color: "var(--m-danger)" }}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {dialog && (
        <Modal title={editingId ? "Editar gasto" : "Nuevo gasto"} onClose={() => setDialog(false)}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <F label="Descripción *">
                <input className="m-input" value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="Ej: Bolsas para empaque" />
              </F>
            </div>
            <F label="Monto (₡) *">
              <input type="number" className="m-input mono" value={form.amount}
                onChange={e => setForm({ ...form, amount: e.target.value })} />
            </F>
            <F label="Fecha">
              <input type="date" className="m-input" value={form.date}
                onChange={e => setForm({ ...form, date: e.target.value })} />
            </F>
            <F label="Categoría">
              <input className="m-input" value={form.category}
                onChange={e => setForm({ ...form, category: e.target.value })}
                placeholder="Ej: Insumos, Servicios, Transporte" />
            </F>
            <F label="Estado">
              <select className="m-input" value={form.status}
                onChange={e => setForm({ ...form, status: e.target.value })}>
                <option value="pendiente">Pendiente (no resta del dashboard)</option>
                <option value="cancelado">Cancelado (resta de la ganancia)</option>
              </select>
            </F>
            <div className="md:col-span-2">
              <F label="Notas">
                <textarea rows={2} className="m-input resize-none" value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })} />
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
