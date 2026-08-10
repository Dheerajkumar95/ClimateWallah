import React, { useEffect, useState } from "react";
import { Loader2, Plus, UserPlus, X, Gavel } from "lucide-react";
import { api, apiError } from "@/lib/api";
import { toast } from "sonner";
import { Btn, Field, TextInput } from "@/admin/components/ui";

const Table = ({ head, children, testid }) => (
  <div className="bg-white border border-border rounded-xl overflow-hidden" data-testid={testid}>
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-warm-beige/60 text-charcoal/70">
          <tr>{head.map((h) => <th key={h} className="text-left font-medium px-4 py-3 whitespace-nowrap">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-border">{children}</tbody>
      </table>
    </div>
  </div>
);

const Empty = ({ text }) => <tr><td colSpan={12} className="px-4 py-10 text-center text-charcoal/50">{text}</td></tr>;
const Spin = () => <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-natural-green" /></div>;

export function PortalClients() {
  const [rows, setRows] = useState(null);
  useEffect(() => { api.get("/admin/portal/clients").then(({ data }) => setRows(data)).catch(() => setRows([])); }, []);
  if (rows === null) return <Spin />;
  return (
    <div>
      <h1 className="text-2xl font-serif text-deep-forest-green mb-1">Portal Clients</h1>
      <p className="text-sm text-charcoal/60 mb-6">Clients who self-registered for the certification portal.</p>
      <Table head={["Name", "Email", "Organization", "Projects", "Registered"]} testid="clients-table">
        {rows.length === 0 ? <Empty text="No clients yet." /> : rows.map((c) => (
          <tr key={c.id} data-testid={`client-row-${c.id}`}>
            <td className="px-4 py-3 font-medium text-charcoal">{c.name}</td>
            <td className="px-4 py-3 text-charcoal/70">{c.email}</td>
            <td className="px-4 py-3 text-charcoal/70">{c.organization || "—"}</td>
            <td className="px-4 py-3">{c.project_count}</td>
            <td className="px-4 py-3 text-charcoal/60">{(c.created_at || "").slice(0, 10)}</td>
          </tr>
        ))}
      </Table>
    </div>
  );
}

export function PortalReviewers() {
  const [rows, setRows] = useState(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [saving, setSaving] = useState(false);

  const load = () => api.get("/admin/portal/reviewers").then(({ data }) => setRows(data)).catch(() => setRows([]));
  useEffect(() => { load(); }, []);

  const create = async () => {
    setSaving(true);
    try {
      await api.post("/admin/portal/reviewers", form);
      toast.success("Reviewer created");
      setOpen(false); setForm({ name: "", email: "", password: "" }); load();
    } catch (err) { toast.error(apiError(err.response?.data?.detail)); }
    finally { setSaving(false); }
  };

  if (rows === null) return <Spin />;
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-serif text-deep-forest-green mb-1">Portal Reviewers</h1>
          <p className="text-sm text-charcoal/60">Reviewer accounts are created here — there is no public signup.</p>
        </div>
        <Btn onClick={() => setOpen(true)} data-testid="add-reviewer-btn"><UserPlus className="h-4 w-4" /> Add Reviewer</Btn>
      </div>
      <Table head={["Name", "Email", "Created"]} testid="reviewers-table">
        {rows.length === 0 ? <Empty text="No reviewers yet." /> : rows.map((r) => (
          <tr key={r.id} data-testid={`reviewer-row-${r.id}`}>
            <td className="px-4 py-3 font-medium text-charcoal">{r.name}</td>
            <td className="px-4 py-3 text-charcoal/70">{r.email}</td>
            <td className="px-4 py-3 text-charcoal/60">{(r.created_at || "").slice(0, 10)}</td>
          </tr>
        ))}
      </Table>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()} data-testid="reviewer-modal">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium text-charcoal">New Reviewer</h2>
              <button onClick={() => setOpen(false)}><X className="h-5 w-5 text-charcoal/50" /></button>
            </div>
            <div className="space-y-4">
              <Field label="Full name"><TextInput value={form.name} onChange={(v) => setForm({ ...form, name: v })} data-testid="rev-name" /></Field>
              <Field label="Email"><TextInput type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} data-testid="rev-email" /></Field>
              <Field label="Password" help="Min 8 chars with upper, lower and a number."><TextInput type="password" value={form.password} onChange={(v) => setForm({ ...form, password: v })} data-testid="rev-password" /></Field>
              <Btn onClick={create} disabled={saving} className="w-full" data-testid="rev-create-btn">{saving && <Loader2 className="h-4 w-4 animate-spin" />} Create reviewer</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function PortalProjects() {
  const [rows, setRows] = useState(null);
  const [reviewers, setReviewers] = useState([]);
  const [assigning, setAssigning] = useState({});
  const [reviewId, setReviewId] = useState(null);

  const load = () => api.get("/admin/portal/certification-projects").then(({ data }) => setRows(data)).catch(() => setRows([]));
  useEffect(() => {
    load();
    api.get("/admin/portal/reviewers").then(({ data }) => setReviewers(data)).catch(() => {});
  }, []);

  const assign = async (projectId, reviewerId) => {
    if (!reviewerId) return;
    setAssigning((a) => ({ ...a, [projectId]: true }));
    try { await api.post("/admin/portal/assign", { project_id: projectId, reviewer_id: reviewerId }); toast.success("Reviewer assigned"); load(); }
    catch (err) { toast.error(apiError(err.response?.data?.detail)); }
    finally { setAssigning((a) => ({ ...a, [projectId]: false })); }
  };

  if (rows === null) return <Spin />;
  return (
    <div>
      <h1 className="text-2xl font-serif text-deep-forest-green mb-1">Certification Projects</h1>
      <p className="text-sm text-charcoal/60 mb-6">Assign reviewers to submitted projects, then review forwarded projects and record the final certification.</p>
      <Table head={["Project", "Client", "Type", "Claimed", "Status", "Reviewer", ""]} testid="cert-projects-table">
        {rows.length === 0 ? <Empty text="No certification projects yet." /> : rows.map((p) => (
          <tr key={p.id} data-testid={`cert-project-row-${p.id}`}>
            <td className="px-4 py-3 font-medium text-charcoal">{p.name}</td>
            <td className="px-4 py-3 text-charcoal/70">{p.client?.name || "—"}</td>
            <td className="px-4 py-3 text-charcoal/70">{p.project_type}</td>
            <td className="px-4 py-3">{p.under_configuration ? "—" : `${p.claimed_total}/${p.total_max}`}</td>
            <td className="px-4 py-3 capitalize">{(p.status || "").replace(/_/g, " ")}</td>
            <td className="px-4 py-3">
              {p.reviewer ? (
                <span className="text-charcoal/80">{p.reviewer.name}</span>
              ) : (p.status === "submitted" || p.status === "changes_requested") ? (
                <select className="border border-border rounded-lg px-2 py-1.5 text-sm bg-white" defaultValue="" disabled={assigning[p.id]}
                  onChange={(e) => assign(p.id, e.target.value)} data-testid={`assign-select-${p.id}`}>
                  <option value="" disabled>Assign…</option>
                  {reviewers.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              ) : <span className="text-charcoal/40">—</span>}
            </td>
            <td className="px-4 py-3 text-right">
              {(p.status === "forwarded" || p.status === "certified" || p.status === "rejected") && !p.under_configuration && (
                <button onClick={() => setReviewId(p.id)} data-testid={`review-open-${p.id}`}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-deep-forest-green text-off-white px-3 py-1.5 text-xs font-medium hover:bg-natural-green transition-colors">
                  <Gavel className="h-3.5 w-3.5" /> {p.status === "forwarded" ? "Review & Certify" : "View decision"}
                </button>
              )}
            </td>
          </tr>
        ))}
      </Table>
      {reviewId && <FinalizeModal projectId={reviewId} onClose={() => setReviewId(null)} onDone={() => { setReviewId(null); load(); }} />}
    </div>
  );
}

function FinalizeModal({ projectId, onClose, onDone }) {
  const [d, setD] = useState(null);
  const [final, setFinal] = useState({});
  const [decision, setDecision] = useState("certified");
  const [cert, setCert] = useState({ number: "", issued_date: "", valid_until: "", notes: "" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get(`/admin/portal/certification-projects/${projectId}`).then(({ data }) => {
      setD(data);
      const rec = data.reviewer_recommendations || {};
      const seed = {};
      (data.template?.categories || []).forEach((c) => c.criteria.forEach((cr) => {
        const src = (data.final_responses || {})[cr.id] || rec[cr.id] || (data.responses || {})[cr.id] || {};
        seed[cr.id] = cr.mandatory ? { met: !!src.met } : { final_points: src.final_points ?? src.recommended_points ?? src.claimed_points ?? 0 };
      }));
      setFinal(seed);
      if (data.official_record) {
        setDecision(data.official_record.decision || "certified");
        setCert({ number: data.official_record.certificate_number || "", issued_date: data.official_record.issued_date || "", valid_until: data.official_record.valid_until || "", notes: data.official_record.notes || "" });
      }
    }).catch(() => setD(false));
  }, [projectId]);

  const tpl = d?.template;
  const done = d && (d.status === "certified" || d.status === "rejected");

  const finalTotal = React.useMemo(() => {
    if (!tpl) return 0;
    let t = 0;
    tpl.categories?.forEach((c) => {
      let s = 0;
      c.criteria.forEach((cr) => { if (!cr.mandatory) s += Math.max(0, Math.min(Number(final[cr.id]?.final_points || 0), cr.max_points)); });
      t += Math.min(s, c.max_points);
    });
    return Math.min(t, tpl.total_max);
  }, [final, tpl]);

  const setF = (id, patch) => setFinal((f) => ({ ...f, [id]: { ...(f[id] || {}), ...patch } }));

  const submit = async () => {
    setBusy(true);
    try {
      await api.post(`/admin/portal/projects/${projectId}/finalize`, { final, decision, certificate: cert });
      toast.success(decision === "certified" ? "Project certified" : "Project rejected");
      onDone();
    } catch (e) { toast.error(apiError(e.response?.data?.detail)); } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()} data-testid="finalize-modal">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-medium text-charcoal">{done ? "Certification decision" : "Final review & certification"}</h2>
          <button onClick={onClose}><X className="h-5 w-5 text-charcoal/50" /></button>
        </div>
        {!d ? <div className="p-10"><Spin /></div> : d === false ? <div className="p-10 text-center text-charcoal/50">Not found.</div> : (
          <div className="overflow-y-auto p-6 space-y-5">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-xl bg-off-white border border-border p-3"><div className="text-xs text-charcoal/50">Client claimed</div><div className="text-xl font-semibold text-charcoal/70">{d.claimed_score?.claimed_total || 0}</div></div>
              <div className="rounded-xl bg-off-white border border-border p-3"><div className="text-xs text-charcoal/50">Reviewer rec.</div><div className="text-xl font-semibold text-charcoal/70">{d.recommended_score?.claimed_total || 0}</div></div>
              <div className="rounded-xl bg-natural-green/10 border border-natural-green/30 p-3"><div className="text-xs text-natural-green">Final</div><div className="text-xl font-semibold text-deep-forest-green" data-testid="final-total">{finalTotal}/{tpl?.total_max}</div></div>
            </div>

            <div className="space-y-3 max-h-[34vh] overflow-y-auto pr-1">
              {tpl?.categories?.map((c) => (
                <div key={c.id} className="rounded-xl border border-border p-3">
                  <div className="text-sm font-medium text-charcoal mb-2">{c.name} <span className="text-xs text-charcoal/40">(max {c.max_points})</span></div>
                  {c.criteria.map((cr) => (
                    <div key={cr.id} className="grid grid-cols-[1fr_auto_auto] gap-3 items-center py-1 text-sm">
                      <span className="text-charcoal/80">{cr.name}</span>
                      <span className="text-xs text-charcoal/45 w-24 text-right">rec: {cr.mandatory ? ((d.reviewer_recommendations||{})[cr.id]?.met ? "Met" : "—") : ((d.reviewer_recommendations||{})[cr.id]?.recommended_points || 0)}</span>
                      <span className="w-20 flex justify-end">
                        {cr.mandatory ? (
                          <input type="checkbox" disabled={done} checked={final[cr.id]?.met === true} onChange={(e) => setF(cr.id, { met: e.target.checked })} className="h-4 w-4 accent-natural-green" data-testid={`final-met-${cr.id}`} />
                        ) : (
                          <input type="number" min={0} max={cr.max_points} disabled={done} value={final[cr.id]?.final_points ?? ""}
                            onChange={(e) => setF(cr.id, { final_points: e.target.value === "" ? "" : Math.max(0, Math.min(cr.max_points, Number(e.target.value))) })}
                            className="w-16 border border-border rounded px-2 py-1 text-center outline-none focus:ring-2 focus:ring-natural-green" data-testid={`final-points-${cr.id}`} />
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Decision">
                <select className="w-full bg-white border border-border rounded-lg px-3.5 py-2.5 text-sm" value={decision} disabled={done} onChange={(e) => setDecision(e.target.value)} data-testid="final-decision">
                  <option value="certified">Certify</option>
                  <option value="rejected">Reject</option>
                </select>
              </Field>
              <Field label="Certificate number"><TextInput value={cert.number} onChange={(v) => setCert({ ...cert, number: v })} disabled={done} data-testid="cert-number" /></Field>
              <Field label="Issued date"><TextInput type="date" value={cert.issued_date} onChange={(v) => setCert({ ...cert, issued_date: v })} disabled={done} /></Field>
              <Field label="Valid until"><TextInput type="date" value={cert.valid_until} onChange={(v) => setCert({ ...cert, valid_until: v })} disabled={done} /></Field>
              <div className="sm:col-span-2"><Field label="Notes"><TextInput value={cert.notes} onChange={(v) => setCert({ ...cert, notes: v })} disabled={done} /></Field></div>
            </div>

            {done ? (
              <div className="rounded-xl bg-off-white border border-border px-4 py-3 text-sm text-charcoal/70">Recorded: <strong className="capitalize">{d.official_record?.decision}</strong> · Band {d.official_record?.band} · {d.official_record?.certificate_number || "no cert #"}</div>
            ) : (
              <Btn onClick={submit} disabled={busy} className="w-full" data-testid="finalize-submit-btn">{busy && <Loader2 className="h-4 w-4 animate-spin" />} Record certification decision</Btn>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
