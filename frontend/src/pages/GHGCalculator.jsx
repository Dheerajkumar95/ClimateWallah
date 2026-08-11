import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import { Factory, Zap, Plane, ArrowRight, ArrowLeft, Leaf, RotateCcw, Info, Gauge } from "lucide-react";
import { toast } from "sonner";
import { API, apiError } from "@/lib/api";
import { Seo } from "@/components/site/Seo";
import { Reveal } from "@/components/site/Reveal";
import { Overline } from "@/components/site/Bits";

const SCOPE_ICON = { scope1: Factory, scope2: Zap, scope3: Plane };

export default function GHGCalculator() {
  const [scopes, setScopes] = useState([]);
  const [source, setSource] = useState("");
  const [entries, setEntries] = useState({});
  const [contact, setContact] = useState({ organization: "", name: "", email: "", reporting_period: "" });
  const [step, setStep] = useState(0);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    axios.get(`${API}/tools/ghg/factors`).then((r) => { setScopes(r.data.scopes); setSource(r.data.source); }).catch(() => {});
  }, []);

  const totalSteps = scopes.length;
  const current = scopes[step];

  const liveScopeTotal = (scope) => scope.activities.reduce((sum, a) => {
    const q = parseFloat(entries[a.id]); return sum + (q > 0 ? q * a.factor : 0);
  }, 0);

  const grandLive = useMemo(() => scopes.reduce((s, sc) => s + liveScopeTotal(sc), 0), [scopes, entries]);

  const setVal = (id, v) => setEntries((s) => ({ ...s, [id]: v }));

  const calculate = async () => {
    if (Object.values(entries).every((v) => !(parseFloat(v) > 0))) {
      toast.error("Enter at least one activity value to calculate."); return;
    }
    setLoading(true);
    try {
      const clean = {};
      Object.entries(entries).forEach(([k, v]) => { if (parseFloat(v) > 0) clean[k] = parseFloat(v); });
      const { data } = await axios.post(`${API}/tools/ghg/calculate`, { ...contact, entries: clean });
      setResult(data); window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) { toast.error(apiError(err.response?.data?.detail)); }
    finally { setLoading(false); }
  };

  const reset = () => { setResult(null); setEntries({}); setStep(0); };

  return (
    <div data-testid="ghg-page">
      <Seo title="GHG Emissions Calculator" description="Estimate your organisation's Scope 1, 2 and 3 greenhouse gas emissions." path="/tools/ghg-calculator" />
      <section className="pt-36 pb-16 bg-deep-forest-green text-off-white">
        <div className="max-w-[1400px] mx-auto px-6 md:px-12">
          <Reveal>
            <span className="h-14 w-14 rounded-full bg-natural-green/20 flex items-center justify-center mb-6"><Gauge className="h-7 w-7 text-natural-green" /></span>
            <Overline className="text-natural-green">Tools &amp; Calculators</Overline>
            <h1 className="mt-5 text-5xl md:text-7xl font-serif max-w-4xl leading-[1.05]">GHG Emissions Calculator</h1>
            <p className="mt-6 text-off-white/80 text-lg max-w-2xl">Estimate your Scope 1, 2 &amp; 3 emissions in minutes using DEFRA/BEIS conversion factors.</p>
          </Reveal>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-3xl mx-auto px-6 md:px-12">
          {result ? (
            <div data-testid="ghg-result">
              <div className="bg-deep-forest-green text-off-white rounded-2xl p-8 text-center">
                <div className="text-sm uppercase tracking-widest text-natural-green">Total footprint</div>
                <div className="text-6xl font-serif mt-2" data-testid="ghg-total">{result.total_t.toLocaleString()}<span className="text-2xl text-off-white/50"> tCO₂e</span></div>
                <div className="text-off-white/60 text-sm mt-1">{result.total_kg.toLocaleString()} kg CO₂e</div>
              </div>

              <div className="grid sm:grid-cols-3 gap-4 mt-6">
                {result.scopes.map((sc) => {
                  const Icon = SCOPE_ICON[sc.id] || Leaf;
                  const pct = result.total_kg ? Math.round((sc.total_kg / result.total_kg) * 100) : 0;
                  return (
                    <div key={sc.id} className="bg-white border border-border rounded-xl p-4" data-testid={`ghg-scope-${sc.id}`}>
                      <Icon className="h-5 w-5 text-natural-green" />
                      <div className="text-xs text-charcoal/60 mt-2">{sc.name.split("—")[0].trim()}</div>
                      <div className="text-2xl font-semibold text-deep-forest-green">{sc.total_t.toLocaleString()}<span className="text-sm text-charcoal/40"> t</span></div>
                      <div className="h-1.5 rounded-full bg-warm-beige overflow-hidden mt-2"><div className="h-full bg-natural-green" style={{ width: `${pct}%` }} /></div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-8 space-y-6">
                {result.scopes.filter((s) => s.items.length).map((sc) => (
                  <div key={sc.id}>
                    <h3 className="font-serif text-xl text-deep-forest-green mb-2">{sc.name}</h3>
                    <div className="bg-white border border-border rounded-xl overflow-hidden">
                      {sc.items.map((it) => (
                        <div key={it.id} className="flex items-center justify-between px-4 py-2.5 border-b border-border last:border-0 text-sm">
                          <span className="text-charcoal/80">{it.name} <span className="text-charcoal/40">({it.quantity.toLocaleString()} {it.unit})</span></span>
                          <span className="font-medium text-deep-forest-green">{it.emissions_kg.toLocaleString()} kg</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-light-mint/40 border border-natural-green/20 rounded-lg p-4 flex gap-3 items-start mt-6">
                <Info className="h-5 w-5 text-natural-green mt-0.5 shrink-0" /><p className="text-sm text-charcoal/80">{result.source}</p>
              </div>

              <div className="mt-8 flex flex-wrap gap-4">
                <Link to="/book" data-testid="ghg-book-cta" className="inline-flex items-center gap-2 rounded-full bg-natural-green text-deep-forest-green px-7 py-3.5 font-semibold hover:bg-deep-forest-green hover:text-off-white transition-colors">Talk to our carbon team <ArrowRight className="h-4 w-4" /></Link>
                <button onClick={reset} data-testid="ghg-reset" className="inline-flex items-center gap-2 rounded-full border-2 border-deep-forest-green text-deep-forest-green px-7 py-3.5 font-medium hover:bg-deep-forest-green hover:text-off-white transition-colors"><RotateCcw className="h-4 w-4" /> Recalculate</button>
              </div>
            </div>
          ) : current ? (
            <div data-testid="ghg-wizard">
              {/* Stepper */}
              <div className="flex items-center gap-2 mb-8">
                {scopes.map((sc, i) => (
                  <React.Fragment key={sc.id}>
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold ${i < step ? "bg-natural-green text-deep-forest-green" : i === step ? "bg-deep-forest-green text-white" : "bg-warm-beige text-charcoal/50"}`}>{i + 1}</div>
                    {i < scopes.length - 1 && <div className={`flex-1 h-0.5 ${i < step ? "bg-natural-green" : "bg-warm-beige"}`} />}
                  </React.Fragment>
                ))}
              </div>

              <div className="bg-white border border-border rounded-2xl p-6 md:p-8">
                <h2 className="font-serif text-2xl text-deep-forest-green">{current.name}</h2>
                <p className="text-sm text-charcoal/60 mt-1 mb-6">{current.description}</p>

                {step === 0 && (
                  <div className="grid sm:grid-cols-2 gap-4 mb-6 pb-6 border-b border-border">
                    <div><label className="block text-xs font-medium text-charcoal/70 mb-1.5">Organisation (optional)</label><input data-testid="ghg-org" className="inp" value={contact.organization} onChange={(e) => setContact({ ...contact, organization: e.target.value })} /></div>
                    <div><label className="block text-xs font-medium text-charcoal/70 mb-1.5">Reporting period (optional)</label><input data-testid="ghg-period" className="inp" placeholder="e.g. FY2025-26" value={contact.reporting_period} onChange={(e) => setContact({ ...contact, reporting_period: e.target.value })} /></div>
                  </div>
                )}

                <div className="space-y-3">
                  {current.activities.map((a) => (
                    <div key={a.id} className="flex items-center gap-3">
                      <label className="flex-1 text-sm text-charcoal/80">{a.name}</label>
                      <div className="relative w-44">
                        <input type="number" min="0" step="any" data-testid={`ghg-input-${a.id}`} className="inp pr-16" value={entries[a.id] ?? ""} onChange={(e) => setVal(a.id, e.target.value)} placeholder="0" />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-charcoal/40">{a.unit}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 pt-4 border-t border-border flex items-center justify-between text-sm">
                  <span className="text-charcoal/60">This scope so far</span>
                  <span className="font-semibold text-deep-forest-green" data-testid={`ghg-live-${current.id}`}>{(liveScopeTotal(current) / 1000).toFixed(2)} tCO₂e</span>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <span className="text-sm text-charcoal/50">Running total: <b className="text-deep-forest-green">{(grandLive / 1000).toFixed(2)} tCO₂e</b></span>
                <div className="flex gap-3">
                  {step > 0 && <button onClick={() => setStep(step - 1)} data-testid="ghg-back" className="inline-flex items-center gap-1.5 rounded-full border-2 border-deep-forest-green text-deep-forest-green px-5 py-2.5 text-sm font-medium hover:bg-deep-forest-green hover:text-off-white transition-colors"><ArrowLeft className="h-4 w-4" /> Back</button>}
                  {step < totalSteps - 1 ? (
                    <button onClick={() => setStep(step + 1)} data-testid="ghg-next" className="inline-flex items-center gap-1.5 rounded-full bg-deep-forest-green text-off-white px-6 py-2.5 text-sm font-medium hover:bg-natural-green hover:text-deep-forest-green transition-colors">Next <ArrowRight className="h-4 w-4" /></button>
                  ) : (
                    <button onClick={calculate} disabled={loading} data-testid="ghg-calculate" className="inline-flex items-center gap-1.5 rounded-full bg-natural-green text-deep-forest-green px-6 py-2.5 text-sm font-semibold hover:bg-deep-forest-green hover:text-off-white transition-colors disabled:opacity-60">{loading ? "Calculating..." : <>Calculate footprint <ArrowRight className="h-4 w-4" /></>}</button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-20 text-charcoal/50">Loading calculator…</div>
          )}
        </div>
      </section>
      <style>{`.inp{width:100%;background:#fff;border:1px solid hsl(var(--border));border-radius:0.5rem;padding:0.6rem 0.9rem;font-size:0.95rem;outline:none}.inp:focus{box-shadow:0 0 0 2px #27F580;border-color:#27F580}`}</style>
    </div>
  );
}
