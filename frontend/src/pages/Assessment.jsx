import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Gauge, ArrowRight, CheckCircle2, AlertTriangle, Info } from "lucide-react";
import { toast } from "sonner";
import { publicApi, apiError } from "@/lib/api";
import { Seo } from "@/components/site/Seo";
import { Reveal } from "@/components/site/Reveal";
import { Overline, CertBadge } from "@/components/site/Bits";

const bandColor = { "Getting Started": "text-amber-600", "Developing": "text-yellow-600", "Ready": "text-natural-green", "Leading": "text-deep-forest-green" };

export default function Assessment() {
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [contact, setContact] = useState({ name: "", email: "", phone: "", company: "" });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { publicApi.get("/assessment-questions").then((r) => setQuestions(r.data)).catch(() => {}); }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (!contact.name || !contact.email) { toast.error("Please provide your name and email."); return; }
    if (Object.keys(answers).length < questions.length) { toast.error("Please answer all questions."); return; }
    setLoading(true);
    try { const { data } = await publicApi.post("/assessment", { ...contact, answers }); setResult(data); window.scrollTo({ top: 0, behavior: "smooth" }); }
    catch (err) { toast.error(apiError(err.response?.data?.detail)); }
    finally { setLoading(false); }
  };

  return (
    <div data-testid="assessment-page">
      <Seo title="Sustainability Readiness Assessment" description="Gauge your organisation's sustainability readiness in minutes." path="/assessment" />
      <section className="pt-36 pb-16 bg-deep-forest-green text-off-white">
        <div className="max-w-[1400px] mx-auto px-6 md:px-12">
          <Reveal>
            <span className="h-14 w-14 rounded-full bg-off-white/15 flex items-center justify-center mb-6"><Gauge className="h-7 w-7" /></span>
            <Overline className="text-light-mint">Readiness Assessment</Overline>
            <h1 className="mt-5 text-5xl md:text-7xl font-serif max-w-4xl leading-[1.05]">How sustainability-ready are you?</h1>
            <p className="mt-6 text-light-mint/85 text-lg max-w-2xl">A quick, indicative assessment across seven sustainability dimensions.</p>
          </Reveal>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-3xl mx-auto px-6 md:px-12">
          {result ? (
            <div data-testid="assessment-result">
              <div className="bg-white border border-black/5 rounded-lg p-8 text-center">
                <div className="text-6xl font-serif text-deep-forest-green">{result.overall_score}<span className="text-2xl text-charcoal/40">/100</span></div>
                <div className={`mt-2 text-xl font-medium ${bandColor[result.band] || "text-natural-green"}`}>{result.band}</div>
              </div>
              <div className="bg-light-mint/40 border border-natural-green/20 rounded-lg p-4 flex gap-3 items-start mt-6">
                <Info className="h-5 w-5 text-natural-green mt-0.5 shrink-0" /><p className="text-sm text-charcoal/80">{result.disclaimer}</p>
              </div>

              <h3 className="mt-8 font-serif text-2xl text-deep-forest-green">Category scores</h3>
              <div className="mt-4 space-y-3">
                {Object.entries(result.category_scores).map(([cat, sc]) => (
                  <div key={cat}>
                    <div className="flex justify-between text-sm mb-1"><span className="text-charcoal/80">{cat}</span><span className="font-medium text-deep-forest-green">{sc}%</span></div>
                    <div className="h-2 rounded-full bg-warm-beige overflow-hidden"><div className="h-full bg-natural-green" style={{ width: `${sc}%` }} /></div>
                  </div>
                ))}
              </div>

              {result.gaps?.length > 0 && (
                <div className="mt-8">
                  <h3 className="font-serif text-2xl text-deep-forest-green mb-3">Key gaps</h3>
                  <div className="flex flex-wrap gap-2">{result.gaps.map((g) => <span key={g} className="inline-flex items-center gap-1.5 text-sm bg-amber-100 text-amber-800 px-3 py-1 rounded-full"><AlertTriangle className="h-3.5 w-3.5" />{g}</span>)}</div>
                </div>
              )}
              {result.recommendations?.length > 0 && (
                <div className="mt-8">
                  <h3 className="font-serif text-2xl text-deep-forest-green mb-3">Recommended next actions</h3>
                  <ul className="space-y-2">{result.recommendations.map((r, i) => <li key={i} className="flex items-start gap-2 text-charcoal/80"><CheckCircle2 className="h-5 w-5 text-natural-green mt-0.5 shrink-0" />{r}</li>)}</ul>
                </div>
              )}
              {result.suggested_services?.length > 0 && (
                <div className="mt-8"><h3 className="font-serif text-2xl text-deep-forest-green mb-3">Suitable RES services</h3><div className="flex flex-wrap gap-2">{result.suggested_services.map((s) => <CertBadge key={s}>{s}</CertBadge>)}</div></div>
              )}
              <div className="mt-8 flex flex-wrap gap-4">
                <Link to="/book" className="inline-flex items-center gap-2 rounded-full bg-deep-forest-green text-off-white px-7 py-3.5 font-medium hover:bg-natural-green transition-colors">Book a consultation <ArrowRight className="h-4 w-4" /></Link>
                <button onClick={() => { setResult(null); setAnswers({}); }} className="rounded-full border-2 border-deep-forest-green text-deep-forest-green px-7 py-3.5 font-medium hover:bg-deep-forest-green hover:text-off-white transition-colors">Retake</button>
              </div>
            </div>
          ) : (
            <form onSubmit={submit} data-testid="assessment-form" className="space-y-6">
              {questions.map((q, qi) => (
                <div key={q.id} className="bg-white border border-black/5 rounded-lg p-6">
                  <div className="text-xs uppercase tracking-widest text-deep-forest-green mb-1">{q.category}</div>
                  <p className="font-medium text-charcoal mb-4">{qi + 1}. {q.text}</p>
                  <div className="grid sm:grid-cols-2 gap-2">
                    {q.options.map((o, oi) => (
                      <label key={oi} className={`cursor-pointer rounded-lg border px-4 py-2.5 text-sm transition-colors ${answers[q.id] === oi ? "bg-light-mint border-natural-green text-deep-forest-green" : "bg-white border-border text-charcoal/70 hover:border-natural-green/40"}`}>
                        <input type="radio" name={q.id} className="hidden" data-testid={`assess-q${qi}-o${oi}`} onChange={() => setAnswers((s) => ({ ...s, [q.id]: oi }))} />
                        {o.label}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
              <div className="bg-white border border-black/5 rounded-lg p-6 grid sm:grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-charcoal/80 mb-1.5">Name *</label><input data-testid="assess-name" className="inp" value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })} /></div>
                <div><label className="block text-sm font-medium text-charcoal/80 mb-1.5">Email *</label><input data-testid="assess-email" className="inp" value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} /></div>
                <div><label className="block text-sm font-medium text-charcoal/80 mb-1.5">Phone</label><input className="inp" value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} /></div>
                <div><label className="block text-sm font-medium text-charcoal/80 mb-1.5">Company</label><input className="inp" value={contact.company} onChange={(e) => setContact({ ...contact, company: e.target.value })} /></div>
              </div>
              <button type="submit" data-testid="assessment-submit" disabled={loading} className="inline-flex items-center gap-2 rounded-full bg-deep-forest-green text-off-white px-8 py-3.5 font-medium hover:bg-natural-green transition-colors disabled:opacity-60">{loading ? "Calculating..." : <>See my readiness score <ArrowRight className="h-4 w-4" /></>}</button>
            </form>
          )}
        </div>
      </section>
      <style>{`.inp{width:100%;background:#fff;border:1px solid hsl(var(--border));border-radius:0.5rem;padding:0.7rem 1rem;font-size:0.95rem;outline:none}.inp:focus{box-shadow:0 0 0 2px #27F580;border-color:#27F580}`}</style>
    </div>
  );
}
