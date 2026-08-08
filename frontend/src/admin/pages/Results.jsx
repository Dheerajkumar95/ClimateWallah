import React, { useEffect, useState } from "react";
import { Eye } from "lucide-react";
import { api } from "@/lib/api";
import { Modal, Loader, Empty } from "@/admin/components/ui";

export function AssessmentResults() {
  const [data, setData] = useState(null);
  const [sel, setSel] = useState(null);
  useEffect(() => { api.get("/admin/assessment-results", { params: { limit: 100 } }).then((r) => setData(r.data)).catch(() => setData({ items: [] })); }, []);

  return (
    <div data-testid="admin-assessment-results">
      <h1 className="text-3xl font-serif text-deep-forest-green">Assessment Results</h1>
      <p className="text-charcoal/60 mt-1">Sustainability readiness assessment submissions.</p>
      <div className="mt-6 bg-white border border-border rounded-xl overflow-hidden">
        {data === null ? <Loader /> : data.items.length === 0 ? <Empty message="No submissions yet." /> : (
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead className="bg-warm-beige/60 text-charcoal/60 text-xs uppercase tracking-wider"><tr><th className="text-left px-5 py-3">Name</th><th className="text-left px-5 py-3">Email</th><th className="text-left px-5 py-3">Score</th><th className="text-left px-5 py-3">Band</th><th className="text-left px-5 py-3 hidden md:table-cell">Date</th><th className="px-5 py-3 text-right">View</th></tr></thead>
            <tbody>{data.items.map((r) => (
              <tr key={r.id} className="border-t border-border hover:bg-warm-beige/30"><td className="px-5 py-3 font-medium">{r.name}</td><td className="px-5 py-3 text-charcoal/70">{r.email}</td><td className="px-5 py-3">{r.overall_score}/100</td><td className="px-5 py-3">{r.band}</td><td className="px-5 py-3 text-charcoal/60 hidden md:table-cell">{(r.created_at || "").slice(0, 10)}</td><td className="px-5 py-3 text-right"><button onClick={() => setSel(r)} className="p-2 rounded-lg hover:bg-warm-beige text-charcoal/70"><Eye className="h-4 w-4" /></button></td></tr>
            ))}</tbody>
          </table></div>
        )}
      </div>
      <Modal open={!!sel} onClose={() => setSel(null)} title="Assessment result" wide>
        {sel && (
          <div className="space-y-4 text-sm">
            <div className="grid sm:grid-cols-2 gap-3">{[["Name", sel.name], ["Email", sel.email], ["Phone", sel.phone], ["Company", sel.company], ["Overall", `${sel.overall_score}/100`], ["Band", sel.band]].map(([k, v]) => <div key={k}><div className="text-xs uppercase tracking-wider text-charcoal/50">{k}</div><div className="text-charcoal">{v || "—"}</div></div>)}</div>
            <div><div className="text-xs uppercase tracking-wider text-charcoal/50 mb-2">Category scores</div>{Object.entries(sel.category_scores || {}).map(([c, s]) => <div key={c} className="flex justify-between border-b border-border py-1"><span>{c}</span><span className="font-medium">{s}%</span></div>)}</div>
            {sel.gaps?.length > 0 && <div><div className="text-xs uppercase tracking-wider text-charcoal/50 mb-1">Gaps</div><div>{sel.gaps.join(", ")}</div></div>}
          </div>
        )}
      </Modal>
    </div>
  );
}

export function CertificationResults() {
  const [data, setData] = useState(null);
  const [sel, setSel] = useState(null);
  useEffect(() => { api.get("/admin/certification-results", { params: { limit: 100 } }).then((r) => setData(r.data)).catch(() => setData({ items: [] })); }, []);

  return (
    <div data-testid="admin-certification-results">
      <h1 className="text-3xl font-serif text-deep-forest-green">Certification Finder Results</h1>
      <p className="text-charcoal/60 mt-1">Certification finder submissions and suggestions.</p>
      <div className="mt-6 bg-white border border-border rounded-xl overflow-hidden">
        {data === null ? <Loader /> : data.items.length === 0 ? <Empty message="No submissions yet." /> : (
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead className="bg-warm-beige/60 text-charcoal/60 text-xs uppercase tracking-wider"><tr><th className="text-left px-5 py-3">Name</th><th className="text-left px-5 py-3">Email</th><th className="text-left px-5 py-3 hidden md:table-cell">Building</th><th className="text-left px-5 py-3">Suggested</th><th className="px-5 py-3 text-right">View</th></tr></thead>
            <tbody>{data.items.map((r) => (
              <tr key={r.id} className="border-t border-border hover:bg-warm-beige/30"><td className="px-5 py-3 font-medium">{r.name}</td><td className="px-5 py-3 text-charcoal/70">{r.email}</td><td className="px-5 py-3 text-charcoal/70 hidden md:table-cell">{r.building_type || "—"}</td><td className="px-5 py-3">{(r.suggestions || []).map((s) => s.framework).join(", ")}</td><td className="px-5 py-3 text-right"><button onClick={() => setSel(r)} className="p-2 rounded-lg hover:bg-warm-beige text-charcoal/70"><Eye className="h-4 w-4" /></button></td></tr>
            ))}</tbody>
          </table></div>
        )}
      </div>
      <Modal open={!!sel} onClose={() => setSel(null)} title="Certification result" wide>
        {sel && (
          <div className="space-y-4 text-sm">
            <div className="grid sm:grid-cols-2 gap-3">{[["Name", sel.name], ["Email", sel.email], ["Phone", sel.phone], ["Company", sel.company], ["Building type", sel.building_type], ["Location", sel.location], ["Construction", sel.construction_type], ["Desired", sel.desired_outcome]].map(([k, v]) => <div key={k}><div className="text-xs uppercase tracking-wider text-charcoal/50">{k}</div><div className="text-charcoal">{v || "—"}</div></div>)}</div>
            <div><div className="text-xs uppercase tracking-wider text-charcoal/50 mb-2">Suggestions</div>{(sel.suggestions || []).map((s, i) => <div key={i} className="border-b border-border py-2"><div className="font-medium text-deep-forest-green">{s.framework}</div><div className="text-charcoal/70">{s.why}</div></div>)}</div>
          </div>
        )}
      </Modal>
    </div>
  );
}
