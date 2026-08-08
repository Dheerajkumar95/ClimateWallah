import React from "react";
import { Link } from "react-router-dom";
import { Leaf, Linkedin, Facebook, Instagram, Youtube, Mail, Phone, MapPin } from "lucide-react";
import { useSettings } from "@/context/SettingsContext";

export function Footer() {
  const { settings } = useSettings();
  const socials = [
    { url: settings?.linkedin_url, Icon: Linkedin },
    { url: settings?.facebook_url, Icon: Facebook },
    { url: settings?.instagram_url, Icon: Instagram },
    { url: settings?.youtube_url, Icon: Youtube },
  ].filter((s) => s.url);

  return (
    <footer data-testid="site-footer" className="bg-deep-forest-green text-light-mint">
      <div className="max-w-[1400px] mx-auto px-6 md:px-12 pt-24 pb-12">
        <div className="grid md:grid-cols-12 gap-12">
          <div className="md:col-span-5">
            <div className="flex items-center gap-2.5 text-off-white mb-6">
              <span className="h-9 w-9 rounded-full bg-off-white/15 flex items-center justify-center">
                <Leaf className="h-5 w-5" strokeWidth={1.75} />
              </span>
              <span className="font-serif text-2xl">{settings?.short_name || "RES"}</span>
            </div>
            <p className="text-light-mint/80 max-w-sm leading-relaxed">
              {settings?.footer_text || "Sustainability consulting for a greener, cleaner future."}
            </p>
            {settings?.cin && (
              <p className="mt-6 text-xs text-light-mint/50 tracking-wide">CIN: {settings.cin}</p>
            )}
            {socials.length > 0 && (
              <div className="flex gap-3 mt-6">
                {socials.map(({ url, Icon }, i) => (
                  <a key={i} href={url} target="_blank" rel="noreferrer" className="h-10 w-10 rounded-full bg-off-white/10 flex items-center justify-center hover:bg-off-white/20 transition-colors">
                    <Icon className="h-4 w-4" />
                  </a>
                ))}
              </div>
            )}
          </div>

          <div className="md:col-span-3">
            <h4 className="text-off-white font-sans font-semibold text-sm uppercase tracking-widest mb-5">Explore</h4>
            <ul className="space-y-3 text-light-mint/80">
              {[["/about","About"],["/services","Services"],["/projects","Projects"],["/team","Team"],["/blog","Insights"],["/contact","Contact"]].map(([to,label]) => (
                <li key={to}><Link to={to} className="hover:text-off-white transition-colors">{label}</Link></li>
              ))}
            </ul>
          </div>

          <div className="md:col-span-4">
            <h4 className="text-off-white font-sans font-semibold text-sm uppercase tracking-widest mb-5">Get in touch</h4>
            <ul className="space-y-4 text-light-mint/80 text-sm">
              {settings?.primary_phone && (
                <li className="flex items-start gap-3"><Phone className="h-4 w-4 mt-0.5 shrink-0" /><span>{settings.primary_phone}{settings?.secondary_phone ? `, ${settings.secondary_phone}` : ""}</span></li>
              )}
              {settings?.primary_email && (
                <li className="flex items-start gap-3"><Mail className="h-4 w-4 mt-0.5 shrink-0" /><a href={`mailto:${settings.primary_email}`} className="hover:text-off-white break-all">{settings.primary_email}</a></li>
              )}
              {settings?.corporate_address && (
                <li className="flex items-start gap-3"><MapPin className="h-4 w-4 mt-0.5 shrink-0" /><span>{settings.corporate_address}</span></li>
              )}
            </ul>
          </div>
        </div>

        <div className="mt-20 border-t border-off-white/10 pt-8">
          <div className="text-[13vw] md:text-[8vw] leading-none font-serif text-off-white/10 select-none tracking-tight">
            RESILIENT EARTH
          </div>
        </div>

        <div className="mt-8 flex flex-col md:flex-row justify-between gap-4 text-xs text-light-mint/50">
          <span>{settings?.copyright_text || "© 2026 Resilient Earth Solutions Pvt. Ltd."}</span>
          <div className="flex gap-6">
            <Link to="/legal/privacy-policy" className="hover:text-off-white">Privacy Policy</Link>
            <Link to="/legal/terms-and-conditions" className="hover:text-off-white">Terms</Link>
            <Link to="/legal/cookie-policy" className="hover:text-off-white">Cookies</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
