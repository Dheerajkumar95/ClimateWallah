import React, { useEffect, useState } from "react";
import { ArrowRight, Award, Building2, Loader2, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { Card, PageHeader } from "./ui";

const ICONS = { IGBC: Building2, WELL: ShieldCheck, LEED: Award };

export default function CertificationTypeSelection() {
  const [items, setItems] = useState(null);

  useEffect(() => {
    api.get("/public/certification-types")
      .then(({ data }) => setItems(data))
      .catch(() => setItems([]));
  }, []);

  if (items === null) {
    return <div className="flex justify-center py-24"><Loader2 className="h-7 w-7 animate-spin text-[#27F580]" /></div>;
  }

  return (
    <div data-testid="certification-type-selection">
      <PageHeader
        title="Choose a certification pathway"
        subtitle="Select the rating system for your new project. The project checklist and review fee will follow this selection."
      />

      {items.length === 0 ? (
        <Card className="py-14 text-center text-[#667085]">No certification pathway is currently available.</Card>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {items.map((item) => {
            const Icon = ICONS[item.code] || Award;
            return (
              <Link
                key={item.code}
                to={`/portal/projects/new/${item.code}`}
                className="group relative overflow-hidden rounded-2xl border border-[#E4E7EC] bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:border-[#27F580] hover:shadow-lg"
                data-testid={`certification-type-${item.code}`}
              >
                <div className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: item.accent || "#27F580" }} />
                <span className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-[#E9FFF2] text-[#172033]">
                  <Icon className="h-6 w-6" />
                </span>
                <div className="text-xl font-semibold text-[#111827]">{item.name}</div>
                <div className="mt-1 text-xs font-medium uppercase tracking-wide text-[#667085]">{item.full_name}</div>
                <p className="mt-4 min-h-12 text-sm leading-6 text-[#667085]">{item.description}</p>
                <div className="mt-6 flex items-center justify-between border-t border-[#E4E7EC] pt-4">
                  <span className="text-xs text-[#667085]">{item.configured_project_types?.length || 0} project types configured</span>
                  <span className="flex items-center gap-1 text-sm font-semibold text-[#172033]">Continue <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></span>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <div className="mt-6 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
        You can review all project details before creating it. Fees are shown only when the completed assessment is submitted for review.
      </div>
    </div>
  );
}
