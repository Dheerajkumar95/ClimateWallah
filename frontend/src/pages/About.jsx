import React, { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { publicApi } from "@/lib/api";
import { Seo } from "@/components/site/Seo";
import { Reveal, Stagger, StaggerItem } from "@/components/site/Reveal";
import { Overline, CertBadge } from "@/components/site/Bits";

export default function About() {
  const [a, setA] = useState(null);
  useEffect(() => { publicApi.get("/about").then((r) => setA(r.data)).catch(() => setA({})); }, []);
  if (!a) return <div className="min-h-screen" />;

  return (
    <div data-testid="about-page">
      <Seo title="About" description={a.intro} path="/about" />
      <section className="pt-36 pb-20 bg-deep-forest-green text-off-white">
        <div className="max-w-[1400px] mx-auto px-6 md:px-12">
          <Reveal>
            <Overline className="text-light-mint">{a.motto || "Caring for the Globe"}</Overline>
            <h1 className="mt-5 text-5xl md:text-7xl font-serif leading-[1.05] max-w-4xl">{a.heading}</h1>
          </Reveal>
        </div>
      </section>

      <section className="py-24 md:py-32">
        <div className="max-w-[1400px] mx-auto px-6 md:px-12 grid lg:grid-cols-12 gap-12 items-start">
          <div className="lg:col-span-7">
            <Reveal><p className="text-lg md:text-xl text-charcoal/80 leading-relaxed">{a.intro}</p></Reveal>
          </div>
          <div className="lg:col-span-5">
            <Reveal delay={0.1}>
              {a.image && <img src={a.image} alt="RES sustainable office" className="rounded-lg w-full object-cover aspect-[4/3]" />}
            </Reveal>
          </div>
        </div>
      </section>

      <section className="py-20 bg-warm-beige">
        <div className="max-w-[1400px] mx-auto px-6 md:px-12 grid lg:grid-cols-2 gap-12">
          <Reveal>
            <Overline>Our Mission</Overline>
            <p className="mt-5 text-3xl md:text-4xl font-serif text-deep-forest-green leading-tight">{a.mission}</p>
          </Reveal>
          <Reveal delay={0.1}>
            <Overline>Our Commitment</Overline>
            <p className="mt-5 text-lg text-charcoal/80 leading-relaxed">{a.commitment}</p>
            <p className="mt-4 text-charcoal/70 leading-relaxed">{a.approach}</p>
          </Reveal>
        </div>
      </section>

      {a.values?.length > 0 && (
        <section className="py-24 md:py-32">
          <div className="max-w-[1400px] mx-auto px-6 md:px-12">
            <Reveal><Overline>Our Values</Overline>
              <h2 className="mt-4 text-4xl md:text-5xl font-serif text-deep-forest-green">The blueprint of how we operate</h2>
            </Reveal>
            <Stagger className="mt-12 grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {a.values.map((v, i) => (
                <StaggerItem key={i}>
                  <div className="bg-white border border-black/5 rounded-lg p-8 flex items-start gap-4 h-full">
                    <CheckCircle2 className="h-6 w-6 text-natural-green shrink-0 mt-0.5" strokeWidth={1.5} />
                    <span className="text-charcoal/85 text-lg">{v}</span>
                  </div>
                </StaggerItem>
              ))}
            </Stagger>
          </div>
        </section>
      )}

      <section className="py-20 bg-deep-forest-green text-off-white">
        <div className="max-w-[1400px] mx-auto px-6 md:px-12 grid lg:grid-cols-2 gap-12">
          {a.credentials?.length > 0 && (
            <Reveal>
              <Overline className="text-light-mint">Certifications & Credentials</Overline>
              <div className="mt-6 flex flex-wrap gap-3">{a.credentials.map((c) => <CertBadge key={c}>{c}</CertBadge>)}</div>
            </Reveal>
          )}
          {a.collaborations?.length > 0 && (
            <Reveal delay={0.1}>
              <Overline className="text-light-mint">Industry Collaborations</Overline>
              <div className="mt-6 flex flex-wrap gap-x-6 gap-y-3 text-light-mint/80">
                {a.collaborations.map((c) => <span key={c} className="text-sm">{c}</span>)}
              </div>
            </Reveal>
          )}
        </div>
        <div className="max-w-[1400px] mx-auto px-6 md:px-12 mt-12">
          {a.cin && <p className="text-xs text-light-mint/50 tracking-wide">CIN: {a.cin}</p>}
        </div>
      </section>
    </div>
  );
}
