import React, { useEffect, useState } from "react";
import { Download, Eye, Gavel, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Btn, Field, TextInput } from "@/admin/components/ui";
import { api, apiError } from "@/lib/api";
import { Empty, InfoItem, ModalShell, Spin, Table } from "./PortalUi";

export default function PortalProjects() {
  const [rows, setRows] = useState(null);
  const [reviewers, setReviewers] = useState([]);
  const [reviewId, setReviewId] = useState(null);
  const [assignId, setAssignId] = useState(null);
  const [detailId, setDetailId] = useState(null);

  const load = () => {
    api.get("/admin/portal/certification-projects")
      .then(({ data }) => setRows(data))
      .catch(() => setRows([]));
  };

  const loadReviewers = () => {
    api.get("/admin/portal/reviewers")
      .then(({ data }) => setReviewers(data))
      .catch(() => setReviewers([]));
  };

  useEffect(() => {
    load();
    loadReviewers();
  }, []);

  if (rows === null) return <Spin />;

  return (
    <div>
      <h1 className="mb-1 text-2xl font-serif text-[#172033]">Certification Projects</h1>
      <p className="mb-6 text-sm text-[#667085]">Assign reviewers to submitted projects, review forwarded projects and record the final certification.</p>

      <Table head={["Project", "Client", "Type", "Claimed", "Status", "Reviewer", "Actions"]} testid="cert-projects-table">
        {rows.length === 0 ? <Empty text="No certification projects yet." /> : rows.map((project) => (
          <tr key={project.id} data-testid={`cert-project-row-${project.id}`}>
            <td className="px-4 py-3 font-medium text-[#172033]">{project.name}</td>
            <td className="px-4 py-3 text-[#667085]">{project.client?.name || "—"}</td>
            <td className="px-4 py-3 text-[#667085]">{project.project_type}</td>
            <td className="px-4 py-3 text-[#172033]">{project.under_configuration ? "—" : `${project.claimed_total}/${project.total_max}`}</td>
            <td className="px-4 py-3 capitalize text-[#667085]">{(project.status || "").replace(/_/g, " ")}</td>
            <td className="px-4 py-3">
              {project.reviewer && <div className="mb-1 text-[#172033]">{project.reviewer.name}</div>}
              {["submitted", "changes_requested", "assigned", "under_review"].includes(project.status) ? (
                <button
                  type="button"
                  onClick={() => setAssignId(project.id)}
                  data-testid={`assign-open-${project.id}`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#27F580] px-3 py-1.5 text-xs font-semibold text-[#172033] hover:bg-[#E9FFF2]"
                >
                  {project.reviewer ? "Reassign" : "Assign reviewer"}
                </button>
              ) : (!project.reviewer && <span className="text-[#667085]">—</span>)}
            </td>
            <td className="px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDetailId(project.id)}
                  data-testid={`project-view-${project.id}`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#E4E7EC] bg-white px-3 py-1.5 text-xs font-semibold text-[#172033] hover:border-[#27F580] hover:bg-[#E9FFF2]"
                >
                  <Eye className="h-3.5 w-3.5" /> View
                </button>
                {(project.status === "forwarded" || project.status === "certified" || project.status === "rejected") && !project.under_configuration && (
                  <button
                    type="button"
                    onClick={() => setReviewId(project.id)}
                    data-testid={`review-open-${project.id}`}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#172033] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#111827]"
                  >
                    <Gavel className="h-3.5 w-3.5" /> {project.status === "forwarded" ? "Review & Certify" : "View decision"}
                  </button>
                )}
              </div>
            </td>
          </tr>
        ))}
      </Table>

      {reviewId && (
        <FinalizeModal
          projectId={reviewId}
          onClose={() => setReviewId(null)}
          onDone={() => {
            setReviewId(null);
            load();
          }}
        />
      )}
      {assignId && (
        <AssignModal
          projectId={assignId}
          reviewers={reviewers}
          onClose={() => setAssignId(null)}
          onDone={() => {
            setAssignId(null);
            load();
            loadReviewers();
          }}
        />
      )}
      {detailId && <ProjectDetailModal projectId={detailId} onClose={() => setDetailId(null)} />}
    </div>
  );
}

function ProjectDetailModal({ projectId, onClose }) {
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    api.get(`/admin/portal/certification-projects/${projectId}`)
      .then(({ data }) => setDetail(data))
      .catch((error) => {
        toast.error(apiError(error.response?.data?.detail));
        onClose();
      });
  }, [projectId, onClose]);

  return (
    <ModalShell title="Project Details" subtitle={detail?.name} onClose={onClose}>
      {!detail ? <Spin /> : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <InfoItem label="Project type" value={detail.project_type} />
            <InfoItem label="Occupancy" value={detail.occupancy_type} />
            <InfoItem label="Status" value={(detail.status || "").replace(/_/g, " ")} />
            <InfoItem label="Claimed score" value={`${detail.claimed_score?.claimed_total || 0}/${detail.claimed_score?.total_max || 0}`} />
            <InfoItem label="Client" value={detail.client?.name} />
            <InfoItem label="Client email" value={detail.client?.email} />
            <InfoItem label="Client phone" value={detail.client?.phone} />
            <InfoItem label="Reviewer" value={detail.reviewer?.name} />
          </div>

          <div>
            <h3 className="mb-3 font-semibold text-[#111827]">Building information</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(detail.building_info || {}).map(([key, value]) => (
                <InfoItem key={key} label={key.replace(/_/g, " ")} value={typeof value === "object" ? JSON.stringify(value) : value} />
              ))}
              {Object.entries(detail.location || {}).map(([key, value]) => (
                <InfoItem key={`location-${key}`} label={`Location ${key.replace(/_/g, " ")}`} value={typeof value === "object" ? JSON.stringify(value) : value} />
              ))}
            </div>
          </div>

          <div>
            <h3 className="mb-3 font-semibold text-[#111827]">Section progress</h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {(detail.template?.categories || []).map((category) => (
                <div key={category.id} className="flex items-center justify-between rounded-xl border border-[#E4E7EC] bg-[#F6F8FA] px-4 py-3">
                  <span className="text-sm font-medium text-[#172033]">{category.name}</span>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#172033]">
                    {detail.claimed_score?.categories?.[category.id] || 0}/{category.max_points}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {!!detail.timeline?.length && (
            <div>
              <h3 className="mb-3 font-semibold text-[#111827]">Activity timeline</h3>
              <div className="space-y-2">
                {detail.timeline.slice().reverse().map((event, index) => (
                  <div key={`${event.at}-${index}`} className="rounded-xl border border-[#E4E7EC] px-4 py-3 text-sm">
                    <div className="font-medium text-[#172033]">{event.event}</div>
                    <div className="mt-1 text-xs text-[#667085]">{event.actor} · {event.at ? new Date(event.at).toLocaleString("en-IN") : ""}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </ModalShell>
  );
}

function AssignModal({ projectId, reviewers, onClose, onDone }) {
  const [detail, setDetail] = useState(null);
  const [selectedReviewer, setSelectedReviewer] = useState(null);
  const [meta, setMeta] = useState({ due_date: "", priority: "normal", instructions: "" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get(`/admin/portal/certification-projects/${projectId}`)
      .then(({ data }) => {
        setDetail(data);
        setSelectedReviewer(data.reviewer_id || null);
        if (data.assignment) {
          setMeta({
            due_date: data.assignment.due_date || "",
            priority: data.assignment.priority || "normal",
            instructions: data.assignment.instructions || "",
          });
        }
      })
      .catch(() => setDetail(false));
  }, [projectId]);

  const assign = async () => {
    if (!selectedReviewer) {
      toast.error("Select a reviewer");
      return;
    }
    setBusy(true);
    try {
      await api.post("/admin/portal/assign", {
        project_id: projectId,
        reviewer_id: selectedReviewer,
        ...meta,
      });
      toast.success("Reviewer assigned");
      onDone();
    } catch (error) {
      toast.error(apiError(error.response?.data?.detail));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await api.post(`/admin/portal/projects/${projectId}/unassign`);
      toast.success("Reviewer removed");
      onDone();
    } catch (error) {
      toast.error(apiError(error.response?.data?.detail));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl bg-white" onClick={(event) => event.stopPropagation()} data-testid="assign-modal">
        <div className="flex items-center justify-between border-b border-[#E4E7EC] px-6 py-4">
          <h2 className="text-lg font-medium text-[#172033]">Assign reviewer</h2>
          <button type="button" onClick={onClose} aria-label="Close"><X className="h-5 w-5 text-[#667085]" /></button>
        </div>

        {!detail ? <div className="p-10"><Spin /></div> : detail === false ? (
          <div className="p-10 text-center text-[#667085]">Project not found.</div>
        ) : (
          <div className="space-y-5 overflow-y-auto p-6">
            <div className="max-h-[38vh] space-y-2 overflow-y-auto pr-1">
              {reviewers.length === 0 && <p className="text-sm text-[#667085]">No reviewers yet — create one first.</p>}
              {reviewers.map((reviewer) => {
                const typeMatches = !reviewer.project_types?.length || reviewer.project_types.includes(detail.project_type);
                return (
                  <button
                    key={reviewer.id}
                    type="button"
                    onClick={() => setSelectedReviewer(reviewer.id)}
                    data-testid={`assign-reviewer-${reviewer.id}`}
                    className={`w-full rounded-xl border p-3 text-left transition-colors ${selectedReviewer === reviewer.id ? "border-[#27F580] bg-[#E9FFF2]" : "border-[#E4E7EC] hover:border-[#27F580]"}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium text-[#172033]">
                          {reviewer.name} {detail.reviewer_id === reviewer.id && <span className="text-xs text-[#667085]">· current</span>}
                        </div>
                        <div className="text-xs text-[#667085]">{reviewer.specialisation || "General"} · {(reviewer.project_types || []).join(", ") || "all types"}</div>
                      </div>
                      <div className="text-right text-xs">
                        <div className={reviewer.available ? "text-[#172033]" : "text-amber-600"}>{reviewer.active_assignments}/{reviewer.max_workload} active</div>
                        {!typeMatches && <div className="text-amber-600">type mismatch</div>}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Due date"><TextInput type="date" value={meta.due_date} onChange={(value) => setMeta({ ...meta, due_date: value })} data-testid="assign-due" /></Field>
              <Field label="Priority">
                <select className="w-full rounded-lg border border-[#E4E7EC] bg-white px-3.5 py-2.5 text-sm" value={meta.priority} onChange={(event) => setMeta({ ...meta, priority: event.target.value })} data-testid="assign-priority">
                  {["low", "normal", "high", "urgent"].map((priority) => <option key={priority} value={priority}>{priority}</option>)}
                </select>
              </Field>
              <div className="sm:col-span-2">
                <Field label="Internal instructions"><TextInput value={meta.instructions} onChange={(value) => setMeta({ ...meta, instructions: value })} data-testid="assign-instructions" /></Field>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Btn onClick={assign} disabled={busy} data-testid="assign-confirm-btn">
                {busy && <Loader2 className="h-4 w-4 animate-spin" />} {detail.reviewer_id ? "Reassign" : "Assign"}
              </Btn>
              {detail.reviewer_id && (
                <button type="button" onClick={remove} disabled={busy} data-testid="assign-remove-btn" className="rounded-lg border border-red-300 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50">
                  Remove assignment
                </button>
              )}
            </div>

            {(detail.assignment_history || []).length > 0 && (
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#667085]">Assignment history</div>
                <ul className="space-y-1.5" data-testid="assign-history">
                  {detail.assignment_history.slice().reverse().map((entry) => (
                    <li key={entry.id} className="flex items-center justify-between rounded-lg border border-[#E4E7EC] bg-[#F6F8FA] px-3 py-1.5 text-xs text-[#667085]">
                      <span className="capitalize"><strong>{entry.action}</strong> · {entry.reviewer_name || entry.reviewer_id}</span>
                      <span>{new Date(entry.at).toLocaleString("en-IN")} · {entry.by}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function FinalizeModal({ projectId, onClose, onDone }) {
  const [detail, setDetail] = useState(null);
  const [finalResponses, setFinalResponses] = useState({});
  const [decision, setDecision] = useState("certified");
  const [certificate, setCertificate] = useState({ number: "", issued_date: "", valid_until: "", notes: "" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get(`/admin/portal/certification-projects/${projectId}`)
      .then(({ data }) => {
        setDetail(data);
        const recommendations = data.reviewer_recommendations || {};
        const initial = {};
        (data.template?.categories || []).forEach((category) => category.criteria.forEach((criterion) => {
          const source = (data.final_responses || {})[criterion.id]
            || recommendations[criterion.id]
            || (data.responses || {})[criterion.id]
            || {};
          initial[criterion.id] = criterion.mandatory
            ? { met: !!source.met }
            : { final_points: source.final_points ?? source.recommended_points ?? source.claimed_points ?? 0 };
        }));
        setFinalResponses(initial);
        if (data.official_record) {
          setDecision(data.official_record.decision || "certified");
          setCertificate({
            number: data.official_record.certificate_number || "",
            issued_date: data.official_record.issued_date || "",
            valid_until: data.official_record.valid_until || "",
            notes: data.official_record.notes || "",
          });
        }
      })
      .catch(() => setDetail(false));
  }, [projectId]);

  const template = detail?.template;
  const completed = detail && (detail.status === "certified" || detail.status === "rejected");

  const finalTotal = React.useMemo(() => {
    if (!template) return 0;
    let total = 0;
    template.categories?.forEach((category) => {
      let categoryTotal = 0;
      category.criteria.forEach((criterion) => {
        if (!criterion.mandatory) {
          categoryTotal += Math.max(0, Math.min(Number(finalResponses[criterion.id]?.final_points || 0), criterion.max_points));
        }
      });
      total += Math.min(categoryTotal, category.max_points);
    });
    return Math.min(total, template.total_max);
  }, [finalResponses, template]);

  const setFinal = (criterionId, patch) => {
    setFinalResponses((current) => ({
      ...current,
      [criterionId]: { ...(current[criterionId] || {}), ...patch },
    }));
  };

  const submit = async () => {
    setBusy(true);
    try {
      await api.post(`/admin/portal/projects/${projectId}/finalize`, {
        final: finalResponses,
        decision,
        certificate,
      });
      toast.success(decision === "certified" ? "Project certified" : "Project rejected");
      onDone();
    } catch (error) {
      toast.error(apiError(error.response?.data?.detail));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl bg-white" onClick={(event) => event.stopPropagation()} data-testid="finalize-modal">
        <div className="flex items-center justify-between border-b border-[#E4E7EC] px-6 py-4">
          <h2 className="text-lg font-medium text-[#172033]">{completed ? "Certification decision" : "Final review & certification"}</h2>
          <button type="button" onClick={onClose} aria-label="Close"><X className="h-5 w-5 text-[#667085]" /></button>
        </div>

        {!detail ? <div className="p-10"><Spin /></div> : detail === false ? (
          <div className="p-10 text-center text-[#667085]">Not found.</div>
        ) : (
          <div className="space-y-5 overflow-y-auto p-6">
            <div className="grid grid-cols-1 gap-3 text-center sm:grid-cols-3">
              <ScoreCard label="Client claimed" value={detail.claimed_score?.claimed_total || 0} />
              <ScoreCard label="Reviewer rec." value={detail.recommended_score?.claimed_total || 0} />
              <ScoreCard label="Final" value={`${finalTotal}/${template?.total_max}`} accent testid="final-total" />
            </div>

            <div className="max-h-[34vh] space-y-3 overflow-y-auto pr-1">
              {template?.categories?.map((category) => (
                <div key={category.id} className="rounded-xl border border-[#E4E7EC] p-3">
                  <div className="mb-2 text-sm font-medium text-[#172033]">{category.name} <span className="text-xs text-[#667085]">(max {category.max_points})</span></div>
                  {category.criteria.map((criterion) => (
                    <div key={criterion.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 py-1 text-sm">
                      <span className="text-[#172033]">{criterion.name}</span>
                      <span className="w-24 text-right text-xs text-[#667085]">
                        rec: {criterion.mandatory
                          ? ((detail.reviewer_recommendations || {})[criterion.id]?.met ? "Met" : "—")
                          : ((detail.reviewer_recommendations || {})[criterion.id]?.recommended_points || 0)}
                      </span>
                      <span className="flex w-20 justify-end">
                        {criterion.mandatory ? (
                          <input type="checkbox" disabled={completed} checked={finalResponses[criterion.id]?.met === true} onChange={(event) => setFinal(criterion.id, { met: event.target.checked })} className="h-4 w-4 accent-[#27F580]" data-testid={`final-met-${criterion.id}`} />
                        ) : (
                          <input
                            type="number"
                            min={0}
                            max={criterion.max_points}
                            disabled={completed}
                            value={finalResponses[criterion.id]?.final_points ?? ""}
                            onChange={(event) => setFinal(criterion.id, {
                              final_points: event.target.value === ""
                                ? ""
                                : Math.max(0, Math.min(criterion.max_points, Number(event.target.value))),
                            })}
                            className="w-16 rounded border border-[#E4E7EC] px-2 py-1 text-center outline-none focus:ring-2 focus:ring-[#27F580]"
                            data-testid={`final-points-${criterion.id}`}
                          />
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Decision">
                <select className="w-full rounded-lg border border-[#E4E7EC] bg-white px-3.5 py-2.5 text-sm" value={decision} disabled={completed} onChange={(event) => setDecision(event.target.value)} data-testid="final-decision">
                  <option value="certified">Certify</option>
                  <option value="rejected">Reject</option>
                </select>
              </Field>
              <Field label="Certificate number"><TextInput value={certificate.number} onChange={(value) => setCertificate({ ...certificate, number: value })} disabled={completed} data-testid="cert-number" /></Field>
              <Field label="Issued date"><TextInput type="date" value={certificate.issued_date} onChange={(value) => setCertificate({ ...certificate, issued_date: value })} disabled={completed} /></Field>
              <Field label="Valid until"><TextInput type="date" value={certificate.valid_until} onChange={(value) => setCertificate({ ...certificate, valid_until: value })} disabled={completed} /></Field>
              <div className="sm:col-span-2"><Field label="Notes"><TextInput value={certificate.notes} onChange={(value) => setCertificate({ ...certificate, notes: value })} disabled={completed} /></Field></div>
            </div>

            {completed ? (
              <div className="rounded-xl border border-[#E4E7EC] bg-[#F6F8FA] px-4 py-3 text-sm text-[#667085]">
                <div>Recorded: <strong className="capitalize text-[#172033]">{detail.official_record?.decision}</strong> · Band {detail.official_record?.band} · {detail.official_record?.certificate_number || "no cert #"}</div>
                {(detail.official_record?.certificate_pdf_url || detail.official_record?.docket_pdf_url) && (
                  <div className="mt-3 flex flex-wrap gap-2.5">
                    {detail.official_record?.certificate_pdf_url && <DownloadLink href={detail.official_record.certificate_pdf_url} label="Certificate" testid="admin-download-certificate" />}
                    {detail.official_record?.docket_pdf_url && <DownloadLink href={detail.official_record.docket_pdf_url} label="Docket" testid="admin-download-docket" outline />}
                  </div>
                )}
              </div>
            ) : (
              <Btn onClick={submit} disabled={busy} className="w-full" data-testid="finalize-submit-btn">
                {busy && <Loader2 className="h-4 w-4 animate-spin" />} Record certification decision
              </Btn>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ScoreCard({ label, value, accent = false, testid }) {
  return (
    <div className={`rounded-xl border p-3 ${accent ? "border-[#27F580] bg-[#E9FFF2]" : "border-[#E4E7EC] bg-[#F6F8FA]"}`}>
      <div className="text-xs text-[#667085]">{label}</div>
      <div className="text-xl font-semibold text-[#172033]" data-testid={testid}>{value}</div>
    </div>
  );
}

function DownloadLink({ href, label, testid, outline = false }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      data-testid={testid}
      className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold ${outline ? "border border-[#172033] text-[#172033] hover:bg-white" : "bg-[#27F580] text-[#172033] hover:bg-[#20DB72]"}`}
    >
      <Download className="h-3.5 w-3.5" /> {label}
    </a>
  );
}