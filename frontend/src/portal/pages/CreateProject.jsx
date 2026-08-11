import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Check, ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { apiError } from "../PortalAuthContext";
import { PageHeader, Card, inpCls } from "./ui";
import { GeoLocationField } from "../components/GeoLocationField";

const STEPS = ["Details", "Building Info", "Location", "Privacy", "Media", "Team"];
const PROJECT_TYPES = ["Commercial", "Residential", "Hotel", "Hospital"];
const CONFIGURED = ["Commercial", "Residential"];
const AREA_UNITS = ["sq.m", "sq.ft"];

export default function CreateProject() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "", project_type: "Commercial", occupancy_type: "owner",
    building_info: {
      space_title: "", occupancy_category: "", built_up_area: "", built_up_unit: "sq.m",
      target_area: "", target_unit: "sq.m", site_area: "", num_floors: "", num_buildings: "1",
      permanent_occupancy: "", visitor_occupancy: "", construction_type: "New",
      part_of_larger: false, parent_development: "", start_date: "", completion_date: "",
      description: "",
    },
    location: { address1: "", address2: "", city: "", state: "", country: "India", pincode: "", geo: null },
    privacy: { confidential: false, owner_developer: "", organization: "", architect: "", main_contact: "" },
    settings: { target_rating: "Gold" },
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
      const { data } = await api.post("/client/projects", form);
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
            <div className="sm:col-span-2"><label className="block text-sm font-medium text-charcoal/80 mb-1.5">Building / space title</label><input className={inpCls} value={form.building_info.space_title} onChange={(e) => set("building_info.space_title", e.target.value)} data-testid="cp-space-title" /></div>
            <div><label className="block text-sm font-medium text-charcoal/80 mb-1.5">Occupancy category</label><input className={inpCls} value={form.building_info.occupancy_category} onChange={(e) => set("building_info.occupancy_category", e.target.value)} placeholder="e.g. Office, Retail" /></div>
            <div><label className="block text-sm font-medium text-charcoal/80 mb-1.5">Construction type</label>
              <select className={inpCls} value={form.building_info.construction_type} onChange={(e) => set("building_info.construction_type", e.target.value)}>
                {["New", "Existing", "Major Renovation"].map((t) => <option key={t}>{t}</option>)}
              </select></div>
            <div className="grid grid-cols-[1fr_90px] gap-2"><div><label className="block text-sm font-medium text-charcoal/80 mb-1.5">Gross built-up area</label><input type="number" className={inpCls} value={form.building_info.built_up_area} onChange={(e) => set("building_info.built_up_area", e.target.value)} data-testid="cp-area" /></div><div><label className="block text-sm font-medium text-charcoal/80 mb-1.5">Unit</label><select className={inpCls} value={form.building_info.built_up_unit} onChange={(e) => set("building_info.built_up_unit", e.target.value)}>{AREA_UNITS.map((u) => <option key={u}>{u}</option>)}</select></div></div>
            <div className="grid grid-cols-[1fr_90px] gap-2"><div><label className="block text-sm font-medium text-charcoal/80 mb-1.5">Target certification area</label><input type="number" className={inpCls} value={form.building_info.target_area} onChange={(e) => set("building_info.target_area", e.target.value)} /></div><div><label className="block text-sm font-medium text-charcoal/80 mb-1.5">Unit</label><select className={inpCls} value={form.building_info.target_unit} onChange={(e) => set("building_info.target_unit", e.target.value)}>{AREA_UNITS.map((u) => <option key={u}>{u}</option>)}</select></div></div>
            <div><label className="block text-sm font-medium text-charcoal/80 mb-1.5">Site area (sq.m)</label><input type="number" className={inpCls} value={form.building_info.site_area} onChange={(e) => set("building_info.site_area", e.target.value)} /></div>
            <div><label className="block text-sm font-medium text-charcoal/80 mb-1.5">Number of buildings</label><input type="number" className={inpCls} value={form.building_info.num_buildings} onChange={(e) => set("building_info.num_buildings", e.target.value)} /></div>
            <div><label className="block text-sm font-medium text-charcoal/80 mb-1.5">Number of floors</label><input type="number" className={inpCls} value={form.building_info.num_floors} onChange={(e) => set("building_info.num_floors", e.target.value)} data-testid="cp-floors" /></div>
            <div><label className="block text-sm font-medium text-charcoal/80 mb-1.5">Permanent occupancy</label><input type="number" className={inpCls} value={form.building_info.permanent_occupancy} onChange={(e) => set("building_info.permanent_occupancy", e.target.value)} /></div>
            <div><label className="block text-sm font-medium text-charcoal/80 mb-1.5">Visitor / transient occupancy</label><input type="number" className={inpCls} value={form.building_info.visitor_occupancy} onChange={(e) => set("building_info.visitor_occupancy", e.target.value)} /></div>
            <div><label className="block text-sm font-medium text-charcoal/80 mb-1.5">Start date</label><input type="date" className={inpCls} value={form.building_info.start_date} onChange={(e) => set("building_info.start_date", e.target.value)} /></div>
            <div><label className="block text-sm font-medium text-charcoal/80 mb-1.5">Expected completion</label><input type="date" className={inpCls} value={form.building_info.completion_date} onChange={(e) => set("building_info.completion_date", e.target.value)} /></div>
            <label className="sm:col-span-2 flex items-center gap-2 text-sm text-charcoal/80"><input type="checkbox" className="h-4 w-4 accent-natural-green" checked={form.building_info.part_of_larger} onChange={(e) => set("building_info.part_of_larger", e.target.checked)} /> Part of a larger development?</label>
            {form.building_info.part_of_larger && <div className="sm:col-span-2"><input className={inpCls} placeholder="Parent development name" value={form.building_info.parent_development} onChange={(e) => set("building_info.parent_development", e.target.value)} /></div>}
            <div className="sm:col-span-2"><label className="block text-sm font-medium text-charcoal/80 mb-1.5">Project description</label><textarea rows={3} className={inpCls + " resize-y"} value={form.building_info.description} onChange={(e) => set("building_info.description", e.target.value)} /></div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2"><label className="block text-sm font-medium text-charcoal/80 mb-1.5">Address line 1</label><input className={inpCls} value={form.location.address1} onChange={(e) => set("location.address1", e.target.value)} data-testid="cp-address" /></div>
              <div className="sm:col-span-2"><label className="block text-sm font-medium text-charcoal/80 mb-1.5">Address line 2</label><input className={inpCls} value={form.location.address2} onChange={(e) => set("location.address2", e.target.value)} /></div>
              <div><label className="block text-sm font-medium text-charcoal/80 mb-1.5">City</label><input className={inpCls} value={form.location.city} onChange={(e) => set("location.city", e.target.value)} data-testid="cp-city" /></div>
              <div><label className="block text-sm font-medium text-charcoal/80 mb-1.5">State</label><input className={inpCls} value={form.location.state} onChange={(e) => set("location.state", e.target.value)} /></div>
              <div><label className="block text-sm font-medium text-charcoal/80 mb-1.5">Country / region</label><input className={inpCls} value={form.location.country} onChange={(e) => set("location.country", e.target.value)} /></div>
              <div><label className="block text-sm font-medium text-charcoal/80 mb-1.5">Postal code</label><input className={inpCls} value={form.location.pincode} onChange={(e) => set("location.pincode", e.target.value)} /></div>
            </div>
            <div>
              <label className="block text-sm font-medium text-charcoal/80 mb-2">Geo location <span className="text-xs text-charcoal/45">(kept private)</span></label>
              <GeoLocationField value={form.location.geo} onChange={(g) => set("location.geo", g)}
                onResolveAddress={(a) => setForm((f) => ({ ...f, location: { ...f.location, city: a.city || f.location.city, state: a.state || f.location.state, country: a.country || f.location.country, pincode: a.pincode || f.location.pincode } }))} />
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="sm:col-span-2 flex items-center gap-2 text-sm text-charcoal/80"><input type="checkbox" className="h-4 w-4 accent-natural-green" checked={form.privacy.confidential} onChange={(e) => set("privacy.confidential", e.target.checked)} data-testid="cp-confidential" /> Keep project-data submissions confidential</label>
            <div><label className="block text-sm font-medium text-charcoal/80 mb-1.5">Project owner / developer</label><input className={inpCls} value={form.privacy.owner_developer} onChange={(e) => set("privacy.owner_developer", e.target.value)} /></div>
            <div><label className="block text-sm font-medium text-charcoal/80 mb-1.5">Organisation</label><input className={inpCls} value={form.privacy.organization} onChange={(e) => set("privacy.organization", e.target.value)} /></div>
            <div><label className="block text-sm font-medium text-charcoal/80 mb-1.5">Architect / consultant</label><input className={inpCls} value={form.privacy.architect} onChange={(e) => set("privacy.architect", e.target.value)} /></div>
            <div><label className="block text-sm font-medium text-charcoal/80 mb-1.5">Main project contact</label><input className={inpCls} value={form.privacy.main_contact} onChange={(e) => set("privacy.main_contact", e.target.value)} /></div>
            <div className="sm:col-span-2"><label className="block text-sm font-medium text-charcoal/80 mb-1.5">Target rating</label>
              <select className={inpCls} value={form.settings.target_rating} onChange={(e) => set("settings.target_rating", e.target.value)}>{["Certified", "Silver", "Gold", "Platinum"].map((r) => <option key={r}>{r}</option>)}</select></div>
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
