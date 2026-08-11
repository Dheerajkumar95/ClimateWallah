import React, { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Phone, Mail, MapPin, Clock, Send, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { publicApi, apiError } from "@/lib/api";
import { useSettings } from "@/context/SettingsContext";
import { Seo } from "@/components/site/Seo";
import { Reveal } from "@/components/site/Reveal";
import { Overline } from "@/components/site/Bits";

const schema = z.object({
  name: z.string().min(2, "Please enter your name"),
  email: z.string().email("Enter a valid email"),
  phone: z.string().optional(),
  company: z.string().optional(),
  subject: z.string().optional(),
  service_of_interest: z.string().optional(),
  message: z.string().min(5, "Please enter a message"),
});

const SERVICES = ["Audit & Energy", "Building Certification", "Climate Action Plan", "Data Management & Reporting", "Other"];

export default function Contact() {
  const { settings } = useSettings();
  const [sent, setSent] = useState(false);
  const [searchParams] = useSearchParams();
  const topic = searchParams.get("topic") || "";
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: topic ? { subject: `Enquiry: ${topic}`, message: `I'd like to know more about ${topic}.` } : {},
  });

  const onSubmit = async (values) => {
    try {
      await publicApi.post("/enquiries", { ...values, source_page: "/contact" });
      setSent(true);
      reset();
      toast.success("Thank you! Your enquiry has been received.");
    } catch (e) {
      toast.error(apiError(e.response?.data?.detail) || "Something went wrong.");
    }
  };

  const info = [
    { Icon: Phone, label: "Call us", val: [settings?.primary_phone, settings?.secondary_phone].filter(Boolean).join(", ") },
    { Icon: Mail, label: "Email us", val: [settings?.primary_email, settings?.secondary_email].filter(Boolean).join(", ") },
    { Icon: MapPin, label: "Corporate office", val: settings?.corporate_address },
    { Icon: MapPin, label: "Registered office", val: settings?.registered_address },
    { Icon: Clock, label: "Business hours", val: settings?.business_hours },
  ].filter((i) => i.val);

  return (
    <div data-testid="contact-page">
      <Seo title="Contact" description="Get in touch with Resilient Earth Solutions." path="/contact" />
      <section className="pt-36 pb-16 bg-deep-forest-green text-off-white">
        <div className="max-w-[1400px] mx-auto px-6 md:px-12">
          <Reveal>
            <Overline className="text-light-mint">Get in touch</Overline>
            <h1 className="mt-5 text-5xl md:text-7xl font-serif max-w-4xl leading-[1.05]">Let's build a resilient future together</h1>
          </Reveal>
        </div>
      </section>

      <section className="py-24 md:py-32">
        <div className="max-w-[1400px] mx-auto px-6 md:px-12 grid lg:grid-cols-12 gap-12 items-start">
          <div className="lg:col-span-5 space-y-8">
            {info.map((i, idx) => (
              <Reveal key={idx} delay={idx * 0.05}>
                <div className="flex items-start gap-4">
                  <span className="h-11 w-11 rounded-full bg-light-mint text-deep-forest-green flex items-center justify-center shrink-0"><i.Icon className="h-5 w-5" strokeWidth={1.5} /></span>
                  <div>
                    <div className="text-xs uppercase tracking-widest text-charcoal/50">{i.label}</div>
                    <div className="text-charcoal mt-1 leading-relaxed">{i.val}</div>
                  </div>
                </div>
              </Reveal>
            ))}
            {settings?.google_maps_url && (
              <Reveal><a href={settings.google_maps_url} target="_blank" rel="noreferrer" data-testid="contact-map-link" className="inline-flex items-center gap-2 text-deep-forest-green font-medium hover:underline">View on Google Maps</a></Reveal>
            )}
          </div>

          <div className="lg:col-span-7">
            {sent ? (
              <div data-testid="contact-success" className="bg-light-mint/50 border border-natural-green/20 rounded-lg p-12 text-center flex flex-col items-center">
                <CheckCircle2 className="h-14 w-14 text-natural-green mb-4" strokeWidth={1.5} />
                <h2 className="text-3xl font-serif text-deep-forest-green">Enquiry received</h2>
                <p className="mt-3 text-charcoal/70">Thank you for reaching out. Our team will get back to you shortly.</p>
                <button onClick={() => setSent(false)} className="mt-6 rounded-full border-2 border-deep-forest-green text-deep-forest-green px-6 py-2.5 font-medium hover:bg-deep-forest-green hover:text-off-white transition-colors">Send another enquiry</button>
              </div>
            ) : (
              <form onSubmit={handleSubmit(onSubmit)} data-testid="contact-form" className="bg-white border border-black/5 rounded-lg p-8 md:p-10 grid sm:grid-cols-2 gap-5">
                <Field label="Name *" error={errors.name}><input data-testid="contact-name" {...register("name")} className="inp" /></Field>
                <Field label="Email *" error={errors.email}><input data-testid="contact-email" {...register("email")} className="inp" /></Field>
                <Field label="Phone" error={errors.phone}><input data-testid="contact-phone" {...register("phone")} className="inp" /></Field>
                <Field label="Company" error={errors.company}><input data-testid="contact-company" {...register("company")} className="inp" /></Field>
                <Field label="Subject" error={errors.subject}><input data-testid="contact-subject" {...register("subject")} className="inp" /></Field>
                <Field label="Service of interest" error={errors.service_of_interest}>
                  <select data-testid="contact-service" {...register("service_of_interest")} className="inp">
                    <option value="">Select a service</option>
                    {SERVICES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </Field>
                <Field label="Message *" error={errors.message} full>
                  <textarea data-testid="contact-message" rows={5} {...register("message")} className="inp resize-none" />
                </Field>
                <div className="sm:col-span-2">
                  <button type="submit" data-testid="contact-submit" disabled={isSubmitting} className="inline-flex items-center gap-2 rounded-full bg-deep-forest-green text-off-white px-8 py-3.5 font-medium hover:bg-natural-green transition-colors disabled:opacity-60">
                    {isSubmitting ? "Sending..." : <>Send enquiry <Send className="h-4 w-4" /></>}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </section>

      <style>{`.inp{width:100%;background:#fff;border:1px solid hsl(var(--border));border-radius:0.5rem;padding:0.75rem 1rem;font-size:0.95rem;outline:none;transition:box-shadow .2s,border-color .2s}.inp:focus{box-shadow:0 0 0 2px #27F580;border-color:#27F580}`}</style>
    </div>
  );
}

function Field({ label, error, children, full }) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <label className="block text-sm font-medium text-charcoal/80 mb-1.5">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-destructive">{error.message}</p>}
    </div>
  );
}
