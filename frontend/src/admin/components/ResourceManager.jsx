import React, { useEffect, useState, useRef } from "react";
import { Plus, Pencil, Trash2, Search, Upload, Loader2 } from "lucide-react";
import { api, apiError } from "@/lib/api";
import { toast } from "sonner";
import { Btn, Field, TextInput, TextArea, Select, Toggle, Modal, ConfirmDialog, ImagePicker, TagsEditor, Loader, Empty } from "./ui";

function DocumentField({ label, value, onChange }) {
  const [up, setUp] = useState(false);
  const ref = useRef();
  const upload = async (file) => {
    if (!file) return;
    setUp(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await api.post("/admin/uploads/document", fd, { headers: { "Content-Type": "multipart/form-data" } });
      onChange(data.url);
      toast.success("Document uploaded");
    } catch (e) { toast.error(apiError(e.response?.data?.detail)); }
    finally { setUp(false); }
  };
  return (
    <Field label={label} help="Upload a PDF or DOCX, or paste a URL.">
      <div className="flex gap-2">
        <TextInput value={value} onChange={onChange} placeholder="Document URL" />
        <Btn variant="outline" type="button" onClick={() => ref.current?.click()} disabled={up}>{up ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}</Btn>
        <input ref={ref} type="file" accept=".pdf,.docx,.doc" className="hidden" onChange={(e) => upload(e.target.files[0])} />
      </div>
    </Field>
  );
}

function FieldRenderer({ field, value, onChange }) {
  const { type, label, help, options } = field;
  switch (type) {
    case "textarea":
      return <Field label={label} help={help}><TextArea value={value} onChange={onChange} rows={field.rows || 4} /></Field>;
    case "html":
      return <Field label={label} help={help || "HTML is supported."}><TextArea value={value} onChange={onChange} rows={field.rows || 8} /></Field>;
    case "number":
      return <Field label={label} help={help}><TextInput type="number" value={value} onChange={(v) => onChange(v === "" ? "" : Number(v))} /></Field>;
    case "image":
      return <ImagePicker label={label} value={value} onChange={onChange} />;
    case "document":
      return <DocumentField label={label} value={value} onChange={onChange} />;
    case "switch":
      return <div className="py-1"><Field label={label} help={help}><Toggle checked={!!value} onChange={onChange} /></Field></div>;
    case "select":
      return <Field label={label} help={help}><Select value={value} onChange={onChange} options={options} /></Field>;
    case "tags":
      return <TagsEditor label={label} value={value} onChange={onChange} placeholder={field.placeholder} />;
    default:
      return <Field label={label} help={help}><TextInput value={value} onChange={onChange} /></Field>;
  }
}

export function ResourceManager({ title, subtitle, coll, fields, columns, defaults, testid }) {
  const [items, setItems] = useState(null);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(null);

  const load = async () => {
    try { const { data } = await api.get(`/admin/${coll}`); setItems(data); }
    catch { setItems([]); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [coll]);

  const openNew = () => { setEditing(null); setForm({ ...defaults }); setModal(true); };
  const openEdit = (item) => { setEditing(item); setForm({ ...item }); setModal(true); };

  const save = async () => {
    setSaving(true);
    try {
      if (editing) await api.put(`/admin/${coll}/${editing.id}`, form);
      else await api.post(`/admin/${coll}`, form);
      toast.success(editing ? "Updated" : "Created");
      setModal(false);
      load();
    } catch (e) { toast.error(apiError(e.response?.data?.detail)); }
    finally { setSaving(false); }
  };

  const del = async () => {
    try { await api.delete(`/admin/${coll}/${confirm.id}`); toast.success("Deleted"); setConfirm(null); load(); }
    catch (e) { toast.error(apiError(e.response?.data?.detail)); }
  };

  const filtered = (items || []).filter((it) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return columns.some((c) => String(it[c.key] ?? "").toLowerCase().includes(q));
  });

  return (
    <div data-testid={testid}>
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-serif text-deep-forest-green">{title}</h1>
          {subtitle && <p className="text-charcoal/60 mt-1">{subtitle}</p>}
        </div>
        <Btn onClick={openNew} data-testid={`add-${coll}`}><Plus className="h-4 w-4" /> Add</Btn>
      </div>

      <div className="mt-6 relative max-w-sm">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-charcoal/40" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." className="w-full bg-white border border-border rounded-lg pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-natural-green" />
      </div>

      <div className="mt-6 bg-white border border-border rounded-xl overflow-hidden">
        {items === null ? <Loader /> : filtered.length === 0 ? (
          <Empty message="No records yet." action={<Btn onClick={openNew}><Plus className="h-4 w-4" /> Add the first one</Btn>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-warm-beige/60 text-charcoal/60 text-xs uppercase tracking-wider">
                <tr>
                  {columns.map((c) => <th key={c.key} className="text-left px-5 py-3 whitespace-nowrap">{c.label}</th>)}
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((it) => (
                  <tr key={it.id} className="border-t border-border hover:bg-warm-beige/30">
                    {columns.map((c) => (
                      <td key={c.key} className="px-5 py-3 max-w-xs truncate">
                        {c.render ? c.render(it) : String(it[c.key] ?? "—")}
                      </td>
                    ))}
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => openEdit(it)} data-testid={`edit-${it.id}`} className="p-2 rounded-lg hover:bg-warm-beige text-charcoal/70"><Pencil className="h-4 w-4" /></button>
                        <button onClick={() => setConfirm(it)} data-testid={`delete-${it.id}`} className="p-2 rounded-lg hover:bg-destructive/10 text-destructive"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? `Edit ${title}` : `Add ${title}`} wide>
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          {fields.map((f) => (
            <FieldRenderer key={f.name} field={f} value={form[f.name]} onChange={(v) => setForm((s) => ({ ...s, [f.name]: v }))} />
          ))}
        </div>
        <div className="mt-6 flex justify-end gap-3 border-t border-border pt-4">
          <Btn variant="outline" onClick={() => setModal(false)}>Cancel</Btn>
          <Btn onClick={save} disabled={saving} data-testid="save-resource">{saving ? "Saving..." : "Save"}</Btn>
        </div>
      </Modal>

      <ConfirmDialog open={!!confirm} onClose={() => setConfirm(null)} onConfirm={del} title="Delete record" message={`Are you sure you want to delete "${confirm?.title || confirm?.name || "this record"}"? This cannot be undone.`} />
    </div>
  );
}
