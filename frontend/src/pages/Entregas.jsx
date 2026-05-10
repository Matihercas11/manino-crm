import { useEffect, useState, useMemo } from "react";
import { api, formatCRC, formatDateTime, STATUS_LABEL } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { MapPin, Phone, CheckCircle2, Circle, Package, Truck } from "lucide-react";

export default function Entregas() {
  const [orders, setOrders] = useState([]);

  const load = async () => {
    const r = await api.get("/orders");
    setOrders(r.data);
  };
  useEffect(() => { load(); }, []);

  const active = useMemo(() =>
    orders.filter(o => o.status !== "entregado"),
    [orders]
  );

  const grouped = useMemo(() => {
    const map = {};
    for (const o of active) {
      const loc = o.client_location?.trim() || "Sin ubicación";
      if (!map[loc]) map[loc] = [];
      map[loc].push(o);
    }
    return Object.entries(map).sort(([a], [b]) => {
      if (a === "Sin ubicación") return 1;
      if (b === "Sin ubicación") return -1;
      return a.localeCompare(b);
    });
  }, [active]);

  const setStatus = async (orderId, status) => {
    try {
      await api.put(`/orders/${orderId}/status`, { status });
      toast.success(`Pedido marcado como ${STATUS_LABEL[status].toLowerCase()}`);
      await load();
    } catch { toast.error("Error al actualizar"); }
  };

  const togglePaid = async (o) => {
    try {
      await api.put(`/orders/${o.id}/paid`, { paid: !o.paid });
      toast.success(o.paid ? "Marcado como no cobrado" : "Marcado como pagado");
      await load();
    } catch { toast.error("Error al actualizar"); }
  };

  const totalPending = active.reduce((a, b) => a + b.total, 0);
  const pendienteCount = active.length;
  const cobradoCount = active.filter(o => o.paid).length;

  return (
    <div>
      <PageHeader
        eyebrow="Logística"
        title="Vista de entregas"
        subtitle="Pedidos pendientes y en proceso, agrupados por ubicación."
      />

      <div className="px-8 lg:px-12 py-8 space-y-8">

        {/* Resumen */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Por entregar", value: active.length, color: "var(--m-ink)" },
            { label: "Pendientes", value: pendienteCount, color: "#D4A373" },
            { label: "Ya cobrados", value: cobradoCount, color: "#4A7C6F" },
            { label: "Monto total", value: formatCRC(totalPending), color: "var(--m-terracotta)" },
          ].map(({ label, value, color }) => (
            <div key={label} className="card-base p-5">
              <div className="eyebrow">{label}</div>
              <div className="font-mono text-2xl mt-2" style={{ color }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Lista agrupada por ubicación */}
        {active.length === 0 ? (
          <div className="card-base p-16 text-center">
            <Truck className="w-8 h-8 mx-auto mb-3" style={{ color: "var(--m-muted)" }} />
            <p className="text-sm" style={{ color: "var(--m-ink-2)" }}>
              No hay pedidos pendientes de entrega. ¡Todo al día!
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {grouped.map(([location, locationOrders]) => (
              <div key={location}>
                <div className="flex items-center gap-2 mb-3">
                  <MapPin className="w-4 h-4" style={{ color: "var(--m-terracotta)" }} />
                  <span className="font-medium text-sm">{location}</span>
                  <span className="font-mono text-xs px-2 py-0.5 rounded-sm"
                    style={{ background: "var(--m-sidebar)", color: "var(--m-ink-2)" }}>
                    {locationOrders.length}
                  </span>
                </div>

                <div className="space-y-3">
                  {locationOrders.map(o => (
                    <OrderCard key={o.id} order={o} onStatusChange={setStatus} onTogglePaid={togglePaid} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function OrderCard({ order: o, onStatusChange, onTogglePaid }) {
  const itemsCount = o.items.reduce((a, b) => a + b.quantity, 0);

  return (
    <div className="card-base p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link to={`/clientes/${o.client_id}`} className="font-medium hover:underline">
              {o.client_name}
            </Link>
            <StatusBadge status={o.status} />
            {o.paid && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] rounded-sm font-medium"
                style={{ background: "#EFF6F4", color: "#4A7C6F" }}>
                <CheckCircle2 className="w-3 h-3" /> Pagado
              </span>
            )}
          </div>
          <div className="mt-1 text-xs" style={{ color: "var(--m-ink-2)" }}>
            {formatDateTime(o.created_at)}
            {o.client_phone && (
              <a href={`tel:${o.client_phone}`} className="ml-3 inline-flex items-center gap-1 hover:underline">
                <Phone className="w-3 h-3" /> {o.client_phone}
              </a>
            )}
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="font-mono text-lg">{formatCRC(o.total)}</div>
          <div className="text-xs mt-0.5" style={{ color: "var(--m-ink-2)" }}>
            <Package className="w-3 h-3 inline mr-0.5" />{itemsCount} artículo{itemsCount !== 1 ? "s" : ""}
          </div>
        </div>
      </div>

      {/* Productos */}
      <div className="mt-3 pt-3" style={{ borderTop: "1px solid var(--m-border)" }}>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {o.items.map(it => (
            <span key={it.product_id} className="text-xs" style={{ color: "var(--m-ink-2)" }}>
              {it.product_name} <span className="font-mono">×{it.quantity}</span>
            </span>
          ))}
        </div>
        {o.notes && (
          <p className="text-xs mt-1.5 italic" style={{ color: "var(--m-muted)" }}>"{o.notes}"</p>
        )}
      </div>

      {/* Acciones */}
      <div className="mt-3 pt-3 flex flex-wrap items-center gap-2" style={{ borderTop: "1px solid var(--m-border)" }}>
        <span className="eyebrow mr-1">Entrega:</span>
        {[
          { v: "pendiente", label: "Pendiente", color: "#D4A373" },
          { v: "entregado", label: "Entregado", color: "#9C4936" },
        ].map(s => (
          <button key={s.v} onClick={() => onStatusChange(o.id, s.v)}
            className="px-3 py-1 text-xs rounded-sm border transition-colors"
            style={{
              borderColor: (o.status === s.v || (o.status === "en_proceso" && s.v === "pendiente")) ? s.color : "var(--m-border)",
              color: (o.status === s.v || (o.status === "en_proceso" && s.v === "pendiente")) ? "#fff" : "var(--m-ink-2)",
              background: (o.status === s.v || (o.status === "en_proceso" && s.v === "pendiente")) ? s.color : "transparent",
              fontWeight: (o.status === s.v || (o.status === "en_proceso" && s.v === "pendiente")) ? 600 : 400,
            }}>
            {s.label}
          </button>
        ))}

        <div className="ml-auto">
          <button onClick={() => onTogglePaid(o)}
            className="inline-flex items-center gap-1.5 px-3 py-1 text-xs rounded-sm font-medium transition-colors"
            style={o.paid
              ? { background: "#EFF6F4", color: "#4A7C6F" }
              : { background: "#F4E9D8", color: "#8A5A1F" }}>
            {o.paid ? <><CheckCircle2 className="w-3.5 h-3.5" /> Pagado</> : <><Circle className="w-3.5 h-3.5" /> Cobrar</>}
          </button>
        </div>
      </div>
    </div>
  );
}
