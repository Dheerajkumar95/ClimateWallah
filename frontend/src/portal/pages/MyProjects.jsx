import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PlusCircle, Loader2, ArrowRight } from "lucide-react";
import { api } from "@/lib/api";
import { PageHeader, Card, StatusBadge, BandBadge, ProgressBar } from "./ui";

export default function MyProjects() {
  const [projects, setProjects] = useState(null);

  useEffect(() => {
    api.get("/client/projects").then(({ data }) => setProjects(data)).catch(() => setProjects([]));
  }, []);

  if (projects === null) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-natural-green" /></div>;

  return (
    <div data-testid="my-projects">
      <PageHeader
        title="My Projects"
        subtitle="All your certification projects in one place."
        action={<Link to="/portal/projects/new" data-testid="projects-create-btn" className="inline-flex items-center gap-2 rounded-lg bg-deep-forest-green text-off-white px-4 py-2.5 text-sm font-medium hover:bg-natural-green transition-colors"><PlusCircle className="h-4 w-4" /> New Project</Link>}
      />
      {projects.length === 0 ? (
        <Card className="text-center py-12"><p className="text-charcoal/60">No projects yet. Create one to begin the certification wizard.</p></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {projects.map((p) => (
            <Link key={p.id} to={`/portal/projects/${p.id}`} data-testid={`project-card-${p.id}`}
              className="group bg-white border border-border rounded-2xl p-5 hover:border-natural-green/50 transition-colors">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <div className="font-medium text-charcoal">{p.name}</div>
                  <div className="text-xs text-charcoal/50 mt-0.5">{p.project_type} · {p.occupancy_type}-occupied</div>
                </div>
                <StatusBadge status={p.status} />
              </div>
              {p.under_configuration ? (
                <p className="text-xs text-amber-600 mb-2">Checklist under configuration for this project type.</p>
              ) : (
                <>
                  <div className="flex items-center justify-between text-xs text-charcoal/60 mb-1.5">
                    <span>Claimed score</span><span>{p.claimed_total} / {p.total_max}</span>
                  </div>
                  <ProgressBar value={p.claimed_total} max={p.total_max} />
                  <div className="mt-3 flex items-center justify-between">
                    <BandBadge band={p.band} />
                    <span className="inline-flex items-center gap-1 text-sm text-natural-green group-hover:gap-2 transition-all">Open <ArrowRight className="h-4 w-4" /></span>
                  </div>
                </>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
