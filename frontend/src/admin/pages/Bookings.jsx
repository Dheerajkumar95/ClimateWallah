import React, { useEffect, useState, useCallback } from "react";
import { Trash2, Eye } from "lucide-react";
import { api, apiError } from "@/lib/api";
import { toast } from "sonner";
import { Modal, ConfirmDialog, Select, TextArea, Btn, Field, Loader, Empty } from "@/admin/components/ui";

const STATUSES = ["All", "New", "Confirmed", "Completed", "Cancelled"];
const color = { New: "bg-natural-green text-off-white", Confirmed: "bg-light-mint text-deep-forest-green", Completed: "bg-emerald-100 text-emerald-800", Cancelled: "bg-charcoal/15 text-charcoal/70" };

export default function Bookings() {
  const [data, setData] = useState(null);
  const [status, setStatus] = useState("All");
  const [sel, setSel] = useState(null);
  const [confirm, setConfirm] = useState(null);

  const load = useCallback(async () => {
    try { const { data } = await api.get("/admin/bookings", { params: { status, limit: 100 } }); setData(data); }
    catch { setData({ items: [] }); }
  }, [status]);
  useEffect(() => { load(); }, [load]);

  const update = async (patch) => { try { const { data } = await api.patch(`/admin/bookings/${sel.id}`, patch); setSel(data); toast.success("Updated"); load(); } catch (e) { toast.error(apiError(e.response?.data?.detail)); } };
  const del = async () => { try { await api.delete(`/admin/bookings/${confirm.id}`); toast.success("Deleted"); setConfirm(null); setSel(null); load(); } catch (e) { toast.error(apiError(e.response?.data?.detail)); } };

  return (
    <div data-testid="admin-bookings">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div><h1 className="text-3xl font-serif text-deep-forest-green">Bookings</h1><p className="text-charcoal/60 mt-1">Discovery call & consultation requests.</p></div>
        <div className="w-44"><Select value={status} onChange={setStatus} options={STATUSES} /></div>
      </div>

      <div className="mt-6 bg-white border border-border rounded-xl overflow-hidden">
        {data === null ? <Loader /> : data.items.length === 0 ? <Empty message="No bookings yet." /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-warm-beige/60 text-charcoal/60 text-xs uppercase tracking-wider"><tr><th className="text-left px-5 py-3">Name</th><th className="text-left px-5 py-3 hidden md:table-cell">Service</th><th className="text-left px-5 py-3 hidden lg:table-cell">Preferred</th><th className="text-left px-5 py-3">Status</th><th className="px-5 py-3 text-right">Actions</th></tr></thead>
              <tbody>
                {data.items.map((b) => (
                  <tr key={b.id} className="border-t border-border hover:bg-warm-beige/30">
                    <td className="px-5 py-3"><div className="font-medium">{b.name}</div><div className="text-charcoal/60 text-xs">{b.email}</div></td>
                    <td className="px-5 py-3 text-charcoal/70 hidden md:table-cell">{b.service || "—"}</td>
                    <td className="px-5 py-3 text-charcoal/60 hidden lg:table-cell">{[b.preferred_date, b.preferred_time].filter(Boolean).join(" ") || "—"}</td>
                    <td className="px-5 py-3"><span className={`text-xs px-2.5 py-1 rounded-full ${color[b.status] || ""}`}>{b.status}</span></td>
                    <td className="px-5 py-3"><div className="flex items-center justify-end gap-2"><button onClick={() => setSel(b)} data-testid={`view-booking-${b.id}`} className="p-2 rounded-lg hover:bg-warm-beige text-charcoal/70"><Eye className="h-4 w-4" /></button><button onClick={() => setConfirm(b)} className="p-2 rounded-lg hover:bg-destructive/10 text-destructive"><Trash2 className="h-4 w-4" /></button></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={!!sel} onClose={() => setSel(null)} title="Booking details" wide>
        {sel && (
          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-3 text-sm">
              {[["Name", sel.name], ["Email", sel.email], ["Phone", sel.phone], ["Company", sel.company], ["Service", sel.service], ["Project type", sel.project_type], ["Preferred date", sel.preferred_date], ["Preferred time", sel.preferred_time], ["Mode", sel.meeting_mode], ["Location", sel.project_location]].map(([k, v]) => <div key={k}><div className="text-xs uppercase tracking-wider text-charcoal/50">{k}</div><div className="text-charcoal">{v || "—"}</div></div>)}
            </div>
            {sel.message && <div><div className="text-xs uppercase tracking-wider text-charcoal/50 mb-1">Message</div><div className="bg-warm-beige/50 rounded-lg p-4 text-charcoal/80 whitespace-pre-line">{sel.message}</div></div>}
            <Field label="Status"><Select value={sel.status} onChange={(v) => update({ status: v })} options={STATUSES.slice(1)} /></Field>
            <Field label="Internal note"><TextArea value={sel.admin_note} onChange={(v) => setSel({ ...sel, admin_note: v })} rows={3} /></Field>
            <div className="flex justify-end"><Btn onClick={() => update({ admin_note: sel.admin_note })}>Save note</Btn></div>
          </div>
        )}
      </Modal>
      <ConfirmDialog open={!!confirm} onClose={() => setConfirm(null)} onConfirm={del} title="Delete booking" message={`Delete booking from ${confirm?.name}?`} />
    </div>
  );
}
