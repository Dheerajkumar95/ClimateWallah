import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, MapPin, ArrowRight, ArrowUpRight } from "lucide-react";
import { publicApi } from "@/lib/api";
import { Seo } from "@/components/site/Seo";
import { Reveal, Stagger, StaggerItem } from "@/components/site/Reveal";
import { Overline } from "@/components/site/Bits";

const fmtDate = (d) => {
  if (!d) return "";
  try { return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }); }
  catch { return d; }
};

function EventCard({ e, past }) {
  return (
    <div className={`group bg-white border border-black/5 rounded-lg overflow-hidden h-full flex flex-col ${past ? "opacity-90" : ""}`}>
      {e.image && <div className="aspect-[16/9] overflow-hidden bg-warm-beige"><img src={e.image} alt={e.title} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-700" /></div>}
      <div className="p-6 flex flex-col flex-1">
        <div className="flex items-center gap-4 text-xs text-charcoal/60">
          {e.event_date && <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" /> {fmtDate(e.event_date)}</span>}
          {e.location && <span className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> {e.location}</span>}
        </div>
        <h3 className="mt-3 text-xl text-deep-forest-green leading-snug">{e.title}</h3>
        {e.description && <p className="mt-2 text-sm text-charcoal/65 leading-relaxed line-clamp-3">{e.description}</p>}
        <div className="mt-auto pt-4">
          {!past && (e.register_url || e.link) ? (
            <a href={e.register_url || e.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm text-deep-forest-green font-medium hover:gap-2.5 transition-all">
              Register <ArrowUpRight className="h-4 w-4" />
            </a>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs uppercase tracking-widest text-charcoal/40">{past ? "Past event" : "Details soon"}</span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Events() {
  const [data, setData] = useState(null);

  useEffect(() => {
    publicApi.get("/events").then((r) => setData(r.data)).catch(() => setData({ upcoming: [], past: [] }));
  }, []);

  const upcoming = data?.upcoming || [];
  const past = data?.past || [];
  const empty = data && upcoming.length === 0 && past.length === 0;

  return (
    <div data-testid="events-page">
      <Seo title="Events" description="Workshops, webinars and events by Resilient Earth Solutions." path="/events" />

      <section className="pt-36 pb-16 bg-deep-forest-green text-off-white">
        <div className="max-w-[1400px] mx-auto px-6 md:px-12">
          <Overline className="text-light-mint">Events</Overline>
          <h1 className="mt-4 text-4xl md:text-6xl font-serif leading-tight">Workshops, webinars &amp; industry events</h1>
          <p className="mt-5 text-light-mint/85 text-lg max-w-2xl">Join RES for practical sessions on green building certification, decarbonisation and sustainability reporting.</p>
        </div>
      </section>

      <section className="py-20 md:py-28">
        <div className="max-w-[1400px] mx-auto px-6 md:px-12">
          {!data ? (
            <div className="text-center text-charcoal/50 py-10">Loading events…</div>
          ) : empty ? (
            <Reveal>
              <div className="bg-warm-beige rounded-2xl p-12 md:p-16 text-center">
                <CalendarDays className="h-10 w-10 text-natural-green mx-auto mb-4" />
                <h2 className="text-2xl md:text-3xl font-serif text-deep-forest-green">No events scheduled right now</h2>
                <p className="mt-3 text-charcoal/65 max-w-lg mx-auto">We host regular workshops and webinars. Book a demo and we'll invite you to the next one.</p>
                <Link to="/book" className="mt-7 inline-flex items-center gap-2 rounded-full bg-deep-forest-green text-off-white px-7 py-3.5 font-medium hover:bg-natural-green transition-colors">
                  Book a Demo <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </Reveal>
          ) : (
            <>
              {upcoming.length > 0 && (
                <div className="mb-16">
                  <Reveal><Overline>Upcoming</Overline><h2 className="mt-4 text-3xl md:text-4xl font-serif text-deep-forest-green">What's next</h2></Reveal>
                  <Stagger className="mt-10 grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {upcoming.map((e, i) => <StaggerItem key={e.id || i}><EventCard e={e} /></StaggerItem>)}
                  </Stagger>
                </div>
              )}
              {past.length > 0 && (
                <div>
                  <Reveal><Overline>Past</Overline><h2 className="mt-4 text-3xl md:text-4xl font-serif text-deep-forest-green">Previously hosted</h2></Reveal>
                  <Stagger className="mt-10 grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {past.map((e, i) => <StaggerItem key={e.id || i}><EventCard e={e} past /></StaggerItem>)}
                  </Stagger>
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
}
