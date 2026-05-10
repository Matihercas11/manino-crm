import { useEffect, useState, useRef, useCallback } from "react";
import { api, formatCRC, formatDateTime } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import { toast } from "sonner";
import { Plus, Trash2, Search, ChevronDown, Check, X, PackageCheck, AlertTriangle } from "lucide-react";

const EMPTY_ITEM = { invoice_name: "", quantity: 1, matched_product_id: null, matched_product_name: null };

function ProductSearch({ value, onSelect, onClear, placeholder }) {
  const [query, setQuery] = useState(value || "");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [openUp, setOpenUp] = useState(false);
  const ref = useRef(null);
  const inputRef = useRef(null);

  const search = useCallback(async (q) => {
    if (!q.trim()) { setResults([]); return; }
    try {
      const r = await api.get(`/products/search?q=${encodeURIComponent(q)}`);
      setResults(r.data);
    } catch { setResults([]); }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => search(query), 200);
    return () => clearTimeout(t);
  }, [query, search]);

  useEffect(() => {
    const handler = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Flip dropdown upward when there's not enough space below
  useEffect(() => {
    if (!open || !inputRef.current) return;
    const rect = inputRef.current.getBoundingClientRect();
    const desired = 220; // max-h-48 (~192px) + padding
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    setOpenUp(spaceBelow < desired && spaceAbove > spaceBelow);
  }, [open, results.length, query]);

  if (value) {
    return (
      <div className="flex items-center gap-1.5 text-sm px-2 py-1 rounded-sm"
        style={{ background: "#EFF6F4", color: "#4A7C6F" }}>
        <Check className="w-3.5 h-3.5 flex-shrink-0" />
        <span className="truncate">{value}</span>
        <button onClick={onClear} className="flex-shrink-0 ml-1"><X className="w-3 h-3" /></button>
      </div>
    );
  }

  const dropdownPos = openUp
    ? { bottom: "100%", marginBottom: 4 }
    : { top: "100%", marginTop: 4 };

  return (
    <div ref={ref} className="relative">
      <div ref={inputRef} className="flex items-center gap-1.5 border-b" style={{ borderColor: "var(--m-border)" }}>
        <Search className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--m-muted)" }} />
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder || "Buscar en catálogo…"}
          className="w-full bg-transparent outline-none text-xs py-1"
        />
      </div>
      {open && results.length > 0 && (
        <div className="absolute z-50 w-full bg-white rounded-sm shadow-lg overflow-auto max-h-48"
          style={{ border: "1px solid var(--m-border)", ...dropdownPos }}>
          {results.map(p => (
            <button key={p.id}
              onMouseDown={() => { onSelect(p); setOpen(false); setQuery(""); }}
              className="w-full text-left px-3 py-2 text-xs hover:bg-[color:var(--m-sidebar)] flex items-center justify-between gap-2">
              <span className="font-medium truncate">{p.name}</span>
              <span className="font-mono flex-shrink-0" style={{ color: "var(--m-ink-2)" }}>stock {p.stock} {p.unit}</span>
            </button>
          ))}
        </div>
      )}
      {open && query.trim() && results.length === 0 && (
        <div className="absolute z-50 w-full bg-white rounded-sm shadow-sm px-3 py-2 text-xs"
          style={{ border: "1px solid var(--m-border)", color: "var(--m-ink-2)", ...dropdownPos }}>
          Sin coincidencias · se guardará sin vincular
        </div>
      )}
    </div>
  );
}

export default function Mercaderia() {
  const [invoices, setInvoices] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [supplier, setSupplier] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState([{ ...EMPTY_ITEM }]);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState({});

  const load = async () => {
    const r = await api.get("/invoices");
    setInvoices(r.data);
  };
  useEffect(() => { load(); }, []);

  const addItem = () => setItems(prev => [...prev, { ...EMPTY_ITEM }]);

  const updateItem = (i, patch) => setItems(prev => prev.map((x, idx) => idx === i ? { ...x, ...patch } : x));

  const removeItem = (i) => setItems(prev => prev.filter((_, idx) => idx !== i));

  const selectProduct = (i, product) => updateItem(i, {
    matched_product_id: product.id,
    matched_product_name: product.name,
  });

  const clearProduct = (i) => updateItem(i, { matched_product_id: null, matched_product_name: null });

  const save = async () => {
    if (items.some(it => !it.invoice_name.trim())) {
      toast.error("Todos los ítems deben tener un nombre"); return;
    }
    if (items.some(it => Number(it.quantity) <= 0)) {
      toast.error("Las cantidades deben ser mayores a 0"); return;
    }
    setSaving(true);
    try {
      await api.post("/invoices", {
        supplier: supplier.trim(),
        notes: notes.trim(),
        items: items.map(it => ({
          invoice_name: it.invoice_name.trim(),
          quantity: Number(it.quantity),
          matched_product_id: it.matched_product_id || null,
        })),
      });
      toast.success("Factura registrada · inventario actualizado");
      setShowForm(false);
      setSupplier(""); setNotes("");
      setItems([{ ...EMPTY_ITEM }]);
      await load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const removeInvoice = async (inv) => {
    if (!window.confirm("¿Eliminar esta recepción? El stock vinculado será revertido.")) return;
    try {
      await api.delete(`/invoices/${inv.id}`);
      toast.success("Recepción eliminada · stock revertido");
      await load();
    } catch { toast.error("Error al eliminar"); }
  };

  const matchedCount = items.filter(it => it.matched_product_id).length;
  const unmatchedCount = items.filter(it => !it.matched_product_id && it.invoice_name.trim()).length;

  return (
    <div>
      <PageHeader
        eyebrow="Compras"
        title="Recibimiento de mercadería"
        subtitle="Registrá facturas entrantes. Vinculá los productos de la factura con el catálogo para actualizar el inventario."
        actions={
          !showForm && (
            <button onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-sm text-sm font-medium text-white"
              style={{ background: "var(--m-terracotta)" }}>
              <Plus className="w-4 h-4" /> Nueva recepción
            </button>
          )
        }
      />

      <div className="px-8 lg:px-12 py-8 space-y-8">

        {/* Formulario nueva recepción */}
        {showForm && (
          <div className="card-base p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="eyebrow">Nueva recepción</div>
                <div className="font-serif text-xl mt-0.5">Registrar factura entrante</div>
              </div>
              <button onClick={() => setShowForm(false)} className="p-1.5 rounded-sm" style={{ color: "var(--m-ink-2)" }}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <F label="Proveedor (opcional)">
                <input className="m-input" value={supplier} onChange={e => setSupplier(e.target.value)} placeholder="Nombre del proveedor" />
              </F>
              <F label="Notas (opcional)">
                <input className="m-input" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Número de factura, observaciones…" />
              </F>
            </div>

            {/* Tabla de ítems */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="eyebrow">Productos recibidos</div>
                <div className="text-xs" style={{ color: "var(--m-ink-2)" }}>
                  {matchedCount > 0 && <span style={{ color: "#4A7C6F" }}>{matchedCount} vinculados</span>}
                  {matchedCount > 0 && unmatchedCount > 0 && " · "}
                  {unmatchedCount > 0 && <span style={{ color: "var(--m-warning)" }}>{unmatchedCount} sin vincular</span>}
                </div>
              </div>

              <div className="rounded-sm overflow-hidden" style={{ border: "1px solid var(--m-border)" }}>
                <table className="w-full text-sm">
                  <thead><tr style={{ borderBottom: "1px solid var(--m-border)", background: "var(--m-sidebar)" }}>
                    <th className="eyebrow py-3 px-4 text-left" style={{ fontSize: 10 }}>Nombre en factura</th>
                    <th className="eyebrow py-3 px-4 text-left" style={{ fontSize: 10, width: 90 }}>Cantidad</th>
                    <th className="eyebrow py-3 px-4 text-left" style={{ fontSize: 10 }}>Producto en catálogo</th>
                    <th className="py-3 px-4 w-10"></th>
                  </tr></thead>
                  <tbody>
                    {items.map((item, i) => (
                      <tr key={i} style={{ borderBottom: i < items.length - 1 ? "1px solid var(--m-border)" : "none" }}>
                        <td className="py-2.5 px-4">
                          <input
                            value={item.invoice_name}
                            onChange={e => updateItem(i, { invoice_name: e.target.value })}
                            placeholder="Ej: Café Colombia 500g"
                            className="w-full bg-transparent outline-none text-sm border-b py-0.5"
                            style={{ borderColor: "var(--m-border)" }}
                          />
                        </td>
                        <td className="py-2.5 px-4">
                          <input
                            type="number"
                            min="0.1"
                            step="0.1"
                            value={item.quantity}
                            onChange={e => updateItem(i, { quantity: e.target.value })}
                            className="w-full bg-transparent outline-none text-sm font-mono border-b py-0.5"
                            style={{ borderColor: "var(--m-border)" }}
                          />
                        </td>
                        <td className="py-2.5 px-4">
                          <ProductSearch
                            value={item.matched_product_name}
                            onSelect={p => selectProduct(i, p)}
                            onClear={() => clearProduct(i)}
                            placeholder="Buscar en catálogo…"
                          />
                        </td>
                        <td className="py-2.5 px-4">
                          {items.length > 1 && (
                            <button onClick={() => removeItem(i)} className="p-1" style={{ color: "var(--m-danger)" }}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <button onClick={addItem}
                className="mt-3 inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-sm border"
                style={{ borderColor: "var(--m-border)", color: "var(--m-ink-2)" }}>
                <Plus className="w-3.5 h-3.5" /> Agregar línea
              </button>
            </div>

            {/* Aviso ítems no vinculados */}
            {unmatchedCount > 0 && (
              <div className="flex items-start gap-2 p-3 rounded-sm text-xs"
                style={{ background: "#FFF8E8", border: "1px solid #D4A373", color: "#8A5A1F" }}>
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>
                  {unmatchedCount} ítem{unmatchedCount > 1 ? "s" : ""} sin vincular — se guardarán en el historial
                  pero no actualizarán el inventario. Vinculalos con el catálogo para actualizar el stock.
                </span>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2" style={{ borderTop: "1px solid var(--m-border)" }}>
              <button onClick={() => setShowForm(false)} className="px-5 py-2 rounded-sm text-sm border" style={{ borderColor: "var(--m-border)" }}>Cancelar</button>
              <button onClick={save} disabled={saving}
                className="px-5 py-2 rounded-sm text-sm font-medium text-white disabled:opacity-50"
                style={{ background: "var(--m-terracotta)" }}>
                {saving ? "Guardando…" : `Confirmar recepción · actualizar ${matchedCount} producto${matchedCount !== 1 ? "s" : ""}`}
              </button>
            </div>
          </div>
        )}

        {/* Historial */}
        <div>
          <div className="eyebrow mb-4">Historial de recepciones</div>
          {invoices.length === 0 ? (
            <div className="card-base p-12 text-center">
              <PackageCheck className="w-8 h-8 mx-auto mb-3" style={{ color: "var(--m-muted)" }} />
              <p className="text-sm" style={{ color: "var(--m-ink-2)" }}>Aún no hay recepciones registradas.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {invoices.map(inv => {
                const isOpen = expanded[inv.id];
                const linked = inv.items.filter(it => it.matched_product_id).length;
                const total = inv.items.length;
                return (
                  <div key={inv.id} className="card-base overflow-hidden">
                    <div className="flex items-center justify-between px-6 py-4">
                      <button
                        onClick={() => setExpanded(e => ({ ...e, [inv.id]: !e[inv.id] }))}
                        className="flex items-center gap-3 flex-1 text-left">
                        {isOpen ? <ChevronDown className="w-4 h-4 flex-shrink-0" style={{ color: "var(--m-ink-2)" }} />
                          : <ChevronDown className="w-4 h-4 flex-shrink-0 -rotate-90" style={{ color: "var(--m-ink-2)" }} />}
                        <div>
                          <div className="text-sm font-medium">
                            {inv.supplier || "Proveedor no especificado"}
                            {inv.notes && <span className="font-normal ml-2" style={{ color: "var(--m-ink-2)" }}>· {inv.notes}</span>}
                          </div>
                          <div className="text-xs mt-0.5" style={{ color: "var(--m-ink-2)" }}>
                            {formatDateTime(inv.created_at)} · {total} ítem{total !== 1 ? "s" : ""}
                            {linked > 0 && <span style={{ color: "#4A7C6F" }}> · {linked} vinculado{linked !== 1 ? "s" : ""}</span>}
                            {linked < total && <span style={{ color: "var(--m-warning)" }}> · {total - linked} sin vincular</span>}
                          </div>
                        </div>
                      </button>
                      <button onClick={() => removeInvoice(inv)} className="p-1.5 rounded-sm ml-4" style={{ color: "var(--m-danger)" }}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {isOpen && (
                      <div style={{ borderTop: "1px solid var(--m-border)", background: "var(--m-sidebar)" }}>
                        <table className="w-full text-xs">
                          <thead><tr style={{ borderBottom: "1px solid var(--m-border)" }}>
                            <th className="eyebrow py-2.5 px-6 text-left" style={{ fontSize: 9 }}>En factura</th>
                            <th className="eyebrow py-2.5 px-6 text-right" style={{ fontSize: 9, width: 80 }}>Cantidad</th>
                            <th className="eyebrow py-2.5 px-6 text-left" style={{ fontSize: 9 }}>Catálogo</th>
                          </tr></thead>
                          <tbody>
                            {inv.items.map((it, i) => (
                              <tr key={i} style={{ borderBottom: i < inv.items.length - 1 ? "1px solid var(--m-border)" : "none" }}>
                                <td className="py-2.5 px-6">{it.invoice_name}</td>
                                <td className="py-2.5 px-6 mono text-right">{it.quantity}</td>
                                <td className="py-2.5 px-6">
                                  {it.matched_product_name
                                    ? <span style={{ color: "#4A7C6F" }}><Check className="w-3 h-3 inline mr-1" />{it.matched_product_name}</span>
                                    : <span style={{ color: "var(--m-muted)" }}>Sin vincular</span>}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      <style>{`.m-input{width:100%;background:transparent;border:none;border-bottom:1px solid var(--m-border);padding:6px 0;font-size:14px;outline:none;color:var(--m-ink);font-family:inherit}.m-input:focus{border-bottom-color:var(--m-terracotta)}`}</style>
    </div>
  );
}

const F = ({ label, children }) => (
  <div><label className="eyebrow block mb-1" style={{ fontSize: 10 }}>{label}</label>{children}</div>
);
