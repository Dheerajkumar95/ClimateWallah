import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FolderKanban, Wrench, Users, FileText, Mail, Plus, Eye, PenSquare, FileDown } from "lucide-react";
import { api } from "@/lib/api";
import { Loader } from "@/admin/components/ui";

export default function Dashboard() {
  const [d, setD] = useState(null);
  useEffect(() => { api.get("/admin/dashboard").then((r) => setD(r.data)).catch(() => setD({})); }, []);
  if (!d) return <Loader />;

  const stats = [
    { label: "Total Projects", value: d.total_projects, Icon: FolderKanban, sub: `${d.published_projects} published` },
    { label: "Services", value: d.total_services, Icon: Wrench },
    { label: "Team Members", value: d.total_team, Icon: Users },
    { label: "Blog Posts", value: d.total_blogs, Icon: FileText, sub: `${d.draft_blogs} drafts` },
    { label: "Total Enquiries", value: d.total_enquiries, Icon: Mail, sub: `${d.new_enquiries} new` },
  ];

  const actions = [
    { to: "/admin/projects", label: "Add Project", Icon: Plus },
    { to: "/admin/services", label: "Add Service", Icon: Plus },
    { to: "/admin/blog", label: "Add Blog", Icon: PenSquare },
    { to: "/admin/enquiries", label: "View Enquiries", Icon: Eye },
    { to: "/admin/settings", label: "Update Contact Info", Icon: Wrench },
    { to: "/admin/capability", label: "Replace Capability PDF", Icon: FileDown },
  ];

  return (
    <div data-testid="admin-dashboard">
      <h1 className="text-3xl font-serif text-deep-forest-green">Dashboard</h1>
      <p className="text-charcoal/60 mt-1">Overview of your RES website content.</p>

      <div className="mt-8 grid grid-cols-2 lg:grid-cols-5 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-white border border-border rounded-xl p-5">
            <div className="flex items-center justify-between">
              <span className="h-10 w-10 rounded-lg bg-light-mint text-deep-forest-green flex items-center justify-center"><s.Icon className="h-5 w-5" strokeWidth={1.5} /></span>
            </div>
            <div className="mt-4 text-3xl font-serif text-deep-forest-green">{s.value ?? 0}</div>
            <div className="text-sm text-charcoal/60">{s.label}</div>
            {s.sub && <div className="text-xs text-natural-green mt-1">{s.sub}</div>}
          </div>
        ))}
      </div>

      <h2 className="mt-10 text-lg font-serif text-deep-forest-green">Quick actions</h2>
      <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {actions.map((a) => (
          <Link key={a.label} to={a.to} className="flex items-center gap-3 bg-white border border-border rounded-xl px-5 py-4 hover:border-natural-green/40 transition-colors">
            <span className="h-9 w-9 rounded-lg bg-warm-beige text-deep-forest-green flex items-center justify-center"><a.Icon className="h-5 w-5" strokeWidth={1.5} /></span>
            <span className="text-sm font-medium text-charcoal">{a.label}</span>
          </Link>
        ))}
      </div>

      <h2 className="mt-10 text-lg font-serif text-deep-forest-green">Recent enquiries</h2>
      <div className="mt-4 bg-white border border-border rounded-xl overflow-hidden">
        {(!d.recent_enquiries || d.recent_enquiries.length === 0) ? (
          <div className="p-8 text-center text-charcoal/50 text-sm">No enquiries yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-warm-beige/60 text-charcoal/60 text-xs uppercase tracking-wider">
              <tr><th className="text-left px-5 py-3">Name</th><th className="text-left px-5 py-3">Email</th><th className="text-left px-5 py-3 hidden md:table-cell">Subject</th><th className="text-left px-5 py-3">Status</th></tr>
            </thead>
            <tbody>
              {d.recent_enquiries.map((e) => (
                <tr key={e.id} className="border-t border-border">
                  <td className="px-5 py-3 font-medium">{e.name}</td>
                  <td className="px-5 py-3 text-charcoal/70">{e.email}</td>
                  <td className="px-5 py-3 text-charcoal/70 hidden md:table-cell">{e.subject || "—"}</td>
                  <td className="px-5 py-3"><span className="text-xs bg-light-mint text-deep-forest-green px-2.5 py-1 rounded-full">{e.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
