import React from "react";
import { SingletonEditor } from "@/admin/components/SingletonEditor";

export default function Settings() {
  return (
    <SingletonEditor
      testid="admin-settings"
      title="Website Settings"
      subtitle="Company details, contact information and social links."
      coll="website_settings"
      fields={[
        { name: "company_name", label: "Company name" },
        { name: "short_name", label: "Short name" },
        { name: "cin", label: "CIN" },
        { name: "logo", label: "Logo", type: "image" },
        { name: "favicon", label: "Favicon", type: "image" },
        { name: "primary_phone", label: "Primary phone" },
        { name: "secondary_phone", label: "Secondary phone" },
        { name: "primary_email", label: "Primary email" },
        { name: "secondary_email", label: "Secondary email" },
        { name: "corporate_address", label: "Corporate address", type: "textarea", full: true },
        { name: "registered_address", label: "Registered address", type: "textarea", full: true },
        { name: "business_hours", label: "Business hours" },
        { name: "google_maps_url", label: "Google Maps URL" },
        { name: "linkedin_url", label: "LinkedIn URL" },
        { name: "facebook_url", label: "Facebook URL" },
        { name: "instagram_url", label: "Instagram URL" },
        { name: "youtube_url", label: "YouTube URL" },
        { name: "footer_text", label: "Footer text", type: "textarea", full: true },
        { name: "copyright_text", label: "Copyright text", full: true },
        { name: "credentials", label: "Credentials / Frameworks", type: "tags", full: true, placeholder: "e.g. LEED" },
        { name: "collaborations", label: "Industry collaborations", type: "tags", full: true, placeholder: "e.g. IGBC" },
      ]}
    />
  );
}
