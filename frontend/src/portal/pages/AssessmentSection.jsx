import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Loader2, Lock, Check, CircleDot, ChevronLeft, ChevronRight, Save, ArrowLeft, ShieldCheck, Cloud, CloudOff } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { apiError } from "../PortalAuthContext";
import { Card, StatusBadge, BandBadge, ProgressBar, inpCls } from "./ui";
import { EvidenceUploader } from "./EvidenceUploader";

export default function AssessmentSection() {
  const { id, slug } = useParams();
  const navigate = useNavigate();
  const [d, setD] = useState(null);
  const [responses, setResponses] = useState({});
  const [evidence, setEvidence] = useState({});
  const [saveState, setSaveState] = useState("idle"); // idle | saving | saved | error
  const [busy, setBusy] = useState(false);
  const debounceRef = useRef(null);
  const dirtyRef = useRef(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/client/projects/${id}/assessment/${slug}`);
      setD(data);
      const seed = {};
      const ev = {};
      data.section.criteria.forEach((cr) => { seed[cr.id] = { ...(cr.response || {}) }; ev[cr.id] = cr.evidence || []; });
      setResponses(seed);
      setEvidence(ev);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      const code = e.response?.status;
      toast.error(apiError(e.response?.data?.detail) || "Cannot open section");
      navigate(`/portal/projects/${id}`, { replace: true });
    }
  }, [id, slug, navigate]);

  useEffect(() => { setD(null); load(); }, [load]);

  const editable = d?.editable;
  const section = d?.section;

  const localScore = useMemo(() => {
    if (!section) return 0;
    let s = 0;
    section.criteria.forEach((cr) => { if (!cr.mandatory) s += Math.max(0, Math.min(Number(responses[cr.id]?.claimed_points || 0), cr.max_points)); });
    return Math.min(s, section.max_points);
  }, [responses, section]);

  const saveDraft = useCallback(async (showToast) => {
    setSaveState("saving");
    try {
      await api.put(`/client/projects/${id}/assessment/${slug}`, { responses });
      dirtyRef.current = false;
      setSaveState("saved");
      if (showToast) toast.success("Draft saved");
    } catch (e) {
      setSaveState("error");
      if (showToast) toast.error(apiError(e.response?.data?.detail));
    }
  }, [id, slug, responses]);

  const setCriterion = (cid, patch) => {
    if (!editable) return;
    dirtyRef.current = true;
    setResponses((r) => ({ ...r, [cid]: { ...(r[cid] || {}), ...patch } }));
    setSaveState("idle");
  };

  // debounced auto-save
  useEffect(() => {
    if (!editable || !dirtyRef.current) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => saveDraft(false), 1300);
    return () => debounceRef.current && clearTimeout(debounceRef.current);
  }, [responses, editable, saveDraft]);

  const saveAndContinue = async () => {
    const mand = section.criteria.filter((c) => c.mandatory);
    if (!mand.every((c) => responses[c.id]?.met === true)) { toast.error("Complete all mandatory (prerequisite) items before continuing."); return; }
    setBusy(true);
    try {
      const { data } = await api.put(`/client/projects/${id}/assessment/${slug}`, { responses, completed_categories: ["_"] });
      dirtyRef.current = false;
      if (data.next_slug) { toast.success("Section saved"); navigate(`/portal/projects/${id}/assessment/${data.next_slug}`); }
      else { toast.success("All sections complete — review & submit"); navigate(`/portal/projects/${id}`); }
    } catch (e) { toast.error(apiError(e.response?.data?.detail)); }
    finally { setBusy(false); }
  };

  if (!d) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-natural-green" /></div>;

  const mandatory = section.criteria.filter((c) => c.mandatory);
  const credits = section.criteria.filter((c) => !c.mandatory);
  const SaveIcon = saveState === "saving" ? Loader2 : saveState === "error" ? CloudOff : Cloud;

  return (
    <div data-testid="assessment-section">
      <Link to={`/portal/projects/${id}`} className="inline-flex items-center gap-1 text-sm text-charcoal/60 hover:text-natural-green mb-3"><ArrowLeft className="h-4 w-4" /> Return to project</Link>

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
        {/* Left: sticky summary + stepper */}
        <div className="lg:sticky lg:top-24 lg:self-start space-y-4">
          <Card className="!p-4">
            <div className="text-xs text-charcoal/50">{d.summary.name}</div>
            <div className="mt-1 flex items-center justify-between"><span className="text-sm font-medium text-charcoal">{d.summary.project_type}</span><StatusBadge status={d.summary.status} /></div>
            <div className="mt-3 flex items-end justify-between"><div className="text-2xl font-semibold text-deep-forest-green" data-testid="section-total-score">{d.score.claimed_total}<span className="text-sm text-charcoal/50">/{d.score.total_max}</span></div><BandBadge band={d.score.band} /></div>
            <ProgressBar value={d.score.claimed_total} max={d.score.total_max} />
          </Card>
          <div className="space-y-1.5">
            {d.sections.map((s, i) => {
              const Icon = s.state === "complete" ? Check : s.state === "locked" ? Lock : CircleDot;
              const clickable = s.state !== "locked";
              const active = s.slug === slug;
              return (
                <button key={s.id} disabled={!clickable} onClick={() => clickable && navigate(`/portal/projects/${id}/assessment/${s.slug}`)} data-testid={`stepper-${s.slug}`}
                  className={`w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors ${active ? "bg-turquoise/15 text-deep-forest-green font-medium" : clickable ? "text-charcoal/70 hover:bg-warm-beige" : "text-charcoal/35 cursor-not-allowed"}`}>
                  <span className={`h-6 w-6 rounded-full flex items-center justify-center text-[11px] shrink-0 ${s.state === "complete" ? "bg-natural-green text-deep-forest-green" : active ? "bg-turquoise text-deep-forest-green" : "bg-warm-beige text-charcoal/50"}`}><Icon className="h-3.5 w-3.5" /></span>
                  {i + 1}. {s.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: current section card */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <h1 className="text-2xl font-serif text-deep-forest-green" data-testid="section-title">{section.name}</h1>
            {editable && (
              <span className="inline-flex items-center gap-1.5 text-xs text-charcoal/50" data-testid="autosave-status">
                <SaveIcon className={`h-3.5 w-3.5 ${saveState === "saving" ? "animate-spin" : ""}`} />
                {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved" : saveState === "error" ? "Save failed" : "Auto-save on"}
              </span>
            )}
          </div>
          <p className="text-xs text-charcoal/50 mb-4">Max {section.max_points} points · {d.sections.findIndex((x) => x.slug === slug) + 1} of {d.sections.length}</p>

          {!editable && <div className="mb-4 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 px-4 py-2.5 text-sm flex items-center gap-2"><Lock className="h-4 w-4" /> Submitted — read-only.</div>}

          {mandatory.length > 0 && (
            <div className="mb-5">
              <div className="text-xs font-semibold tracking-wide uppercase text-charcoal/45 mb-2">Mandatory requirements</div>
              <div className="space-y-3">
                {mandatory.map((cr) => (
                  <div key={cr.id} className="rounded-xl border border-border p-4" data-testid={`criterion-${cr.id}`}>
                    <div className="flex items-start justify-between gap-4">
                      <div><div className="text-sm font-medium text-charcoal">{cr.name}</div><div className="text-xs text-charcoal/45 mt-0.5">{cr.code} · prerequisite</div></div>
                      <label className="flex items-center gap-2 shrink-0 cursor-pointer">
                        <input type="checkbox" disabled={!editable} checked={responses[cr.id]?.met === true} onChange={(e) => setCriterion(cr.id, { met: e.target.checked })} className="h-4 w-4 accent-natural-green" data-testid={`met-${cr.id}`} />
                        <span className="text-sm text-charcoal/70">Met</span>
                      </label>
                    </div>
                    <EvidenceUploader projectId={id} criterionId={cr.id} files={evidence[cr.id]} editable={editable} onChange={(fs) => setEvidence((e) => ({ ...e, [cr.id]: fs }))} />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="text-xs font-semibold tracking-wide uppercase text-charcoal/45 mb-2">Optional credits</div>
          <div className="space-y-3">
            {credits.map((cr) => (
              <div key={cr.id} className="rounded-xl border border-border p-4" data-testid={`criterion-${cr.id}`}>
                <div className="flex items-start justify-between gap-4">
                  <div><div className="text-sm font-medium text-charcoal">{cr.name}</div><div className="text-xs text-charcoal/45 mt-0.5">{cr.code} · up to {cr.max_points} pts</div></div>
                  <input type="number" min={0} max={cr.max_points} disabled={!editable}
                    value={responses[cr.id]?.claimed_points ?? ""}
                    onChange={(e) => setCriterion(cr.id, { claimed_points: e.target.value === "" ? "" : Math.max(0, Math.min(cr.max_points, Number(e.target.value))) })}
                    className="w-24 bg-white border border-border rounded-lg px-3 py-2 text-sm text-center outline-none focus:ring-2 focus:ring-turquoise shrink-0" data-testid={`points-${cr.id}`} />
                </div>
                <input className={inpCls + " mt-3 text-xs"} placeholder="Notes / evidence reference (optional)" disabled={!editable}
                  value={responses[cr.id]?.notes ?? ""} onChange={(e) => setCriterion(cr.id, { notes: e.target.value })} />
                <EvidenceUploader projectId={id} criterionId={cr.id} files={evidence[cr.id]} editable={editable} onChange={(fs) => setEvidence((e) => ({ ...e, [cr.id]: fs }))} />
              </div>
            ))}
          </div>

          {editable && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
              <div className="flex items-center gap-2">
                {d.prev_slug && <button onClick={() => navigate(`/portal/projects/${id}/assessment/${d.prev_slug}`)} className="inline-flex items-center gap-1 text-sm text-charcoal/70" data-testid="section-prev"><ChevronLeft className="h-4 w-4" /> Previous</button>}
                <button onClick={() => saveDraft(true)} data-testid="section-save-draft" className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3.5 py-2 text-sm text-charcoal/80 hover:bg-warm-beige transition-colors"><Save className="h-4 w-4" /> Save Draft</button>
              </div>
              <button onClick={saveAndContinue} disabled={busy} data-testid="section-continue" className="inline-flex items-center gap-1.5 rounded-lg bg-deep-forest-green text-off-white px-4 py-2.5 text-sm font-medium hover:bg-natural-green transition-colors disabled:opacity-60">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} {d.is_last ? "Save & Review" : "Save & Continue"} <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
