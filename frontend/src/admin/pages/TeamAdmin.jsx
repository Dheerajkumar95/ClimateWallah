import React from "react";
import { ResourceManager } from "@/admin/components/ResourceManager";

const badge = (text, on) => (
  <span className={`text-xs px-2.5 py-1 rounded-full ${on ? "bg-light-mint text-deep-forest-green" : "bg-charcoal/10 text-charcoal/60"}`}>{text}</span>
);

export default function TeamAdmin() {
  return (
    <ResourceManager
      testid="admin-team"
      title="Team"
      subtitle="Manage key people. Use initials placeholder or upload a photo."
      coll="team_members"
      defaults={{ active: true, display_order: 0 }}
      columns={[
        { key: "name", label: "Name" },
        { key: "designation", label: "Designation" },
        { key: "credentials", label: "Credentials" },
        { key: "active", label: "Status", render: (it) => badge(it.active ? "Active" : "Inactive", it.active) },
      ]}
      fields={[
        { name: "name", label: "Name", type: "text" },
        { name: "designation", label: "Designation", type: "text" },
        { name: "credentials", label: "Credentials", type: "text", help: "e.g. IGBC AP, LEED AP" },
        { name: "biography", label: "Biography", type: "textarea", rows: 5 },
        { name: "profile_image", label: "Profile image (optional)", type: "image", help: "Leave blank to show initials placeholder." },
        { name: "linkedin_url", label: "LinkedIn URL", type: "text" },
        { name: "display_order", label: "Display order", type: "number" },
        { name: "active", label: "Active", type: "switch" },
      ]}
    />
  );
}
