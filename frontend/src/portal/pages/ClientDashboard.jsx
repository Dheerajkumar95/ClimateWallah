import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FolderKanban, PlusCircle, Send, ClipboardCheck, Loader2, ArrowRight } from "lucide-react";
import { api } from "@/lib/api";
import { usePortalAuth } from "../PortalAuthContext";
import { PageHeader, Card, StatusBadge, BandBadge } from "./ui";

const Stat = ({ Icon, label, value }) => (
  <Card className="flex items-center gap-4">
    <span className="h-11 w-11 rounded-xl bg-natural-green/10 flex items-center justify-center"><Icon className="h-5 w-5 text-natural-green" /></span>
    <div>
      <div className="text-2xl font-semibold text-deep-forest-green" data-testid={`stat-${label.toLowerCase()}`}>{value}</div>
      <div className="text-xs text-charcoal/55">{label}</div>
    </div>
  </Card>
);

export default function ClientDashboard() {
  const { user } = usePortalAuth();
  const [projects, setProjects] = useState(null);

  useEffect(() => {
    api.get("/client/projects").then(({ data }) => setProjects(data)).catch(() => setProjects([]));
  }, []);

  if (projects === null) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-natural-green" /></div>;

  const submitted = projects.filter((p) => p.status !== "draft").length;
  const drafts = projects.filter((p) => p.status === "draft").length;

  return (
    <div data-testid="client-dashboard">
      <PageHeader
        title={`Welcome, ${user?.name?.split(" ")[0] || "there"}`}
        subtitle="Track and manage your green building certification projects."
        action={<Link to="/portal/projects/new" data-testid="dash-create-btn" className="inline-flex items-center gap-2 rounded-lg bg-deep-forest-green text-off-white px-4 py-2.5 text-sm font-medium hover:bg-natural-green transition-colors"><PlusCircle className="h-4 w-4" /> New Project</Link>}
      />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <Stat Icon={FolderKanban} label="Projects" value={projects.length} />
        <Stat Icon={ClipboardCheck} label="Drafts" value={drafts} />
        <Stat Icon={Send} label="Submitted" value={submitted} />
      </div>

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-medium text-charcoal">Recent projects</h2>
        <Link to="/portal/projects" className="text-sm text-deep-forest-green hover:underline">View all</Link>
      </div>
      {projects.length === 0 ? (
        <Card className="text-center py-12">
          <p className="text-charcoal/60 mb-4">You have no certification projects yet.</p>
          <Link to="/portal/projects/new" className="inline-flex items-center gap-2 rounded-lg bg-deep-forest-green text-off-white px-4 py-2.5 text-sm font-medium hover:bg-natural-green transition-colors"><PlusCircle className="h-4 w-4" /> Create your first project</Link>
        </Card>
      ) : (
        <div className="space-y-3">
          {projects.slice(0, 5).map((p) => (
            <Link key={p.id} to={`/portal/projects/${p.id}`} data-testid={`project-card-${p.id}`}
              className="group flex items-center justify-between bg-white border border-border rounded-xl px-5 py-4 hover:border-natural-green/50 transition-colors">
              <div>
                <div className="font-medium text-charcoal">{p.name}</div>
                <div className="text-xs text-charcoal/50 mt-0.5">{p.project_type} · {p.occupancy_type}-occupied</div>
              </div>
              <div className="flex items-center gap-3">
                {!p.under_configuration && <span className="text-sm text-charcoal/70">{p.claimed_total}/{p.total_max}</span>}
                {p.under_configuration ? <span className="text-xs text-amber-600">Checklist under configuration</span> : <BandBadge band={p.band} />}
                <StatusBadge status={p.status} />
                <ArrowRight className="h-4 w-4 text-charcoal/30 group-hover:text-natural-green transition-colors" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
