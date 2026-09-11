import React, { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate, Link } from "react-router-dom";
import {
  LayoutDashboard, FolderKanban, PlusCircle, ClipboardList, LogOut, Menu, X, Leaf, ShieldCheck, WalletCards, Bell, ReceiptIndianRupee,
} from "lucide-react";
import { usePortalAuth } from "./PortalAuthContext";
import { toast } from "sonner";
import { api } from "@/lib/api";

const CLIENT_NAV = [
  { to: "/portal/dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { to: "/portal/projects", label: "My Projects", Icon: FolderKanban },
  { to: "/portal/projects/new", label: "Create Project", Icon: PlusCircle },
  { to: "/portal/invoices", label: "Invoices & Receipts", Icon: ReceiptIndianRupee },
];

const REVIEWER_NAV = [
  { to: "/reviewer/dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { to: "/reviewer/assignments", label: "My Assignments", Icon: ClipboardList },
  { to: "/reviewer/account", label: "Plan & Earnings", Icon: WalletCards },
  { to: "/reviewer/invoices", label: "Invoices & Receipts", Icon: ReceiptIndianRupee },
];

export function PortalLayout({ role }) {
  const { user, logout } = usePortalAuth();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const navigate = useNavigate();
  const NAV = role === "reviewer" ? REVIEWER_NAV : CLIENT_NAV;

  useEffect(() => {
    const base = role === "reviewer" ? "/reviewer" : "/client";
    api.get(`${base}/notifications`).then(({ data }) => setNotifications(data || [])).catch(() => setNotifications([]));
  }, [role]);

  const markRead = async (notice) => {
    if (notice.read) return;
    const base = role === "reviewer" ? "/reviewer" : "/client";
    try {
      await api.post(`${base}/notifications/${notice.id}/read`);
      setNotifications((items) => items.map((item) => item.id === notice.id ? { ...item, read: true } : item));
    } catch (_) {}
  };

  const doLogout = async () => {
    await logout();
    toast.success("Logged out");
    navigate("/portal/login");
  };

  return (
    <div className="min-h-screen bg-[#F6F8FA] flex" data-testid="portal-shell">
      {/* Sidebar */}
      <aside className={`fixed lg:sticky top-0 left-0 z-50 h-screen w-64 bg-[#172033] text-white border-r border-white/10 flex flex-col transition-transform ${open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <div className="flex items-center justify-between px-5 h-[72px] border-b border-white/10">
          <Link to={role === "reviewer" ? "/reviewer/dashboard" : "/portal/dashboard"} className="flex items-center gap-2.5">
            <span className="h-9 w-9 rounded-lg bg-[#27F580]/15 flex items-center justify-center"><Leaf className="h-5 w-5 text-[#27F580]" /></span>
            <div>
              <div className="font-serif text-lg leading-none text-white">ClimateWallah</div>
              <div className="text-[11px] text-white/55 mt-0.5 capitalize">{role} workspace</div>
            </div>
          </Link>
          <button className="lg:hidden text-white/70" onClick={() => setOpen(false)}><X className="h-5 w-5" /></button>
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
                  isActive ? "bg-[#27F580] text-[#172033] font-semibold" : "text-white/70 hover:bg-white/10 hover:text-white"
                }`
              }
            >
              <Icon className="h-4.5 w-4.5" style={{ height: 18, width: 18 }} /> {label}
            </NavLink>
          ))}
        </nav>
        <div className="px-3 pb-4">
          <Link to={role === "reviewer" ? "/reviewer/account" : "/portal/dashboard"} onClick={() => setOpen(false)} className="block rounded-lg bg-white/5 border border-white/10 p-3 mb-2 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#27F580]">
            <div className="text-sm font-medium text-white truncate">{user?.name}</div>
            <div className="text-xs text-white/50 truncate">{user?.public_id ? `${user.public_id} · ` : ""}{user?.email}</div>
            {role === "reviewer" && <span className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${user?.reviewer_status === "approved" ? "bg-[#27F580] text-[#172033]" : user?.reviewer_status === "suspended" ? "bg-purple-300 text-[#172033]" : "bg-amber-400 text-[#172033]"}`}>{(user?.reviewer_status || "pending").replace(/_/g, " ")}</span>}
          </Link>
          <button
            onClick={doLogout}
            data-testid="portal-logout-btn"
            className="w-full flex items-center gap-2 rounded-lg px-3.5 py-2.5 text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white transition-colors"
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
          <div className="ml-auto flex items-center gap-3">
            <div className="relative">
              <button onClick={() => setNoticeOpen((v) => !v)} className="relative rounded-lg border border-border bg-white p-2 text-charcoal/70 hover:border-natural-green" aria-label="Notifications">
                <Bell className="h-5 w-5" />
                {notifications.some((n) => !n.read) && <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-red-500" />}
              </button>
              {noticeOpen && <div className="absolute right-0 mt-2 w-[340px] max-w-[85vw] overflow-hidden rounded-xl border border-border bg-white shadow-xl">
                <div className="border-b border-border px-4 py-3"><div className="font-medium text-charcoal">Notifications</div><div className="text-xs text-charcoal/50">{notifications.filter((n) => !n.read).length} unread</div></div>
                <div className="max-h-96 overflow-y-auto">
                  {notifications.length === 0 ? <div className="px-4 py-8 text-center text-sm text-charcoal/50">No notifications yet.</div> : notifications.slice(0, 20).map((n) => <button key={n.id} onClick={() => markRead(n)} className={`block w-full border-b border-border px-4 py-3 text-left hover:bg-[#F6F8FA] ${n.read ? "bg-white" : "bg-natural-green/5"}`}>
                    <div className="flex items-start justify-between gap-2"><div className="text-sm font-medium text-charcoal">{n.title}</div>{!n.read && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-natural-green" />}</div>
                    <div className="mt-1 text-xs leading-5 text-charcoal/60">{n.message}</div>
                    <div className="mt-1 text-[10px] text-charcoal/40">{n.created_at ? new Date(n.created_at).toLocaleString("en-IN") : ""}</div>
                  </button>)}
                </div>
              </div>}
            </div>
            <Link to="/" className="text-sm text-deep-forest-green hover:underline">← Back to website</Link>
          </div>
        </header>
        <main className="flex-1 p-5 lg:p-8 max-w-[1200px] w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
