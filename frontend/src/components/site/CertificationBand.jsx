import React from "react";
import { Reveal, Stagger, StaggerItem } from "./Reveal";
import { Overline, CertBadge } from "./Bits";

export function CertificationBand({ logos = [], credentials = [] }) {
  const hasLogos = logos && logos.length > 0;
  return (
    <section className="py-20 bg-warm-beige border-y border-black/5" data-testid="certification-band">
      <div className="max-w-[1400px] mx-auto px-6 md:px-12">
        <Reveal>
          <Overline>Our Credentials</Overline>
          <p className="mt-4 text-2xl md:text-3xl font-serif text-deep-forest-green max-w-3xl">
            Accredited across all major green building certification frameworks
          </p>
        </Reveal>

        {hasLogos ? (
          <Stagger className="mt-12 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {logos.map((l, i) => (
              <StaggerItem key={l.name} delay={i * 0.05}>
                <div className="group bg-white border border-black/5 rounded-xl p-5 flex items-center justify-center aspect-[4/3] transition-transform duration-300 hover:-translate-y-1">
                  <img
                    src={l.image}
                    alt={`${l.name} certification`}
                    className="max-h-24 w-auto object-contain grayscale-[0.15] group-hover:grayscale-0 transition-[filter] duration-300"
                    loading="lazy"
                  />
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        ) : (
          <div className="mt-10 flex flex-wrap gap-3">
            {credentials.map((c) => (<CertBadge key={c}>{c}</CertBadge>))}
          </div>
        )}
      </div>
    </section>
  );
}
