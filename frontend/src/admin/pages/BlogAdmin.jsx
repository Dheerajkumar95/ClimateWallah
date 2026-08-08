import React from "react";
import { ResourceManager } from "@/admin/components/ResourceManager";

const badge = (text, on) => (
  <span className={`text-xs px-2.5 py-1 rounded-full ${on ? "bg-light-mint text-deep-forest-green" : "bg-charcoal/10 text-charcoal/60"}`}>{text}</span>
);

export default function BlogAdmin() {
  return (
    <ResourceManager
      testid="admin-blog"
      title="Blog / Insights"
      subtitle="Publish verified articles and insights."
      coll="blog_posts"
      defaults={{ status: "draft", featured: false, display_order: 0 }}
      columns={[
        { key: "title", label: "Title" },
        { key: "category", label: "Category" },
        { key: "status", label: "Status", render: (it) => badge(it.status, it.status === "published") },
        { key: "featured", label: "Featured", render: (it) => badge(it.featured ? "Featured" : "—", it.featured) },
      ]}
      fields={[
        { name: "title", label: "Title", type: "text" },
        { name: "slug", label: "Slug", type: "text", help: "Leave blank to auto-generate." },
        { name: "category", label: "Category", type: "text" },
        { name: "author", label: "Author", type: "text" },
        { name: "excerpt", label: "Excerpt", type: "textarea" },
        { name: "cover_image", label: "Cover image", type: "image" },
        { name: "content", label: "Content", type: "html", rows: 12 },
        { name: "status", label: "Status", type: "select", options: [{ value: "draft", label: "Draft" }, { value: "published", label: "Published" }] },
        { name: "featured", label: "Featured", type: "switch" },
        { name: "seo_title", label: "SEO title", type: "text" },
        { name: "seo_description", label: "SEO description", type: "textarea" },
      ]}
    />
  );
}
