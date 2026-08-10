import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, ClipboardList, ArrowRight, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import { usePortalAuth } from "../PortalAuthContext";
import { PageHeader, Card, StatusBadge, BandBadge } from "./ui";

export default function ReviewerDashboard() {
  const { user } = usePortalAuth();
  const [items, setItems] = useState(null);

  useEffect(() => {
    api.get("/reviewer/assignments").then(({ data }) => setItems(data)).catch(() => setItems([]));
  }, []);

  if (items === null) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-natural-green" /></div>;

  return (
    <div data-testid="reviewer-dashboard">
      <PageHeader title={`Reviewer workspace`} subtitle={`Signed in as ${user?.name}. Projects assigned to you appear below.`} />
      <div className="rounded-xl bg-warm-beige/60 border border-border px-4 py-2.5 text-xs text-charcoal/70 flex items-center gap-2 mb-5">
        <ShieldCheck className="h-4 w-4 text-natural-green" /> Reviewers recommend points — final certification is issued by RES Admin only.
      </div>

      <h2 className="text-lg font-medium text-charcoal mb-3 flex items-center gap-2"><ClipboardList className="h-5 w-5 text-natural-green" /> My assignments</h2>
      {items.length === 0 ? (
        <Card className="text-center py-12"><p className="text-charcoal/60">No projects assigned yet.</p></Card>
      ) : (
        <div className="space-y-3">
          {items.map((p) => (
            <Link key={p.id} to={`/reviewer/projects/${p.id}`} data-testid={`assignment-${p.id}`}
              className="group flex items-center justify-between bg-white border border-border rounded-xl px-5 py-4 hover:border-natural-green/50 transition-colors">
              <div>
                <div className="font-medium text-charcoal">{p.name}</div>
                <div className="text-xs text-charcoal/50 mt-0.5">{p.project_type} · {p.client?.name || "—"} {p.client?.organization ? `(${p.client.organization})` : ""}</div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-charcoal/70">{p.claimed_total}/{p.total_max}</span>
                <BandBadge band={p.band} />
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
