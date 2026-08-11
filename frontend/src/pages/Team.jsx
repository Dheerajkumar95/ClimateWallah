import React, { useEffect, useState } from "react";
import { Linkedin } from "lucide-react";
import { publicApi } from "@/lib/api";
import { Seo } from "@/components/site/Seo";
import { Reveal, Stagger, StaggerItem } from "@/components/site/Reveal";
import { Overline, TeamAvatar, CertBadge } from "@/components/site/Bits";

export default function Team() {
  const [team, setTeam] = useState([]);
  useEffect(() => { publicApi.get("/team").then((r) => setTeam(r.data)).catch(() => {}); }, []);

  return (
    <div data-testid="team-page">
      <Seo title="Team" description="Meet the accredited sustainability experts behind Resilient Earth Solutions." path="/team" />
      <section className="pt-36 pb-16 bg-deep-forest-green text-off-white">
        <div className="max-w-[1400px] mx-auto px-6 md:px-12">
          <Reveal>
            <Overline className="text-light-mint">Key People</Overline>
            <h1 className="mt-5 text-5xl md:text-7xl font-serif max-w-4xl leading-[1.05]">The people behind the practice</h1>
          </Reveal>
        </div>
      </section>

      <section className="py-24 md:py-32">
        <div className="max-w-[1400px] mx-auto px-6 md:px-12">
          <Stagger className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {team.map((m) => (
              <StaggerItem key={m.id}>
                <div className="bg-white border border-black/5 rounded-lg p-8 flex flex-col items-center text-center h-full">
                  <TeamAvatar name={m.name} image={m.profile_image} />
                  <h2 className="mt-6 text-2xl text-deep-forest-green">{m.name}</h2>
                  <p className="text-deep-forest-green font-medium mt-1">{m.designation}</p>
                  {m.credentials && <div className="mt-3"><CertBadge>{m.credentials}</CertBadge></div>}
                  {m.biography && <p className="mt-4 text-sm text-charcoal/70 leading-relaxed">{m.biography}</p>}
                  {m.linkedin_url && (
                    <a href={m.linkedin_url} target="_blank" rel="noreferrer" className="mt-5 h-10 w-10 rounded-full bg-light-mint text-deep-forest-green flex items-center justify-center hover:bg-deep-forest-green hover:text-off-white transition-colors">
                      <Linkedin className="h-4 w-4" />
                    </a>
                  )}
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>
    </div>
  );
}
