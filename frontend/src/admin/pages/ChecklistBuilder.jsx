import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  ClipboardList,
  Loader2,
  Plus,
  Save,
  Send,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { api, apiError } from "@/lib/api";
import { Btn, Field, TextInput } from "@/admin/components/ui";

const PROJECT_TYPES = ["Residential", "Commercial", "Hotel", "Hospital"];

const makeId = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
const prefixFor = (category) =>
  (category?.id || category?.name || "CAT")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 4)
    .toUpperCase() || "CAT";

function IconButton({ title, danger = false, children, ...props }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      className={`rounded-lg border p-2 transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${
        danger
          ? "border-red-200 text-[#EF4444] hover:bg-red-50"
          : "border-[#E4E7EC] text-[#667085] hover:border-[#27F580] hover:bg-[#E9FFF2] hover:text-[#172033]"
      }`}
      {...props}
    >
      {children}
    </button>
  );
}

export default function ChecklistBuilder() {
  const [projectType, setProjectType] = useState("Residential");
  const [template, setTemplate] = useState(null);
  const [status, setStatus] = useState("not_configured");
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/admin/portal/checklists/${projectType}`);
      setTemplate(data.template);
      setStatus(data.status);
      setSelectedId(data.template?.categories?.[0]?.id || null);
    } catch (error) {
      toast.error(apiError(error.response?.data?.detail));
      setTemplate(null);
    } finally {
      setLoading(false);
    }
  }, [projectType]);

  useEffect(() => {
    load();
  }, [load]);

  const categories = useMemo(() => template?.categories || [], [template]);
  const selectedIndex = categories.findIndex((category) => category.id === selectedId);
  const selected = selectedIndex >= 0 ? categories[selectedIndex] : null;

  const configuredTotals = useMemo(
    () => ({
      owner: categories.reduce((sum, item) => sum + Number(item.max_points?.owner || 0), 0),
      tenant: categories.reduce((sum, item) => sum + Number(item.max_points?.tenant || 0), 0),
    }),
    [categories]
  );

  const changeTemplate = (patch) => setTemplate((current) => ({ ...current, ...patch }));

  const replaceCategories = (nextCategories) => {
    setTemplate((current) => ({ ...current, categories: nextCategories }));
  };

  const updateCategory = (patch) => {
    replaceCategories(
      categories.map((category) =>
        category.id === selectedId ? { ...category, ...patch } : category
      )
    );
  };

  const addCategory = () => {
    const id = makeId("category");
    const next = {
      id,
      name: "New Category",
      order: categories.length,
      max_points: { owner: 0, tenant: 0 },
      criteria: [],
    };
    replaceCategories([...categories, next]);
    setSelectedId(id);
  };

  const deleteCategory = () => {
    if (!selected || !window.confirm(`Delete “${selected.name}” and all its items?`)) return;
    const next = categories
      .filter((category) => category.id !== selected.id)
      .map((category, index) => ({ ...category, order: index }));
    replaceCategories(next);
    setSelectedId(next[0]?.id || null);
  };

  const moveCategory = (direction) => {
    const target = selectedIndex + direction;
    if (selectedIndex < 0 || target < 0 || target >= categories.length) return;
    const next = [...categories];
    [next[selectedIndex], next[target]] = [next[target], next[selectedIndex]];
    replaceCategories(next.map((category, index) => ({ ...category, order: index })));
  };

  const addCriterion = (mandatory) => {
    if (!selected) return;
    const matching = (selected.criteria || []).filter((item) => !!item.mandatory === mandatory);
    const prefix = prefixFor(selected);
    const criterion = {
      id: makeId(`${selected.id}-${mandatory ? "p" : "c"}`),
      code: `${prefix} ${mandatory ? "Mandatory" : "Credit"} ${matching.length + 1}`,
      name: mandatory ? "New Mandatory Requirement" : "New Optional Credit",
      description: "",
      mandatory,
      max_owner: 0,
      max_tenant: 0,
      evidence_required: true,
      active: true,
      order: (selected.criteria || []).length,
    };
    updateCategory({ criteria: [...(selected.criteria || []), criterion] });
  };

  const updateCriterion = (criterionId, patch) => {
    updateCategory({
      criteria: (selected.criteria || []).map((criterion) =>
        criterion.id === criterionId ? { ...criterion, ...patch } : criterion
      ),
    });
  };

  const deleteCriterion = (criterion) => {
    if (!window.confirm(`Delete “${criterion.name}”?`)) return;
    updateCategory({
      criteria: (selected.criteria || [])
        .filter((item) => item.id !== criterion.id)
        .map((item, index) => ({ ...item, order: index })),
    });
  };

  const moveCriterion = (criterionId, direction) => {
    const criteria = [...(selected.criteria || [])];
    const current = criteria.find((item) => item.id === criterionId);
    if (!current) return;
    const sameType = criteria.filter((item) => !!item.mandatory === !!current.mandatory);
    const groupIndex = sameType.findIndex((item) => item.id === criterionId);
    const targetGroupIndex = groupIndex + direction;
    if (targetGroupIndex < 0 || targetGroupIndex >= sameType.length) return;
    const index = criteria.findIndex((item) => item.id === criterionId);
    const target = criteria.findIndex((item) => item.id === sameType[targetGroupIndex].id);
    [criteria[index], criteria[target]] = [criteria[target], criteria[index]];
    updateCategory({ criteria: criteria.map((item, order) => ({ ...item, order })) });
  };

  const saveDraft = async ({ quiet = false } = {}) => {
    if (!template) return false;
    setSaving(true);
    try {
      const { data } = await api.put(`/admin/portal/checklists/${projectType}`, { template });
      setTemplate(data.template);
      setStatus("draft");
      if (!quiet) toast.success("Checklist draft saved");
      return true;
    } catch (error) {
      toast.error(apiError(error.response?.data?.detail));
      return false;
    } finally {
      setSaving(false);
    }
  };

  const publish = async () => {
    const saved = await saveDraft({ quiet: true });
    if (!saved) return;
    setSaving(true);
    try {
      const { data } = await api.post(`/admin/portal/checklists/${projectType}/publish`);
      setTemplate(data.template);
      setStatus("published");
      toast.success(data.message);
    } catch (error) {
      toast.error(apiError(error.response?.data?.detail));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-24"><Loader2 className="h-7 w-7 animate-spin text-[#27F580]" /></div>;
  }

  if (!template) return null;

  const mandatory = (selected?.criteria || []).filter((item) => item.mandatory);
  const optional = (selected?.criteria || []).filter((item) => !item.mandatory);

  return (
    <div className="space-y-6" data-testid="checklist-builder">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-[#667085]">
            <ClipboardList className="h-4 w-4 text-[#27F580]" /> Certification configuration
          </div>
          <h1 className="text-3xl font-semibold text-[#111827]">Checklist Builder</h1>
          <p className="mt-1 text-sm text-[#667085]">Configure client mandatory requirements and optional credits.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${status === "published" ? "bg-[#E9FFF2] text-[#172033]" : "bg-amber-50 text-amber-700"}`}>
            {status.replace(/_/g, " ")}
          </span>
          <Btn variant="outline" onClick={() => saveDraft()} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save draft
          </Btn>
          <button
            type="button"
            onClick={publish}
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#27F580] px-4 py-2.5 text-sm font-semibold text-[#172033] transition-colors hover:bg-[#20DB72] disabled:opacity-60"
          >
            <Send className="h-4 w-4" /> Publish
          </button>
        </div>
      </div>

      <section className="rounded-2xl border border-[#E4E7EC] bg-white p-5 shadow-sm">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Project type">
            <select
              value={projectType}
              onChange={(event) => setProjectType(event.target.value)}
              className="w-full rounded-lg border border-[#E4E7EC] bg-white px-3.5 py-2.5 text-sm text-[#172033] outline-none focus:ring-2 focus:ring-[#27F580]"
            >
              {PROJECT_TYPES.map((item) => <option key={item}>{item}</option>)}
            </select>
          </Field>
          <Field label="Template name">
            <TextInput value={template.name} onChange={(name) => changeTemplate({ name })} />
          </Field>
          <Field label="Owner total maximum">
            <TextInput type="number" min="0" value={template.total_max?.owner} onChange={(value) => changeTemplate({ total_max: { ...(template.total_max || {}), owner: Number(value || 0) } })} />
          </Field>
          <Field label="Tenant total maximum">
            <TextInput type="number" min="0" value={template.total_max?.tenant} onChange={(value) => changeTemplate({ total_max: { ...(template.total_max || {}), tenant: Number(value || 0) } })} />
          </Field>
        </div>
        <div className="mt-4 flex flex-wrap gap-3 text-xs text-[#667085]">
          <span>Configured category total: Owner <strong className="text-[#172033]">{configuredTotals.owner}</strong></span>
          <span>Tenant <strong className="text-[#172033]">{configuredTotals.tenant}</strong></span>
          <span>Version <strong className="text-[#172033]">{template.version || "1"}</strong></span>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="rounded-2xl border border-[#E4E7EC] bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-[#111827]">Categories</h2>
            <IconButton title="Add category" onClick={addCategory}><Plus className="h-4 w-4" /></IconButton>
          </div>
          <div className="space-y-2">
            {categories.map((category, index) => (
              <button
                key={category.id}
                type="button"
                onClick={() => setSelectedId(category.id)}
                className={`w-full rounded-xl border px-3 py-3 text-left transition-colors ${
                  category.id === selectedId
                    ? "border-[#27F580] bg-[#E9FFF2]"
                    : "border-[#E4E7EC] bg-white hover:border-[#27F580]"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-[#172033]">{index + 1}. {category.name}</span>
                  <span className="text-xs text-[#667085]">{category.max_points?.owner || 0} pts</span>
                </div>
                <div className="mt-1 text-xs text-[#667085]">{category.criteria?.length || 0} checklist items</div>
              </button>
            ))}
            {!categories.length && <div className="rounded-xl border border-dashed border-[#E4E7EC] p-6 text-center text-sm text-[#667085]">Add the first category.</div>}
          </div>
        </aside>

        <main className="min-w-0 space-y-5">
          {!selected ? (
            <div className="rounded-2xl border border-dashed border-[#E4E7EC] bg-white p-16 text-center text-[#667085]">Select or add a category.</div>
          ) : (
            <>
              <section className="rounded-2xl border border-[#E4E7EC] bg-white p-5 shadow-sm">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold text-[#111827]">Category settings</h2>
                  <div className="flex gap-2">
                    <IconButton title="Move category up" onClick={() => moveCategory(-1)} disabled={selectedIndex === 0}><ArrowUp className="h-4 w-4" /></IconButton>
                    <IconButton title="Move category down" onClick={() => moveCategory(1)} disabled={selectedIndex === categories.length - 1}><ArrowDown className="h-4 w-4" /></IconButton>
                    <IconButton title="Delete category" danger onClick={deleteCategory}><Trash2 className="h-4 w-4" /></IconButton>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <Field label="Category name"><TextInput value={selected.name} onChange={(name) => updateCategory({ name })} /></Field>
                  <Field label="Owner maximum points"><TextInput type="number" min="0" value={selected.max_points?.owner} onChange={(value) => updateCategory({ max_points: { ...(selected.max_points || {}), owner: Number(value || 0) } })} /></Field>
                  <Field label="Tenant maximum points"><TextInput type="number" min="0" value={selected.max_points?.tenant} onChange={(value) => updateCategory({ max_points: { ...(selected.max_points || {}), tenant: Number(value || 0) } })} /></Field>
                </div>
              </section>

              <CriteriaSection
                title="Mandatory Requirements"
                items={mandatory}
                mandatory
                onAdd={() => addCriterion(true)}
                onChange={updateCriterion}
                onDelete={deleteCriterion}
                onMove={moveCriterion}
              />

              <CriteriaSection
                title="Optional Credits"
                items={optional}
                onAdd={() => addCriterion(false)}
                onChange={updateCriterion}
                onDelete={deleteCriterion}
                onMove={moveCriterion}
              />
            </>
          )}
        </main>
      </div>
    </div>
  );
}

function CriteriaSection({ title, items, mandatory = false, onAdd, onChange, onDelete, onMove }) {
  return (
    <section className="rounded-2xl border border-[#E4E7EC] bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold uppercase tracking-wide text-[#667085]">{title}</h2>
          <p className="mt-1 text-xs text-[#667085]">{mandatory ? "Prerequisites carry no points." : "Evidence automatically claims the configured points."}</p>
        </div>
        <button type="button" onClick={onAdd} className="inline-flex items-center gap-1.5 rounded-lg border border-[#27F580] px-3 py-2 text-xs font-semibold text-[#172033] hover:bg-[#E9FFF2]">
          <Plus className="h-4 w-4" /> Add {mandatory ? "requirement" : "credit"}
        </button>
      </div>

      <div className="space-y-3">
        {items.map((item, index) => (
          <article key={item.id} className="rounded-xl border border-[#E4E7EC] bg-[#F6F8FA] p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {mandatory && <CheckCircle2 className="h-4 w-4 text-[#27F580]" />}
                <span className="text-sm font-semibold text-[#172033]">{item.name || `${title} item`}</span>
                {!mandatory && <span className="rounded-full border border-[#E4E7EC] bg-white px-2.5 py-1 text-xs font-semibold text-[#172033]">{item.max_owner || 0} points</span>}
              </div>
              <div className="flex gap-1.5">
                <IconButton title="Move up" onClick={() => onMove(item.id, -1)} disabled={index === 0}><ArrowUp className="h-3.5 w-3.5" /></IconButton>
                <IconButton title="Move down" onClick={() => onMove(item.id, 1)} disabled={index === items.length - 1}><ArrowDown className="h-3.5 w-3.5" /></IconButton>
                <IconButton title="Delete" danger onClick={() => onDelete(item)}><Trash2 className="h-3.5 w-3.5" /></IconButton>
              </div>
            </div>
            <div className={`grid grid-cols-1 gap-3 ${mandatory ? "md:grid-cols-2" : "md:grid-cols-4"}`}>
              <Field label="Name"><TextInput value={item.name} onChange={(name) => onChange(item.id, { name })} /></Field>
              <Field label="Code"><TextInput value={item.code} onChange={(code) => onChange(item.id, { code })} /></Field>
              {!mandatory && <Field label="Owner points"><TextInput type="number" min="0" value={item.max_owner} onChange={(value) => onChange(item.id, { max_owner: Number(value || 0) })} /></Field>}
              {!mandatory && <Field label="Tenant points"><TextInput type="number" min="0" value={item.max_tenant} onChange={(value) => onChange(item.id, { max_tenant: Number(value || 0) })} /></Field>}
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto] md:items-end">
              <Field label="Description / client guidance"><TextInput value={item.description} onChange={(description) => onChange(item.id, { description })} /></Field>
              <label className="flex items-center gap-2 rounded-lg border border-[#E4E7EC] bg-white px-3 py-2.5 text-sm text-[#172033]">
                <input type="checkbox" checked={item.evidence_required !== false} onChange={(event) => onChange(item.id, { evidence_required: event.target.checked })} className="h-4 w-4 accent-[#27F580]" /> Evidence required
              </label>
            </div>
          </article>
        ))}
        {!items.length && <div className="rounded-xl border border-dashed border-[#E4E7EC] p-8 text-center text-sm text-[#667085]">No {title.toLowerCase()} added.</div>}
      </div>
    </section>
  );
}