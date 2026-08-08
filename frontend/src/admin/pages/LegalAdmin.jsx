import React, { useEffect, useState } from "react";
import { api, apiError } from "@/lib/api";
import { toast } from "sonner";
import { Btn, Field, TextInput, TextArea, Loader } from "@/admin/components/ui";

export default function LegalAdmin() {
  const [pages, setPages] = useState(null);
  const [active, setActive] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try { const { data } = await api.get("/admin/legal"); setPages(data); setActive((a) => a || data[0]); }
    catch { setPages([]); }
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    setSaving(true);
    try {
      await api.put(`/admin/legal/${active.slug}`, { title: active.title, content: active.content });
      toast.success("Saved");
      load();
    } catch (e) { toast.error(apiError(e.response?.data?.detail)); }
    finally { setSaving(false); }
  };

  if (!pages) return <Loader />;

  return (
    <div data-testid="admin-legal">
      <h1 className="text-3xl font-serif text-deep-forest-green">Legal Pages</h1>
      <p className="text-charcoal/60 mt-1">Edit Privacy Policy, Terms and Cookie Policy.</p>

      <div className="mt-6 flex flex-wrap gap-2">
        {pages.map((p) => (
          <button key={p.slug} onClick={() => setActive(p)} className={`px-4 py-2 rounded-full text-sm ${active?.slug === p.slug ? "bg-deep-forest-green text-off-white" : "bg-white border border-border text-charcoal/70"}`}>{p.title}</button>
        ))}
      </div>

      {active && (
        <div className="mt-6 bg-white border border-border rounded-xl p-6 md:p-8 max-w-3xl space-y-4">
          <Field label="Title"><TextInput value={active.title} onChange={(v) => setActive({ ...active, title: v })} /></Field>
          <Field label="Content (HTML supported)"><TextArea value={active.content} onChange={(v) => setActive({ ...active, content: v })} rows={14} /></Field>
          <div className="flex justify-end"><Btn onClick={save} disabled={saving} data-testid="save-legal">{saving ? "Saving..." : "Save page"}</Btn></div>
        </div>
      )}
    </div>
  );
}
