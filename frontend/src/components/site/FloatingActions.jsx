import React from "react";
import { useLocation } from "react-router-dom";
import { MessageCircle } from "lucide-react";
import { useSettings } from "@/context/SettingsContext";

export function FloatingActions() {
  const { settings } = useSettings();
  const { pathname } = useLocation();
  if (pathname.startsWith("/admin")) return null;

  const phone = (settings?.primary_phone || "").replace(/[^0-9]/g, "");
  const waUrl = phone ? `https://wa.me/${phone}?text=${encodeURIComponent("Hello RES, I'd like to know more about your sustainability services.")}` : null;

  return (
    <div className="fixed z-[60] bottom-5 right-5 flex flex-col items-end gap-3">
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
