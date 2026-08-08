import React from "react";
import { SingletonEditor } from "@/admin/components/SingletonEditor";

export default function AboutAdmin() {
  return (
    <SingletonEditor
      testid="admin-about"
      title="About Page"
      subtitle="Company profile, mission, values and credentials."
      coll="about"
      fields={[
        { name: "heading", label: "Heading", full: true },
        { name: "motto", label: "Motto" },
        { name: "cin", label: "CIN" },
        { name: "intro", label: "Introduction", type: "textarea", rows: 6, full: true },
        { name: "mission", label: "Mission", type: "textarea", full: true },
        { name: "commitment", label: "Sustainability commitment", type: "textarea", full: true },
        { name: "approach", label: "Approach", type: "textarea", full: true },
        { name: "image", label: "About image", type: "image", full: true },
        { name: "values", label: "Values", type: "tags", full: true, placeholder: "Add a value" },
        { name: "credentials", label: "Credentials", type: "tags", full: true },
        { name: "collaborations", label: "Industry collaborations", type: "tags", full: true },
      ]}
    />
  );
}
