import React, { useEffect, useState } from "react";
import { Loader2, Plus, UserPlus, X } from "lucide-react";
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
      <p className="text-sm text-charcoal/60 mb-6">Queue of client certification projects. Assign reviewers to submitted projects.</p>
      <Table head={["Project", "Client", "Type", "Claimed", "Band", "Status", "Reviewer"]} testid="cert-projects-table">
        {rows.length === 0 ? <Empty text="No certification projects yet." /> : rows.map((p) => (
          <tr key={p.id} data-testid={`cert-project-row-${p.id}`}>
            <td className="px-4 py-3 font-medium text-charcoal">{p.name}</td>
            <td className="px-4 py-3 text-charcoal/70">{p.client?.name || "—"}</td>
            <td className="px-4 py-3 text-charcoal/70">{p.project_type}</td>
            <td className="px-4 py-3">{p.under_configuration ? "—" : `${p.claimed_total}/${p.total_max}`}</td>
            <td className="px-4 py-3">{p.under_configuration ? "—" : p.band}</td>
            <td className="px-4 py-3 capitalize">{(p.status || "").replace(/_/g, " ")}</td>
            <td className="px-4 py-3">
              {p.reviewer ? (
                <span className="text-charcoal/80">{p.reviewer.name}</span>
              ) : p.status === "submitted" ? (
                <select
                  className="border border-border rounded-lg px-2 py-1.5 text-sm bg-white"
                  defaultValue=""
                  disabled={assigning[p.id]}
                  onChange={(e) => assign(p.id, e.target.value)}
                  data-testid={`assign-select-${p.id}`}
                >
                  <option value="" disabled>Assign…</option>
                  {reviewers.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              ) : (
                <span className="text-charcoal/40">—</span>
              )}
            </td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
