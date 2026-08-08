import React from "react";
import { ResourceManager } from "@/admin/components/ResourceManager";
const badge = (t, on) => <span className={`text-xs px-2.5 py-1 rounded-full ${on ? "bg-light-mint text-deep-forest-green" : "bg-charcoal/10 text-charcoal/60"}`}>{t}</span>;

export default function MethodologyAdmin() {
  return (
    <ResourceManager testid="admin-methodology" title="Methodology" subtitle="Manage the RES working methodology steps." coll="methodology_steps"
      defaults={{ active: true, display_order: 0 }}
      columns={[{ key: "title", label: "Step" }, { key: "icon", label: "Icon" }, { key: "active", label: "Status", render: (it) => badge(it.active ? "Active" : "Inactive", it.active) }, { key: "display_order", label: "Order" }]}
      fields={[
        { name: "title", label: "Step title", type: "text" },
        { name: "description", label: "Description", type: "textarea" },
        { name: "icon", label: "Icon (lucide name)", type: "text", help: "e.g. route, search-check, hammer" },
        { name: "display_order", label: "Display order", type: "number" },
        { name: "active", label: "Active", type: "switch" },
      ]} />
  );
}
