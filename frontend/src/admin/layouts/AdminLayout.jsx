import React, { useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Home, Info, Wrench, FolderKanban, Users, FileText, Mail,
  Image, FileDown, Settings, Search, Scale, KeyRound, LogOut, Menu, X, Leaf, ChevronRight,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

const NAV = [
  { to: "/admin/dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { to: "/admin/homepage", label: "Homepage", Icon: Home },
  { to: "/admin/about", label: "About", Icon: Info },
  { to: "/admin/services", label: "Services", Icon: Wrench },
  { to: "/admin/projects", label: "Projects", Icon: FolderKanban },
  { to: "/admin/team", label: "Team", Icon: Users },
  { to: "/admin/blog", label: "Blog", Icon: FileText },
  { to: "/admin/enquiries", label: "Enquiries", Icon: Mail },
  { to: "/admin/media", label: "Media", Icon: Image },
  { to: "/admin/capability", label: "Capability PDF", Icon: FileDown },
  { to: "/admin/settings", label: "Website Settings", Icon: Settings },
  { to: "/admin/seo", label: "SEO Settings", Icon: Search },
  { to: "/admin/legal", label: "Legal Pages", Icon: Scale },
  { to: "/admin/change-password", label: "Change Password", Icon: KeyRound },
];

export function AdminLayout() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const current = NAV.find((n) => location.pathname.startsWith(n.to));

  const doLogout = async () => { await logout(); toast.success("Logged out"); navigate("/admin/login"); };

  return (
    <div className="min-h-screen bg-off-white flex">
      {/* Sidebar */}
      <aside className={`fixed lg:sticky top-0 left-0 z-50 h-screen w-72 bg-deep-forest-green text-off-white flex flex-col transition-transform ${open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <div className="flex items-center justify-between px-6 h-20 border-b border-off-white/10">
          <div className="flex items-center gap-2.5">
            <span className="h-9 w-9 rounded-full bg-off-white/15 flex items-center justify-center"><Leaf className="h-5 w-5" /></span>
            <div><div className="font-serif text-xl leading-none">RES Admin</div></div>
          </div>
          <button className="lg:hidden" onClick={() => setOpen(false)}><X className="h-5 w-5" /></button>
        </div>
        <nav className="flex-1 overflow-y-auto no-scrollbar py-4 px-3">
          {NAV.map(({ to, label, Icon }) => (
            <NavLink key={to} to={to} onClick={() => setOpen(false)} data-testid={`admin-nav-${label.toLowerCase().replace(/ /g, "-")}`}
              className={({ isActive }) => `flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm mb-1 transition-colors ${isActive ? "bg-off-white/15 text-off-white" : "text-light-mint/70 hover:bg-off-white/10 hover:text-off-white"}`}>
              <Icon className="h-5 w-5" strokeWidth={1.5} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-off-white/10">
          <button onClick={doLogout} data-testid="admin-logout" className="flex w-full items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm text-light-mint/70 hover:bg-off-white/10 hover:text-off-white transition-colors">
            <LogOut className="h-5 w-5" strokeWidth={1.5} /> Logout
          </button>
        </div>
      </aside>

      {open && <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setOpen(false)} />}

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 bg-off-white/90 backdrop-blur-xl border-b border-border h-16 flex items-center px-4 md:px-8 gap-4">
          <button className="lg:hidden text-charcoal" onClick={() => setOpen(true)}><Menu className="h-6 w-6" /></button>
          <div className="flex items-center gap-2 text-sm text-charcoal/60">
            <span>Admin</span>
            {current && <><ChevronRight className="h-4 w-4" /><span className="text-charcoal font-medium">{current.label}</span></>}
          </div>
          <div className="ml-auto text-sm text-charcoal/70 hidden sm:block">{user?.email}</div>
        </header>
        <main className="flex-1 p-4 md:p-8 max-w-full">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
