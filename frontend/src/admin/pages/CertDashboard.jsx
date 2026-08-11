import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Users, UserCog, Award, Inbox, Eye, MessageSquareWarning, Gavel, CheckCircle2, ArrowRight } from "lucide-react";
import { api } from "@/lib/api";

const StatCard = ({ Icon, label, value, tone = "green", onClick, testid }) => (
  <button onClick={onClick} data-testid={testid}
    className={`text-left rounded-xl border p-4 transition-colors ${onClick ? "hover:border-turquoise cursor-pointer" : "cursor-default"} ${tone === "accent" ? "bg-turquoise/10 border-turquoise/30" : "bg-white border-border"}`}>
    <div className="flex items-center gap-3">
      <span className={`h-10 w-10 rounded-lg flex items-center justify-center ${tone === "accent" ? "bg-turquoise/20 text-deep-forest-green" : "bg-deep-forest-green/10 text-deep-forest-green"}`}><Icon className="h-5 w-5" /></span>
      <div>
        <div className="text-2xl font-semibold text-deep-forest-green" data-testid={`${testid}-value`}>{value ?? 0}</div>
        <div className="text-xs text-charcoal/55">{label}</div>
      </div>
    </div>
  </button>
);

export default function CertDashboard() {
  const [d, setD] = useState(null);
  const navigate = useNavigate();

  useEffect(() => { api.get("/admin/portal/dashboard").then(({ data }) => setD(data)).catch(() => setD({})); }, []);

  if (d === null) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-natural-green" /></div>;

  const goProjects = () => navigate("/admin/certification/projects");

  return (
    <div data-testid="cert-dashboard">
      <h1 className="text-2xl font-serif text-deep-forest-green mb-1">Certification Portal Overview</h1>
      <p className="text-sm text-charcoal/60 mb-6">Clients, reviewers and the certification project pipeline at a glance.</p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <StatCard Icon={Users} label="Clients" value={d.clients} testid="stat-clients" onClick={() => navigate("/admin/certification/clients")} />
        <StatCard Icon={UserCog} label="Reviewers" value={d.reviewers} testid="stat-reviewers" onClick={() => navigate("/admin/certification/reviewers")} />
        <StatCard Icon={Award} label="Total Projects" value={d.projects} testid="stat-projects" onClick={goProjects} />
        <StatCard Icon={Inbox} label="New / Unassigned" value={d.unassigned} tone="accent" testid="stat-unassigned" onClick={goProjects} />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard Icon={Eye} label="Under Review" value={d.under_review} testid="stat-under-review" onClick={goProjects} />
        <StatCard Icon={MessageSquareWarning} label="Changes Requested" value={d.changes_requested} testid="stat-changes" onClick={goProjects} />
        <StatCard Icon={Gavel} label="Awaiting Admin" value={d.awaiting_admin} tone="accent" testid="stat-awaiting" onClick={goProjects} />
        <StatCard Icon={CheckCircle2} label="Certified" value={d.certified} testid="stat-certified" onClick={goProjects} />
      </div>

      <div className="mt-8">
        <button onClick={goProjects} className="inline-flex items-center gap-2 rounded-lg bg-deep-forest-green text-off-white px-5 py-2.5 text-sm font-medium hover:bg-natural-green transition-colors" data-testid="dash-view-projects">
          View all projects <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
