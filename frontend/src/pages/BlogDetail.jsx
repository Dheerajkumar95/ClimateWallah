import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { publicApi } from "@/lib/api";
import { Seo } from "@/components/site/Seo";
import { Reveal } from "@/components/site/Reveal";
import { CertBadge } from "@/components/site/Bits";

export default function BlogDetail() {
  const { slug } = useParams();
  const [data, setData] = useState(null);
  const [err, setErr] = useState(false);
  useEffect(() => { publicApi.get(`/blogs/${slug}`).then((r) => setData(r.data)).catch(() => setErr(true)); }, [slug]);

  if (err) return <div className="pt-40 pb-40 text-center text-charcoal/60">Post not found. <Link to="/blog" className="underline">Back to insights</Link></div>;
  if (!data) return <div className="min-h-screen" />;
  const p = data.post;

  return (
    <div data-testid="blog-detail-page">
      <Seo title={p.seo_title || p.title} description={p.seo_description || p.excerpt} image={p.cover_image} path={`/blog/${slug}`} />
      <section className="pt-36 pb-12 bg-deep-forest-green text-off-white">
        <div className="max-w-3xl mx-auto px-6 md:px-12">
          <Link to="/blog" className="inline-flex items-center gap-2 text-light-mint/80 hover:text-off-white mb-8"><ArrowLeft className="h-4 w-4" /> All Insights</Link>
          <Reveal>
            {p.category && <div className="mb-4"><CertBadge>{p.category}</CertBadge></div>}
            <h1 className="text-4xl md:text-6xl font-serif leading-[1.08]">{p.title}</h1>
            {p.author && <p className="mt-5 text-light-mint/70">By {p.author}</p>}
          </Reveal>
        </div>
      </section>

      {p.cover_image && (
        <div className="max-w-4xl mx-auto px-6 md:px-12 -mt-0 py-10">
          <img src={p.cover_image} alt={p.title} className="rounded-lg w-full object-cover aspect-[16/9]" />
        </div>
      )}

      <article className="max-w-3xl mx-auto px-6 md:px-12 pb-24">
        <div className="prose prose-lg max-w-none text-charcoal/85 leading-relaxed [&_p]:mb-5 [&_h2]:font-serif [&_h2]:text-3xl [&_h2]:text-deep-forest-green [&_h2]:mt-10 [&_h2]:mb-4 [&_a]:text-natural-green [&_ul]:list-disc [&_ul]:pl-6"
          dangerouslySetInnerHTML={{ __html: p.content || `<p>${p.excerpt || ""}</p>` }} />
      </article>

      {data.related?.length > 0 && (
        <section className="py-20 bg-warm-beige">
          <div className="max-w-[1400px] mx-auto px-6 md:px-12">
            <h2 className="text-3xl font-serif text-deep-forest-green mb-8">Related insights</h2>
            <div className="grid md:grid-cols-3 gap-6">
              {data.related.map((b) => (
                <Link key={b.id} to={`/blog/${b.slug}`} className="group block bg-white border border-black/5 rounded-lg overflow-hidden">
                  {b.cover_image && <div className="aspect-[16/10] overflow-hidden"><img src={b.cover_image} alt={b.title} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-700" /></div>}
                  <div className="p-6"><h3 className="text-xl text-deep-forest-green">{b.title}</h3></div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
