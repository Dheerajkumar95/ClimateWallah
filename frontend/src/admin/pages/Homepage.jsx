import React, { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { api, apiError } from "@/lib/api";
import { toast } from "sonner";
import { Btn, Field, TextInput, TextArea, ImagePicker, TagsEditor, Toggle, Loader } from "@/admin/components/ui";

const SECTIONS = [
  ["services", "Services"], ["mission", "Mission"], ["values", "Values"],
  ["featured_projects", "Featured Projects"], ["credentials", "Credentials"],
  ["why_choose", "Why Choose RES"], ["team", "Team"], ["blog", "Blog"], ["contact_cta", "Contact CTA"],
];

export default function Homepage() {
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { api.get("/admin/homepage").then((r) => setForm(r.data || {})).catch(() => setForm({})); }, []);
  const set = (k, v) => setForm((s) => ({ ...s, [k]: v }));

  const save = async () => {
    setSaving(true);
    try { const { data } = await api.put("/admin/homepage", form); setForm(data); toast.success("Homepage saved"); }
    catch (e) { toast.error(apiError(e.response?.data?.detail)); }
    finally { setSaving(false); }
  };

  if (!form) return <Loader />;

  const stats = form.stats || [];
  const why = form.why_choose || [];
  const sections = form.sections || {};

  const updList = (key, i, patch) => set(key, (form[key] || []).map((it, idx) => idx === i ? { ...it, ...patch } : it));
  const addTo = (key, obj) => set(key, [...(form[key] || []), obj]);
  const rm = (key, i) => set(key, (form[key] || []).filter((_, idx) => idx !== i));

  return (
    <div data-testid="admin-homepage">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div><h1 className="text-3xl font-serif text-deep-forest-green">Homepage</h1><p className="text-charcoal/60 mt-1">Control the public homepage content and sections.</p></div>
        <Btn onClick={save} disabled={saving} data-testid="save-homepage">{saving ? "Saving..." : "Save changes"}</Btn>
      </div>

      <div className="mt-6 grid gap-6 max-w-4xl">
        <Card title="Hero">
          <Field label="Hero title"><TextInput value={form.hero_title} onChange={(v) => set("hero_title", v)} /></Field>
          <Field label="Hero subtitle"><TextArea value={form.hero_subtitle} onChange={(v) => set("hero_subtitle", v)} /></Field>
          <ImagePicker label="Hero image" value={form.hero_image} onChange={(v) => set("hero_image", v)} />
          <Field label={`Hero image overlay darkness — ${form.hero_overlay_opacity ?? 70}%`} help="Drag to increase (darker, more readable text) or decrease (brighter image).">
            <div className="flex items-center gap-4">
              <span className="text-xs text-charcoal/50">Lighter</span>
              <input
                type="range" min="0" max="90" step="5"
                value={form.hero_overlay_opacity ?? 70}
                onChange={(e) => set("hero_overlay_opacity", Number(e.target.value))}
                data-testid="hero-overlay-slider"
                className="flex-1 accent-natural-green"
              />
              <span className="text-xs text-charcoal/50">Darker</span>
            </div>
          </Field>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Primary CTA text"><TextInput value={form.cta_primary_text} onChange={(v) => set("cta_primary_text", v)} /></Field>
            <Field label="Primary CTA link"><TextInput value={form.cta_primary_link} onChange={(v) => set("cta_primary_link", v)} /></Field>
            <Field label="Secondary CTA text"><TextInput value={form.cta_secondary_text} onChange={(v) => set("cta_secondary_text", v)} /></Field>
            <Field label="Secondary CTA link"><TextInput value={form.cta_secondary_link} onChange={(v) => set("cta_secondary_link", v)} /></Field>
          </div>
        </Card>

        <Card title="Introduction & Mission">
          <Field label="Intro heading"><TextInput value={form.intro_heading} onChange={(v) => set("intro_heading", v)} /></Field>
          <Field label="Intro text"><TextArea value={form.intro_text} onChange={(v) => set("intro_text", v)} rows={4} /></Field>
          <Field label="Mission"><TextArea value={form.mission} onChange={(v) => set("mission", v)} /></Field>
          <TagsEditor label="Values" value={form.values} onChange={(v) => set("values", v)} placeholder="Add a value" />
        </Card>

        <Card title="Statistics">
          {stats.map((s, i) => (
            <div key={i} className="flex gap-3 items-end">
              <div className="flex-1"><Field label="Value"><TextInput value={s.value} onChange={(v) => updList("stats", i, { value: v })} /></Field></div>
              <div className="flex-1"><Field label="Label"><TextInput value={s.label} onChange={(v) => updList("stats", i, { label: v })} /></Field></div>
              <Btn variant="ghost" onClick={() => rm("stats", i)}><Trash2 className="h-4 w-4" /></Btn>
            </div>
          ))}
          <Btn variant="outline" onClick={() => addTo("stats", { value: "", label: "" })}><Plus className="h-4 w-4" /> Add stat</Btn>
        </Card>

        <Card title="Why Choose RES">
          {why.map((w, i) => (
            <div key={i} className="border border-border rounded-lg p-4 space-y-3">
              <div className="flex justify-between items-center"><span className="text-sm font-medium text-charcoal/70">Item {i + 1}</span><Btn variant="ghost" onClick={() => rm("why_choose", i)}><Trash2 className="h-4 w-4" /></Btn></div>
              <Field label="Title"><TextInput value={w.title} onChange={(v) => updList("why_choose", i, { title: v })} /></Field>
              <Field label="Text"><TextArea value={w.text} onChange={(v) => updList("why_choose", i, { text: v })} rows={2} /></Field>
            </div>
          ))}
          <Btn variant="outline" onClick={() => addTo("why_choose", { title: "", text: "" })}><Plus className="h-4 w-4" /> Add item</Btn>
        </Card>

        <Card title="Contact CTA">
          <Field label="Heading"><TextInput value={form.contact_cta_heading} onChange={(v) => set("contact_cta_heading", v)} /></Field>
          <Field label="Text"><TextArea value={form.contact_cta_text} onChange={(v) => set("contact_cta_text", v)} /></Field>
        </Card>

        <Card title="Section Visibility">
          <div className="grid sm:grid-cols-2 gap-3">
            {SECTIONS.map(([key, label]) => (
              <div key={key} className="flex items-center justify-between bg-warm-beige/40 rounded-lg px-4 py-3">
                <span className="text-sm text-charcoal/80">{label}</span>
                <Toggle checked={sections[key] !== false} onChange={(v) => set("sections", { ...sections, [key]: v })} />
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function Card({ title, children }) {
  return (
    <div className="bg-white border border-border rounded-xl p-6 md:p-8 space-y-4">
      <h2 className="text-lg font-serif text-deep-forest-green">{title}</h2>
      {children}
    </div>
  );
}
