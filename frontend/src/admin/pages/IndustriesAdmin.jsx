import React from "react";
import { ResourceManager } from "@/admin/components/ResourceManager";
const badge = (t, on) => <span className={`text-xs px-2.5 py-1 rounded-full ${on ? "bg-light-mint text-deep-forest-green" : "bg-charcoal/10 text-charcoal/60"}`}>{t}</span>;

export default function IndustriesAdmin() {
  return (
    <ResourceManager testid="admin-industries" title="Industries (Who We Serve)" subtitle="Manage industry pages." coll="industries"
      defaults={{ active: true, challenges: [], solutions: [], related_services: [], display_order: 0 }}
      columns={[{ key: "title", label: "Title" }, { key: "slug", label: "Slug" }, { key: "active", label: "Status", render: (it) => badge(it.active ? "Active" : "Inactive", it.active) }, { key: "display_order", label: "Order" }]}
      fields={[
        { name: "title", label: "Title", type: "text" },
        { name: "slug", label: "Slug", type: "text", help: "Leave blank to auto-generate." },
        { name: "intro", label: "Introduction", type: "textarea" },
        { name: "image", label: "Image", type: "image" },
        { name: "challenges", label: "Industry challenges", type: "tags", placeholder: "Add a challenge" },
        { name: "solutions", label: "Suggested solutions", type: "tags", placeholder: "Add a solution" },
        { name: "related_services", label: "Related services", type: "tags", placeholder: "Service name" },
        { name: "display_order", label: "Display order", type: "number" },
        { name: "active", label: "Active", type: "switch" },
        { name: "seo_title", label: "SEO title", type: "text" },
        { name: "seo_description", label: "SEO description", type: "textarea" },
      ]} />
  );
}
