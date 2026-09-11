import React, { useEffect, useState } from "react";
import { Award, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { api, apiError } from "@/lib/api";

const EMPTY = { code: "", name: "", full_name: "", description: "", accent: "#27F580", active: true, price_multiplier: 1, display_order: 0 };
const inputClass = "w-full rounded-lg border border-[#E4E7EC] bg-white px-3.5 py-2.5 text-sm text-[#172033] outline-none focus:ring-2 focus:ring-[#27F580]";

export default function CertificationTypes() {
  const [items, setItems] = useState(null);
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = () => api.get("/admin/portal/certification-types").then(({ data }) => setItems(data)).catch((error) => { setItems([]); toast.error(apiError(error.response?.data?.detail)); });
  useEffect(() => { load(); }, []);

  const save = async (event) => {
    event.preventDefault(); setBusy(true);
    try {
      const payload = { ...editing, code: editing.code.toUpperCase(), price_multiplier: Number(editing.price_multiplier || 1), display_order: Number(editing.display_order || 0) };
      if (editing.id) await api.put(`/admin/portal/certification-types/${editing.code}`, payload);
      else await api.post("/admin/portal/certification-types", payload);
      toast.success(editing.id ? "Certification type updated" : "Certification type added"); setEditing(null); load();
    } catch (error) { toast.error(apiError(error.response?.data?.detail)); } finally { setBusy(false); }
  };

  const remove = async (item) => {
    if (!window.confirm(`Delete or archive ${item.name}? Existing projects will remain unchanged.`)) return;
    try { const { data } = await api.delete(`/admin/portal/certification-types/${item.code}`); toast.success(data.message); load(); } catch (error) { toast.error(apiError(error.response?.data?.detail)); }
  };

  if (items === null) return <div className="flex justify-center py-24"><Loader2 className="h-7 w-7 animate-spin text-[#27F580]" /></div>;
  return <div className="space-y-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-[#667085]">Certification portal</p><h1 className="mt-1 text-3xl font-semibold text-[#111827]">Certification Types</h1><p className="mt-1 text-sm text-[#667085]">Manage the IGBC, WELL, LEED and future certification choices shown to clients.</p></div><button onClick={() => setEditing(EMPTY)} className="inline-flex items-center gap-2 rounded-lg bg-[#27F580] px-4 py-2.5 text-sm font-semibold text-[#172033] hover:bg-[#20DB72]"><Plus className="h-4 w-4" /> Add certification type</button></div>
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">{items.map((item) => <article key={item.code} className="rounded-2xl border border-[#E4E7EC] bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-4"><span className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ backgroundColor: `${item.accent || "#27F580"}22` }}><Award className="h-5 w-5 text-[#172033]" /></span><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${item.active ? "bg-[#E9FFF2] text-[#172033]" : "bg-slate-100 text-slate-600"}`}>{item.active ? "Active" : "Archived"}</span></div><div className="mt-4 text-xl font-semibold text-[#111827]">{item.name}</div><div className="mt-1 text-sm text-[#667085]">{item.full_name}</div><p className="mt-3 min-h-[40px] text-sm text-[#667085]">{item.description || "No description"}</p><div className="mt-4 flex items-center justify-between border-t border-[#E4E7EC] pt-4"><span className="text-xs text-[#667085]">Price multiplier {item.price_multiplier || 1}×</span><div className="flex gap-2"><button onClick={() => setEditing({ ...item })} className="rounded-lg border border-[#E4E7EC] p-2 text-[#3B82F6] hover:bg-blue-50"><Pencil className="h-4 w-4" /></button><button onClick={() => remove(item)} className="rounded-lg border border-red-200 p-2 text-[#EF4444] hover:bg-red-50"><Trash2 className="h-4 w-4" /></button></div></div></article>)}</div>
    {!items.length && <div className="rounded-2xl border border-dashed border-[#E4E7EC] bg-white p-16 text-center text-[#667085]">No certification types configured.</div>}
    {editing && <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/50 p-4" onClick={() => setEditing(null)}><form onSubmit={save} onClick={(e) => e.stopPropagation()} className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl"><div className="mb-5 flex items-center justify-between"><h2 className="text-xl font-semibold text-[#111827]">{editing.id ? "Edit" : "Add"} certification type</h2><button type="button" onClick={() => setEditing(null)}><X className="h-5 w-5 text-[#667085]" /></button></div><div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><Field label="Code"><input required disabled={!!editing.id} className={inputClass} value={editing.code} onChange={(e) => setEditing({ ...editing, code: e.target.value.toUpperCase() })} placeholder="EDGE" /></Field><Field label="Short name"><input required className={inputClass} value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></Field><Field label="Full name"><input className={inputClass} value={editing.full_name || ""} onChange={(e) => setEditing({ ...editing, full_name: e.target.value })} /></Field><Field label="Accent colour"><input type="color" className="h-11 w-full rounded-lg border border-[#E4E7EC] bg-white p-1" value={editing.accent || "#27F580"} onChange={(e) => setEditing({ ...editing, accent: e.target.value })} /></Field><Field label="Price multiplier"><input min="0.01" step="0.01" type="number" className={inputClass} value={editing.price_multiplier} onChange={(e) => setEditing({ ...editing, price_multiplier: e.target.value })} /></Field><Field label="Display order"><input min="0" type="number" className={inputClass} value={editing.display_order} onChange={(e) => setEditing({ ...editing, display_order: e.target.value })} /></Field></div><Field label="Description"><textarea rows="3" className={`${inputClass} mt-4`} value={editing.description || ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></Field><label className="mt-4 flex items-center gap-2 text-sm text-[#172033]"><input type="checkbox" checked={editing.active} onChange={(e) => setEditing({ ...editing, active: e.target.checked })} className="accent-[#27F580]" /> Active and visible to clients</label><button disabled={busy} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#172033] px-4 py-3 font-semibold text-white hover:bg-[#111827] disabled:opacity-60">{busy && <Loader2 className="h-4 w-4 animate-spin" />} Save certification type</button></form></div>}
  </div>;
}

function Field({ label, children }) { return <label className="block"><span className="mb-1.5 block text-sm font-medium text-[#172033]">{label}</span>{children}</label>; }
