import React, { useRef, useState } from "react";
import { Paperclip, Loader2, X, FileText, CheckCircle2, XCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { apiError } from "../PortalAuthContext";

const STATUS = {
  pending: { Icon: Clock, cls: "text-amber-600", label: "Pending review" },
  approved: { Icon: CheckCircle2, cls: "text-natural-green", label: "Approved" },
  rejected: { Icon: XCircle, cls: "text-red-500", label: "Rejected" },
};

export function EvidenceUploader({ projectId, criterionId, files = [], editable = true, onChange }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);

  const upload = async (e) => {
    const list = Array.from(e.target.files || []);
    if (!list.length) return;
    setBusy(true);
    try {
      const added = [];
      for (const f of list) {
        const fd = new FormData();
        fd.append("file", f);
        fd.append("scope", "evidence");
        fd.append("criterion_id", criterionId);
        const { data } = await api.post(`/client/projects/${projectId}/files`, fd);
        added.push(data);
      }
      onChange?.([...(files || []), ...added]);
      toast.success("Evidence uploaded");
    } catch (err) { toast.error(apiError(err.response?.data?.detail) || "Upload failed"); }
    finally { setBusy(false); if (inputRef.current) inputRef.current.value = ""; }
  };

  const remove = async (fid) => {
    try {
      await api.delete(`/client/projects/${projectId}/files/${fid}`, { params: { criterion_id: criterionId } });
      onChange?.((files || []).filter((f) => f.id !== fid));
    } catch (err) { toast.error(apiError(err.response?.data?.detail)); }
  };

  return (
    <div className="mt-3" data-testid={`evidence-${criterionId}`}>
      {(files || []).length > 0 && (
        <ul className="space-y-1.5 mb-2">
          {files.map((f) => {
            const st = STATUS[f.status] || STATUS.pending;
            return (
              <li key={f.id} className="flex items-center gap-2 text-xs bg-off-white border border-border rounded-lg px-2.5 py-1.5">
                <FileText className="h-3.5 w-3.5 text-charcoal/40 shrink-0" />
                <a href={f.url} target="_blank" rel="noreferrer" className="truncate text-charcoal/80 hover:underline flex-1" title={f.original_name}>{f.original_name}</a>
                <span className={`inline-flex items-center gap-1 ${st.cls}`}><st.Icon className="h-3.5 w-3.5" /> {st.label}</span>
                {f.review?.comment && <span className="text-charcoal/40 italic truncate max-w-[120px]" title={f.review.comment}>“{f.review.comment}”</span>}
                {editable && <button onClick={() => remove(f.id)} className="text-charcoal/40 hover:text-red-500 shrink-0" data-testid={`evidence-del-${f.id}`}><X className="h-3.5 w-3.5" /></button>}
              </li>
            );
          })}
        </ul>
      )}
      {editable && (
        <>
          <input ref={inputRef} type="file" multiple hidden onChange={upload} accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.png,.jpg,.jpeg,.webp,.dwg,.zip" data-testid={`evidence-input-${criterionId}`} />
          <button onClick={() => inputRef.current?.click()} disabled={busy} data-testid={`evidence-upload-${criterionId}`}
            className="inline-flex items-center gap-1.5 text-xs text-natural-green hover:underline">
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Paperclip className="h-3.5 w-3.5" />} Attach evidence
          </button>
        </>
      )}
    </div>
  );
}
