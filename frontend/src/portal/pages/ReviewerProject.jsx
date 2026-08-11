import React, { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Loader2, ShieldCheck, ChevronLeft, Save, Send, MessageSquareWarning, Paperclip, Check, X as XIcon } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { apiError } from "../PortalAuthContext";
import { PageHeader, Card, StatusBadge, BandBadge, ProgressBar, inpCls } from "./ui";

const EDITABLE = ["assigned", "submitted", "under_review"];

function bandFor(total, thresholds) {
  const t = thresholds?.find((x) => total >= x.min && total <= x.max);
  return t ? t.band : "Uncertified";
}

export default function ReviewerProject() {
  const { id } = useParams();
  const [p, setP] = useState(null);
  const [recs, setRecs] = useState({});
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data } = await api.get(`/reviewer/projects/${id}`);
    setP(data);
    const existing = data.reviewer_recommendations || {};
    // seed from client responses if reviewer hasn't started
    const seed = {};
    (data.template?.categories || []).forEach((c) => c.criteria.forEach((cr) => {
      const r = existing[cr.id] || data.responses?.[cr.id] || {};
      seed[cr.id] = cr.mandatory ? { met: !!r.met } : { recommended_points: r.recommended_points ?? r.claimed_points ?? 0 };
    }));
    setRecs(seed);
    setComment(data.reviewer_comment || "");
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  const editable = p && EDITABLE.includes(p.status);
  const tpl = p?.template;

  const recScore = useMemo(() => {
    if (!tpl || tpl.under_configuration) return { total: 0, max: 0, band: "Pending" };
    let total = 0;
    for (const c of tpl.categories) {
      let sum = 0;
      for (const cr of c.criteria) {
        if (cr.mandatory) continue;
        sum += Math.max(0, Math.min(Number(recs[cr.id]?.recommended_points || 0), cr.max_points));
      }
      total += Math.min(sum, c.max_points);
    }
    total = Math.min(total, tpl.total_max);
    return { total, max: tpl.total_max, band: bandFor(total, tpl.thresholds) };
  }, [recs, tpl]);

  const setRec = (critId, patch) => setRecs((r) => ({ ...r, [critId]: { ...(r[critId] || {}), ...patch } }));

  const reviewEvidence = async (criterionId, fileId, status) => {
    try {
      await api.post(`/reviewer/projects/${id}/evidence/${fileId}/review`, { criterion_id: criterionId, status });
      toast.success(`Evidence ${status}`);
      await load();
    } catch (e) { toast.error(apiError(e.response?.data?.detail)); }
  };

  const saveRecs = async () => {
    setBusy(true);
    try { await api.put(`/reviewer/projects/${id}/recommendations`, { recommendations: recs, reviewer_comment: comment }); toast.success("Recommendation saved"); await load(); }
    catch (e) { toast.error(apiError(e.response?.data?.detail)); } finally { setBusy(false); }
  };
  const requestChanges = async () => {
    if (!comment.trim()) { toast.error("Add a comment describing the changes required."); return; }
    setBusy(true);
    try { await api.post(`/reviewer/projects/${id}/request-changes`, { comment }); toast.success("Changes requested — sent back to client"); await load(); }
    catch (e) { toast.error(apiError(e.response?.data?.detail)); } finally { setBusy(false); }
  };
  const forward = async () => {
    setBusy(true);
    try { await api.put(`/reviewer/projects/${id}/recommendations`, { recommendations: recs, reviewer_comment: comment });
      await api.post(`/reviewer/projects/${id}/forward`, { comment }); toast.success("Forwarded to admin for final decision"); await load(); }
    catch (e) { toast.error(apiError(e.response?.data?.detail)); } finally { setBusy(false); }
  };

  if (p === null) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-natural-green" /></div>;
  if (p === false) return <Card className="text-center py-12"><p className="text-charcoal/60">Assignment not found.</p></Card>;

  return (
    <div data-testid="reviewer-project">
      <Link to="/reviewer/assignments" className="inline-flex items-center gap-1 text-sm text-charcoal/60 hover:text-natural-green mb-3"><ChevronLeft className="h-4 w-4" /> Back to assignments</Link>
      <PageHeader title={p.name} subtitle={`${p.project_type} · ${p.occupancy_type}-occupied · ${p.client?.name || ""}`} action={<StatusBadge status={p.status} />} />

      <div className="rounded-xl bg-warm-beige/60 border border-border px-4 py-2.5 text-xs text-charcoal/70 flex items-center gap-2 mb-5">
        <ShieldCheck className="h-4 w-4 text-natural-green" /> Reviewers recommend points — final certification is issued by RES Admin only.
      </div>

      {!editable && (
        <div className="mb-5 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 text-sm">This project is {p.status.replace(/_/g, " ")} and is read-only for review.</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
        <div className="space-y-4">
          {tpl?.categories?.map((c) => (
            <Card key={c.id} data-testid={`review-cat-${c.id}`}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium text-charcoal">{c.name}</h3>
                <span className="text-xs text-charcoal/50">Max {c.max_points}</span>
              </div>
              <div className="space-y-2">
                <div className="grid grid-cols-[1fr_auto_auto] gap-3 text-[11px] uppercase tracking-wide text-charcoal/40 pb-1 border-b border-border">
                  <span>Criterion</span><span className="text-right w-20">Claimed</span><span className="text-right w-24">Recommend</span>
                </div>
                {c.criteria.map((cr) => {
                  const claimed = p.responses?.[cr.id] || {};
                  const files = (p.evidence || {})[cr.id] || [];
                  return (
                    <div key={cr.id} className="py-1.5" data-testid={`review-crit-${cr.id}`}>
                      <div className="grid grid-cols-[1fr_auto_auto] gap-3 items-center">
                        <div>
                          <div className="text-sm text-charcoal/85">{cr.name}</div>
                          <div className="text-[11px] text-charcoal/40">{cr.code}{cr.mandatory ? " · mandatory" : ` · max ${cr.max_points}`}</div>
                        </div>
                        <div className="text-right w-20 text-sm text-charcoal/60">{cr.mandatory ? (claimed.met ? "Met" : "—") : (claimed.claimed_points || 0)}</div>
                        <div className="w-24 flex justify-end">
                          {cr.mandatory ? (
                            <input type="checkbox" disabled={!editable} checked={recs[cr.id]?.met === true}
                              onChange={(e) => setRec(cr.id, { met: e.target.checked })} className="h-4 w-4 accent-natural-green" data-testid={`rec-met-${cr.id}`} />
                          ) : (
                            <input type="number" min={0} max={cr.max_points} disabled={!editable}
                              value={recs[cr.id]?.recommended_points ?? ""}
                              onChange={(e) => setRec(cr.id, { recommended_points: e.target.value === "" ? "" : Math.max(0, Math.min(cr.max_points, Number(e.target.value))) })}
                              className="w-20 bg-white border border-border rounded-lg px-2 py-1.5 text-sm text-center outline-none focus:ring-2 focus:ring-turquoise" data-testid={`rec-points-${cr.id}`} />
                          )}
                        </div>
                      </div>
                      {files.length > 0 && (
                        <ul className="mt-1.5 space-y-1 pl-1" data-testid={`review-evidence-${cr.id}`}>
                          {files.map((f) => (
                            <li key={f.id} className="flex items-center gap-2 text-xs bg-off-white border border-border rounded-lg px-2.5 py-1.5">
                              <Paperclip className="h-3.5 w-3.5 text-charcoal/40 shrink-0" />
                              <a href={f.url} target="_blank" rel="noreferrer" className="truncate text-charcoal/80 hover:underline flex-1">{f.original_name}</a>
                              <span className={`capitalize ${f.status === "approved" ? "text-natural-green" : f.status === "rejected" ? "text-red-500" : "text-amber-600"}`}>{f.status}</span>
                              {editable && (
                                <span className="flex items-center gap-1 shrink-0">
                                  <button onClick={() => reviewEvidence(cr.id, f.id, "approved")} data-testid={`ev-approve-${f.id}`} className="p-1 rounded hover:bg-natural-green/10 text-natural-green"><Check className="h-3.5 w-3.5" /></button>
                                  <button onClick={() => reviewEvidence(cr.id, f.id, "rejected")} data-testid={`ev-reject-${f.id}`} className="p-1 rounded hover:bg-red-50 text-red-500"><XIcon className="h-3.5 w-3.5" /></button>
                                </span>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          ))}

          <Card>
            <label className="text-sm font-medium text-charcoal/80 flex items-center gap-1.5 mb-2"><MessageSquareWarning className="h-4 w-4 text-natural-green" /> Reviewer comment</label>
            <textarea rows={3} disabled={!editable} className={inpCls + " resize-y"} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Notes for the client / admin…" data-testid="review-comment" />
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <div className="text-xs text-charcoal/55 mb-1">Client claimed</div>
            <div className="flex items-end justify-between mb-1">
              <div className="text-2xl font-semibold text-charcoal/70">{p.score?.claimed_total || 0}<span className="text-sm text-charcoal/40">/{p.score?.total_max}</span></div>
              <BandBadge band={p.score?.band} />
            </div>
            <div className="h-px bg-border my-3" />
            <div className="text-xs text-charcoal/55 mb-1">Your recommendation</div>
            <div className="flex items-end justify-between mb-2">
              <div className="text-3xl font-semibold text-deep-forest-green" data-testid="rec-total">{recScore.total}<span className="text-base text-charcoal/50">/{recScore.max}</span></div>
              <BandBadge band={recScore.band} />
            </div>
            <ProgressBar value={recScore.total} max={recScore.max} />
          </Card>

          {editable && (
            <Card className="space-y-2">
              <button onClick={saveRecs} disabled={busy} data-testid="review-save-btn" className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-charcoal/80 hover:bg-warm-beige transition-colors">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save recommendation</button>
              <button onClick={requestChanges} disabled={busy} data-testid="review-request-btn" className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-amber-500 text-white px-4 py-2.5 text-sm font-medium hover:bg-amber-600 transition-colors"><MessageSquareWarning className="h-4 w-4" /> Request changes</button>
              <button onClick={forward} disabled={busy} data-testid="review-forward-btn" className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-deep-forest-green text-off-white px-4 py-2.5 text-sm font-medium hover:bg-natural-green transition-colors"><Send className="h-4 w-4" /> Forward to admin</button>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
