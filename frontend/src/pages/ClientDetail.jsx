import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api, formatCRC, formatDateTime } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import { toast } from "sonner";
import { ArrowLeft, Mail, Phone, MapPin, User, Trash2, StickyNote } from "lucide-react";

export default function ClientDetail() {
  const { id } = useParams();
  const [client, setClient] = useState(null);
  const [orders, setOrders] = useState([]);
  const [notes, setNotes] = useState([]);
  const [noteDraft, setNoteDraft] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  const loadNotes = async () => { const r = await api.get(`/clients/${id}/notes`); setNotes(r.data); };

  useEffect(() => {
    Promise.all([api.get(`/clients/${id}`), api.get(`/clients/${id}/orders`), api.get(`/clients/${id}/notes`)])
      .then(([c, o, n]) => { setClient(c.data); setOrders(o.data); setNotes(n.data); });
  }, [id]);

  const addNote = async () => {
    const body = noteDraft.trim();
    if (!body) return;
    setSavingNote(true);
    try { await api.post(`/clients/${id}/notes`, { body }); setNoteDraft(""); await loadNotes(); toast.success("Nota guardada"); }
    catch { toast.error("Error al guardar la nota"); }
    finally { setSavingNote(false); }
  };

  const removeNote = async (noteId) => {
    if (!window.confirm("¿Eliminar esta nota?")) return;
    try { await api.delete(`/clients/${id}/notes/${noteId}`); await loadNotes(); toast.success("Nota eliminada"); }
    catch { toast.error("Error al eliminar"); }
  };

  if (!client) return <div className="p-12 text-sm" style={{ color: "var(--m-ink-2)" }}>Cargando…</div>;

  const totalSpent = orders.reduce((a, b) => a + b.total, 0);
  const avgTicket = orders.length ? totalSpent / orders.length : 0;

  return (
    <div>
      <PageHeader eyebrow={client.client_type} title={client.business_name}
        subtitle={client.notes || "Perfil individual con historial de compras."}
        actions={<Link to="/clientes" className="inline-flex items-center gap-2 px-4 py-2 rounded-sm text-sm border" style={{ borderColor: "var(--m-border)" }}><ArrowLeft className="w-4 h-4" /> Volver</Link>} />
      <div className="px-8 lg:px-12 py-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card-base p-6">
          <div className="eyebrow">Contacto</div>
          <div className="mt-4 space-y-3 text-sm">
            <Row icon={<User className="w-4 h-4" />} value={client.contact_name || "—"} />
            <Row icon={<Phone className="w-4 h-4" />} value={client.phone || "—"} mono />
            <Row icon={<Mail className="w-4 h-4" />} value={client.email || "—"} />
            <Row icon={<MapPin className="w-4 h-4" />} value={client.location || "—"} />
          </div>
        </div>
        <div className="card-base p-6">
          <div className="eyebrow">Resumen</div>
          <div className="mt-4 space-y-3">
            <Stat label="Total gastado" value={formatCRC(totalSpent)} />
            <Stat label="Pedidos" value={orders.length} />
            <Stat label="Ticket promedio" value={formatCRC(avgTicket)} />
          </div>
        </div>
        <div className="card-base p-6">
          <div className="eyebrow">Acciones</div>
          <div className="mt-4 space-y-2">
            <Link to="/pos" className="block w-full text-center py-2.5 rounded-sm text-sm text-white" style={{ background: "var(--m-terracotta)" }}>Nueva compra</Link>
            <Link to="/clientes" className="block w-full text-center py-2.5 rounded-sm text-sm border" style={{ borderColor: "var(--m-border)" }}>Ver todos</Link>
          </div>
        </div>
      </div>
      <div className="px-8 lg:px-12 pb-8">
        <div className="flex items-baseline justify-between mb-4">
          <div className="flex items-baseline gap-3">
            <StickyNote className="w-5 h-5" style={{ color: "var(--m-terracotta)" }} />
            <h2 className="font-serif text-3xl">Notas internas</h2>
          </div>
          <span className="text-xs" style={{ color: "var(--m-ink-2)" }}>{notes.length} {notes.length === 1 ? "nota" : "notas"}</span>
        </div>
        <div className="card-base p-6">
          <div className="flex gap-3 items-start">
            <textarea value={noteDraft} onChange={e => setNoteDraft(e.target.value)}
              onKeyDown={e => { if ((e.metaKey||e.ctrlKey) && e.key === "Enter") addNote(); }}
              placeholder="Agrega una nota interna sobre este cliente… (preferencias, condiciones, recordatorios)"
              rows={2} className="flex-1 bg-transparent outline-none text-sm resize-none py-2 px-0 border-b"
              style={{ borderColor: "var(--m-border)", fontFamily: "inherit", color: "var(--m-ink)" }} />
            <button onClick={addNote} disabled={savingNote || !noteDraft.trim()}
              className="px-4 py-2 rounded-sm text-sm text-white disabled:opacity-50" style={{ background: "var(--m-terracotta)" }}>
              {savingNote ? "…" : "Guardar"}
            </button>
          </div>
          <div className="mt-6">
            {notes.length === 0 ? (
              <p className="text-sm py-4" style={{ color: "var(--m-ink-2)" }}>Aún no hay notas. Las notas funcionan como un diario interno del cliente.</p>
            ) : (
              <ul className="divide-y" style={{ borderColor: "var(--m-border)" }}>
                {notes.map(n => (
                  <li key={n.id} className="py-3 flex items-start gap-3 group">
                    <div className="w-1 self-stretch rounded-sm" style={{ background: "var(--m-terracotta)" }} />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs mb-1" style={{ color: "var(--m-ink-2)" }}>{formatDateTime(n.created_at)}</div>
                      <p className="text-sm whitespace-pre-wrap">{n.body}</p>
                    </div>
                    <button onClick={() => removeNote(n.id)} className="p-1.5 opacity-0 group-hover:opacity-100" style={{ color: "var(--m-danger)" }}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
      <div className="px-8 lg:px-12 pb-12">
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="font-serif text-3xl">Historial</h2>
          <span className="text-xs" style={{ color: "var(--m-ink-2)" }}>{orders.length} pedidos</span>
        </div>
        <div className="card-base overflow-hidden">
          {orders.length === 0 ? (
            <div className="py-16 text-center text-sm" style={{ color: "var(--m-ink-2)" }}>Este cliente aún no tiene pedidos.</div>
          ) : (
            <table className="w-full text-sm">
              <thead><tr className="text-left" style={{ borderBottom: "1px solid var(--m-border)" }}>
                <th className="eyebrow py-4 px-6">Fecha</th><th className="eyebrow py-4 px-6">Productos</th>
                <th className="eyebrow py-4 px-6">Estado</th><th className="eyebrow py-4 px-6 text-right">Total</th>
              </tr></thead>
              <tbody>
                {orders.map(o => (
                  <tr key={o.id} style={{ borderBottom: "1px solid var(--m-border)" }}>
                    <td className="py-3.5 px-6 text-xs" style={{ color: "var(--m-ink-2)" }}>{formatDateTime(o.created_at)}</td>
                    <td className="py-3.5 px-6">{o.items.map(i => `${i.product_name} × ${i.quantity}`).join(", ")}</td>
                    <td className="py-3.5 px-6"><StatusBadge status={o.status} /></td>
                    <td className="py-3.5 px-6 text-right font-mono">{formatCRC(o.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

const Row = ({ icon, value, mono }) => (
  <div className="flex items-center gap-3"><span style={{ color: "var(--m-muted)" }}>{icon}</span><span className={mono ? "mono" : ""}>{value}</span></div>
);

const Stat = ({ label, value }) => (
  <div className="flex items-baseline justify-between"><span className="text-sm" style={{ color: "var(--m-ink-2)" }}>{label}</span><span className="mono text-base">{value}</span></div>
);
