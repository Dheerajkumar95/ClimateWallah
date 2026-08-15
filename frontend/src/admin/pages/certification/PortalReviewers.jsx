import React, { useEffect, useState } from "react";
import { Eye, KeyRound, Loader2, Trash2, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { Btn, Field, TextInput } from "@/admin/components/ui";
import { api, apiError } from "@/lib/api";
import { Empty, InfoItem, ModalShell, Spin, Table } from "./PortalUi";

const EMPTY_FORM = {
  name: "",
  email: "",
  password: "",
  specialisation: "",
  project_types: [],
  max_workload: 5,
};

export default function PortalReviewers() {
  const [rows, setRows] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [viewId, setViewId] = useState(null);
  const [passwordReviewer, setPasswordReviewer] = useState(null);
  const [deleteReviewer, setDeleteReviewer] = useState(null);

  const load = () => {
    api.get("/admin/portal/reviewers")
      .then(({ data }) => setRows(data))
      .catch(() => setRows([]));
  };

  useEffect(() => {
    load();
  }, []);

  const toggleType = (projectType) => {
    setForm((current) => ({
      ...current,
      project_types: current.project_types.includes(projectType)
        ? current.project_types.filter((item) => item !== projectType)
        : [...current.project_types, projectType],
    }));
  };

  const create = async () => {
    setSaving(true);
    try {
      await api.post("/admin/portal/reviewers", {
        ...form,
        max_workload: Number(form.max_workload) || 5,
      });
      toast.success("Reviewer created");
      setCreateOpen(false);
      setForm(EMPTY_FORM);
      load();
    } catch (error) {
      toast.error(apiError(error.response?.data?.detail));
    } finally {
      setSaving(false);
    }
  };

  if (rows === null) return <Spin />;

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="mb-1 text-2xl font-serif text-[#172033]">Portal Reviewers</h1>
          <p className="text-sm text-[#667085]">Reviewer accounts are created here — there is no public signup.</p>
        </div>
        <Btn onClick={() => setCreateOpen(true)} data-testid="add-reviewer-btn">
          <UserPlus className="h-4 w-4" /> Add Reviewer
        </Btn>
      </div>

      <Table head={["Name", "Email", "Specialisation", "Types", "Workload", "Completed", "Actions"]} testid="reviewers-table">
        {rows.length === 0 ? <Empty text="No reviewers yet." /> : rows.map((reviewer) => (
          <tr key={reviewer.id} data-testid={`reviewer-row-${reviewer.id}`}>
            <td className="px-4 py-3 font-medium text-[#172033]">{reviewer.name}</td>
            <td className="px-4 py-3 text-[#667085]">{reviewer.email}</td>
            <td className="px-4 py-3 text-[#667085]">{reviewer.specialisation || "—"}</td>
            <td className="px-4 py-3 text-xs text-[#667085]">{(reviewer.project_types || []).join(", ") || "All"}</td>
            <td className="px-4 py-3">
              <span className={reviewer.available ? "text-[#172033]" : "text-amber-600"}>
                {reviewer.active_assignments}/{reviewer.max_workload}
              </span>
            </td>
            <td className="px-4 py-3 text-[#667085]">{reviewer.completed_reviews || 0}</td>
            <td className="px-4 py-3">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setViewId(reviewer.id)}
                  title="View reviewer"
                  className="rounded-lg border border-[#E4E7EC] p-2 text-[#667085] hover:border-[#27F580] hover:bg-[#E9FFF2] hover:text-[#172033]"
                >
                  <Eye className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setPasswordReviewer(reviewer)}
                  title="Update password"
                  className="rounded-lg border border-[#E4E7EC] p-2 text-[#3B82F6] hover:bg-blue-50"
                >
                  <KeyRound className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteReviewer(reviewer)}
                  title="Delete reviewer"
                  className="rounded-lg border border-red-200 p-2 text-[#EF4444] hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </td>
          </tr>
        ))}
      </Table>

      {createOpen && (
        <CreateReviewerModal
          form={form}
          saving={saving}
          onFormChange={setForm}
          onToggleType={toggleType}
          onSubmit={create}
          onClose={() => setCreateOpen(false)}
        />
      )}
      {viewId && <ReviewerDetailModal reviewerId={viewId} onClose={() => setViewId(null)} />}
      {passwordReviewer && <ReviewerPasswordModal reviewer={passwordReviewer} onClose={() => setPasswordReviewer(null)} />}
      {deleteReviewer && (
        <DeleteReviewerModal
          reviewer={deleteReviewer}
          onClose={() => setDeleteReviewer(null)}
          onDone={() => {
            setDeleteReviewer(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function CreateReviewerModal({ form, saving, onFormChange, onToggleType, onSubmit, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6" onClick={(event) => event.stopPropagation()} data-testid="reviewer-modal">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-medium text-[#172033]">New Reviewer</h2>
          <button type="button" onClick={onClose} aria-label="Close"><X className="h-5 w-5 text-[#667085]" /></button>
        </div>
        <div className="space-y-4">
          <Field label="Full name"><TextInput value={form.name} onChange={(value) => onFormChange({ ...form, name: value })} data-testid="rev-name" /></Field>
          <Field label="Email"><TextInput type="email" value={form.email} onChange={(value) => onFormChange({ ...form, email: value })} data-testid="rev-email" /></Field>
          <Field label="Password" help="Min 8 chars with upper, lower and a number."><TextInput type="password" value={form.password} onChange={(value) => onFormChange({ ...form, password: value })} data-testid="rev-password" /></Field>
          <Field label="Specialisation"><TextInput value={form.specialisation} onChange={(value) => onFormChange({ ...form, specialisation: value })} data-testid="rev-spec" /></Field>
          <Field label="Supported project types">
            <div className="flex flex-wrap gap-2">
              {["Commercial", "Residential", "Hotel", "Hospital"].map((projectType) => (
                <button
                  key={projectType}
                  type="button"
                  onClick={() => onToggleType(projectType)}
                  data-testid={`rev-type-${projectType}`}
                  className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${form.project_types.includes(projectType) ? "border-[#27F580] bg-[#E9FFF2] text-[#172033]" : "border-[#E4E7EC] text-[#667085]"}`}
                >
                  {projectType}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Max workload"><TextInput type="number" value={form.max_workload} onChange={(value) => onFormChange({ ...form, max_workload: value })} data-testid="rev-workload" /></Field>
          <Btn onClick={onSubmit} disabled={saving} className="w-full" data-testid="rev-create-btn">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Create reviewer
          </Btn>
        </div>
      </div>
    </div>
  );
}

function ReviewerDetailModal({ reviewerId, onClose }) {
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    api.get(`/admin/portal/reviewers/${reviewerId}`)
      .then(({ data }) => setDetail(data))
      .catch((error) => {
        toast.error(apiError(error.response?.data?.detail));
        onClose();
      });
  }, [reviewerId, onClose]);

  return (
    <ModalShell title="Reviewer Details" subtitle={detail?.email} onClose={onClose}>
      {!detail ? <Spin /> : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <InfoItem label="Name" value={detail.name} />
            <InfoItem label="Email" value={detail.email} />
            <InfoItem label="Specialisation" value={detail.specialisation} />
            <InfoItem label="Project types" value={(detail.project_types || []).join(", ") || "All"} />
            <InfoItem label="Active assignments" value={detail.active_assignments || 0} />
            <InfoItem label="Maximum workload" value={detail.max_workload || 5} />
            <InfoItem label="Completed reviews" value={detail.completed_reviews || 0} />
            <InfoItem label="Status" value={detail.active === false ? "Deleted" : "Active"} />
          </div>
          <div>
            <h3 className="mb-3 font-semibold text-[#111827]">Assigned projects</h3>
            <Table head={["Project", "Client", "Type", "Status", "Updated"]}>
              {!detail.projects?.length ? <Empty text="No assigned projects." /> : detail.projects.map((project) => (
                <tr key={project.id}>
                  <td className="px-4 py-3 font-medium text-[#172033]">{project.name}</td>
                  <td className="px-4 py-3 text-[#667085]">{project.client?.name || "—"}</td>
                  <td className="px-4 py-3 text-[#667085]">{project.project_type}</td>
                  <td className="px-4 py-3 capitalize text-[#667085]">{(project.status || "").replace(/_/g, " ")}</td>
                  <td className="px-4 py-3 text-[#667085]">{(project.updated_at || "").slice(0, 10)}</td>
                </tr>
              ))}
            </Table>
          </div>
        </div>
      )}
    </ModalShell>
  );
}

function ReviewerPasswordModal({ reviewer, onClose }) {
  const [form, setForm] = useState({ new_password: "", confirm_password: "" });
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  const generate = () => {
    const value = `Res@${Math.random().toString(36).slice(2, 8)}A1`;
    setForm({ new_password: value, confirm_password: value });
  };

  const submit = async () => {
    if (form.new_password !== form.confirm_password) {
      toast.error("Passwords do not match");
      return;
    }
    setBusy(true);
    try {
      const { data } = await api.patch(`/admin/portal/reviewers/${reviewer.id}/password`, form);
      toast.success(data.message);
      onClose();
    } catch (error) {
      toast.error(apiError(error.response?.data?.detail));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalShell title="Update Reviewer Password" subtitle={`${reviewer.name} · ${reviewer.email}`} onClose={onClose} width="max-w-lg">
      <div className="space-y-4">
        <Field label="New password" help="Minimum 8 characters with uppercase, lowercase and a number.">
          <TextInput type={show ? "text" : "password"} value={form.new_password} onChange={(value) => setForm({ ...form, new_password: value })} />
        </Field>
        <Field label="Confirm password">
          <TextInput type={show ? "text" : "password"} value={form.confirm_password} onChange={(value) => setForm({ ...form, confirm_password: value })} />
        </Field>
        <label className="flex items-center gap-2 text-sm text-[#667085]">
          <input type="checkbox" checked={show} onChange={(event) => setShow(event.target.checked)} className="accent-[#27F580]" /> Show password
        </label>
        <div className="flex flex-wrap justify-end gap-2 pt-2">
          <Btn variant="outline" type="button" onClick={generate}>Generate password</Btn>
          <Btn variant="outline" type="button" onClick={onClose}>Cancel</Btn>
          <button type="button" onClick={submit} disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-[#27F580] px-4 py-2.5 text-sm font-semibold text-[#172033] hover:bg-[#20DB72] disabled:opacity-60">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />} Update password
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

function DeleteReviewerModal({ reviewer, onClose, onDone }) {
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);

  const remove = async () => {
    setBusy(true);
    try {
      const { data } = await api.delete(`/admin/portal/reviewers/${reviewer.id}`);
      toast.success(data.message);
      onDone();
    } catch (error) {
      toast.error(apiError(error.response?.data?.detail));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalShell title="Delete Reviewer" subtitle="Completed review history will be preserved." onClose={onClose} width="max-w-lg">
      <div className="space-y-4">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          This will disable <strong>{reviewer.name}</strong> and prevent future logins or assignments. Active assignments must be removed first.
        </div>
        <Field label={`Type ${reviewer.email} to confirm`}>
          <TextInput value={confirmation} onChange={setConfirmation} />
        </Field>
        <div className="flex justify-end gap-2">
          <Btn variant="outline" onClick={onClose}>Cancel</Btn>
          <button
            type="button"
            onClick={remove}
            disabled={busy || confirmation !== reviewer.email}
            className="inline-flex items-center gap-2 rounded-lg bg-[#EF4444] px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Delete reviewer
          </button>
        </div>
      </div>
    </ModalShell>
  );
}