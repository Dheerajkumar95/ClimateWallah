import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Loader2, Lock, Check, CircleDot, ShieldCheck, Send, Award, AlertCircle, ArrowRight, Clock, Download } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { apiError } from "../PortalAuthContext";
import { PageHeader, Card, StatusBadge, BandBadge, ProgressBar } from "./ui";

const STATE_ICON = { complete: Check, current: CircleDot, unlocked: CircleDot, locked: Lock };

export default function ProjectOverview() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [d, setD] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const load = () => api.get(`/client/projects/${id}/assessment`).then(({ data }) => setD(data)).catch(() => setD(false));
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  if (d === null) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-natural-green" /></div>;
  if (d === false) return <Card className="text-center py-12"><p className="text-charcoal/60">Project not found.</p><Link to="/portal/projects" className="text-deep-forest-green hover:underline text-sm mt-3 inline-block">← Back</Link></Card>;

  const { project, score, sections, timeline, editable } = d;
  const currentSection = sections.find((s) => s.state === "current") || sections.find((s) => s.state !== "complete") || sections[0];
  const allComplete = sections.length > 0 && sections.every((s) => s.state === "complete");
  const doneCount = sections.filter((s) => s.state === "complete").length;
  const gotoSection = (slug) => navigate(`/portal/projects/${id}/assessment/${slug}`);

  const submit = async () => {
    setSubmitting(true);
    try { const { data } = await api.post(`/client/projects/${id}/submit`); toast.success(`Submitted for review (v${data.version})`); load(); }
    catch (e) { toast.error(apiError(e.response?.data?.detail)); } finally { setSubmitting(false); }
  };

  return (
    <div data-testid="project-overview">
      <PageHeader title={project.name} subtitle={`${project.rating_system || project.project_type} · ${project.occupancy_type}-occupied`} action={<StatusBadge status={project.status} />} />

      <div className="rounded-xl bg-warm-beige/60 border border-border px-4 py-2.5 text-xs text-charcoal/70 flex items-center gap-2 mb-5">
        <ShieldCheck className="h-4 w-4 text-natural-green" /> RES Internal / Preliminary Assessment — not an official IGBC certification.
      </div>

      {d.reviewer_comment && (
        <div className="mb-5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 text-sm" data-testid="changes-banner">
          <div className="font-medium mb-0.5">Reviewer requested changes</div>
          <div className="text-amber-700/90">{d.reviewer_comment}</div>
        </div>
      )}
      {d.official_record && (
        <div className={`mb-5 rounded-xl px-4 py-4 ${d.official_record.decision === "certified" ? "bg-turquoise/10 border border-turquoise/40" : "bg-red-50 border border-red-200"}`} data-testid="final-banner">
          <div className="flex items-center gap-2">
            {d.official_record.decision === "certified" ? <Award className="h-5 w-5 text-deep-forest-green" /> : <AlertCircle className="h-5 w-5 text-red-500" />}
            <span className="font-medium text-charcoal">{d.official_record.decision === "certified" ? `Certified — ${d.official_record.band}` : "Not certified"}</span>
          </div>
          <div className="text-sm text-charcoal/70 mt-1.5">Final score <strong>{d.official_record.final_total}/{d.official_record.total_max}</strong>{d.official_record.certificate_number && <> · Certificate <strong>{d.official_record.certificate_number}</strong></>}</div>
          {d.official_record.decision === "certified" && (d.official_record.certificate_pdf_url || d.official_record.docket_pdf_url) && (
            <div className="flex flex-wrap gap-2.5 mt-3">
              {d.official_record.certificate_pdf_url && (
                <a href={d.official_record.certificate_pdf_url} target="_blank" rel="noreferrer" data-testid="download-certificate" className="inline-flex items-center gap-1.5 rounded-lg bg-natural-green text-deep-forest-green px-4 py-2 text-sm font-semibold hover:bg-deep-forest-green hover:text-off-white transition-colors"><Download className="h-4 w-4" /> Certificate (PDF)</a>
              )}
              {d.official_record.docket_pdf_url && (
                <a href={d.official_record.docket_pdf_url} target="_blank" rel="noreferrer" data-testid="download-docket" className="inline-flex items-center gap-1.5 rounded-lg border border-deep-forest-green/40 text-deep-forest-green px-4 py-2 text-sm font-medium hover:bg-deep-forest-green/5 transition-colors"><Download className="h-4 w-4" /> Assessment docket</a>
              )}
            </div>
          )}
        </div>
      )}

      {d.under_configuration ? (
        <Card className="text-center py-12"><AlertCircle className="h-8 w-8 text-amber-500 mx-auto mb-3" /><p className="text-charcoal font-medium">Checklist under configuration</p><p className="text-sm text-charcoal/60 mt-1">The checklist for {project.project_type} projects is being finalised.</p></Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
          <div className="space-y-6">
            {/* Score summary */}
            <Card>
              <div className="flex items-end justify-between mb-2">
                <div><div className="text-xs text-charcoal/55">Claimed score</div><div className="text-3xl font-semibold text-deep-forest-green" data-testid="overview-score">{score.claimed_total}<span className="text-base text-charcoal/50">/{score.total_max}</span></div></div>
                <BandBadge band={score.band} />
              </div>
              <ProgressBar value={score.claimed_total} max={score.total_max} />
              <div className="mt-3 text-xs text-charcoal/55">{doneCount} of {sections.length} sections completed</div>
            </Card>

            {/* Sequential stepper */}
            <div>
              <h2 className="text-lg font-medium text-charcoal mb-3">Certification sections</h2>
              <div className="space-y-2">
                {sections.map((s, i) => {
                  const Icon = STATE_ICON[s.state] || CircleDot;
                  const clickable = s.state !== "locked";
                  return (
                    <button key={s.id} disabled={!clickable} onClick={() => clickable && gotoSection(s.slug)} data-testid={`overview-section-${s.slug}`}
                      className={`w-full flex items-center justify-between rounded-xl border px-4 py-3.5 text-left transition-colors ${clickable ? "bg-white hover:border-turquoise" : "bg-off-white opacity-60 cursor-not-allowed"} ${s.state === "current" ? "border-turquoise ring-1 ring-turquoise/40" : "border-border"}`}>
                      <div className="flex items-center gap-3">
                        <span className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold ${s.state === "complete" ? "bg-natural-green text-deep-forest-green" : s.state === "current" ? "bg-turquoise text-deep-forest-green" : s.state === "locked" ? "bg-warm-beige text-charcoal/40" : "bg-deep-forest-green/10 text-deep-forest-green"}`}>
                          <Icon className="h-4 w-4" />
                        </span>
                        <div>
                          <div className="text-sm font-medium text-charcoal">{i + 1}. {s.name}</div>
                          <div className="text-xs text-charcoal/50">{s.state === "locked" ? "Locked — complete previous section" : s.state === "complete" ? "Completed" : `${s.required_remaining} mandatory item(s) remaining`}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-charcoal/60">
                        <span>{score.categories?.[s.id] || 0}/{s.max_points}</span>
                        {clickable && <ArrowRight className="h-4 w-4 text-charcoal/30" />}
                      </div>
                    </button>
                  );
                })}
              </div>

              {editable && (
                <div className="mt-5 flex flex-wrap gap-3">
                  <button onClick={() => gotoSection(currentSection.slug)} data-testid="overview-continue-btn"
                    className="inline-flex items-center gap-2 rounded-lg bg-deep-forest-green text-off-white px-5 py-2.5 text-sm font-medium hover:bg-natural-green transition-colors">
                    {doneCount === 0 ? "Start assessment" : "Continue assessment"} <ArrowRight className="h-4 w-4" />
                  </button>
                  {allComplete && (
                    <button onClick={submit} disabled={submitting} data-testid="overview-submit-btn"
                      className="inline-flex items-center gap-2 rounded-lg bg-turquoise text-deep-forest-green px-5 py-2.5 text-sm font-semibold hover:brightness-95 transition-all">
                      {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Submit for review
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Timeline */}
          <div>
            <Card>
              <h3 className="text-sm font-medium text-charcoal mb-3 flex items-center gap-2"><Clock className="h-4 w-4 text-natural-green" /> Progress timeline</h3>
              <ol className="space-y-3" data-testid="project-timeline">
                {(timeline || []).slice().reverse().map((t, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="mt-1 h-2 w-2 rounded-full bg-turquoise shrink-0" />
                    <div>
                      <div className="text-sm text-charcoal">{t.event}</div>
                      <div className="text-xs text-charcoal/45">{new Date(t.at).toLocaleString("en-IN")} · {t.actor}</div>
                      {t.note && <div className="text-xs text-charcoal/55 mt-0.5">{t.note}</div>}
                    </div>
                  </li>
                ))}
              </ol>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
