import React, { useState } from "react";
import { NavLink, Outlet, useNavigate, Link } from "react-router-dom";
import {
  LayoutDashboard, FolderKanban, PlusCircle, ClipboardList, LogOut, Menu, X, Leaf, ShieldCheck,
} from "lucide-react";
import { usePortalAuth } from "./PortalAuthContext";
import { toast } from "sonner";

const CLIENT_NAV = [
  { to: "/portal/dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { to: "/portal/projects", label: "My Projects", Icon: FolderKanban },
  { to: "/portal/projects/new", label: "Create Project", Icon: PlusCircle },
];

const REVIEWER_NAV = [
  { to: "/reviewer/dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { to: "/reviewer/assignments", label: "My Assignments", Icon: ClipboardList },
];

export function PortalLayout({ role }) {
  const { user, logout } = usePortalAuth();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const NAV = role === "reviewer" ? REVIEWER_NAV : CLIENT_NAV;

  const doLogout = async () => {
    await logout();
    toast.success("Logged out");
    navigate("/portal/login");
  };

  return (
    <div className="min-h-screen bg-off-white flex" data-testid="portal-shell">
      {/* Sidebar */}
      <aside className={`fixed lg:sticky top-0 left-0 z-50 h-screen w-64 bg-white border-r border-border flex flex-col transition-transform ${open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <div className="flex items-center justify-between px-5 h-[72px] border-b border-border">
          <Link to={role === "reviewer" ? "/reviewer/dashboard" : "/portal/dashboard"} className="flex items-center gap-2.5">
            <span className="h-9 w-9 rounded-lg bg-natural-green/10 flex items-center justify-center"><Leaf className="h-5 w-5 text-natural-green" /></span>
            <div>
              <div className="font-serif text-lg leading-none text-deep-forest-green">RES Portal</div>
              <div className="text-[11px] text-charcoal/50 mt-0.5 capitalize">{role} workspace</div>
            </div>
          </Link>
          <button className="lg:hidden text-charcoal/60" onClick={() => setOpen(false)}><X className="h-5 w-5" /></button>
        </div>
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {NAV.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to.endsWith("/projects")}
              onClick={() => setOpen(false)}
              data-testid={`portal-nav-${label.toLowerCase().replace(/\s+/g, "-")}`}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium transition-colors ${
                  isActive ? "bg-natural-green text-white" : "text-charcoal/70 hover:bg-warm-beige"
                }`
              }
            >
              <Icon className="h-4.5 w-4.5" style={{ height: 18, width: 18 }} /> {label}
            </NavLink>
          ))}
        </nav>
        <div className="px-3 pb-4">
          <div className="rounded-lg bg-off-white border border-border p-3 mb-2">
            <div className="text-sm font-medium text-charcoal truncate">{user?.name}</div>
            <div className="text-xs text-charcoal/50 truncate">{user?.email}</div>
          </div>
          <button
            onClick={doLogout}
            data-testid="portal-logout-btn"
            className="w-full flex items-center gap-2 rounded-lg px-3.5 py-2.5 text-sm font-medium text-charcoal/70 hover:bg-warm-beige transition-colors"
          >
            <LogOut className="h-4 w-4" /> Log out
          </button>
        </div>
      </aside>

      {open && <div className="fixed inset-0 z-40 bg-black/30 lg:hidden" onClick={() => setOpen(false)} />}

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 h-[72px] bg-white/90 backdrop-blur border-b border-border flex items-center justify-between px-5">
          <button className="lg:hidden text-charcoal/70" onClick={() => setOpen(true)}><Menu className="h-6 w-6" /></button>
          <div className="hidden lg:flex items-center gap-2 text-xs text-charcoal/60">
            <ShieldCheck className="h-4 w-4 text-natural-green" />
            RES Internal / Preliminary Assessment — not an official IGBC certification.
          </div>
          <Link to="/" className="text-sm text-natural-green hover:underline">← Back to website</Link>
        </header>
        <main className="flex-1 p-5 lg:p-8 max-w-[1200px] w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
