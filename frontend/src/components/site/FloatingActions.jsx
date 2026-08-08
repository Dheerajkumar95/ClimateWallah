import React from "react";
import { Link, useLocation } from "react-router-dom";
import { MessageCircle, CalendarCheck } from "lucide-react";
import { useSettings } from "@/context/SettingsContext";

export function FloatingActions() {
  const { settings } = useSettings();
  const { pathname } = useLocation();
  if (pathname.startsWith("/admin")) return null;

  const phone = (settings?.primary_phone || "").replace(/[^0-9]/g, "");
  const waUrl = phone ? `https://wa.me/${phone}?text=${encodeURIComponent("Hello RES, I'd like to know more about your sustainability services.")}` : null;

  return (
    <div className="fixed z-[60] bottom-5 right-5 flex flex-col items-end gap-3">
      <Link
        to="/book"
        data-testid="sticky-book-cta"
        className="hidden sm:inline-flex items-center gap-2 rounded-full bg-deep-forest-green text-off-white pl-5 pr-6 py-3 shadow-lg hover:bg-natural-green transition-colors"
      >
        <CalendarCheck className="h-5 w-5" /> Book Free Consultation
      </Link>
      {waUrl && (
        <a
          href={waUrl}
          target="_blank"
          rel="noreferrer"
          data-testid="whatsapp-button"
          aria-label="Chat on WhatsApp"
          className="h-14 w-14 rounded-full bg-[#25D366] text-white flex items-center justify-center shadow-lg hover:scale-105 transition-transform"
        >
          <MessageCircle className="h-7 w-7" />
        </a>
      )}
    </div>
  );
}
