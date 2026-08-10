import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Loader2, ShieldCheck, ChevronLeft } from "lucide-react";
import { api } from "@/lib/api";
import { PageHeader, Card, StatusBadge, BandBadge, ProgressBar } from "./ui";

export default function ReviewerProject() {
  const { id } = useParams();
  const [p, setP] = useState(null);

  useEffect(() => {
    api.get(`/reviewer/projects/${id}`).then(({ data }) => setP(data)).catch(() => setP(false));
  }, [id]);

  if (p === null) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-natural-green" /></div>;
  if (p === false) return <Card className="text-center py-12"><p className="text-charcoal/60">Assignment not found.</p><Link to="/reviewer/assignments" className="text-natural-green hover:underline text-sm mt-3 inline-block">← Back</Link></Card>;

  const tpl = p.template;
  const score = p.score || {};

  return (
    <div data-testid="reviewer-project">
      <Link to="/reviewer/assignments" className="inline-flex items-center gap-1 text-sm text-charcoal/60 hover:text-natural-green mb-3"><ChevronLeft className="h-4 w-4" /> Back to assignments</Link>
      <PageHeader title={p.name} subtitle={`${p.project_type} · ${p.occupancy_type}-occupied`} action={<StatusBadge status={p.status} />} />

      <div className="rounded-xl bg-warm-beige/60 border border-border px-4 py-2.5 text-xs text-charcoal/70 flex items-center gap-2 mb-5">
        <ShieldCheck className="h-4 w-4 text-natural-green" /> RES Internal / Preliminary Assessment — not an official IGBC certification.
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
        <div className="space-y-4">
          {tpl?.categories?.map((c) => (
            <Card key={c.id}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium text-charcoal">{c.name}</h3>
                <span className="text-sm text-charcoal/60">{score.categories?.[c.id] || 0}/{c.max_points}</span>
              </div>
              <div className="space-y-2">
                {c.criteria.map((cr) => {
                  const r = p.responses?.[cr.id] || {};
                  return (
                    <div key={cr.id} className="flex items-center justify-between text-sm border-b border-border/60 last:border-0 py-1.5">
                      <span className="text-charcoal/80">{cr.name} <span className="text-charcoal/40 text-xs">({cr.code})</span></span>
                      <span className="text-charcoal/70 shrink-0">{cr.mandatory ? (r.met ? "✓ Met" : "—") : `${r.claimed_points || 0} pts`}</span>
                    </div>
                  );
                })}
              </div>
            </Card>
          ))}
        </div>
        <div>
          <Card>
            <div className="text-xs text-charcoal/55 mb-1">Client claimed score</div>
            <div className="flex items-end justify-between mb-2">
              <div className="text-3xl font-semibold text-deep-forest-green">{score.claimed_total || 0}<span className="text-base text-charcoal/50">/{score.total_max}</span></div>
              <BandBadge band={score.band} />
            </div>
            <ProgressBar value={score.claimed_total || 0} max={score.total_max} />
            <p className="text-xs text-charcoal/50 mt-4">Reviewer recommendation tools (recommend points, request changes, forward to admin) are coming in the next release.</p>
          </Card>
        </div>
      </div>
    </div>
  );
}
