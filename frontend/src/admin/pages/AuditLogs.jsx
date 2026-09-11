import React, { useEffect, useState } from "react";
import { History, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { api, apiError } from "@/lib/api";
import { toast } from "sonner";

export default function AuditLogs() {
  const [rows, setRows] = useState(null);
  const load = () => { setRows(null); api.get("/admin/portal/audit-logs?limit=500").then(({data}) => setRows(data || [])).catch((e) => { setRows([]); toast.error(apiError(e.response?.data?.detail)); }); };
  useEffect(load, []);
  return <div className="space-y-6 pb-10">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-[#667085]">Security & governance</p><h1 className="mt-1 text-3xl font-semibold text-[#111827]">Audit Trail</h1><p className="mt-1 text-sm text-[#667085]">Append-only history of sensitive certification and finance administration actions.</p></div><button onClick={load} className="inline-flex items-center gap-2 rounded-lg border border-[#E4E7EC] bg-white px-3 py-2 text-sm"><RefreshCw className="h-4 w-4" /> Refresh</button></div>
    <div className="rounded-2xl border border-[#E4E7EC] bg-white shadow-sm overflow-hidden">
      {rows === null ? <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin" /></div> : rows.length === 0 ? <div className="py-16 text-center text-sm text-[#667085]"><History className="mx-auto mb-3 h-8 w-8 opacity-40" />No audit events recorded yet.</div> : <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-[#F6F8FA] text-left text-xs uppercase tracking-wide text-[#667085]"><tr><th className="px-4 py-3">Time</th><th className="px-4 py-3">Action</th><th className="px-4 py-3">Entity</th><th className="px-4 py-3">Administrator</th><th className="px-4 py-3">Summary</th></tr></thead><tbody className="divide-y divide-[#E4E7EC]">{rows.map(r => <tr key={r.id} className="hover:bg-[#FAFBFC]"><td className="whitespace-nowrap px-4 py-3 text-xs text-[#667085]">{r.created_at ? new Date(r.created_at).toLocaleString("en-IN") : "—"}</td><td className="px-4 py-3"><span className="inline-flex items-center gap-1.5 rounded-full bg-[#E9FFF2] px-2.5 py-1 text-xs font-semibold text-[#172033]"><ShieldCheck className="h-3.5 w-3.5" />{String(r.action || "").replaceAll("_", " ")}</span></td><td className="px-4 py-3 text-[#344054]">{r.entity_type}{r.entity_id ? <div className="text-xs text-[#98A2B3]">{r.entity_id}</div> : null}</td><td className="px-4 py-3 text-[#344054]">{r.actor_email || r.actor_id || "System"}</td><td className="px-4 py-3 text-[#667085]">{r.summary || "—"}</td></tr>)}</tbody></table></div>}
    </div>
  </div>;
}
