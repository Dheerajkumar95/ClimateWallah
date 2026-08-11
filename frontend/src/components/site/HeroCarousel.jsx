import React, { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";

const IMG = "https://static.prod-images.emergentagent.com/jobs/4802f517-df95-41f2-81d6-255f9deb6754/images";

const SLIDES = [
  {
    kicker: "Green Materials Marketplace",
    titleA: "Find Trusted Low-Carbon",
    titleB: "Materials & Green Vendors",
    subtitle: "Discover India's marketplace for vetted green vendors and sustainable building products — in one click.",
    cta: "Explore Marketplace",
    to: "/resources",
    image: `${IMG}/a9460f36d23503dd5e354bafc9b71ff24064630f46723dd4b58981b768d4a44b.jpeg`,
  },
  {
    kicker: "IGBC Readiness",
    titleA: "IGBC Target Score:",
    titleB: "Check your project readiness",
    subtitle: "Instantly benchmark, see your score, and get precise interventions to close the IGBC gap.",
    cta: "Try the Pre-Qualifier",
    to: "/certification-finder",
    image: `${IMG}/c20191567fd0be4da2cfeec26034399f1b45ef4ef142d411cbe387400b93b81f.jpeg`,
  },
  {
    kicker: "Sustainability Platform",
    titleA: "Green Building Design Doesn't",
    titleB: "Have to Be Complex & Costly",
    subtitle: "Take the right first step with India's automated sustainability platform, built by Resilient Earth Solutions.",
    cta: "Book a Demo",
    to: "/book",
    image: `${IMG}/ceacacbe76d2b88f7049ca6302eb7478a1a8e8451888254e3292af745eb1cb7b.jpeg`,
  },
];

export function HeroCarousel() {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);

  const go = useCallback((n) => setI((prev) => (n + SLIDES.length) % SLIDES.length), []);

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setI((p) => (p + 1) % SLIDES.length), 6000);
    return () => clearInterval(t);
  }, [paused, i]);

  const s = SLIDES[i];

  return (
    <section
      className="relative bg-off-white overflow-hidden pt-20"
      data-testid="hero-section"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(42,89,52,0.08),transparent_55%)]" />
      <div className="relative max-w-[1400px] mx-auto px-6 md:px-12 min-h-[640px] lg:min-h-[720px] grid lg:grid-cols-2 gap-8 items-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={`text-${i}`}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
            className="max-w-xl py-10"
          >
            <span className="inline-block text-xs font-semibold tracking-[0.2em] uppercase text-deep-forest-green mb-5">{s.kicker}</span>
            <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl leading-[1.05] tracking-tight text-charcoal">
              {s.titleA}{" "}
              <span className="text-deep-forest-green">{s.titleB}</span>
            </h1>
            <p className="mt-6 text-base md:text-lg text-charcoal/65 leading-relaxed max-w-lg">{s.subtitle}</p>
            <Link
              to={s.to}
              data-testid="hero-primary-cta"
              className="group mt-9 inline-flex items-center gap-2 rounded-full bg-natural-green text-deep-forest-green px-7 py-3.5 font-semibold hover:bg-deep-forest-green hover:text-off-white transition-colors"
            >
              {s.cta}
              <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </motion.div>
        </AnimatePresence>

        <AnimatePresence mode="wait">
          <motion.div
            key={`img-${i}`}
            initial={{ opacity: 0, scale: 0.96, x: 30 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.98, x: -20 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="hidden lg:block"
          >
            <img src={s.image} alt={s.titleA} className="w-full h-auto drop-shadow-2xl select-none pointer-events-none" />
          </motion.div>
        </AnimatePresence>

        {/* Arrows */}
        <button onClick={() => go(i - 1)} aria-label="Previous slide" data-testid="hero-prev"
          className="hidden lg:flex absolute left-3 top-1/2 -translate-y-1/2 h-11 w-11 items-center justify-center rounded-full bg-white border border-border text-charcoal/60 hover:text-natural-green hover:border-natural-green/40 transition-colors">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button onClick={() => go(i + 1)} aria-label="Next slide" data-testid="hero-next"
          className="hidden lg:flex absolute right-3 top-1/2 -translate-y-1/2 h-11 w-11 items-center justify-center rounded-full bg-white border border-border text-charcoal/60 hover:text-natural-green hover:border-natural-green/40 transition-colors">
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Dots */}
      <div className="relative flex items-center justify-center gap-2.5 pb-10">
        {SLIDES.map((_, idx) => (
          <button
            key={idx}
            onClick={() => go(idx)}
            data-testid={`hero-dot-${idx}`}
            aria-label={`Go to slide ${idx + 1}`}
            className={`h-2 rounded-full transition-all duration-300 ${idx === i ? "w-8 bg-natural-green" : "w-2 bg-charcoal/20 hover:bg-charcoal/40"}`}
          />
        ))}
      </div>
      <div className="h-6 bg-gradient-to-b from-transparent to-[#EAFBF4]" />
    </section>
  );
}
