import React, { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { Search, FileText } from "lucide-react";
import { publicApi } from "@/lib/api";
import { Seo } from "@/components/site/Seo";
import { Reveal, Stagger, StaggerItem } from "@/components/site/Reveal";
import { Overline, CertBadge } from "@/components/site/Bits";

export default function Blog() {
  const [data, setData] = useState({ items: [], categories: [] });
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  useEffect(() => { publicApi.get("/blogs").then((r) => setData(r.data)).catch(() => {}); }, []);

  const filtered = useMemo(() => data.items.filter((b) => {
    if (category !== "All" && b.category !== category) return false;
    if (search) { const q = search.toLowerCase(); return [b.title, b.excerpt].some((f) => (f || "").toLowerCase().includes(q)); }
    return true;
  }), [data.items, category, search]);

  return (
    <div data-testid="blog-page">
      <Seo title="Insights" description="Perspectives on sustainability, green building and climate action from RES." path="/blog" />
      <section className="pt-36 pb-16 bg-deep-forest-green text-off-white">
        <div className="max-w-[1400px] mx-auto px-6 md:px-12">
          <Reveal>
            <Overline className="text-light-mint">Insights</Overline>
            <h1 className="mt-5 text-5xl md:text-7xl font-serif max-w-4xl leading-[1.05]">Ideas for a greener built environment</h1>
          </Reveal>
        </div>
      </section>

      <section className="py-14">
        <div className="max-w-[1400px] mx-auto px-6 md:px-12">
          <div className="flex flex-col lg:flex-row gap-4 justify-between mb-10">
            <div className="relative max-w-md w-full">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-charcoal/40" />
              <input data-testid="blog-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search insights..." className="w-full bg-white border border-border rounded-full pl-11 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-natural-green" />
            </div>
            {data.categories.length > 0 && (
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="bg-white border border-border rounded-full px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-natural-green">
                <option value="All">All Categories</option>
                {data.categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            )}
          </div>

          {filtered.length === 0 ? (
            <div className="py-24 text-center text-charcoal/50 flex flex-col items-center gap-4">
              <FileText className="h-10 w-10 text-charcoal/20" />
              No insights published yet. Check back soon.
            </div>
          ) : (
            <Stagger className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map((b) => (
                <StaggerItem key={b.id}>
                  <Link to={`/blog/${b.slug}`} data-testid={`blog-card-${b.slug}`} className="group block bg-white border border-black/5 rounded-lg overflow-hidden h-full">
                    {b.cover_image && <div className="aspect-[16/10] overflow-hidden bg-warm-beige"><img src={b.cover_image} alt={b.title} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-700" /></div>}
                    <div className="p-6">
                      {b.category && <CertBadge>{b.category}</CertBadge>}
                      <h2 className="mt-3 text-xl md:text-2xl text-deep-forest-green leading-snug">{b.title}</h2>
                      <p className="mt-2 text-sm text-charcoal/65 line-clamp-3">{b.excerpt}</p>
                    </div>
                  </Link>
                </StaggerItem>
              ))}
            </Stagger>
          )}
        </div>
      </section>
    </div>
  );
}
