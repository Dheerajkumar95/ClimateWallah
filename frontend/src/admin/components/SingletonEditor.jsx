import React, { useEffect, useState } from "react";
import { api, apiError } from "@/lib/api";
import { toast } from "sonner";
import { Btn, Field, TextInput, TextArea, ImagePicker, TagsEditor, Loader } from "./ui";

function Renderer({ field, value, onChange }) {
  const { type, label, help, rows } = field;
  if (type === "textarea") return <Field label={label} help={help}><TextArea value={value} onChange={onChange} rows={rows || 4} /></Field>;
  if (type === "html") return <Field label={label} help={help || "HTML supported."}><TextArea value={value} onChange={onChange} rows={rows || 10} /></Field>;
  if (type === "image") return <ImagePicker label={label} value={value} onChange={onChange} />;
  if (type === "tags") return <TagsEditor label={label} value={value} onChange={onChange} placeholder={field.placeholder} />;
  return <Field label={label} help={help}><TextInput value={value} onChange={onChange} /></Field>;
}

export function SingletonEditor({ title, subtitle, coll, fields, testid }) {
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { api.get(`/admin/${coll}`).then((r) => setForm(r.data || {})).catch(() => setForm({})); }, [coll]);

  const save = async () => {
    setSaving(true);
    try { const { data } = await api.put(`/admin/${coll}`, form); setForm(data); toast.success("Saved"); }
    catch (e) { toast.error(apiError(e.response?.data?.detail)); }
    finally { setSaving(false); }
  };

  if (!form) return <Loader />;

  return (
    <div data-testid={testid}>
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-serif text-deep-forest-green">{title}</h1>
          {subtitle && <p className="text-charcoal/60 mt-1">{subtitle}</p>}
        </div>
        <Btn onClick={save} disabled={saving} data-testid={`save-${coll}`}>{saving ? "Saving..." : "Save changes"}</Btn>
      </div>
      <div className="mt-6 bg-white border border-border rounded-xl p-6 md:p-8 max-w-3xl grid sm:grid-cols-2 gap-5">
        {fields.map((f) => (
          <div key={f.name} className={f.full ? "sm:col-span-2" : ""}>
            <Renderer field={f} value={form[f.name]} onChange={(v) => setForm((s) => ({ ...s, [f.name]: v }))} />
          </div>
        ))}
      </div>
    </div>
  );
}
