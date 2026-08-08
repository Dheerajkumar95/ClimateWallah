import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Download, FileText } from "lucide-react";
import { publicApi } from "@/lib/api";
import { Seo } from "@/components/site/Seo";
import { Overline } from "@/components/site/Bits";

export default function Capability() {
  const [doc, setDoc] = useState(null);
  useEffect(() => { publicApi.get("/capability-profile").then((r) => setDoc(r.data)).catch(() => setDoc({})); }, []);

  return (
    <div data-testid="capability-page">
      <Seo title="Capability Profile" description="Download the Resilient Earth Solutions capability profile." path="/capability-profile" />
      <section className="pt-40 pb-32 bg-deep-forest-green text-off-white min-h-[70vh] flex items-center">
        <div className="max-w-3xl mx-auto px-6 md:px-12 text-center flex flex-col items-center">
          <span className="h-16 w-16 rounded-full bg-off-white/15 flex items-center justify-center mb-6"><FileText className="h-8 w-8" strokeWidth={1.5} /></span>
          <Overline className="text-light-mint">Capability Profile</Overline>
          <h1 className="mt-5 text-4xl md:text-6xl font-serif leading-tight">Our sustainability consulting capabilities</h1>
          {doc === null ? null : doc?.url ? (
            <a href={doc.url} target="_blank" rel="noreferrer" download data-testid="capability-download" className="mt-10 inline-flex items-center gap-2 rounded-full bg-off-white text-deep-forest-green px-8 py-4 font-medium hover:bg-light-mint transition-colors">
              <Download className="h-5 w-5" /> Download PDF
            </a>
          ) : (
            <div className="mt-10 text-light-mint/80">
              <p>The capability profile will be available for download soon.</p>
              <Link to="/contact" className="mt-6 inline-flex items-center gap-2 rounded-full border-2 border-off-white/60 px-7 py-3.5 font-medium hover:bg-off-white hover:text-deep-forest-green transition-colors">Request it via contact</Link>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
