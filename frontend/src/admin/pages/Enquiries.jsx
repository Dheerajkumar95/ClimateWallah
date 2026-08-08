import React, { useEffect, useState, useCallback } from "react";
import { Search, Download, Trash2, Eye } from "lucide-react";
import { api, apiError, API } from "@/lib/api";
import { toast } from "sonner";
import { Btn, Modal, ConfirmDialog, Select, TextArea, Loader, Empty } from "@/admin/components/ui";

const STATUSES = ["All", "New", "Read", "Replied", "Closed"];
const statusColor = { New: "bg-natural-green text-off-white", Read: "bg-light-mint text-deep-forest-green", Replied: "bg-warm-beige text-charcoal", Closed: "bg-charcoal/15 text-charcoal/70" };

export default function Enquiries() {
  const [data, setData] = useState(null);
  const [status, setStatus] = useState("All");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [note, setNote] = useState("");
  const [confirm, setConfirm] = useState(null);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/admin/enquiries", { params: { status, search, limit: 100 } });
      setData(data);
    } catch { setData({ items: [] }); }
  }, [status, search]);

  useEffect(() => { load(); }, [load]);

  const open = async (e) => {
    try { const { data } = await api.get(`/admin/enquiries/${e.id}`); setSelected(data); setNote(data.admin_note || ""); load(); }
    catch (err) { toast.error(apiError(err.response?.data?.detail)); }
  };

  const update = async (patch) => {
    try {
      const { data } = await api.patch(`/admin/enquiries/${selected.id}`, patch);
      setSelected(data); toast.success("Updated"); load();
    } catch (err) { toast.error(apiError(err.response?.data?.detail)); }
  };

  const del = async () => {
    try { await api.delete(`/admin/enquiries/${confirm.id}`); toast.success("Deleted"); setConfirm(null); setSelected(null); load(); }
    catch (err) { toast.error(apiError(err.response?.data?.detail)); }
  };

  const exportCsv = () => { window.open(`${API}/admin/enquiries/export`, "_blank"); };

  return (
    <div data-testid="admin-enquiries">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-serif text-deep-forest-green">Enquiries</h1>
          <p className="text-charcoal/60 mt-1">Contact form submissions from the website.</p>
        </div>
        <Btn variant="outline" onClick={exportCsv} data-testid="export-csv"><Download className="h-4 w-4" /> Export CSV</Btn>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-charcoal/40" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search enquiries..." className="w-full bg-white border border-border rounded-lg pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-natural-green" />
        </div>
        <div className="w-44"><Select value={status} onChange={setStatus} options={STATUSES} /></div>
      </div>

      <div className="mt-6 bg-white border border-border rounded-xl overflow-hidden">
        {data === null ? <Loader /> : data.items.length === 0 ? <Empty message="No enquiries found." /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-warm-beige/60 text-charcoal/60 text-xs uppercase tracking-wider">
                <tr><th className="text-left px-5 py-3">Name</th><th className="text-left px-5 py-3">Email</th><th className="text-left px-5 py-3 hidden md:table-cell">Subject</th><th className="text-left px-5 py-3 hidden lg:table-cell">Date</th><th className="text-left px-5 py-3">Status</th><th className="px-5 py-3 text-right">Actions</th></tr>
              </thead>
              <tbody>
                {data.items.map((e) => (
                  <tr key={e.id} className="border-t border-border hover:bg-warm-beige/30">
                    <td className="px-5 py-3 font-medium">{e.name}</td>
                    <td className="px-5 py-3 text-charcoal/70">{e.email}</td>
                    <td className="px-5 py-3 text-charcoal/70 hidden md:table-cell">{e.subject || "—"}</td>
                    <td className="px-5 py-3 text-charcoal/60 hidden lg:table-cell">{(e.created_at || "").slice(0, 10)}</td>
                    <td className="px-5 py-3"><span className={`text-xs px-2.5 py-1 rounded-full ${statusColor[e.status] || ""}`}>{e.status}</span></td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => open(e)} data-testid={`view-enquiry-${e.id}`} className="p-2 rounded-lg hover:bg-warm-beige text-charcoal/70"><Eye className="h-4 w-4" /></button>
                        <button onClick={() => setConfirm(e)} className="p-2 rounded-lg hover:bg-destructive/10 text-destructive"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={!!selected} onClose={() => setSelected(null)} title="Enquiry details" wide>
        {selected && (
          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-3 text-sm">
              {[["Name", selected.name], ["Email", selected.email], ["Phone", selected.phone], ["Company", selected.company], ["Subject", selected.subject], ["Service", selected.service_of_interest], ["Source", selected.source_page], ["Date", (selected.created_at || "").slice(0, 16).replace("T", " ")]].map(([k, v]) => (
                <div key={k}><div className="text-xs uppercase tracking-wider text-charcoal/50">{k}</div><div className="text-charcoal">{v || "—"}</div></div>
              ))}
            </div>
            <div><div className="text-xs uppercase tracking-wider text-charcoal/50 mb-1">Message</div><div className="bg-warm-beige/50 rounded-lg p-4 text-charcoal/80 whitespace-pre-line">{selected.message}</div></div>
            <div className="grid sm:grid-cols-2 gap-4 items-end">
              <div>
                <div className="text-sm font-medium text-charcoal/80 mb-1.5">Status</div>
                <Select value={selected.status} onChange={(v) => update({ status: v })} options={["New", "Read", "Replied", "Closed"]} />
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-charcoal/80 mb-1.5">Internal note</div>
              <TextArea value={note} onChange={setNote} rows={3} />
              <div className="mt-2 flex justify-between">
                <Btn variant="danger" onClick={() => setConfirm(selected)}>Delete</Btn>
                <Btn onClick={() => update({ admin_note: note })} data-testid="save-note">Save note</Btn>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog open={!!confirm} onClose={() => setConfirm(null)} onConfirm={del} title="Delete enquiry" message={`Delete enquiry from ${confirm?.name}?`} />
    </div>
  );
}
