import React from "react";
import { ResourceManager } from "@/admin/components/ResourceManager";
const badge = (t, on) => <span className={`text-xs px-2.5 py-1 rounded-full ${on ? "bg-light-mint text-deep-forest-green" : "bg-charcoal/10 text-charcoal/60"}`}>{t}</span>;

export default function ResourcesAdmin() {
  return (
    <ResourceManager testid="admin-resources" title="Resource Centre" subtitle="Guides, brochures, checklists and case studies." coll="resources"
      defaults={{ status: "published", featured: false, require_lead: false, download_count: 0, display_order: 0 }}
      columns={[{ key: "title", label: "Title" }, { key: "category", label: "Category" }, { key: "download_count", label: "Downloads" }, { key: "status", label: "Status", render: (it) => badge(it.status, it.status === "published") }]}
      fields={[
        { name: "title", label: "Title", type: "text" },
        { name: "category", label: "Category", type: "text", help: "e.g. Guide, Checklist, Case Study, Brochure" },
        { name: "short_description", label: "Short description", type: "textarea" },
        { name: "thumbnail", label: "Thumbnail", type: "image" },
        { name: "file_url", label: "Document", type: "document" },
        { name: "require_lead", label: "Require lead capture before download", type: "switch" },
        { name: "featured", label: "Featured", type: "switch" },
        { name: "status", label: "Status", type: "select", options: [{ value: "published", label: "Published" }, { value: "draft", label: "Draft" }] },
        { name: "display_order", label: "Display order", type: "number" },
      ]} />
  );
}
