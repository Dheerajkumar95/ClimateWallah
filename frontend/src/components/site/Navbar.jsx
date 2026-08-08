import React, { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { Menu, X, Leaf } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useSettings } from "@/context/SettingsContext";

const LINKS = [
  { to: "/", label: "Home" },
  { to: "/about", label: "About" },
  { to: "/services", label: "Services" },
  { to: "/industries", label: "Industries" },
  { to: "/projects", label: "Projects" },
  { to: "/resources", label: "Resources" },
  { to: "/blog", label: "Insights" },
  { to: "/contact", label: "Contact" },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const { settings } = useSettings();
  const location = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => { setOpen(false); }, [location.pathname]);

  const isHome = location.pathname === "/";
  const solid = scrolled || !isHome || open;
  const textColor = solid ? "text-deep-forest-green" : "text-off-white";

  return (
    <header
      data-testid="navbar"
      className={`fixed top-0 left-0 right-0 z-50 transition-colors duration-300 ${
        solid ? "backdrop-blur-xl bg-off-white/85 border-b border-border/40" : "bg-transparent"
      }`}
    >
      <div className="max-w-[1400px] mx-auto px-6 md:px-12">
        <div className="flex items-center justify-between h-20">
          <Link to="/" data-testid="navbar-logo" className={`flex items-center gap-2.5 ${textColor}`}>
            <span className={`h-9 w-9 rounded-full flex items-center justify-center ${solid ? "bg-deep-forest-green text-off-white" : "bg-off-white/20 text-off-white"}`}>
              <Leaf className="h-5 w-5" strokeWidth={1.75} />
            </span>
            <span className="font-serif text-2xl leading-none">
              {settings?.short_name || "RES"}
            </span>
          </Link>

          <nav className="hidden lg:flex items-center gap-8">
            {LINKS.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.to === "/"}
                data-testid={`nav-link-${l.label.toLowerCase()}`}
                className={({ isActive }) =>
                  `text-sm font-medium tracking-wide transition-opacity hover:opacity-70 ${textColor} ${
                    isActive ? "opacity-100" : "opacity-80"
                  }`
                }
              >
                {l.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <Link
              to="/book"
              data-testid="navbar-cta"
              className="hidden lg:inline-flex items-center rounded-full bg-deep-forest-green text-off-white px-6 py-2.5 text-sm font-medium hover:bg-natural-green transition-colors"
            >
              Book Consultation
            </Link>
            <button
              className={`lg:hidden ${textColor}`}
              onClick={() => setOpen((v) => !v)}
              data-testid="mobile-menu-toggle"
              aria-label="Toggle menu"
            >
              {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.nav
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="lg:hidden bg-off-white border-t border-border/40 overflow-hidden"
            data-testid="mobile-menu"
          >
            <div className="px-6 py-4 flex flex-col">
              {LINKS.map((l) => (
                <NavLink
                  key={l.to}
                  to={l.to}
                  end={l.to === "/"}
                  className="py-3 text-deep-forest-green text-lg border-b border-border/30 last:border-0"
                >
                  {l.label}
                </NavLink>
              ))}
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
