import React, { useEffect, useState, useCallback } from "react";
import { Search, Download, Trash2, Eye } from "lucide-react";
import { api, apiError, API } from "@/lib/api";
import { toast } from "sonner";
import { Modal, ConfirmDialog, Select, TextArea, TextInput, Btn, Field, Loader, Empty } from "@/admin/components/ui";

const STATUSES = ["All", "New", "Contacted", "Follow-up", "Qualified", "Converted", "Closed"];
const color = { New: "bg-natural-green text-off-white", Contacted: "bg-light-mint text-deep-forest-green", "Follow-up": "bg-amber-100 text-amber-800", Qualified: "bg-blue-100 text-blue-800", Converted: "bg-emerald-100 text-emerald-800", Closed: "bg-charcoal/15 text-charcoal/70" };

export default function Leads() {
  const [data, setData] = useState(null);
  const [status, setStatus] = useState("All");
  const [source, setSource] = useState("All");
  const [search, setSearch] = useState("");
  const [sel, setSel] = useState(null);
  const [confirm, setConfirm] = useState(null);

  const load = useCallback(async () => {
    try { const { data } = await api.get("/admin/leads", { params: { status, source, search, limit: 100 } }); setData(data); }
    catch { setData({ items: [], sources: [] }); }
  }, [status, source, search]);
  useEffect(() => { load(); }, [load]);

  const update = async (patch) => {
    try { const { data } = await api.patch(`/admin/leads/${sel.id}`, patch); setSel(data); toast.success("Updated"); load(); }
    catch (e) { toast.error(apiError(e.response?.data?.detail)); }
  };
  const del = async () => { try { await api.delete(`/admin/leads/${confirm.id}`); toast.success("Deleted"); setConfirm(null); setSel(null); load(); } catch (e) { toast.error(apiError(e.response?.data?.detail)); } };

  return (
    <div data-testid="admin-leads">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div><h1 className="text-3xl font-serif text-deep-forest-green">Leads</h1><p className="text-charcoal/60 mt-1">Unified leads from all website sources.</p></div>
        <Btn variant="outline" onClick={() => window.open(`${API}/admin/leads/export`, "_blank")} data-testid="export-leads"><Download className="h-4 w-4" /> Export CSV</Btn>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-sm"><Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-charcoal/40" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search leads..." className="w-full bg-white border border-border rounded-lg pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-natural-green" /></div>
        <div className="w-40"><Select value={status} onChange={setStatus} options={STATUSES} /></div>
        <div className="w-48"><Select value={source} onChange={setSource} options={["All", ...(data?.sources || [])]} /></div>
      </div>

      <div className="mt-6 bg-white border border-border rounded-xl overflow-hidden">
        {data === null ? <Loader /> : data.items.length === 0 ? <Empty message="No leads yet." /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-warm-beige/60 text-charcoal/60 text-xs uppercase tracking-wider"><tr><th className="text-left px-5 py-3">Name</th><th className="text-left px-5 py-3 hidden md:table-cell">Company</th><th className="text-left px-5 py-3">Source</th><th className="text-left px-5 py-3 hidden lg:table-cell">Follow-up</th><th className="text-left px-5 py-3">Status</th><th className="px-5 py-3 text-right">Actions</th></tr></thead>
              <tbody>
                {data.items.map((l) => (
                  <tr key={l.id} className="border-t border-border hover:bg-warm-beige/30">
                    <td className="px-5 py-3"><div className="font-medium">{l.name}</div><div className="text-charcoal/60 text-xs">{l.email}</div></td>
                    <td className="px-5 py-3 text-charcoal/70 hidden md:table-cell">{l.company || "—"}</td>
                    <td className="px-5 py-3"><span className="text-xs bg-warm-beige px-2.5 py-1 rounded-full">{l.source}</span></td>
                    <td className="px-5 py-3 text-charcoal/60 hidden lg:table-cell">{l.follow_up_date || "—"}</td>
                    <td className="px-5 py-3"><span className={`text-xs px-2.5 py-1 rounded-full ${color[l.status] || ""}`}>{l.status}</span></td>
                    <td className="px-5 py-3"><div className="flex items-center justify-end gap-2"><button onClick={() => setSel(l)} data-testid={`view-lead-${l.id}`} className="p-2 rounded-lg hover:bg-warm-beige text-charcoal/70"><Eye className="h-4 w-4" /></button><button onClick={() => setConfirm(l)} className="p-2 rounded-lg hover:bg-destructive/10 text-destructive"><Trash2 className="h-4 w-4" /></button></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={!!sel} onClose={() => setSel(null)} title="Lead details" wide>
        {sel && (
          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-3 text-sm">
              {[["Name", sel.name], ["Company", sel.company], ["Email", sel.email], ["Phone", sel.phone], ["Source", sel.source], ["Interested service", sel.interested_service], ["Created", (sel.created_at || "").slice(0, 16).replace("T", " ")]].map(([k, v]) => <div key={k}><div className="text-xs uppercase tracking-wider text-charcoal/50">{k}</div><div className="text-charcoal">{v || "—"}</div></div>)}
            </div>
            {sel.message && <div><div className="text-xs uppercase tracking-wider text-charcoal/50 mb-1">Message</div><div className="bg-warm-beige/50 rounded-lg p-4 text-charcoal/80 whitespace-pre-line">{sel.message}</div></div>}
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Status"><Select value={sel.status} onChange={(v) => update({ status: v })} options={STATUSES.slice(1)} /></Field>
              <Field label="Follow-up date"><TextInput type="date" value={sel.follow_up_date} onChange={(v) => update({ follow_up_date: v })} /></Field>
            </div>
            <Field label="Internal note"><TextArea value={sel.admin_note} onChange={(v) => setSel({ ...sel, admin_note: v })} rows={3} /></Field>
            <div className="flex justify-between"><Btn variant="danger" onClick={() => setConfirm(sel)}>Delete</Btn><Btn onClick={() => update({ admin_note: sel.admin_note })} data-testid="save-lead-note">Save note</Btn></div>
          </div>
        )}
      </Modal>
      <ConfirmDialog open={!!confirm} onClose={() => setConfirm(null)} onConfirm={del} title="Delete lead" message={`Delete lead from ${confirm?.name}?`} />
    </div>
  );
}
