import React, { useEffect, useState } from "react";
import { Ban, Check, Eye, FileText, Loader2, RefreshCw, UploadCloud, X, XCircle } from "lucide-react";
import { toast } from "sonner";
import { api, apiError } from "@/lib/api";

const inputClass = "w-full rounded-lg border border-[#E4E7EC] bg-white p-3 text-sm text-[#172033] outline-none focus:ring-2 focus:ring-[#27F580]";

export default function ReviewerApplications() {
  const [items, setItems] = useState(null);
  const [selected, setSelected] = useState(null);
  const [comment, setComment] = useState("");
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const [welcomePdf, setWelcomePdf] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = () => api.get("/admin/portal/reviewer-applications")
    .then(({ data }) => setItems(data))
    .catch((error) => { setItems([]); toast.error(apiError(error.response?.data?.detail)); });
  useEffect(() => { load(); }, []);

  const viewDocument = async (document) => {
    try {
      const response = await api.get(`/admin/portal/reviewer-documents/${document.id}`, { responseType: "blob" });
      const url = URL.createObjectURL(response.data);
      window.open(url, "_blank", "noopener,noreferrer");
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (error) { toast.error(apiError(error.response?.data?.detail)); }
  };

  const uploadWelcomePdf = async () => {
    if (!welcomePdf) return null;
    const body = new FormData();
    body.append("file", welcomePdf);
    const { data } = await api.post("/admin/portal/reviewer-welcome-pdf", body);
    return data.id;
  };

  const decide = async (decision) => {
    setBusy(true);
    try {
      let welcome_pdf_id = null;
      if (decision === "approved" && welcomePdf) welcome_pdf_id = await uploadWelcomePdf();
      await api.post(`/admin/portal/reviewer-applications/${selected.id}/decision`, {
        decision,
        comment,
        welcome_message: decision === "approved" ? welcomeMessage : null,
        welcome_pdf_id,
      });
      toast.success(decision === "approved" ? "Reviewer approved and welcome email queued" : `Reviewer ${decision.replace(/_/g, " ")}`);
      setSelected(null); setComment(""); setWelcomeMessage(""); setWelcomePdf(null); load();
    } catch (error) { toast.error(apiError(error.response?.data?.detail)); }
    finally { setBusy(false); }
  };

  if (items === null) return <div className="flex justify-center py-24"><Loader2 className="h-7 w-7 animate-spin text-[#27F580]" /></div>;

  return <div className="space-y-6">
    <div className="flex items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-[#667085]">Professional network</p><h1 className="mt-1 text-3xl font-semibold text-[#111827]">Reviewer Applications</h1><p className="mt-1 text-sm text-[#667085]">Verification, documents, subscription status and reviewer access decisions.</p></div><button onClick={load} className="rounded-lg border border-[#E4E7EC] bg-white p-2.5 text-[#172033]"><RefreshCw className="h-4 w-4" /></button></div>
    <div className="overflow-hidden rounded-2xl border border-[#E4E7EC] bg-white shadow-sm"><div className="overflow-x-auto"><table className="w-full min-w-[1180px] text-left text-sm"><thead className="bg-[#F6F8FA] text-xs uppercase tracking-wide text-[#667085]"><tr><th className="px-4 py-3">Reviewer ID</th><th>Reviewer</th><th>Phone</th><th>Experience</th><th>Specialisation</th><th>Documents</th><th>Application</th><th>Subscription</th><th className="px-4">Action</th></tr></thead><tbody>
      {items.map((item) => <tr key={item.id} className="border-t border-[#E4E7EC]"><td className="px-4 py-3 font-mono text-xs font-semibold text-[#172033]">{item.public_id || "—"}</td><td><div className="font-medium text-[#172033]">{item.name}</div><div className="text-xs text-[#667085]">{item.email}</div></td><td className="text-[#667085]">{item.phone || "—"}</td><td className="text-[#667085]">{item.experience_years || 0} years</td><td className="max-w-[180px] text-[#667085]">{item.specialisation || "—"}</td><td className="text-[#667085]">{item.documents?.length || 0}/2</td><td><Status status={item.reviewer_status} /></td><td><PlanStatus item={item} /></td><td className="px-4"><button onClick={() => { setSelected(item); setComment(item.reviewer_admin_comment || ""); setWelcomeMessage(""); setWelcomePdf(null); }} className="inline-flex items-center gap-1.5 rounded-lg border border-[#E4E7EC] px-3 py-2 text-xs font-semibold text-[#172033] hover:border-[#27F580] hover:bg-[#E9FFF2]"><Eye className="h-4 w-4" /> View</button></td></tr>)}
      {!items.length && <tr><td colSpan="9" className="p-14 text-center text-[#667085]">No reviewer applications yet.</td></tr>}
    </tbody></table></div></div>

    {selected && <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/50 p-4" onClick={() => setSelected(null)}><div className="w-full max-w-4xl rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-start justify-between"><div><div className="font-mono text-xs font-semibold text-[#7C5CFC]">{selected.public_id || "Reviewer ID pending"}</div><h2 className="mt-1 text-xl font-semibold text-[#111827]">{selected.name}</h2><p className="text-sm text-[#667085]">{selected.email} · {selected.phone || "No phone"}</p></div><button onClick={() => setSelected(null)} aria-label="Close"><X className="h-5 w-5 text-[#667085]" /></button></div>
      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4"><Info label="City" value={selected.city} /><Info label="Organisation" value={selected.organization} /><Info label="Experience" value={`${selected.experience_years || 0} years`} /><Info label="Specialisation" value={selected.specialisation} /><Info label="Project types" value={(selected.project_types || []).join(", ")} /><Info label="Rating systems" value={(selected.rating_systems || []).join(", ")} /><Info label="Application" value={(selected.reviewer_status || "").replace(/_/g, " ")} /><Info label="Plan" value={selected.subscription_state?.status} /></div>
      <h3 className="mt-6 font-semibold text-[#111827]">Verification documents</h3><div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">{(selected.documents || []).map((doc) => <button key={doc.id} onClick={() => viewDocument(doc)} className="flex items-center gap-3 rounded-xl border border-[#E4E7EC] p-4 text-left hover:border-[#3B82F6]"><FileText className="h-5 w-5 text-[#3B82F6]" /><span className="min-w-0"><span className="block text-sm font-medium capitalize text-[#172033]">{doc.document_type}</span><span className="block truncate text-xs text-[#667085]">{doc.original_name}</span><span className="mt-1 block text-[11px] capitalize text-[#667085]">{doc.status || "pending"}</span></span></button>)}{!selected.documents?.length && <div className="col-span-2 rounded-xl border border-dashed border-[#E4E7EC] p-6 text-center text-sm text-[#667085]">No documents.</div>}</div>
      <label className="mt-5 block"><span className="mb-1.5 block text-sm font-medium text-[#172033]">Admin comment</span><textarea value={comment} onChange={(e) => setComment(e.target.value)} rows="3" className={inputClass} placeholder="Approval note or requested corrections" /></label>
      <div className="mt-4 rounded-xl border border-[#E4E7EC] bg-[#F6F8FA] p-4"><div className="text-sm font-semibold text-[#172033]">Approval email options</div><label className="mt-3 block"><span className="mb-1 block text-xs font-medium text-[#667085]">Custom welcome message</span><textarea value={welcomeMessage} onChange={(e) => setWelcomeMessage(e.target.value)} rows="2" className={inputClass} placeholder="Welcome to the ClimateWallah reviewer network…" /></label><label className="mt-3 flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-[#98A2B3] bg-white px-3 py-2 text-sm text-[#172033]"><UploadCloud className="h-4 w-4" /> {welcomePdf ? welcomePdf.name : "Optional welcome / offer PDF"}<input type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => setWelcomePdf(e.target.files?.[0] || null)} /></label><p className="mt-2 text-xs text-[#667085]">Approval email includes name, Reviewer ID, email and login URL. Password is never emailed.</p></div>
      <div className="mt-5 flex flex-wrap justify-end gap-2"><Decision onClick={() => decide("suspended")} disabled={busy} tone="purple" Icon={Ban}>Suspend</Decision><Decision onClick={() => decide("rejected")} disabled={busy} tone="red" Icon={XCircle}>Reject</Decision><Decision onClick={() => decide("changes_requested")} disabled={busy} tone="amber" Icon={RefreshCw}>Request Changes</Decision><Decision onClick={() => decide("approved")} disabled={busy} tone="green" Icon={Check}>Approve</Decision></div>
    </div></div>}
  </div>;
}

function Status({ status }) {
  const map = {
    approved: "bg-[#E9FFF2] text-[#172033]", rejected: "bg-red-50 text-red-700", suspended: "bg-purple-50 text-purple-700",
    changes_requested: "bg-amber-50 text-amber-800", pending_documents: "bg-amber-50 text-amber-800", pending_review: "bg-blue-50 text-blue-700",
  };
  const labels = { pending_documents: "Pending Documents", pending_review: "Under Review", changes_requested: "Changes Requested", approved: "Approved", rejected: "Rejected", suspended: "Suspended" };
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${map[status] || "bg-amber-50 text-amber-700"}`}>{labels[status] || "Pending"}</span>;
}
function PlanStatus({ item }) { const state = item.subscription_state || {}; return <div><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${state.active ? "bg-[#E9FFF2] text-[#172033]" : state.status === "expired" ? "bg-red-50 text-red-700" : "bg-[#F6F8FA] text-[#667085]"}`}>{(state.status || "not started").replace(/_/g, " ")}</span>{state.ends_at && <div className="mt-1 text-[11px] text-[#667085]">to {String(state.ends_at).slice(0,10)}</div>}</div>; }
function Info({ label, value }) { return <div className="rounded-xl bg-[#F6F8FA] p-3"><div className="text-xs text-[#667085]">{label}</div><div className="mt-1 text-sm font-medium capitalize text-[#172033]">{value || "—"}</div></div>; }
function Decision({ children, Icon, tone, ...props }) { const cls = tone === "red" ? "border-red-200 text-red-700 hover:bg-red-50" : tone === "amber" ? "border-amber-200 text-amber-700 hover:bg-amber-50" : tone === "purple" ? "border-purple-200 text-purple-700 hover:bg-purple-50" : "border-[#27F580] bg-[#27F580] text-[#172033] hover:bg-[#20DB72]"; return <button {...props} className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold disabled:opacity-50 ${cls}`}><Icon className="h-4 w-4" />{children}</button>; }
