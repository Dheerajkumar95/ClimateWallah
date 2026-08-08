import React, { useEffect, useState } from "react";
import { Download, FileText } from "lucide-react";
import { toast } from "sonner";
import { publicApi } from "@/lib/api";
import { Seo } from "@/components/site/Seo";
import { Reveal, Stagger, StaggerItem } from "@/components/site/Reveal";
import { Overline, CertBadge } from "@/components/site/Bits";

export default function Resources() {
  const [data, setData] = useState({ items: [], categories: [] });
  const [cat, setCat] = useState("All");
  useEffect(() => { publicApi.get("/resources").then((r) => setData(r.data)).catch(() => {}); }, []);

  const download = async (r) => {
    try {
      const { data: res } = await publicApi.post(`/resources/${r.id}/download`, {});
      if (res.url) window.open(res.url, "_blank");
      else toast.info("This resource will be available for download soon.");
    } catch { toast.error("Download failed."); }
  };

  const items = cat === "All" ? data.items : data.items.filter((i) => i.category === cat);

  return (
    <div data-testid="resources-page">
      <Seo title="Resource Centre" description="Guides, checklists and capability profiles from RES." path="/resources" />
      <section className="pt-36 pb-16 bg-deep-forest-green text-off-white">
        <div className="max-w-[1400px] mx-auto px-6 md:px-12">
          <Reveal><Overline className="text-light-mint">Resource Centre</Overline><h1 className="mt-5 text-5xl md:text-7xl font-serif max-w-4xl leading-[1.05]">Guides & downloads</h1></Reveal>
        </div>
      </section>
      <section className="py-16">
        <div className="max-w-[1400px] mx-auto px-6 md:px-12">
          {data.categories.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-10">
              {["All", ...data.categories].map((c) => <button key={c} onClick={() => setCat(c)} className={`px-4 py-2 rounded-full text-sm ${cat === c ? "bg-deep-forest-green text-off-white" : "bg-white border border-border text-charcoal/70"}`}>{c}</button>)}
            </div>
          )}
          {items.length === 0 ? (
            <div className="py-24 text-center text-charcoal/50 flex flex-col items-center gap-3"><FileText className="h-10 w-10 text-charcoal/20" />No resources published yet.</div>
          ) : (
            <Stagger className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {items.map((r) => (
                <StaggerItem key={r.id}>
                  <div className="bg-white border border-black/5 rounded-lg overflow-hidden h-full flex flex-col">
                    {r.thumbnail && <div className="aspect-[16/10] overflow-hidden bg-warm-beige"><img src={r.thumbnail} alt={r.title} className="h-full w-full object-cover" /></div>}
                    <div className="p-6 flex flex-col flex-1">
                      {r.category && <CertBadge>{r.category}</CertBadge>}
                      <h2 className="mt-3 text-xl text-deep-forest-green">{r.title}</h2>
                      <p className="mt-2 text-sm text-charcoal/65 flex-1">{r.short_description}</p>
                      <button onClick={() => download(r)} data-testid={`resource-download-${r.id}`} className="mt-4 inline-flex items-center justify-center gap-2 rounded-full bg-deep-forest-green text-off-white px-5 py-2.5 text-sm font-medium hover:bg-natural-green transition-colors"><Download className="h-4 w-4" /> Download</button>
                    </div>
                  </div>
                </StaggerItem>
              ))}
            </Stagger>
          )}
        </div>
      </section>
    </div>
  );
}
