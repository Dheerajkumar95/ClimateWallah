import React, { useEffect, useState, useMemo } from "react";
import { Search } from "lucide-react";
import { publicApi } from "@/lib/api";
import { Seo } from "@/components/site/Seo";
import { Reveal, Stagger, StaggerItem } from "@/components/site/Reveal";
import { Overline, ProjectCard } from "@/components/site/Bits";

export default function Projects() {
  const [data, setData] = useState({ items: [], categories: [], locations: [] });
  const [category, setCategory] = useState("All");
  const [location, setLocation] = useState("All");
  const [search, setSearch] = useState("");

  useEffect(() => { publicApi.get("/projects").then((r) => setData(r.data)).catch(() => {}); }, []);

  const filtered = useMemo(() => {
    return data.items.filter((p) => {
      if (category !== "All" && p.category !== category) return false;
      if (location !== "All" && p.location !== location) return false;
      if (search) {
        const q = search.toLowerCase();
        return [p.title, p.location, p.certification, p.category].some((f) => (f || "").toLowerCase().includes(q));
      }
      return true;
    });
  }, [data.items, category, location, search]);

  return (
    <div data-testid="projects-page">
      <Seo title="Projects" description="Green building certification and sustainability projects delivered across India." path="/projects" />
      <section className="pt-36 pb-16 bg-deep-forest-green text-off-white">
        <div className="max-w-[1400px] mx-auto px-6 md:px-12">
          <Reveal>
            <Overline className="text-light-mint">Projects Completed</Overline>
            <h1 className="mt-5 text-5xl md:text-7xl font-serif max-w-4xl leading-[1.05]">A portfolio of certified sustainability</h1>
          </Reveal>
        </div>
      </section>

      <section className="py-14">
        <div className="max-w-[1400px] mx-auto px-6 md:px-12">
          <div className="flex flex-col lg:flex-row gap-4 lg:items-center justify-between mb-10">
            <div className="relative max-w-md w-full">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-charcoal/40" />
              <input
                data-testid="projects-search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search projects..."
                className="w-full bg-white border border-border rounded-full pl-11 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-natural-green"
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <select data-testid="projects-category-filter" value={category} onChange={(e) => setCategory(e.target.value)} className="bg-white border border-border rounded-full px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-natural-green">
                <option value="All">All Categories</option>
                {data.categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <select data-testid="projects-location-filter" value={location} onChange={(e) => setLocation(e.target.value)} className="bg-white border border-border rounded-full px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-natural-green">
                <option value="All">All Locations</option>
                {data.locations.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="py-24 text-center text-charcoal/50">No projects match your filters.</div>
          ) : (
            <Stagger className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map((p) => (<StaggerItem key={p.id}><ProjectCard project={p} /></StaggerItem>))}
            </Stagger>
          )}
        </div>
      </section>
    </div>
  );
}
