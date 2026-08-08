import React from "react";
import { ResourceManager } from "@/admin/components/ResourceManager";

const badge = (text, on) => (
  <span className={`text-xs px-2.5 py-1 rounded-full ${on ? "bg-light-mint text-deep-forest-green" : "bg-charcoal/10 text-charcoal/60"}`}>{text}</span>
);

export default function ServicesAdmin() {
  return (
    <ResourceManager
      testid="admin-services"
      title="Services"
      subtitle="Manage sustainability service offerings."
      coll="services"
      defaults={{ active: true, features: [], display_order: 0 }}
      columns={[
        { key: "title", label: "Title" },
        { key: "slug", label: "Slug" },
        { key: "active", label: "Status", render: (it) => badge(it.active ? "Active" : "Inactive", it.active) },
        { key: "display_order", label: "Order" },
      ]}
      fields={[
        { name: "title", label: "Title", type: "text" },
        { name: "slug", label: "Slug", type: "text", help: "Leave blank to auto-generate from title." },
        { name: "icon", label: "Icon (lucide name, e.g. leaf, gauge, award)", type: "text" },
        { name: "image", label: "Image", type: "image" },
        { name: "short_description", label: "Short description", type: "textarea" },
        { name: "full_description", label: "Full description (overview)", type: "textarea", rows: 6 },
        { name: "client_problem", label: "Client problem being solved", type: "textarea" },
        { name: "features", label: "Key deliverables / features", type: "tags", placeholder: "Add a deliverable" },
        { name: "benefits", label: "Key benefits", type: "tags", placeholder: "Add a benefit" },
        { name: "methodology", label: "RES working methodology", type: "textarea", rows: 4 },
        { name: "applicable_industries", label: "Applicable industries", type: "tags", placeholder: "Add an industry" },
        { name: "standards", label: "Relevant certifications / standards", type: "tags", placeholder: "e.g. LEED" },
        { name: "faq_html", label: "FAQs (HTML)", type: "html", help: "Use <h4> for questions and <p> for answers." },
        { name: "display_order", label: "Display order", type: "number" },
        { name: "active", label: "Active", type: "switch" },
        { name: "seo_title", label: "SEO title", type: "text" },
        { name: "seo_description", label: "SEO description", type: "textarea" },
      ]}
    />
  );
}
