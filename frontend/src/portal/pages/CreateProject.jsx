import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Check, ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { apiError } from "../PortalAuthContext";
import { PageHeader, Card, inpCls } from "./ui";

const STEPS = ["Details", "Building Info", "Location", "Settings", "Media", "Team"];
const PROJECT_TYPES = ["Commercial", "Residential", "Hotel", "Hospital"];
const CONFIGURED = ["Commercial"];

export default function CreateProject() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "", project_type: "Commercial", occupancy_type: "owner",
    building_info: { built_up_area: "", num_floors: "", year: "", description: "" },
    location: { address: "", city: "", state: "", country: "India", pincode: "" },
    settings: { target_rating: "Gold", notes: "" },
    team: [],
  });

  const set = (path, value) => {
    setForm((f) => {
      const next = { ...f };
      if (path.includes(".")) {
        const [a, b] = path.split(".");
        next[a] = { ...next[a], [b]: value };
      } else next[path] = value;
      return next;
    });
  };

  const addMember = () => set("team", [...form.team, { name: "", role: "", email: "" }]);
  const updMember = (i, k, v) => set("team", form.team.map((m, idx) => (idx === i ? { ...m, [k]: v } : m)));
  const rmMember = (i) => set("team", form.team.filter((_, idx) => idx !== i));

  const next = () => setStep((s) => Math.min(STEPS.length - 1, s + 1));
  const prev = () => setStep((s) => Math.max(0, s - 1));

  const submit = async () => {
    if (!form.name.trim()) { toast.error("Project name is required"); setStep(0); return; }
    setSaving(true);
    try {
      const payload = {
        ...form,
        building_info: {
          ...form.building_info,
          built_up_area: form.building_info.built_up_area ? Number(form.building_info.built_up_area) : null,
          num_floors: form.building_info.num_floors ? Number(form.building_info.num_floors) : null,
        },
      };
      const { data } = await api.post("/client/projects", payload);
      toast.success("Project created");
      navigate(`/portal/projects/${data.id}`);
    } catch (err) {
      toast.error(apiError(err.response?.data?.detail) || "Could not create project");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div data-testid="create-project">
      <PageHeader title="Create Certification Project" subtitle="Set up a new IGBC-style certification project." />

      {/* Stepper */}
      <div className="flex items-center gap-1 mb-6 overflow-x-auto pb-1">
        {STEPS.map((s, i) => (
          <React.Fragment key={s}>
            <button onClick={() => i <= step && setStep(i)} className="flex items-center gap-2 shrink-0" data-testid={`step-${i}`}>
              <span className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold ${i < step ? "bg-natural-green text-white" : i === step ? "bg-deep-forest-green text-white" : "bg-warm-beige text-charcoal/50"}`}>
                {i < step ? <Check className="h-4 w-4" /> : i + 1}
              </span>
              <span className={`text-sm ${i === step ? "text-charcoal font-medium" : "text-charcoal/50"}`}>{s}</span>
            </button>
            {i < STEPS.length - 1 && <span className="h-px w-6 bg-border shrink-0" />}
          </React.Fragment>
        ))}
      </div>

      <Card className="space-y-5">
        {step === 0 && (
          <>
            <div>
              <label className="block text-sm font-medium text-charcoal/80 mb-1.5">Project name *</label>
              <input className={inpCls} value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Green HQ Tower" data-testid="cp-name" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-charcoal/80 mb-1.5">Project type</label>
                <select className={inpCls} value={form.project_type} onChange={(e) => set("project_type", e.target.value)} data-testid="cp-type">
                  {PROJECT_TYPES.map((t) => <option key={t} value={t}>{t}{CONFIGURED.includes(t) ? "" : " (checklist under configuration)"}</option>)}
                </select>
                {!CONFIGURED.includes(form.project_type) && <p className="mt-1 text-xs text-amber-600">This type's checklist is under configuration — you can create the project but the wizard opens later.</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-charcoal/80 mb-1.5">Occupancy</label>
                <select className={inpCls} value={form.occupancy_type} onChange={(e) => set("occupancy_type", e.target.value)} data-testid="cp-occupancy">
                  <option value="owner">Owner-occupied</option>
                  <option value="tenant">Tenant-occupied</option>
                </select>
              </div>
            </div>
          </>
        )}

        {step === 1 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-charcoal/80 mb-1.5">Built-up area (sq.m)</label><input type="number" className={inpCls} value={form.building_info.built_up_area} onChange={(e) => set("building_info.built_up_area", e.target.value)} data-testid="cp-area" /></div>
            <div><label className="block text-sm font-medium text-charcoal/80 mb-1.5">Number of floors</label><input type="number" className={inpCls} value={form.building_info.num_floors} onChange={(e) => set("building_info.num_floors", e.target.value)} data-testid="cp-floors" /></div>
            <div><label className="block text-sm font-medium text-charcoal/80 mb-1.5">Year of construction</label><input className={inpCls} value={form.building_info.year} onChange={(e) => set("building_info.year", e.target.value)} /></div>
            <div className="sm:col-span-2"><label className="block text-sm font-medium text-charcoal/80 mb-1.5">Description</label><textarea rows={3} className={inpCls + " resize-y"} value={form.building_info.description} onChange={(e) => set("building_info.description", e.target.value)} /></div>
          </div>
        )}

        {step === 2 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2"><label className="block text-sm font-medium text-charcoal/80 mb-1.5">Address</label><input className={inpCls} value={form.location.address} onChange={(e) => set("location.address", e.target.value)} data-testid="cp-address" /></div>
            <div><label className="block text-sm font-medium text-charcoal/80 mb-1.5">City</label><input className={inpCls} value={form.location.city} onChange={(e) => set("location.city", e.target.value)} /></div>
            <div><label className="block text-sm font-medium text-charcoal/80 mb-1.5">State</label><input className={inpCls} value={form.location.state} onChange={(e) => set("location.state", e.target.value)} /></div>
            <div><label className="block text-sm font-medium text-charcoal/80 mb-1.5">Country</label><input className={inpCls} value={form.location.country} onChange={(e) => set("location.country", e.target.value)} /></div>
            <div><label className="block text-sm font-medium text-charcoal/80 mb-1.5">Pincode</label><input className={inpCls} value={form.location.pincode} onChange={(e) => set("location.pincode", e.target.value)} /></div>
          </div>
        )}

        {step === 3 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-charcoal/80 mb-1.5">Target rating</label>
              <select className={inpCls} value={form.settings.target_rating} onChange={(e) => set("settings.target_rating", e.target.value)}>
                {["Certified", "Silver", "Gold", "Platinum"].map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2"><label className="block text-sm font-medium text-charcoal/80 mb-1.5">Notes</label><textarea rows={3} className={inpCls + " resize-y"} value={form.settings.notes} onChange={(e) => set("settings.notes", e.target.value)} /></div>
          </div>
        )}

        {step === 4 && (
          <div className="text-center py-8">
            <p className="text-charcoal/60">Document & media uploads become available inside the project workspace once created.</p>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-charcoal/80">Project team</label>
              <button onClick={addMember} className="inline-flex items-center gap-1.5 text-sm text-natural-green hover:underline" data-testid="cp-add-member"><Plus className="h-4 w-4" /> Add member</button>
            </div>
            {form.team.length === 0 && <p className="text-sm text-charcoal/50">No team members added.</p>}
            {form.team.map((m, i) => (
              <div key={i} className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-center">
                <input className={inpCls} placeholder="Name" value={m.name} onChange={(e) => updMember(i, "name", e.target.value)} />
                <input className={inpCls} placeholder="Role" value={m.role} onChange={(e) => updMember(i, "role", e.target.value)} />
                <div className="flex gap-2">
                  <input className={inpCls} placeholder="Email" value={m.email} onChange={(e) => updMember(i, "email", e.target.value)} />
                  <button onClick={() => rmMember(i)} className="text-red-500 shrink-0 px-2"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-border">
          <button onClick={prev} disabled={step === 0} className="inline-flex items-center gap-1.5 text-sm text-charcoal/70 disabled:opacity-40"><ChevronLeft className="h-4 w-4" /> Back</button>
          {step < STEPS.length - 1 ? (
            <button onClick={next} data-testid="cp-next" className="inline-flex items-center gap-1.5 rounded-lg bg-deep-forest-green text-off-white px-4 py-2.5 text-sm font-medium hover:bg-natural-green transition-colors">Next <ChevronRight className="h-4 w-4" /></button>
          ) : (
            <button onClick={submit} disabled={saving} data-testid="cp-submit" className="inline-flex items-center gap-2 rounded-lg bg-deep-forest-green text-off-white px-5 py-2.5 text-sm font-medium hover:bg-natural-green transition-colors disabled:opacity-60">{saving && <Loader2 className="h-4 w-4 animate-spin" />} Create project</button>
          )}
        </div>
      </Card>
    </div>
  );
}
