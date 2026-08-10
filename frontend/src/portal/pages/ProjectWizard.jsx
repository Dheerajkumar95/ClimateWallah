import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import {
  Loader2, Check, Lock, ChevronLeft, ChevronRight, Save, Send, ShieldCheck, CircleDot, AlertCircle, Award,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { apiError } from "../PortalAuthContext";
import { PageHeader, Card, StatusBadge, BandBadge, ProgressBar, inpCls } from "./ui";

const EDITABLE = ["draft", "changes_requested"];

function bandFor(total, thresholds) {
  const t = thresholds?.find((x) => total >= x.min && total <= x.max);
  return t ? t.band : "Uncertified";
}

export default function ProjectWizard() {
  const { id } = useParams();
  const [project, setProject] = useState(null);
  const [template, setTemplate] = useState(null);
  const [responses, setResponses] = useState({});
  const [completed, setCompleted] = useState([]);
  const [maxUnlocked, setMaxUnlocked] = useState(0);
  const [active, setActive] = useState(0);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const dirty = useRef(false);

  const load = useCallback(async () => {
    const [{ data: p }, { data: t }] = await Promise.all([
      api.get(`/client/projects/${id}`),
      api.get(`/client/projects/${id}/template`),
    ]);
    setProject(p);
    setTemplate(t);
    setResponses(p.responses || {});
    setCompleted(p.completed_categories || []);
    setMaxUnlocked(p.current_category_index || 0);
    setActive(p.current_category_index || 0);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const editable = project && EDITABLE.includes(project.status) && !project.under_configuration;

  const setCriterion = (critId, patch) => {
    if (!editable) return;
    dirty.current = true;
    setResponses((r) => ({ ...r, [critId]: { ...(r[critId] || {}), ...patch } }));
  };

  // local scoring for instant feedback
  const score = useMemo(() => {
    if (!template || template.under_configuration) return { total: 0, max: 0, cats: {}, band: "Pending" };
    let total = 0; const cats = {};
    for (const c of template.categories) {
      let sum = 0;
      for (const cr of c.criteria) {
        if (cr.mandatory) continue;
        const pts = Math.max(0, Math.min(Number(responses[cr.id]?.claimed_points || 0), cr.max_points));
        sum += pts;
      }
      sum = Math.min(sum, c.max_points);
      cats[c.id] = sum; total += sum;
    }
    total = Math.min(total, template.total_max);
    return { total, max: template.total_max, cats, band: bandFor(total, template.thresholds) };
  }, [responses, template]);

  const categoryComplete = (cat) => cat.criteria.filter((cr) => cr.mandatory).every((cr) => responses[cr.id]?.met === true);
  const allComplete = template && !template.under_configuration && template.categories.every(categoryComplete);

  const persist = async (extra = {}) => {
    const { data } = await api.put(`/client/projects/${id}/responses`, { responses, ...extra });
    dirty.current = false;
    return data;
  };

  const saveProgress = async () => {
    setSaving(true);
    try { await persist({ completed_categories: completed, current_category_index: maxUnlocked }); toast.success("Progress saved"); }
    catch (err) { toast.error(apiError(err.response?.data?.detail)); }
    finally { setSaving(false); }
  };

  const saveAndContinue = async () => {
    const cat = template.categories[active];
    if (!categoryComplete(cat)) { toast.error("Complete all mandatory (prerequisite) items in this section first."); return; }
    const newCompleted = Array.from(new Set([...completed, cat.id]));
    const nextIdx = Math.min(template.categories.length - 1, active + 1);
    const newMax = Math.max(maxUnlocked, nextIdx);
    setSaving(true);
    try {
      await persist({ completed_categories: newCompleted, current_category_index: newMax });
      setCompleted(newCompleted); setMaxUnlocked(newMax); setActive(nextIdx);
      toast.success(`${cat.name} saved`);
    } catch (err) { toast.error(apiError(err.response?.data?.detail)); }
    finally { setSaving(false); }
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      if (dirty.current) await persist({ completed_categories: completed, current_category_index: maxUnlocked });
      const { data } = await api.post(`/client/projects/${id}/submit`);
      toast.success(`Submitted for review (v${data.version})`);
      await load();
    } catch (err) { toast.error(apiError(err.response?.data?.detail)); }
    finally { setSubmitting(false); }
  };

  if (!project || !template) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-natural-green" /></div>;

  if (template.under_configuration) {
    return (
      <div>
        <PageHeader title={project.name} subtitle={`${project.project_type} · ${project.occupancy_type}-occupied`} />
        <Card className="text-center py-14">
          <AlertCircle className="h-8 w-8 text-amber-500 mx-auto mb-3" />
          <p className="text-charcoal font-medium">Checklist under configuration</p>
          <p className="text-sm text-charcoal/60 mt-1 max-w-md mx-auto">The certification checklist for <strong>{project.project_type}</strong> projects is being finalised. The wizard will open here once it's available. No score is shown until then.</p>
          <Link to="/portal/projects" className="inline-block mt-5 text-sm text-natural-green hover:underline">← Back to projects</Link>
        </Card>
      </div>
    );
  }

  const cat = template.categories[active];

  return (
    <div data-testid="project-wizard">
      <PageHeader
        title={project.name}
        subtitle={`${template.name} · ${project.occupancy_type}-occupied`}
        action={<StatusBadge status={project.status} />}
      />

      {!editable && (
        <div className="mb-5 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 text-sm flex items-center gap-2" data-testid="readonly-banner">
          <Lock className="h-4 w-4" /> This project has been submitted and is read-only.
        </div>
      )}

      <div className="rounded-xl bg-warm-beige/60 border border-border px-4 py-2.5 text-xs text-charcoal/70 flex items-center gap-2 mb-5">
        <ShieldCheck className="h-4 w-4 text-natural-green" /> RES Internal / Preliminary Assessment — not an official IGBC certification.
      </div>

      {project.status === "changes_requested" && project.reviewer_comment && (
        <div className="mb-5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 text-sm" data-testid="changes-banner">
          <div className="font-medium mb-0.5">Reviewer requested changes</div>
          <div className="text-amber-700/90">{project.reviewer_comment}</div>
          <div className="text-xs text-amber-700/70 mt-1">Update your responses and re-submit for review.</div>
        </div>
      )}

      {project.official_record && (
        <div className={`mb-5 rounded-xl px-4 py-4 ${project.official_record.decision === "certified" ? "bg-natural-green/10 border border-natural-green/30" : "bg-red-50 border border-red-200"}`} data-testid="final-banner">
          <div className="flex items-center gap-2">
            {project.official_record.decision === "certified" ? <Award className="h-5 w-5 text-natural-green" /> : <AlertCircle className="h-5 w-5 text-red-500" />}
            <span className="font-medium text-charcoal capitalize">{project.official_record.decision === "certified" ? `Certified — ${project.official_record.band}` : "Not certified"}</span>
          </div>
          <div className="text-sm text-charcoal/70 mt-1.5">
            Final score: <strong>{project.official_record.final_total}/{project.official_record.total_max}</strong>
            {project.official_record.certificate_number && <> · Certificate <strong>{project.official_record.certificate_number}</strong></>}
            {project.official_record.valid_until && <> · Valid until {project.official_record.valid_until}</>}
          </div>
          {project.official_record.notes && <div className="text-xs text-charcoal/55 mt-1">{project.official_record.notes}</div>}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
        {/* Category rail */}
        <div className="space-y-2">
          {template.categories.map((c, i) => {
            const done = completed.includes(c.id);
            const locked = i > maxUnlocked;
            return (
              <button
                key={c.id}
                disabled={locked}
                onClick={() => !locked && setActive(i)}
                data-testid={`wizard-cat-${c.id}`}
                className={`w-full text-left rounded-xl border px-4 py-3 transition-colors ${
                  active === i ? "border-natural-green bg-natural-green/5" : "border-border bg-white hover:border-natural-green/40"
                } ${locked ? "opacity-55 cursor-not-allowed" : ""}`}
              >
                <div className="flex items-center gap-2">
                  <span className={`h-6 w-6 rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0 ${done ? "bg-natural-green text-white" : active === i ? "bg-deep-forest-green text-white" : "bg-warm-beige text-charcoal/60"}`}>
                    {locked ? <Lock className="h-3 w-3" /> : done ? <Check className="h-3.5 w-3.5" /> : i + 1}
                  </span>
                  <span className="text-sm font-medium text-charcoal leading-tight">{c.name}</span>
                </div>
                <div className="mt-2 pl-8 flex items-center justify-between text-xs text-charcoal/55">
                  <span>{score.cats[c.id] || 0}/{c.max_points} pts</span>
                  {done && <span className="text-natural-green">Complete</span>}
                </div>
              </button>
            );
          })}

          <Card className="!p-4 mt-4">
            <div className="text-xs text-charcoal/55 mb-1">Preliminary score</div>
            <div className="flex items-end justify-between mb-2">
              <div className="text-2xl font-semibold text-deep-forest-green" data-testid="wizard-total-score">{score.total}<span className="text-sm text-charcoal/50">/{score.max}</span></div>
              <BandBadge band={score.band} />
            </div>
            <ProgressBar value={score.total} max={score.max} />
          </Card>
        </div>

        {/* Active category */}
        <div>
          <Card>
            <div className="flex items-center gap-2 mb-1">
              <CircleDot className="h-4 w-4 text-natural-green" />
              <h2 className="text-lg font-medium text-charcoal">{cat.name}</h2>
            </div>
            <p className="text-xs text-charcoal/50 mb-5">Max {cat.max_points} points · Section {active + 1} of {template.categories.length}</p>

            <div className="space-y-4">
              {cat.criteria.map((cr) => (
                <div key={cr.id} className="rounded-xl border border-border p-4" data-testid={`criterion-${cr.id}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-sm font-medium text-charcoal">{cr.name}</div>
                      <div className="text-xs text-charcoal/45 mt-0.5">{cr.code}{cr.mandatory ? " · Mandatory prerequisite" : ` · up to ${cr.max_points} pts`}</div>
                    </div>
                    {cr.mandatory ? (
                      <label className="flex items-center gap-2 shrink-0 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={responses[cr.id]?.met === true}
                          disabled={!editable}
                          onChange={(e) => setCriterion(cr.id, { met: e.target.checked })}
                          className="h-4 w-4 accent-natural-green"
                          data-testid={`met-${cr.id}`}
                        />
                        <span className="text-sm text-charcoal/70">Met</span>
                      </label>
                    ) : (
                      <input
                        type="number" min={0} max={cr.max_points}
                        value={responses[cr.id]?.claimed_points ?? ""}
                        disabled={!editable}
                        onChange={(e) => {
                          let v = e.target.value === "" ? "" : Math.max(0, Math.min(cr.max_points, Number(e.target.value)));
                          setCriterion(cr.id, { claimed_points: v });
                        }}
                        className="w-24 bg-white border border-border rounded-lg px-3 py-2 text-sm text-center outline-none focus:ring-2 focus:ring-natural-green shrink-0"
                        data-testid={`points-${cr.id}`}
                      />
                    )}
                  </div>
                  {!cr.mandatory && (
                    <input
                      className={inpCls + " mt-3 text-xs"}
                      placeholder="Notes / evidence reference (optional)"
                      value={responses[cr.id]?.notes ?? ""}
                      disabled={!editable}
                      onChange={(e) => setCriterion(cr.id, { notes: e.target.value })}
                    />
                  )}
                </div>
              ))}
            </div>

            {editable && (
              <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
                <div className="flex items-center gap-2">
                  <button onClick={() => setActive((a) => Math.max(0, a - 1))} disabled={active === 0} className="inline-flex items-center gap-1 text-sm text-charcoal/70 disabled:opacity-40"><ChevronLeft className="h-4 w-4" /> Prev</button>
                  <button onClick={saveProgress} disabled={saving} data-testid="wizard-save-btn" className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3.5 py-2 text-sm text-charcoal/80 hover:bg-warm-beige transition-colors">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save</button>
                </div>
                {active < template.categories.length - 1 ? (
                  <button onClick={saveAndContinue} disabled={saving} data-testid="wizard-continue-btn" className="inline-flex items-center gap-1.5 rounded-lg bg-deep-forest-green text-off-white px-4 py-2.5 text-sm font-medium hover:bg-natural-green transition-colors disabled:opacity-60">Save & Continue <ChevronRight className="h-4 w-4" /></button>
                ) : (
                  <button onClick={submit} disabled={submitting || !allComplete} data-testid="wizard-submit-btn" title={!allComplete ? "Complete all mandatory items in every section" : ""} className="inline-flex items-center gap-2 rounded-lg bg-deep-forest-green text-off-white px-5 py-2.5 text-sm font-medium hover:bg-natural-green transition-colors disabled:opacity-50">{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Submit for review</button>
                )}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
