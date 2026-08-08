import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { publicApi } from "@/lib/api";
import { Seo } from "@/components/site/Seo";
import { Reveal, Stagger, StaggerItem } from "@/components/site/Reveal";
import { Overline } from "@/components/site/Bits";

export default function Industries() {
  const [items, setItems] = useState([]);
  useEffect(() => { publicApi.get("/industries").then((r) => setItems(r.data)).catch(() => {}); }, []);

  return (
    <div data-testid="industries-page">
      <Seo title="Who We Serve" description="Sustainability advisory tailored to your industry." path="/industries" />
      <section className="pt-36 pb-16 bg-deep-forest-green text-off-white">
        <div className="max-w-[1400px] mx-auto px-6 md:px-12">
          <Reveal>
            <Overline className="text-light-mint">Who We Serve</Overline>
            <h1 className="mt-5 text-5xl md:text-7xl font-serif max-w-4xl leading-[1.05]">Tailored to your industry</h1>
          </Reveal>
        </div>
      </section>
      <section className="py-20">
        <div className="max-w-[1400px] mx-auto px-6 md:px-12">
          <Stagger className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {items.map((it) => (
              <StaggerItem key={it.id}>
                <Link to={`/industries/${it.slug}`} data-testid={`industry-card-${it.slug}`} className="group block bg-white border border-black/5 rounded-lg overflow-hidden h-full hover:border-natural-green/30 transition-colors">
                  {it.image && <div className="aspect-[16/10] overflow-hidden bg-warm-beige"><img src={it.image} alt={it.title} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-700" /></div>}
                  <div className="p-6">
                    <div className="flex items-start justify-between"><h2 className="text-xl md:text-2xl text-deep-forest-green">{it.title}</h2><ArrowUpRight className="h-5 w-5 text-charcoal/30 group-hover:text-deep-forest-green transition-colors" /></div>
                    <p className="mt-2 text-charcoal/70 text-sm leading-relaxed">{it.intro}</p>
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
