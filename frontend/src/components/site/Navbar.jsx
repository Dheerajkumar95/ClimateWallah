import React, { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { Menu, X, Leaf, ChevronDown, ArrowUpRight, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useSettings } from "@/context/SettingsContext";
import { publicApi } from "@/lib/api";

const topic = (label) => `/contact?topic=${encodeURIComponent(label)}`;

const TOOLS_MENU = [
  { title: "Tools & Calculators", items: [
    { label: "GHG Accounting", to: topic("GHG Accounting") },
    { label: "LCA", to: topic("Life Cycle Assessment (LCA)") },
  ]},
  { title: "Compliance", items: [
    { label: "CBAM", to: topic("CBAM") }, { label: "CCTS", to: topic("CCTS") },
    { label: "EPR", to: topic("EPR") }, { label: "EIA", to: topic("EIA") }, { label: "RPO", to: topic("RPO") },
  ]},
  { title: "ESG Reporting", items: [
    { label: "BRSR", to: topic("BRSR Reporting") }, { label: "GRI", to: topic("GRI Reporting") },
    { label: "IFRS", to: topic("IFRS Sustainability") }, { label: "SASB", to: topic("SASB") },
  ]},
  { title: "Certifications", items: [
    { label: "IGBC", to: "/certification-finder" }, { label: "LEED", to: "/certification-finder" },
    { label: "GRIHA", to: "/certification-finder" }, { label: "GNFZ", to: "/certification-finder" },
    { label: "ISO Standards", to: topic("ISO Standards") },
  ]},
];

const NAV = [
  { to: "/", label: "Home" },
  { to: "/about", label: "About" },
  { to: "/projects", label: "Projects" },
  { label: "Services", menu: "services" },
  { label: "Tools", menu: "tools" },
  { to: "/events", label: "Events" },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [mega, setMega] = useState(null); // 'services' | 'tools' | null
  const [services, setServices] = useState([]);
  const { settings } = useSettings();
  const location = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => { setOpen(false); setMega(null); }, [location.pathname]);
  useEffect(() => { publicApi.get("/services").then((r) => setServices(r.data || [])).catch(() => {}); }, []);

  const isHome = location.pathname === "/";
  const solid = true;
  const textColor = "text-deep-forest-green";

  return (
    <header
      data-testid="navbar"
      onMouseLeave={() => setMega(null)}
      className={`fixed top-0 left-0 right-0 z-50 transition-colors duration-300 ${
        solid ? "backdrop-blur-xl bg-off-white/90 border-b border-border/40" : "bg-transparent"
      }`}
    >
      <div className="max-w-[1400px] mx-auto px-6 md:px-12">
        <div className="flex items-center justify-between h-20">
          <Link to="/" data-testid="navbar-logo" className={`flex items-center gap-2.5 ${textColor}`}>
            <span className={`h-9 w-9 rounded-full flex items-center justify-center ${solid ? "bg-deep-forest-green text-off-white" : "bg-off-white/20 text-off-white"}`}>
              <Leaf className="h-5 w-5" strokeWidth={1.75} />
            </span>
            <span className="font-serif text-2xl leading-none">{settings?.short_name || "RES"}</span>
          </Link>

          <nav className="hidden lg:flex items-center gap-8">
            {NAV.map((l) => l.menu ? (
              <button
                key={l.label}
                onMouseEnter={() => setMega(l.menu)}
                data-testid={`nav-link-${l.label.toLowerCase()}`}
                className={`flex items-center gap-1 text-sm font-medium tracking-wide transition-opacity hover:opacity-70 ${textColor} ${mega === l.menu ? "opacity-100" : "opacity-80"}`}
              >
                {l.label} <ChevronDown className={`h-3.5 w-3.5 transition-transform ${mega === l.menu ? "rotate-180" : ""}`} />
              </button>
            ) : (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.to === "/"}
                onMouseEnter={() => setMega(null)}
                data-testid={`nav-link-${l.label.toLowerCase()}`}
                className={({ isActive }) => `text-sm font-medium tracking-wide transition-opacity hover:opacity-70 ${textColor} ${isActive ? "opacity-100" : "opacity-80"}`}
              >
                {l.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <Link to="/book" data-testid="navbar-cta"
              className="hidden lg:inline-flex items-center rounded-full bg-deep-forest-green text-off-white px-5 py-2.5 text-sm font-medium hover:bg-natural-green transition-colors">
              Book a Demo
            </Link>
            <Link to="/portal/login" data-testid="navbar-login"
              className={`hidden lg:inline-flex items-center rounded-full border px-5 py-2.5 text-sm font-semibold transition-colors ${solid ? "border-deep-forest-green text-deep-forest-green hover:bg-deep-forest-green hover:text-off-white" : "border-off-white/70 text-off-white hover:bg-off-white hover:text-deep-forest-green"}`}>
              Login
            </Link>
            <button className={`lg:hidden ${textColor}`} onClick={() => setOpen((v) => !v)} data-testid="mobile-menu-toggle" aria-label="Toggle menu">
              {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mega menus (desktop) */}
      <AnimatePresence>
        {mega && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="hidden lg:block absolute left-0 right-0 top-20"
            data-testid={`mega-${mega}`}
          >
            <div className="max-w-[1400px] mx-auto px-6 md:px-12">
              <div className="rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-[#101827] text-off-white">
                {mega === "tools" ? (
                  <div>
                    <div className="px-8 py-4 border-b border-white/10 text-xs font-semibold tracking-[0.2em] text-natural-green">TOOLS &amp; PLATFORM</div>
                    <div className="grid grid-cols-4 gap-8 p-8">
                      {TOOLS_MENU.map((col) => (
                        <div key={col.title}>
                          <div className="text-xs font-semibold tracking-[0.15em] text-natural-green uppercase mb-4">{col.title}</div>
                          <ul className="space-y-2.5">
                            {col.items.map((it) => (
                              <li key={it.label}>
                                <Link to={it.to} className="group inline-flex items-center gap-1.5 text-sm text-off-white/75 hover:text-off-white transition-colors">
                                  {it.label}
                                  <ArrowUpRight className="h-3.5 w-3.5 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                                </Link>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="px-8 py-4 border-b border-white/10 flex items-center justify-between">
                      <div>
                        <div className="text-xs font-semibold tracking-[0.2em] text-natural-green">SERVICES</div>
                        <div className="text-xs text-off-white/50 mt-0.5">Explore how RES can support your sustainability goals</div>
                      </div>
                      <Link to="/services" className="text-xs text-off-white/70 hover:text-off-white inline-flex items-center gap-1">All services <ArrowRight className="h-3.5 w-3.5" /></Link>
                    </div>
                    <div className="grid grid-cols-2 xl:grid-cols-3 gap-4 p-8 max-h-[60vh] overflow-y-auto">
                      {(services.length ? services : []).map((s) => (
                        <Link key={s.id} to={`/services/${s.slug}`} className="group rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 p-4 transition-colors">
                          <div className="text-sm font-medium text-off-white group-hover:text-natural-green transition-colors">{s.title}</div>
                          {s.short_description && <div className="text-xs text-off-white/55 mt-1.5 line-clamp-2">{s.short_description}</div>}
                          <div className="mt-3 inline-flex items-center gap-1 text-xs text-natural-green">Learn more <ArrowUpRight className="h-3.5 w-3.5" /></div>
                        </Link>
                      ))}
                      <Link to="/book" className="rounded-xl bg-natural-green/15 hover:bg-natural-green/25 border border-natural-green/30 p-4 flex flex-col justify-center transition-colors">
                        <div className="text-sm font-semibold text-off-white">Not sure where to start?</div>
                        <div className="text-xs text-off-white/60 mt-1">Book a free demo and we'll map your path.</div>
                        <div className="mt-3 inline-flex items-center gap-1 text-xs text-natural-green font-medium">Book a Demo <ArrowRight className="h-3.5 w-3.5" /></div>
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile menu */}
      <AnimatePresence>
        {open && (
          <motion.nav
            initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="lg:hidden bg-off-white border-t border-border/40 overflow-hidden" data-testid="mobile-menu"
          >
            <div className="px-6 py-4 flex flex-col">
              {[{ to: "/", label: "Home" }, { to: "/about", label: "About" }, { to: "/projects", label: "Projects" }, { to: "/services", label: "Services" }, { to: "/certification-finder", label: "Tools" }, { to: "/events", label: "Events" }].map((l) => (
                <NavLink key={l.label} to={l.to} end={l.to === "/"} className="py-3 text-deep-forest-green text-lg border-b border-border/30">
                  {l.label}
                </NavLink>
              ))}
              <div className="flex gap-3 pt-4">
                <Link to="/book" className="flex-1 text-center rounded-full bg-deep-forest-green text-off-white px-5 py-3 text-sm font-medium">Book a Demo</Link>
                <Link to="/portal/login" className="flex-1 text-center rounded-full border border-deep-forest-green text-deep-forest-green px-5 py-3 text-sm font-semibold">Login</Link>
              </div>
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
