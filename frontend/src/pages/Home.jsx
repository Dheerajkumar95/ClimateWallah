import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, ArrowUpRight, Download, CheckCircle2 } from "lucide-react";
import { publicApi } from "@/lib/api";
import { Seo } from "@/components/site/Seo";
import { Reveal, Stagger, StaggerItem } from "@/components/site/Reveal";
import { ServiceIcon, Overline, ProjectCard, TeamAvatar, CertBadge } from "@/components/site/Bits";
import { CertificationBand } from "@/components/site/CertificationBand";

export default function Home() {
  const [d, setD] = useState(null);

  useEffect(() => {
    publicApi.get("/home").then((r) => setD(r.data)).catch(() => setD({}));
  }, []);

  if (!d) return <div className="min-h-screen bg-deep-forest-green" />;

  const home = d.home || {};
  const sections = home.sections || {};
  const overlay = typeof home.hero_overlay_opacity === "number" ? home.hero_overlay_opacity : 70;

  return (
    <div data-testid="home-page">
      <Seo title="Sustainability Consulting" description={home.hero_subtitle} path="/" />

      {/* HERO */}
      <section className="relative min-h-[92vh] flex items-center" data-testid="hero-section">
        <div className="absolute inset-0">
          <img src={home.hero_image} alt="Sustainable green building" className="h-full w-full object-cover" />
          <div className="absolute inset-0" style={{ backgroundColor: `rgba(19, 58, 38, ${overlay / 100})` }} />
          <div className="absolute inset-0 bg-gradient-to-t from-deep-forest-green/90 via-deep-forest-green/20 to-transparent" />
        </div>
        <div className="relative max-w-[1400px] mx-auto px-6 md:px-12 w-full pt-24">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
            className="max-w-4xl"
          >
            <Overline className="text-light-mint">Resilient Earth Solutions</Overline>
            <h1 className="mt-5 text-off-white text-5xl md:text-7xl lg:text-8xl font-serif leading-[1.03] tracking-tight">
              {home.hero_title}
            </h1>
            <p className="mt-8 text-light-mint/90 text-lg md:text-xl max-w-2xl leading-relaxed">
              {home.hero_subtitle}
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              <Link
                to={home.cta_primary_link || "/projects"}
                data-testid="hero-primary-cta"
                className="group inline-flex items-center gap-2 rounded-full bg-off-white text-deep-forest-green px-7 py-3.5 font-medium hover:bg-light-mint transition-colors"
              >
                {home.cta_primary_text || "Explore Our Projects"}
                <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                to={home.cta_secondary_link || "/capability-profile"}
                data-testid="hero-secondary-cta"
                className="inline-flex items-center gap-2 rounded-full border-2 border-off-white/60 text-off-white px-7 py-3.5 font-medium hover:bg-off-white hover:text-deep-forest-green transition-colors"
              >
                <Download className="h-4 w-4" />
                {home.cta_secondary_text || "Download Capability Profile"}
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* STATS */}
      {home.stats?.length > 0 && (
        <section className="bg-deep-forest-green text-off-white">
          <div className="max-w-[1400px] mx-auto px-6 md:px-12 py-14 grid grid-cols-2 md:grid-cols-4 gap-8">
            {home.stats.map((s, i) => (
              <Reveal key={i} delay={i * 0.08}>
                <div className="text-4xl md:text-5xl font-serif text-light-mint">{s.value}</div>
                <div className="mt-2 text-sm uppercase tracking-widest text-off-white/70">{s.label}</div>
              </Reveal>
            ))}
          </div>
        </section>
      )}

      {/* INTRO */}
      <section className="py-24 md:py-32">
        <div className="max-w-[1400px] mx-auto px-6 md:px-12 grid lg:grid-cols-12 gap-12 items-start">
          <div className="lg:col-span-5">
            <Reveal>
              <Overline>{home.intro_heading || "Caring for the Globe"}</Overline>
              <h2 className="mt-4 text-4xl md:text-5xl font-serif text-deep-forest-green leading-tight">
                Sustainability, engineered for lasting impact
              </h2>
            </Reveal>
          </div>
          <div className="lg:col-span-7">
            <Reveal delay={0.1}>
              <p className="text-lg md:text-xl text-charcoal/75 leading-relaxed">{home.intro_text}</p>
              <Link to="/about" className="mt-8 inline-flex items-center gap-2 text-deep-forest-green font-medium hover:gap-3 transition-all">
                More about RES <ArrowRight className="h-4 w-4" />
              </Link>
            </Reveal>
          </div>
        </div>
      </section>

      {/* SERVICES */}
      {sections.services !== false && d.services?.length > 0 && (
        <section className="py-24 md:py-32 bg-warm-beige" data-testid="home-services">
          <div className="max-w-[1400px] mx-auto px-6 md:px-12">
            <Reveal><Overline>Our Sustainability Services</Overline>
              <h2 className="mt-4 text-4xl md:text-5xl font-serif text-deep-forest-green">What we do</h2>
            </Reveal>
            <Stagger className="mt-14 grid md:grid-cols-2 gap-6">
              {d.services.map((s) => (
                <StaggerItem key={s.id}>
                  <Link to={`/services/${s.slug}`} data-testid={`home-service-${s.slug}`}
                    className="group block bg-off-white border border-black/5 rounded-lg p-8 md:p-10 h-full hover:border-natural-green/30 transition-colors">
                    <div className="flex items-start justify-between">
                      <span className="h-14 w-14 rounded-full bg-light-mint text-deep-forest-green flex items-center justify-center">
                        <ServiceIcon name={s.icon} />
                      </span>
                      <ArrowUpRight className="h-6 w-6 text-charcoal/30 group-hover:text-deep-forest-green group-hover:-translate-y-1 group-hover:translate-x-1 transition-all" />
                    </div>
                    <h3 className="mt-6 text-2xl md:text-3xl text-deep-forest-green">{s.title}</h3>
                    <p className="mt-3 text-charcoal/70 leading-relaxed">{s.short_description}</p>
                  </Link>
                </StaggerItem>
              ))}
            </Stagger>
          </div>
        </section>
      )}

      {/* MISSION & VALUES */}
      {(sections.mission !== false || sections.values !== false) && (
        <section className="py-24 md:py-32 bg-deep-forest-green text-off-white">
          <div className="max-w-[1400px] mx-auto px-6 md:px-12 grid lg:grid-cols-12 gap-12">
            {sections.mission !== false && (
              <div className="lg:col-span-5">
                <Reveal>
                  <Overline className="text-light-mint">Our Mission</Overline>
                  <p className="mt-6 text-3xl md:text-4xl font-serif leading-tight text-off-white">{home.mission}</p>
                </Reveal>
              </div>
            )}
            {sections.values !== false && home.values?.length > 0 && (
              <div className="lg:col-span-7">
                <Reveal delay={0.1}><Overline className="text-light-mint">Our Values</Overline></Reveal>
                <Stagger className="mt-8 grid sm:grid-cols-2 gap-x-10 gap-y-5">
                  {home.values.map((v, i) => (
                    <StaggerItem key={i}>
                      <div className="flex items-start gap-3 py-2 border-b border-off-white/10">
                        <CheckCircle2 className="h-5 w-5 text-light-mint mt-1 shrink-0" strokeWidth={1.5} />
                        <span className="text-off-white/90">{v}</span>
                      </div>
                    </StaggerItem>
                  ))}
                </Stagger>
              </div>
            )}
          </div>
        </section>
      )}

      {/* FEATURED PROJECTS */}
      {sections.featured_projects !== false && d.projects?.length > 0 && (
        <section className="py-24 md:py-32" data-testid="home-projects">
          <div className="max-w-[1400px] mx-auto px-6 md:px-12">
            <div className="flex items-end justify-between flex-wrap gap-4">
              <Reveal><Overline>Featured Work</Overline>
                <h2 className="mt-4 text-4xl md:text-5xl font-serif text-deep-forest-green">Projects completed</h2>
              </Reveal>
              <Link to="/projects" className="inline-flex items-center gap-2 text-deep-forest-green font-medium hover:gap-3 transition-all">
                View all projects <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <Stagger className="mt-14 grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {d.projects.map((p) => (
                <StaggerItem key={p.id}><ProjectCard project={p} /></StaggerItem>
              ))}
            </Stagger>
          </div>
        </section>
      )}

      {/* CREDENTIALS */}
      {sections.credentials !== false && (d.credential_logos?.length > 0 || d.credentials?.length > 0) && (
        <CertificationBand logos={d.credential_logos} credentials={d.credentials} />
      )}

      {/* WHY CHOOSE */}
      {sections.why_choose !== false && home.why_choose?.length > 0 && (
        <section className="py-24 md:py-32">
          <div className="max-w-[1400px] mx-auto px-6 md:px-12">
            <Reveal><Overline>Why Choose RES</Overline>
              <h2 className="mt-4 text-4xl md:text-5xl font-serif text-deep-forest-green">Partners in your sustainability journey</h2>
            </Reveal>
            <Stagger className="mt-14 grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {home.why_choose.map((w, i) => (
                <StaggerItem key={i}>
                  <div className="bg-white border border-black/5 rounded-lg p-8 h-full">
                    <div className="text-5xl font-serif text-light-mint">{String(i + 1).padStart(2, "0")}</div>
                    <h3 className="mt-4 text-xl text-deep-forest-green font-sans font-medium">{w.title}</h3>
                    <p className="mt-3 text-charcoal/70 leading-relaxed text-sm">{w.text}</p>
                  </div>
                </StaggerItem>
              ))}
            </Stagger>
          </div>
        </section>
      )}

      {/* TEAM */}
      {sections.team !== false && d.team?.length > 0 && (
        <section className="py-24 md:py-32 bg-warm-beige">
          <div className="max-w-[1400px] mx-auto px-6 md:px-12">
            <div className="flex items-end justify-between flex-wrap gap-4">
              <Reveal><Overline>Key People</Overline>
                <h2 className="mt-4 text-4xl md:text-5xl font-serif text-deep-forest-green">Meet the team</h2>
              </Reveal>
              <Link to="/team" className="inline-flex items-center gap-2 text-deep-forest-green font-medium hover:gap-3 transition-all">
                Full team <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <Stagger className="mt-14 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-8">
              {d.team.map((m) => (
                <StaggerItem key={m.id}>
                  <div className="text-center flex flex-col items-center">
                    <TeamAvatar name={m.name} image={m.profile_image} size="h-24 w-24" />
                    <h3 className="mt-4 text-lg text-deep-forest-green font-sans font-medium">{m.name}</h3>
                    <p className="text-xs text-charcoal/60">{m.designation}</p>
                  </div>
                </StaggerItem>
              ))}
            </Stagger>
          </div>
        </section>
      )}

      {/* BLOG */}
      {sections.blog !== false && d.blogs?.length > 0 && (
        <section className="py-24 md:py-32">
          <div className="max-w-[1400px] mx-auto px-6 md:px-12">
            <Reveal><Overline>Insights</Overline>
              <h2 className="mt-4 text-4xl md:text-5xl font-serif text-deep-forest-green">Latest from RES</h2>
            </Reveal>
            <Stagger className="mt-14 grid md:grid-cols-3 gap-6">
              {d.blogs.map((b) => (
                <StaggerItem key={b.id}>
                  <Link to={`/blog/${b.slug}`} className="group block bg-white border border-black/5 rounded-lg overflow-hidden h-full">
                    {b.cover_image && <div className="aspect-[16/10] overflow-hidden bg-warm-beige"><img src={b.cover_image} alt={b.title} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-700" /></div>}
                    <div className="p-6">
                      {b.category && <CertBadge>{b.category}</CertBadge>}
                      <h3 className="mt-3 text-xl text-deep-forest-green leading-snug">{b.title}</h3>
                      <p className="mt-2 text-sm text-charcoal/60 line-clamp-2">{b.excerpt}</p>
                    </div>
                  </Link>
                </StaggerItem>
              ))}
            </Stagger>
          </div>
        </section>
      )}

      {/* CONTACT CTA */}
      {sections.contact_cta !== false && (
        <section className="py-24 md:py-32 bg-deep-forest-green text-off-white">
          <div className="max-w-[1400px] mx-auto px-6 md:px-12 text-center flex flex-col items-center">
            <Reveal>
              <h2 className="text-4xl md:text-6xl font-serif max-w-4xl leading-tight">{home.contact_cta_heading || "Ready to start your sustainability journey?"}</h2>
              <p className="mt-6 text-light-mint/85 text-lg max-w-2xl mx-auto">{home.contact_cta_text}</p>
              <Link to="/contact" data-testid="home-contact-cta" className="mt-10 inline-flex items-center gap-2 rounded-full bg-off-white text-deep-forest-green px-8 py-4 font-medium hover:bg-light-mint transition-colors">
                Contact us <ArrowRight className="h-4 w-4" />
              </Link>
            </Reveal>
          </div>
        </section>
      )}
    </div>
  );
}
