import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { LayoutDashboard, Users, Package, ClipboardList, TrendingUp, Coffee, ShoppingCart } from "lucide-react";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/pos", label: "Nueva compra", icon: ShoppingCart },
  { to: "/clientes", label: "Clientes", icon: Users },
  { to: "/pedidos", label: "Pedidos", icon: ClipboardList },
  { to: "/inventario", label: "Inventario", icon: Package },
  { to: "/analisis", label: "Análisis", icon: TrendingUp },
];

export default function Layout() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen flex" style={{ background: "var(--m-app)" }}>
      <aside className="hidden lg:flex flex-col w-[260px] h-screen sticky top-0"
        style={{ background: "var(--m-sidebar)", borderRight: "1px solid var(--m-border)" }}>
        <div className="px-7 pt-8 pb-6">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 flex items-center justify-center rounded-sm" style={{ background: "var(--m-terracotta)" }}>
              <Coffee className="w-5 h-5 text-white" strokeWidth={1.8} />
            </div>
            <div className="leading-tight">
              <div className="font-serif text-xl font-semibold tracking-tight">Manino</div>
              <div className="eyebrow" style={{ fontSize: 9 }}>Coffee&nbsp;·&nbsp;Dealer&nbsp;·&nbsp;Curator</div>
            </div>
          </div>
        </div>
        <div className="px-4 pt-2">
          <div className="eyebrow px-3 pb-2">Operaciones</div>
          <nav className="flex flex-col gap-0.5">
            {NAV.map(({ to, label, icon: Icon, end }) => (
              <NavLink key={to} to={to} end={end}
                className={({ isActive }) => [
                  "flex items-center gap-3 px-3 py-2.5 rounded-sm transition-colors text-sm",
                  isActive ? "bg-white font-medium text-[color:var(--m-terracotta)]" : "text-[color:var(--m-ink-2)] hover:bg-white/60 hover:text-[color:var(--m-ink)]",
                ].join(" ")}>
                <Icon className="w-[18px] h-[18px]" strokeWidth={1.6} /><span>{label}</span>
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="mt-auto px-6 py-6" style={{ borderTop: "1px solid var(--m-border)" }}>
          <button onClick={() => navigate("/pos")}
            className="w-full text-sm py-2.5 px-3 rounded-sm transition-colors text-white font-medium"
            style={{ background: "var(--m-terracotta)" }}>+ Registrar compra</button>
          <p className="eyebrow mt-4 text-center" style={{ fontSize: 9, letterSpacing: "0.2em" }}>v1.0&nbsp;·&nbsp;Interno</p>
        </div>
      </aside>
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 flex items-center gap-3 px-4 py-3"
        style={{ background: "var(--m-sidebar)", borderBottom: "1px solid var(--m-border)" }}>
        <div className="w-8 h-8 flex items-center justify-center rounded-sm" style={{ background: "var(--m-terracotta)" }}>
          <Coffee className="w-4 h-4 text-white" strokeWidth={1.8} />
        </div>
        <div className="font-serif text-lg font-semibold">Manino</div>
        <div className="ml-auto flex gap-1 overflow-x-auto">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end}
              className={({ isActive }) => ["flex items-center gap-1.5 px-2.5 py-1.5 rounded-sm text-xs whitespace-nowrap",
                isActive ? "bg-white text-[color:var(--m-terracotta)]" : "text-[color:var(--m-ink-2)]"].join(" ")}>
              <Icon className="w-3.5 h-3.5" strokeWidth={1.8} /><span>{label}</span>
            </NavLink>
          ))}
        </div>
      </div>
      <main className="flex-1 min-w-0 pt-[68px] lg:pt-0"><Outlet /></main>
    </div>
  );
}
