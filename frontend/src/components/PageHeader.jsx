export default function PageHeader({ eyebrow, title, subtitle, actions }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-6 px-8 lg:px-12 pt-10 pb-8"
      style={{ borderBottom: "1px solid var(--m-border)" }}>
      <div>
        {eyebrow && <div className="eyebrow mb-3">{eyebrow}</div>}
        <h1 className="font-serif font-semibold tracking-tight text-4xl lg:text-5xl leading-none">{title}</h1>
        {subtitle && <p className="mt-3 text-sm max-w-xl" style={{ color: "var(--m-ink-2)" }}>{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </div>
  );
}
