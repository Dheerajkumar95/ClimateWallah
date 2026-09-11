import React, { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, FileCheck2, Leaf, Loader2, ShieldCheck, UploadCloud } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { apiError, usePortalAuth } from "../PortalAuthContext";

const inputClass = "w-full rounded-lg border border-[#E4E7EC] bg-white px-3.5 py-3 text-sm text-[#172033] outline-none transition-shadow focus:ring-2 focus:ring-[#27F580]";
const PROJECT_TYPES = ["Commercial", "Residential", "Hotel", "Hospital"];
const FALLBACK_RATING_SYSTEMS = ["IGBC", "WELL", "LEED"];

export default function ReviewerRegister() {
  const navigate = useNavigate();
  const { setUser } = usePortalAuth();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [otp, setOtp] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const [documents, setDocuments] = useState([]);
  const [ratingSystems, setRatingSystems] = useState(FALLBACK_RATING_SYSTEMS);
  const [accepted, setAccepted] = useState({ guidelines: false, declaration: false });
  const [form, setForm] = useState({
    name: "", email: "", phone: "", city: "", organization: "", specialisation: "",
    experience_years: "", password: "", confirm_password: "", project_types: [], rating_systems: [],
  });

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const toggle = (key, value) => update(key, form[key].includes(value) ? form[key].filter((item) => item !== value) : [...form[key], value]);

  useEffect(() => {
    api.get("/public/certification-types")
      .then(({ data }) => {
        const codes = (data || []).map((item) => item.code).filter(Boolean);
        if (codes.length) setRatingSystems(codes);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (resendCooldown <= 0) return undefined;
    const timer = window.setTimeout(() => setResendCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [resendCooldown]);

  const register = async (event) => {
    event.preventDefault();
    if (form.password !== form.confirm_password) return toast.error("Passwords do not match");
    if (!form.project_types.length || !form.rating_systems.length) return toast.error("Select at least one project type and certification system");
    setBusy(true);
    try {
      await api.post("/auth/reviewer/register", { ...form, experience_years: Number(form.experience_years || 0), confirm_password: undefined });
      toast.success("Verification code sent to your email");
      setStep(1);
      setResendCooldown(60);
    } catch (error) {
      toast.error(apiError(error.response?.data?.detail));
    } finally { setBusy(false); }
  };

  const verify = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.post("/auth/reviewer/verify-otp", { email: form.email, otp });
      setUser(data);
      toast.success("Email verified");
      setStep(2);
    } catch (error) {
      toast.error(apiError(error.response?.data?.detail));
    } finally { setBusy(false); }
  };

  const upload = async (documentType, file) => {
    if (!file) return;
    setBusy(true);
    try {
      const body = new FormData();
      body.append("document_type", documentType);
      body.append("file", file);
      const { data } = await api.post("/reviewer/onboarding/documents", body);
      setDocuments((current) => [...current.filter((item) => item.document_type !== documentType), data]);
      toast.success(`${documentType} uploaded`);
    } catch (error) {
      toast.error(apiError(error.response?.data?.detail));
    } finally { setBusy(false); }
  };

  const submitApplication = async () => {
    if (!documents.some((item) => item.document_type === "identity") || !documents.some((item) => item.document_type === "qualification")) {
      return toast.error("Upload both identity and professional qualification documents");
    }
    if (!accepted.guidelines || !accepted.declaration) return toast.error("Accept both declarations to continue");
    setBusy(true);
    try {
      await api.post("/reviewer/onboarding/submit", { guidelines_accepted: accepted.guidelines, declaration_accepted: accepted.declaration });
      toast.success("Application submitted for admin verification");
      navigate("/reviewer/account", { replace: true });
    } catch (error) {
      toast.error(apiError(error.response?.data?.detail));
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen bg-[#F6F8FA] px-4 py-10">
      <div className="mx-auto w-full max-w-3xl">
        <Link to="/portal/login" className="mb-6 inline-flex items-center gap-2 text-sm text-[#667085] hover:text-[#172033]"><ArrowLeft className="h-4 w-4" /> Back to sign in</Link>
        <div className="mb-7 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#E9FFF2]"><Leaf className="h-6 w-6 text-[#172033]" /></span>
          <div><div className="text-xl font-semibold text-[#172033]">Become a Reviewer</div><div className="text-sm text-[#667085]">Join the ClimateWallah professional review network</div></div>
        </div>

        <div className="mb-5 grid grid-cols-3 gap-2">
          {["Profile & email", "Verification", "Documents & declaration"].map((label, index) => (
            <div key={label} className={`rounded-xl border px-3 py-3 text-center text-xs font-semibold ${index <= step ? "border-[#27F580] bg-[#E9FFF2] text-[#172033]" : "border-[#E4E7EC] bg-white text-[#667085]"}`}>
              <span className="mr-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-white">{index < step ? <Check className="h-3 w-3" /> : index + 1}</span>{label}
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-[#E4E7EC] bg-white p-6 shadow-sm md:p-8">
          {step === 0 && (
            <form onSubmit={register} className="space-y-5">
              <div><h1 className="text-2xl font-semibold text-[#111827]">Professional profile</h1><p className="mt-1 text-sm text-[#667085]">Your account will become active after document verification and a monthly plan purchase.</p></div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field label="Full name"><input required className={inputClass} value={form.name} onChange={(e) => update("name", e.target.value)} /></Field>
                <Field label="Email"><input required type="email" className={inputClass} value={form.email} onChange={(e) => update("email", e.target.value)} /></Field>
                <Field label="Phone"><input required className={inputClass} value={form.phone} onChange={(e) => update("phone", e.target.value)} /></Field>
                <Field label="City"><input required className={inputClass} value={form.city} onChange={(e) => update("city", e.target.value)} /></Field>
                <Field label="Organisation"><input className={inputClass} value={form.organization} onChange={(e) => update("organization", e.target.value)} /></Field>
                <Field label="Specialisation"><input className={inputClass} value={form.specialisation} onChange={(e) => update("specialisation", e.target.value)} placeholder="Green buildings, energy, water…" /></Field>
                <Field label="Experience (years)"><input min="0" type="number" className={inputClass} value={form.experience_years} onChange={(e) => update("experience_years", e.target.value)} /></Field>
              </div>
              <ChoiceField title="Project types" items={PROJECT_TYPES} selected={form.project_types} onToggle={(value) => toggle("project_types", value)} />
              <ChoiceField title="Certification experience" items={ratingSystems} selected={form.rating_systems} onToggle={(value) => toggle("rating_systems", value)} />
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field label="Password"><input required type="password" className={inputClass} value={form.password} onChange={(e) => update("password", e.target.value)} /></Field>
                <Field label="Confirm password"><input required type="password" className={inputClass} value={form.confirm_password} onChange={(e) => update("confirm_password", e.target.value)} /></Field>
              </div>
              <p className="text-xs text-[#667085]">Use at least 8 characters with uppercase, lowercase and a number.</p>
              <PrimaryButton busy={busy}>Send verification code <ArrowRight className="h-4 w-4" /></PrimaryButton>
            </form>
          )}

          {step === 1 && (
            <form onSubmit={verify} className="mx-auto max-w-md space-y-5 py-5 text-center">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#E9FFF2]"><ShieldCheck className="h-7 w-7 text-[#172033]" /></span>
              <div><h1 className="text-2xl font-semibold text-[#111827]">Verify your email</h1><p className="mt-2 text-sm text-[#667085]">Enter the 6-digit code sent to <strong>{form.email}</strong>. It is valid for 5 minutes.</p></div>
              <input required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} className={`${inputClass} text-center text-2xl tracking-[.45em]`} />
              <PrimaryButton busy={busy}>Verify email</PrimaryButton>
              <button type="button" disabled={resendCooldown > 0 || busy} onClick={() => api.post("/auth/reviewer/resend-otp", { email: form.email }).then(() => { toast.success("New code sent"); setResendCooldown(60); }).catch((error) => toast.error(apiError(error.response?.data?.detail)))} className="text-sm font-medium text-[#172033] hover:underline disabled:text-[#98A2B3] disabled:no-underline">{resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend code"}</button>
            </form>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div><h1 className="text-2xl font-semibold text-[#111827]">Verification documents</h1><p className="mt-1 text-sm text-[#667085]">Upload readable PDF/JPG/PNG documents. Admin will verify these before approval.</p></div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <DocumentUpload label="Identity / PAN document" type="identity" onUpload={upload} uploaded={documents.find((item) => item.document_type === "identity")} />
                <DocumentUpload label="Professional qualification" type="qualification" onUpload={upload} uploaded={documents.find((item) => item.document_type === "qualification")} />
              </div>
              <div className="rounded-xl border border-[#E4E7EC] bg-[#F6F8FA] p-5">
                <h2 className="font-semibold text-[#172033]">Reviewer guidelines</h2>
                <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-[#667085]">
                  <li>Review evidence independently, confidentially and without conflict of interest.</li>
                  <li>Use only the published checklist and provide clear comments for every correction.</li>
                  <li>Final certification is issued by ClimateWallah Admin, not by the reviewer.</li>
                  <li>A monthly reviewer plan is required for new assignments; expiry never removes already-earned payouts.</li>
                </ul>
              </div>
              <CheckRow checked={accepted.guidelines} onChange={(value) => setAccepted({ ...accepted, guidelines: value })}>I have read and accept the reviewer guidelines.</CheckRow>
              <CheckRow checked={accepted.declaration} onChange={(value) => setAccepted({ ...accepted, declaration: value })}>I declare that the submitted details and documents are genuine.</CheckRow>
              <button type="button" onClick={submitApplication} disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#27F580] px-4 py-3 font-semibold text-[#172033] hover:bg-[#20DB72] disabled:opacity-60">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileCheck2 className="h-4 w-4" />} Submit for verification
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) { return <label className="block"><span className="mb-1.5 block text-sm font-medium text-[#172033]">{label}</span>{children}</label>; }

function ChoiceField({ title, items, selected, onToggle }) {
  return <div><div className="mb-2 text-sm font-medium text-[#172033]">{title}</div><div className="flex flex-wrap gap-2">{items.map((item) => <button key={item} type="button" onClick={() => onToggle(item)} className={`rounded-lg border px-3 py-2 text-sm ${selected.includes(item) ? "border-[#27F580] bg-[#E9FFF2] font-semibold text-[#172033]" : "border-[#E4E7EC] text-[#667085]"}`}>{item}</button>)}</div></div>;
}

function PrimaryButton({ busy, children }) { return <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#172033] px-4 py-3 font-semibold text-white hover:bg-[#111827] disabled:opacity-60">{busy && <Loader2 className="h-4 w-4 animate-spin" />}{children}</button>; }

function CheckRow({ checked, onChange, children }) { return <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#E4E7EC] p-4 text-sm text-[#172033]"><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#27F580]" /><span>{children}</span></label>; }

function DocumentUpload({ label, type, onUpload, uploaded }) {
  const ref = useRef(null);
  return (
    <div className={`rounded-xl border p-5 ${uploaded ? "border-[#27F580] bg-[#E9FFF2]" : "border-dashed border-[#E4E7EC] bg-white"}`}>
      <UploadCloud className="mb-3 h-6 w-6 text-[#172033]" />
      <div className="font-medium text-[#172033]">{label}</div>
      <div className="mt-1 truncate text-xs text-[#667085]">{uploaded?.original_name || "PDF, PNG, JPG or WEBP · max 15 MB"}</div>
      <input ref={ref} hidden type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" onChange={(e) => onUpload(type, e.target.files?.[0])} />
      <button type="button" onClick={() => ref.current?.click()} className="mt-4 rounded-lg border border-[#172033] px-3 py-2 text-xs font-semibold text-[#172033] hover:bg-white">{uploaded ? "Replace file" : "Choose file"}</button>
    </div>
  );
}
