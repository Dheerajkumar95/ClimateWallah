import React from "react";
import { ResourceManager } from "@/admin/components/ResourceManager";

const badge = (text, on) => (
  <span className={`text-xs px-2.5 py-1 rounded-full ${on ? "bg-light-mint text-deep-forest-green" : "bg-charcoal/10 text-charcoal/60"}`}>{text}</span>
);

export default function ProjectsAdmin() {
  return (
    <ResourceManager
      testid="admin-projects"
      title="Projects"
      subtitle="Manage completed sustainability projects."
      coll="projects"
      defaults={{ status: "published", featured: false, gallery: [], display_order: 0 }}
      columns={[
        { key: "title", label: "Title" },
        { key: "location", label: "Location" },
        { key: "category", label: "Category" },
        { key: "status", label: "Status", render: (it) => badge(it.status, it.status === "published") },
        { key: "featured", label: "Featured", render: (it) => badge(it.featured ? "Featured" : "—", it.featured) },
      ]}
      fields={[
        { name: "title", label: "Title", type: "text" },
        { name: "slug", label: "Slug", type: "text", help: "Leave blank to auto-generate." },
        { name: "location", label: "Location", type: "text" },
        { name: "category", label: "Category", type: "text" },
        { name: "certification", label: "Certification", type: "text" },
        { name: "capacity", label: "Capacity", type: "text" },
        { name: "completion_date", label: "Completion date", type: "text" },
        { name: "cover_image", label: "Cover image", type: "image" },
        { name: "gallery", label: "Gallery image URLs", type: "tags", placeholder: "Add image URL" },
        { name: "short_description", label: "Short description", type: "textarea" },
        { name: "full_description", label: "Full description", type: "textarea", rows: 6 },
        { name: "status", label: "Status", type: "select", options: [{ value: "published", label: "Published" }, { value: "draft", label: "Draft" }] },
        { name: "featured", label: "Featured", type: "switch" },
        { name: "display_order", label: "Display order", type: "number" },
        { name: "seo_title", label: "SEO title", type: "text" },
        { name: "seo_description", label: "SEO description", type: "textarea" },
      ]}
    />
  );
}
