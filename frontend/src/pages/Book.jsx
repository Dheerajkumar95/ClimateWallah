import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { CalendarCheck, CheckCircle2, Send } from "lucide-react";
import { toast } from "sonner";
import { publicApi, apiError } from "@/lib/api";
import { Seo } from "@/components/site/Seo";
import { Reveal } from "@/components/site/Reveal";
import { Overline } from "@/components/site/Bits";

export default function Book() {
  const [services, setServices] = useState([]);
  const [sent, setSent] = useState(false);
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm();

  useEffect(() => { publicApi.get("/services").then((r) => setServices(r.data)).catch(() => {}); }, []);

  const onSubmit = async (values) => {
    try {
      await publicApi.post("/bookings", values);
      setSent(true); reset();
      toast.success("Consultation request received!");
    } catch (e) { toast.error(apiError(e.response?.data?.detail)); }
  };

  return (
    <div data-testid="book-page">
      <Seo title="Book a Free Consultation" description="Schedule a discovery call with the RES sustainability advisory team." path="/book" />
      <section className="pt-36 pb-16 bg-deep-forest-green text-off-white">
        <div className="max-w-[1400px] mx-auto px-6 md:px-12">
          <Reveal>
            <Overline className="text-light-mint">Book a Discovery Call</Overline>
            <h1 className="mt-5 text-5xl md:text-7xl font-serif max-w-4xl leading-[1.05]">Book your free consultation</h1>
            <p className="mt-6 text-light-mint/85 text-lg max-w-2xl">Tell us about your project and we'll arrange a discovery call with our advisory team.</p>
          </Reveal>
        </div>
      </section>

      <section className="py-20">
        <div className="max-w-3xl mx-auto px-6 md:px-12">
          {sent ? (
            <div data-testid="book-success" className="bg-light-mint/50 border border-natural-green/20 rounded-lg p-12 text-center flex flex-col items-center">
              <CheckCircle2 className="h-14 w-14 text-natural-green mb-4" strokeWidth={1.5} />
              <h2 className="text-3xl font-serif text-deep-forest-green">Request received</h2>
              <p className="mt-3 text-charcoal/70">Thank you. Our team will confirm your consultation shortly.</p>
              <button onClick={() => setSent(false)} className="mt-6 rounded-full border-2 border-deep-forest-green text-deep-forest-green px-6 py-2.5 font-medium hover:bg-deep-forest-green hover:text-off-white transition-colors">Book another</button>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} data-testid="book-form" className="bg-white border border-black/5 rounded-lg p-8 md:p-10 grid sm:grid-cols-2 gap-5">
              <F label="Name *" e={errors.name}><input data-testid="book-name" className="inp" {...register("name", { required: "Required" })} /></F>
              <F label="Email *" e={errors.email}><input data-testid="book-email" className="inp" {...register("email", { required: "Required" })} /></F>
              <F label="Phone"><input data-testid="book-phone" className="inp" {...register("phone")} /></F>
              <F label="Company"><input className="inp" {...register("company")} /></F>
              <F label="Service of interest"><select data-testid="book-service" className="inp" {...register("service")}><option value="">Select</option>{services.map((s) => <option key={s.id} value={s.title}>{s.title}</option>)}</select></F>
              <F label="Project type"><input className="inp" placeholder="e.g. Office, Data Centre" {...register("project_type")} /></F>
              <F label="Preferred date"><input type="date" data-testid="book-date" className="inp" {...register("preferred_date")} /></F>
              <F label="Preferred time"><input type="time" className="inp" {...register("preferred_time")} /></F>
              <F label="Meeting mode"><select className="inp" {...register("meeting_mode")}><option value="">Select</option><option>Online</option><option>In-person</option><option>Phone</option></select></F>
              <F label="Project location"><input className="inp" {...register("project_location")} /></F>
              <F label="Message" full><textarea rows={4} className="inp resize-none" {...register("message")} /></F>
              <div className="sm:col-span-2">
                <button type="submit" data-testid="book-submit" disabled={isSubmitting} className="inline-flex items-center gap-2 rounded-full bg-deep-forest-green text-off-white px-8 py-3.5 font-medium hover:bg-natural-green transition-colors disabled:opacity-60">
                  {isSubmitting ? "Submitting..." : <>Request consultation <CalendarCheck className="h-4 w-4" /></>}
                </button>
              </div>
            </form>
          )}
        </div>
      </section>
      <style>{`.inp{width:100%;background:#fff;border:1px solid hsl(var(--border));border-radius:0.5rem;padding:0.75rem 1rem;font-size:0.95rem;outline:none;transition:box-shadow .2s,border-color .2s}.inp:focus{box-shadow:0 0 0 2px #27F580;border-color:#27F580}`}</style>
    </div>
  );
}

function F({ label, e, children, full }) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <label className="block text-sm font-medium text-charcoal/80 mb-1.5">{label}</label>
      {children}
      {e && <p className="mt-1 text-xs text-destructive">{e.message}</p>}
    </div>
  );
}
