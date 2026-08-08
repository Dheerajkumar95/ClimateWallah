import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { publicApi } from "@/lib/api";
import { Seo } from "@/components/site/Seo";
import { Reveal, Stagger, StaggerItem } from "@/components/site/Reveal";
import { Overline, ServiceIcon } from "@/components/site/Bits";

export default function Services() {
  const [items, setItems] = useState([]);
  useEffect(() => { publicApi.get("/services").then((r) => setItems(r.data)).catch(() => {}); }, []);

  return (
    <div data-testid="services-page">
      <Seo title="Services" description="End-to-end sustainability services across audits, certification, climate action and reporting." path="/services" />
      <section className="pt-36 pb-20 bg-deep-forest-green text-off-white">
        <div className="max-w-[1400px] mx-auto px-6 md:px-12">
          <Reveal>
            <Overline className="text-light-mint">Our Sustainability Services</Overline>
            <h1 className="mt-5 text-5xl md:text-7xl font-serif max-w-4xl leading-[1.05]">Services engineered for measurable impact</h1>
          </Reveal>
        </div>
      </section>

      <section className="py-24 md:py-32">
        <div className="max-w-[1400px] mx-auto px-6 md:px-12">
          <Stagger className="grid md:grid-cols-2 gap-6">
            {items.map((s) => (
              <StaggerItem key={s.id}>
                <Link to={`/services/${s.slug}`} data-testid={`service-card-${s.slug}`}
                  className="group block bg-white border border-black/5 rounded-lg overflow-hidden h-full hover:border-natural-green/30 transition-colors">
                  {s.image && <div className="aspect-[16/9] overflow-hidden bg-warm-beige"><img src={s.image} alt={s.title} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-700" /></div>}
                  <div className="p-8 md:p-10">
                    <div className="flex items-start justify-between">
                      <span className="h-14 w-14 rounded-full bg-light-mint text-deep-forest-green flex items-center justify-center"><ServiceIcon name={s.icon} /></span>
                      <ArrowUpRight className="h-6 w-6 text-charcoal/30 group-hover:text-deep-forest-green transition-colors" />
                    </div>
                    <h2 className="mt-6 text-2xl md:text-3xl text-deep-forest-green">{s.title}</h2>
                    <p className="mt-3 text-charcoal/70 leading-relaxed">{s.short_description}</p>
                  </div>
                </Link>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>
    </div>
  );
}
