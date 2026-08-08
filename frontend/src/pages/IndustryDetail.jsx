import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, AlertTriangle, CheckCircle2, Leaf } from "lucide-react";
import { publicApi } from "@/lib/api";
import { Seo } from "@/components/site/Seo";
import { Reveal } from "@/components/site/Reveal";
import { Overline } from "@/components/site/Bits";

export default function IndustryDetail() {
  const { slug } = useParams();
  const [d, setD] = useState(null);
  const [err, setErr] = useState(false);
  useEffect(() => { publicApi.get(`/industries/${slug}`).then((r) => setD(r.data)).catch(() => setErr(true)); }, [slug]);

  if (err) return <div className="pt-40 pb-40 text-center text-charcoal/60">Not found. <Link to="/industries" className="underline">Back</Link></div>;
  if (!d) return <div className="min-h-screen" />;

  return (
    <div data-testid="industry-detail-page">
      <Seo title={d.seo_title || d.title} description={d.seo_description || d.intro} image={d.image} path={`/industries/${slug}`} />
      <section className="relative pt-36 pb-20 bg-deep-forest-green text-off-white overflow-hidden">
        {d.image && <div className="absolute inset-0"><img src={d.image} alt={d.title} className="h-full w-full object-cover opacity-25" /><div className="absolute inset-0 bg-deep-forest-green/60" /></div>}
        <div className="relative max-w-[1400px] mx-auto px-6 md:px-12">
          <Link to="/industries" className="inline-flex items-center gap-2 text-light-mint/80 hover:text-off-white mb-8"><ArrowLeft className="h-4 w-4" /> Who We Serve</Link>
          <Reveal><Overline className="text-light-mint">Industry</Overline><h1 className="mt-4 text-5xl md:text-7xl font-serif leading-[1.05] max-w-4xl">{d.title}</h1><p className="mt-6 text-light-mint/85 text-lg max-w-2xl">{d.intro}</p></Reveal>
        </div>
      </section>

      <section className="py-20">
        <div className="max-w-[1400px] mx-auto px-6 md:px-12 grid lg:grid-cols-2 gap-12">
          {d.challenges?.length > 0 && (
            <Reveal>
              <Overline>Industry Challenges</Overline>
              <ul className="mt-5 space-y-3">{d.challenges.map((c, i) => <li key={i} className="flex items-start gap-3 text-charcoal/80"><AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />{c}</li>)}</ul>
            </Reveal>
          )}
          {d.solutions?.length > 0 && (
            <Reveal delay={0.1}>
              <Overline>Suggested Solutions</Overline>
              <ul className="mt-5 space-y-3">{d.solutions.map((c, i) => <li key={i} className="flex items-start gap-3 text-charcoal/80"><CheckCircle2 className="h-5 w-5 text-natural-green mt-0.5 shrink-0" />{c}</li>)}</ul>
            </Reveal>
          )}
        </div>
      </section>

      <section className="py-20 bg-deep-forest-green text-off-white text-center">
        <div className="max-w-2xl mx-auto px-6 md:px-12 flex flex-col items-center">
          <Leaf className="h-8 w-8 text-light-mint mb-4" />
          <h2 className="text-3xl md:text-4xl font-serif">Let's tailor a solution for your project</h2>
          <Link to="/book" className="mt-8 inline-flex items-center gap-2 rounded-full bg-off-white text-deep-forest-green px-8 py-4 font-medium hover:bg-light-mint transition-colors">Schedule a consultation <ArrowRight className="h-4 w-4" /></Link>
        </div>
      </section>
    </div>
  );
}
