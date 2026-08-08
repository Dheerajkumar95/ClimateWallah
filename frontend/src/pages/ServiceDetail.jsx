import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Check } from "lucide-react";
import { publicApi } from "@/lib/api";
import { Seo } from "@/components/site/Seo";
import { Reveal } from "@/components/site/Reveal";
import { Overline, ServiceIcon } from "@/components/site/Bits";

export default function ServiceDetail() {
  const { slug } = useParams();
  const [s, setS] = useState(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    publicApi.get(`/services/${slug}`).then((r) => setS(r.data)).catch(() => setErr(true));
  }, [slug]);

  if (err) return <div className="pt-40 pb-40 text-center text-charcoal/60">Service not found. <Link to="/services" className="underline">Back to services</Link></div>;
  if (!s) return <div className="min-h-screen" />;

  return (
    <div data-testid="service-detail-page">
      <Seo title={s.seo_title || s.title} description={s.seo_description || s.short_description} path={`/services/${slug}`} />
      <section className="pt-36 pb-16 bg-deep-forest-green text-off-white">
        <div className="max-w-[1400px] mx-auto px-6 md:px-12">
          <Link to="/services" className="inline-flex items-center gap-2 text-light-mint/80 hover:text-off-white mb-8"><ArrowLeft className="h-4 w-4" /> All Services</Link>
          <Reveal>
            <span className="h-16 w-16 rounded-full bg-off-white/15 flex items-center justify-center mb-6"><ServiceIcon name={s.icon} className="h-8 w-8" /></span>
            <h1 className="text-5xl md:text-7xl font-serif leading-[1.05] max-w-4xl">{s.title}</h1>
            <p className="mt-6 text-light-mint/85 text-lg max-w-2xl">{s.short_description}</p>
          </Reveal>
        </div>
      </section>

      <section className="py-24 md:py-32">
        <div className="max-w-[1400px] mx-auto px-6 md:px-12 grid lg:grid-cols-12 gap-12 items-start">
          <div className="lg:col-span-7">
            <Reveal><p className="text-lg md:text-xl text-charcoal/80 leading-relaxed whitespace-pre-line">{s.full_description}</p></Reveal>
            {s.image && <Reveal delay={0.1}><img src={s.image} alt={s.title} className="mt-10 rounded-lg w-full object-cover aspect-[16/9]" /></Reveal>}
          </div>
          <div className="lg:col-span-5">
            <Reveal delay={0.15}>
              <div className="bg-warm-beige rounded-lg p-8 md:p-10">
                <Overline>What's included</Overline>
                <ul className="mt-6 space-y-4">
                  {(s.features || []).map((f, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="h-6 w-6 rounded-full bg-deep-forest-green text-off-white flex items-center justify-center shrink-0 mt-0.5"><Check className="h-3.5 w-3.5" /></span>
                      <span className="text-charcoal/85">{f}</span>
                    </li>
                  ))}
                </ul>
                <Link to="/contact" className="mt-8 inline-flex items-center justify-center w-full rounded-full bg-deep-forest-green text-off-white px-6 py-3.5 font-medium hover:bg-natural-green transition-colors">Enquire about this service</Link>
              </div>
            </Reveal>
          </div>
        </div>
      </section>
    </div>
  );
}
