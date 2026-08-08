import React from "react";
import { SingletonEditor } from "@/admin/components/SingletonEditor";

export default function Seo() {
  return (
    <SingletonEditor
      testid="admin-seo"
      title="SEO Settings"
      subtitle="Default metadata used across the website."
      coll="seo_settings"
      fields={[
        { name: "default_title", label: "Default title", full: true },
        { name: "default_description", label: "Default description", type: "textarea", full: true },
        { name: "default_keywords", label: "Default keywords", type: "textarea", full: true },
        { name: "og_image", label: "Social sharing image", type: "image", full: true },
      ]}
    />
  );
}
