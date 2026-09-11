import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, ClipboardList, ArrowRight, ShieldCheck, AlertTriangle, CreditCard } from "lucide-react";
import { api } from "@/lib/api";
import { usePortalAuth } from "../PortalAuthContext";
import { PageHeader, Card, StatusBadge, BandBadge } from "./ui";

export default function ReviewerDashboard() {
  const { user } = usePortalAuth();
  const [items, setItems] = useState(null);
  const [account, setAccount] = useState(null);

  useEffect(() => {
    Promise.all([
      api.get("/reviewer/assignments").catch(() => ({ data: [] })),
      api.get("/reviewer/account").catch(() => ({ data: null })),
    ]).then(([assignments, profile]) => { setItems(assignments.data); setAccount(profile.data); });
  }, []);

  if (items === null) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-natural-green" /></div>;

  return (
    <div data-testid="reviewer-dashboard">
      <PageHeader title={`Reviewer workspace`} subtitle={`Signed in as ${user?.name}. Projects assigned to you appear below.`} />
      {account && account.profile?.reviewer_status !== "approved" && (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" /><div><div className="font-semibold capitalize">Profile {(account.profile?.reviewer_status || "pending").replace(/_/g, " ")}</div><div>Admin verification is required before projects can be assigned. <Link to="/reviewer/account" className="font-semibold underline">View application status</Link></div></div></div>
      )}
      {account?.profile?.reviewer_status === "approved" && account.profile?.requires_subscription && !account.subscription?.active && (
        <div className="mb-5 flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><div className="flex gap-3"><CreditCard className="mt-0.5 h-5 w-5 shrink-0" /><div><div className="font-semibold">Reviewer plan {account.subscription?.status === "expired" ? "expired" : "inactive"}</div><div>Renew your monthly plan to receive new assignments. Earned payouts remain safe.</div></div></div><Link to="/reviewer/account" className="shrink-0 rounded-lg bg-[#172033] px-3 py-2 text-xs font-semibold text-white">Recharge</Link></div>
      )}
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
