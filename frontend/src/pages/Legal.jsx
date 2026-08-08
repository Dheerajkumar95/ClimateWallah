import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { publicApi } from "@/lib/api";
import { Seo } from "@/components/site/Seo";

export default function Legal() {
  const { slug } = useParams();
  const [page, setPage] = useState(null);
  const [err, setErr] = useState(false);
  useEffect(() => { setPage(null); setErr(false); publicApi.get(`/legal/${slug}`).then((r) => setPage(r.data)).catch(() => setErr(true)); }, [slug]);

  if (err) return <div className="pt-40 pb-40 text-center text-charcoal/60">Page not found. <Link to="/" className="underline">Home</Link></div>;
  if (!page) return <div className="min-h-screen" />;

  return (
    <div data-testid="legal-page">
      <Seo title={page.title} path={`/legal/${slug}`} />
      <section className="pt-36 pb-12 bg-deep-forest-green text-off-white">
        <div className="max-w-3xl mx-auto px-6 md:px-12">
          <h1 className="text-4xl md:text-6xl font-serif">{page.title}</h1>
        </div>
      </section>
      <article className="max-w-3xl mx-auto px-6 md:px-12 py-16">
        <div className="prose prose-lg max-w-none text-charcoal/85 leading-relaxed [&_p]:mb-4 [&_h2]:font-serif [&_h2]:text-2xl [&_h2]:text-deep-forest-green [&_h2]:mt-8 [&_ul]:list-disc [&_ul]:pl-6"
          dangerouslySetInnerHTML={{ __html: page.content || "" }} />
      </article>
    </div>
  );
}
