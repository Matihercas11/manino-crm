import { STATUS_LABEL, STATUS_COLOR } from "@/lib/api";

export default function StatusBadge({ status }) {
  const c = STATUS_COLOR[status] || STATUS_COLOR.pendiente;
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-sm uppercase tracking-wider"
      style={{ background: c.bg, color: c.fg }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: c.fg }} />
      {STATUS_LABEL[status]}
    </span>
  );
}
