import React from "react";
import { ResourceManager } from "@/admin/components/ResourceManager";
const badge = (t, on) => <span className={`text-xs px-2.5 py-1 rounded-full ${on ? "bg-light-mint text-deep-forest-green" : "bg-charcoal/10 text-charcoal/60"}`}>{t}</span>;

export function PartnersAdmin() {
  return (
    <ResourceManager testid="admin-partners" title="Partners & Collaborations" subtitle="Manage industry collaborations and partner logos." coll="partners"
      defaults={{ active: true, display_order: 0 }}
      columns={[{ key: "name", label: "Name" }, { key: "partner_type", label: "Type" }, { key: "active", label: "Status", render: (it) => badge(it.active ? "Active" : "Inactive", it.active) }]}
      fields={[
        { name: "name", label: "Partner name", type: "text" },
        { name: "logo", label: "Logo", type: "image" },
        { name: "partner_type", label: "Partner type", type: "text" },
        { name: "website_url", label: "Website URL", type: "text" },
        { name: "description", label: "Description", type: "textarea" },
        { name: "display_order", label: "Display order", type: "number" },
        { name: "active", label: "Active", type: "switch" },
      ]} />
  );
}

export function EventsAdmin() {
  return (
    <ResourceManager testid="admin-events" title="Events & Webinars" subtitle="Manage upcoming and past events." coll="events"
      defaults={{ active: true, featured: false, mode: "Online", display_order: 0 }}
      columns={[{ key: "title", label: "Title" }, { key: "event_date", label: "Date" }, { key: "mode", label: "Mode" }, { key: "active", label: "Status", render: (it) => badge(it.active ? "Active" : "Hidden", it.active) }]}
      fields={[
        { name: "title", label: "Title", type: "text" },
        { name: "description", label: "Description", type: "textarea" },
        { name: "event_date", label: "Date & time (YYYY-MM-DDTHH:MM)", type: "text", help: "e.g. 2026-10-15T15:00" },
        { name: "speaker", label: "Speaker", type: "text" },
        { name: "mode", label: "Mode", type: "select", options: ["Online", "Offline"] },
        { name: "venue", label: "Venue / meeting link", type: "text" },
        { name: "registration_url", label: "Registration URL", type: "text" },
        { name: "recording_url", label: "Recording URL", type: "text" },
        { name: "cover_image", label: "Cover image", type: "image" },
        { name: "featured", label: "Featured", type: "switch" },
        { name: "active", label: "Visible", type: "switch" },
        { name: "display_order", label: "Display order", type: "number" },
      ]} />
  );
}

export function CertificationRulesAdmin() {
  return (
    <ResourceManager testid="admin-cert-rules" title="Certification Rules" subtitle="Configure the Certification Finder matching logic." coll="certification_rules"
      defaults={{ active: true, building_types: [], construction_types: [], priorities: [], display_order: 0 }}
      columns={[{ key: "framework", label: "Framework" }, { key: "active", label: "Status", render: (it) => badge(it.active ? "Active" : "Inactive", it.active) }, { key: "display_order", label: "Order" }]}
      fields={[
        { name: "framework", label: "Framework name", type: "text", help: "e.g. LEED, IGBC" },
        { name: "blurb", label: "Why it may suit (shown to user)", type: "textarea" },
        { name: "building_types", label: "Applicable building types", type: "tags" },
        { name: "construction_types", label: "Construction types", type: "tags", placeholder: "New Construction / Existing Building / Interiors" },
        { name: "priorities", label: "Matching priorities", type: "tags" },
        { name: "display_order", label: "Display order", type: "number" },
        { name: "active", label: "Active", type: "switch" },
      ]} />
  );
}

export function AssessmentQuestionsAdmin() {
  return (
    <ResourceManager testid="admin-assessment-questions" title="Assessment Questions" subtitle="Manage readiness assessment questions (options seeded; edit text, category, weight)." coll="assessment_questions"
      defaults={{ active: true, weight: 1, display_order: 0, options: [] }}
      columns={[{ key: "category", label: "Category" }, { key: "text", label: "Question" }, { key: "weight", label: "Weight" }, { key: "active", label: "Active", render: (it) => badge(it.active ? "Active" : "Inactive", it.active) }]}
      fields={[
        { name: "category", label: "Category", type: "text" },
        { name: "text", label: "Question text", type: "textarea" },
        { name: "weight", label: "Weight", type: "number" },
        { name: "display_order", label: "Display order", type: "number" },
        { name: "active", label: "Active", type: "switch" },
      ]} />
  );
}
