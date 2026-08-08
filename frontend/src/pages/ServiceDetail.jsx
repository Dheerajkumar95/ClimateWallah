import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Check, CalendarCheck, Send, Download, CheckCircle2, Building2 } from "lucide-react";
import { publicApi } from "@/lib/api";
import { Seo } from "@/components/site/Seo";
import { Reveal } from "@/components/site/Reveal";
import { Overline, ServiceIcon, CertBadge, ProjectCard } from "@/components/site/Bits";

export default function ServiceDetail() {
  const { slug } = useParams();
  const [s, setS] = useState(null);
  const [projects, setProjects] = useState([]);
  const [err, setErr] = useState(false);
  useEffect(() => {
    publicApi.get(`/services/${slug}`).then((r) => setS(r.data)).catch(() => setErr(true));
    publicApi.get("/projects", { params: { featured: true } }).then((r) => setProjects((r.data.items || []).slice(0, 3))).catch(() => {});
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

      <section className="py-20 md:py-28">
        <div className="max-w-[1400px] mx-auto px-6 md:px-12 grid lg:grid-cols-12 gap-12 items-start">
          <div className="lg:col-span-7 space-y-12">
            <Reveal>
              <Overline>Overview</Overline>
              <p className="mt-4 text-lg md:text-xl text-charcoal/80 leading-relaxed whitespace-pre-line">{s.full_description}</p>
            </Reveal>
            {s.client_problem && <Reveal><Overline>The problem we solve</Overline><p className="mt-4 text-charcoal/80 leading-relaxed whitespace-pre-line">{s.client_problem}</p></Reveal>}
            {s.benefits?.length > 0 && (
              <Reveal><Overline>Key benefits</Overline>
                <ul className="mt-4 grid sm:grid-cols-2 gap-3">{s.benefits.map((b, i) => <li key={i} className="flex items-start gap-2.5 text-charcoal/80"><CheckCircle2 className="h-5 w-5 text-natural-green mt-0.5 shrink-0" />{b}</li>)}</ul>
              </Reveal>
            )}
            {s.methodology && <Reveal><Overline>Our methodology</Overline><p className="mt-4 text-charcoal/80 leading-relaxed whitespace-pre-line">{s.methodology}</p></Reveal>}
            {s.applicable_industries?.length > 0 && (
              <Reveal><Overline>Applicable industries</Overline>
                <div className="mt-4 flex flex-wrap gap-2">{s.applicable_industries.map((i) => <span key={i} className="inline-flex items-center gap-1.5 bg-warm-beige text-charcoal px-3 py-1.5 rounded-full text-sm"><Building2 className="h-3.5 w-3.5" />{i}</span>)}</div>
              </Reveal>
            )}
            {s.faq_html && (
              <Reveal><Overline>Frequently asked questions</Overline>
                <div className="mt-4 prose max-w-none text-charcoal/80 [&_h4]:font-serif [&_h4]:text-xl [&_h4]:text-deep-forest-green [&_h4]:mt-6 [&_h4]:mb-1 [&_p]:mb-2" dangerouslySetInnerHTML={{ __html: s.faq_html }} />
              </Reveal>
            )}
          </div>
          <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-24">
            {s.features?.length > 0 && (
              <Reveal delay={0.1}>
                <div className="bg-warm-beige rounded-lg p-8">
                  <Overline>Key deliverables</Overline>
                  <ul className="mt-5 space-y-3">{s.features.map((f, i) => <li key={i} className="flex items-start gap-3"><span className="h-6 w-6 rounded-full bg-deep-forest-green text-off-white flex items-center justify-center shrink-0 mt-0.5"><Check className="h-3.5 w-3.5" /></span><span className="text-charcoal/85">{f}</span></li>)}</ul>
                  {s.standards?.length > 0 && <div className="mt-6 pt-6 border-t border-black/10"><div className="text-xs uppercase tracking-widest text-charcoal/50 mb-3">Standards</div><div className="flex flex-wrap gap-2">{s.standards.map((c) => <CertBadge key={c}>{c}</CertBadge>)}</div></div>}
                </div>
              </Reveal>
            )}
            <Reveal delay={0.15}>
              <div className="bg-deep-forest-green text-off-white rounded-lg p-8 space-y-3">
                <h3 className="font-serif text-2xl">Ready to talk?</h3>
                <Link to="/book" data-testid="service-book-cta" className="flex items-center justify-center gap-2 rounded-full bg-off-white text-deep-forest-green px-6 py-3 font-medium hover:bg-light-mint transition-colors"><CalendarCheck className="h-4 w-4" /> Book a Consultation</Link>
                <Link to="/contact" className="flex items-center justify-center gap-2 rounded-full border border-off-white/50 px-6 py-3 font-medium hover:bg-off-white/10 transition-colors"><Send className="h-4 w-4" /> Send Enquiry</Link>
                <Link to="/capability-profile" className="flex items-center justify-center gap-2 rounded-full border border-off-white/50 px-6 py-3 font-medium hover:bg-off-white/10 transition-colors"><Download className="h-4 w-4" /> Download Capability Profile</Link>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {projects.length > 0 && (
        <section className="py-20 bg-warm-beige">
          <div className="max-w-[1400px] mx-auto px-6 md:px-12">
            <Overline>Related projects</Overline>
            <div className="mt-8 grid md:grid-cols-3 gap-6">{projects.map((p) => <ProjectCard key={p.id} project={p} />)}</div>
          </div>
        </section>
      )}
    </div>
  );
}
