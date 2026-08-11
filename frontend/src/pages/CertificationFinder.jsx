import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Compass, ArrowRight, CheckCircle2, Info } from "lucide-react";
import { toast } from "sonner";
import { publicApi, apiError } from "@/lib/api";
import { Seo } from "@/components/site/Seo";
import { Reveal } from "@/components/site/Reveal";
import { Overline, CertBadge } from "@/components/site/Bits";

const BUILDING_TYPES = ["Corporate Offices", "Data Centres", "Hotels & Hospitality", "Real Estate Developers", "Manufacturing & Industrial", "Educational Institutions", "Healthcare Buildings"];
const PRIORITIES = ["Energy Efficiency", "Water Efficiency", "Waste Management", "Indoor Air Quality", "Health & Wellness", "Global Recognition", "Cost Effectiveness", "Smart Building"];
const OUTCOMES = ["Not sure yet", "LEED", "IGBC", "GRIHA", "EDGE", "WELL", "TRUE", "WiredScore"];

export default function CertificationFinder() {
  const [f, setF] = useState({ building_type: "", location: "", construction_type: "New Construction", project_stage: "", floor_area: "", priorities: [], desired_outcome: "", timeline: "", budget_range: "", name: "", email: "", phone: "", company: "" });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const togglePriority = (p) => set("priorities", f.priorities.includes(p) ? f.priorities.filter((x) => x !== p) : [...f.priorities, p]);

  const submit = async (e) => {
    e.preventDefault();
    if (!f.name || !f.email) { toast.error("Please provide your name and email."); return; }
    setLoading(true);
    try { const { data } = await publicApi.post("/certification-finder", f); setResult(data); window.scrollTo({ top: 0, behavior: "smooth" }); }
    catch (err) { toast.error(apiError(err.response?.data?.detail)); }
    finally { setLoading(false); }
  };

  return (
    <div data-testid="finder-page">
      <Seo title="Green Building Certification Finder" description="Find which green building certification frameworks may suit your project." path="/certification-finder" />
      <section className="pt-36 pb-16 bg-deep-forest-green text-off-white">
        <div className="max-w-[1400px] mx-auto px-6 md:px-12">
          <Reveal>
            <span className="h-14 w-14 rounded-full bg-off-white/15 flex items-center justify-center mb-6"><Compass className="h-7 w-7" /></span>
            <Overline className="text-light-mint">Certification Finder</Overline>
            <h1 className="mt-5 text-5xl md:text-7xl font-serif max-w-4xl leading-[1.05]">Find your certification pathway</h1>
            <p className="mt-6 text-light-mint/85 text-lg max-w-2xl">Answer a few questions and we'll suggest frameworks that may suit your project.</p>
          </Reveal>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-4xl mx-auto px-6 md:px-12">
          {result ? (
            <div data-testid="finder-result">
              <div className="bg-light-mint/40 border border-natural-green/20 rounded-lg p-4 flex gap-3 items-start mb-8">
                <Info className="h-5 w-5 text-natural-green mt-0.5 shrink-0" />
                <p className="text-sm text-charcoal/80">{result.disclaimer}</p>
              </div>
              <h2 className="text-3xl font-serif text-deep-forest-green mb-6">Suggested frameworks</h2>
              <div className="space-y-4">
                {result.suggestions.map((s, i) => (
                  <div key={i} className="bg-white border border-black/5 rounded-lg p-6">
                    <CertBadge>{s.framework}</CertBadge>
                    <p className="mt-3 text-charcoal/80">{s.why}</p>
                    {s.reasons?.length > 0 && (
                      <ul className="mt-3 space-y-1.5">
                        {s.reasons.map((r, j) => <li key={j} className="flex items-start gap-2 text-sm text-charcoal/70"><CheckCircle2 className="h-4 w-4 text-natural-green mt-0.5 shrink-0" />{r}</li>)}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-8 bg-warm-beige rounded-lg p-6">
                <h3 className="font-serif text-xl text-deep-forest-green mb-3">Recommended next steps</h3>
                <ol className="list-decimal pl-5 space-y-1.5 text-charcoal/80">{result.next_steps.map((n, i) => <li key={i}>{n}</li>)}</ol>
              </div>
              <div className="mt-8 flex flex-wrap gap-4">
                <Link to="/book" data-testid="finder-discuss-cta" className="inline-flex items-center gap-2 rounded-full bg-deep-forest-green text-off-white px-7 py-3.5 font-medium hover:bg-natural-green transition-colors">Discuss This Recommendation <ArrowRight className="h-4 w-4" /></Link>
                <button onClick={() => setResult(null)} className="rounded-full border-2 border-deep-forest-green text-deep-forest-green px-7 py-3.5 font-medium hover:bg-deep-forest-green hover:text-off-white transition-colors">Start over</button>
              </div>
            </div>
          ) : (
            <form onSubmit={submit} className="bg-white border border-black/5 rounded-lg p-8 md:p-10 grid sm:grid-cols-2 gap-5">
              <L label="Building / project type"><select data-testid="finder-building-type" className="inp" value={f.building_type} onChange={(e) => set("building_type", e.target.value)}><option value="">Select</option>{BUILDING_TYPES.map((b) => <option key={b}>{b}</option>)}</select></L>
              <L label="Project location"><input className="inp" value={f.location} onChange={(e) => set("location", e.target.value)} /></L>
              <L label="Construction type"><select className="inp" value={f.construction_type} onChange={(e) => set("construction_type", e.target.value)}><option>New Construction</option><option>Existing Building</option><option>Interiors</option></select></L>
              <L label="Current project stage"><select className="inp" value={f.project_stage} onChange={(e) => set("project_stage", e.target.value)}><option value="">Select</option><option>Concept</option><option>Design</option><option>Construction</option><option>Operational</option></select></L>
              <L label="Approx. floor area (sq.ft)"><input className="inp" value={f.floor_area} onChange={(e) => set("floor_area", e.target.value)} /></L>
              <L label="Desired outcome"><select className="inp" value={f.desired_outcome} onChange={(e) => set("desired_outcome", e.target.value)}><option value="">Select</option>{OUTCOMES.map((o) => <option key={o}>{o}</option>)}</select></L>
              <L label="Timeline"><select className="inp" value={f.timeline} onChange={(e) => set("timeline", e.target.value)}><option value="">Select</option><option>0-3 months</option><option>3-6 months</option><option>6-12 months</option><option>12+ months</option></select></L>
              <L label="Budget range"><select className="inp" value={f.budget_range} onChange={(e) => set("budget_range", e.target.value)}><option value="">Select</option><option>Under ₹5L</option><option>₹5L - ₹15L</option><option>₹15L - ₹50L</option><option>₹50L+</option></select></L>
              <L label="Primary sustainability priorities" full>
                <div className="flex flex-wrap gap-2">
                  {PRIORITIES.map((p) => (
                    <button type="button" key={p} onClick={() => togglePriority(p)} className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${f.priorities.includes(p) ? "bg-deep-forest-green text-off-white border-deep-forest-green" : "bg-white text-charcoal/70 border-border"}`}>{p}</button>
                  ))}
                </div>
              </L>
              <div className="sm:col-span-2 border-t border-border pt-5 grid sm:grid-cols-2 gap-5">
                <L label="Name *"><input data-testid="finder-name" className="inp" value={f.name} onChange={(e) => set("name", e.target.value)} /></L>
                <L label="Email *"><input data-testid="finder-email" className="inp" value={f.email} onChange={(e) => set("email", e.target.value)} /></L>
                <L label="Phone"><input className="inp" value={f.phone} onChange={(e) => set("phone", e.target.value)} /></L>
                <L label="Company"><input className="inp" value={f.company} onChange={(e) => set("company", e.target.value)} /></L>
              </div>
              <div className="sm:col-span-2">
                <button type="submit" data-testid="finder-submit" disabled={loading} className="inline-flex items-center gap-2 rounded-full bg-deep-forest-green text-off-white px-8 py-3.5 font-medium hover:bg-natural-green transition-colors disabled:opacity-60">{loading ? "Analysing..." : <>Get my recommendation <ArrowRight className="h-4 w-4" /></>}</button>
              </div>
            </form>
          )}
        </div>
      </section>
      <style>{`.inp{width:100%;background:#fff;border:1px solid hsl(var(--border));border-radius:0.5rem;padding:0.7rem 1rem;font-size:0.95rem;outline:none}.inp:focus{box-shadow:0 0 0 2px #27F580;border-color:#27F580}`}</style>
    </div>
  );
}

function L({ label, children, full }) {
  return <div className={full ? "sm:col-span-2" : ""}><label className="block text-sm font-medium text-charcoal/80 mb-1.5">{label}</label>{children}</div>;
}
