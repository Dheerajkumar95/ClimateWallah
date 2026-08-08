import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, MapPin, Award, Calendar, Gauge } from "lucide-react";
import { publicApi } from "@/lib/api";
import { Seo } from "@/components/site/Seo";
import { Reveal } from "@/components/site/Reveal";
import { CertBadge } from "@/components/site/Bits";

export default function ProjectDetail() {
  const { slug } = useParams();
  const [p, setP] = useState(null);
  const [err, setErr] = useState(false);
  useEffect(() => { publicApi.get(`/projects/${slug}`).then((r) => setP(r.data)).catch(() => setErr(true)); }, [slug]);

  if (err) return <div className="pt-40 pb-40 text-center text-charcoal/60">Project not found. <Link to="/projects" className="underline">Back to projects</Link></div>;
  if (!p) return <div className="min-h-screen" />;

  const meta = [
    { Icon: MapPin, label: "Location", val: p.location },
    { Icon: Award, label: "Certification", val: p.certification },
    { Icon: Gauge, label: "Capacity", val: p.capacity },
    { Icon: Calendar, label: "Completion", val: p.completion_date },
  ].filter((m) => m.val);

  return (
    <div data-testid="project-detail-page">
      <Seo title={p.seo_title || p.title} description={p.seo_description || p.short_description} image={p.cover_image} path={`/projects/${slug}`} />
      <section className="relative pt-36 pb-20 bg-deep-forest-green text-off-white overflow-hidden">
        {p.cover_image && <div className="absolute inset-0"><img src={p.cover_image} alt={p.title} className="h-full w-full object-cover opacity-25" /><div className="absolute inset-0 bg-deep-forest-green/60" /></div>}
        <div className="relative max-w-[1400px] mx-auto px-6 md:px-12">
          <Link to="/projects" className="inline-flex items-center gap-2 text-light-mint/80 hover:text-off-white mb-8"><ArrowLeft className="h-4 w-4" /> All Projects</Link>
          <Reveal>
            <div className="flex gap-2 mb-5 flex-wrap"><CertBadge>{p.category}</CertBadge></div>
            <h1 className="text-5xl md:text-7xl font-serif leading-[1.05] max-w-4xl">{p.title}</h1>
          </Reveal>
        </div>
      </section>

      <section className="py-24 md:py-32">
        <div className="max-w-[1400px] mx-auto px-6 md:px-12 grid lg:grid-cols-12 gap-12 items-start">
          <div className="lg:col-span-7">
            <Reveal><p className="text-lg md:text-xl text-charcoal/80 leading-relaxed whitespace-pre-line">{p.full_description}</p></Reveal>
            {p.gallery?.length > 0 && (
              <div className="mt-10 grid sm:grid-cols-2 gap-4">
                {p.gallery.map((g, i) => <img key={i} src={g} alt={`${p.title} ${i + 1}`} className="rounded-lg w-full object-cover aspect-[4/3]" />)}
              </div>
            )}
          </div>
          <div className="lg:col-span-5">
            <Reveal delay={0.1}>
              <div className="bg-warm-beige rounded-lg p-8 space-y-6">
                {meta.map((m, i) => (
                  <div key={i} className="flex items-start gap-4">
                    <span className="h-10 w-10 rounded-full bg-light-mint text-deep-forest-green flex items-center justify-center shrink-0"><m.Icon className="h-5 w-5" strokeWidth={1.5} /></span>
                    <div>
                      <div className="text-xs uppercase tracking-widest text-charcoal/50">{m.label}</div>
                      <div className="text-charcoal font-medium">{m.val}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </div>
      </section>
    </div>
  );
}
