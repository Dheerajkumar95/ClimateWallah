import { useEffect } from "react";
import { useSettings } from "@/context/SettingsContext";

export function Seo({ title, description, image, path }) {
  const { seo } = useSettings();
  useEffect(() => {
    const t = title ? `${title} | RES` : seo?.default_title || "Resilient Earth Solutions";
    document.title = t;
    const setMeta = (attr, key, val) => {
      if (!val) return;
      let el = document.head.querySelector(`meta[${attr}="${key}"]`);
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attr, key);
        document.head.appendChild(el);
      }
      el.setAttribute("content", val);
    };
    const desc = description || seo?.default_description || "";
    setMeta("name", "description", desc);
    setMeta("property", "og:title", t);
    setMeta("property", "og:description", desc);
    setMeta("property", "og:type", "website");
    setMeta("property", "og:image", image || seo?.og_image || "");
    let canonical = document.head.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.setAttribute("rel", "canonical");
      document.head.appendChild(canonical);
    }
    canonical.setAttribute("href", `${window.location.origin}${path || window.location.pathname}`);
  }, [title, description, image, path, seo]);
  return null;
}
