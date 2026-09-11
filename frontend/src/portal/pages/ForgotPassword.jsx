import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, KeyRound, Loader2, MailCheck } from "lucide-react";
import { toast } from "sonner";
import { api, apiError } from "@/lib/api";

const inputClass = "w-full rounded-lg border border-[#E4E7EC] bg-white px-3.5 py-3 text-sm text-[#172033] outline-none focus:ring-2 focus:ring-[#27F580]";

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [identifier, setIdentifier] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [cooldown, setCooldown] = useState(0);

  const startCooldown = () => {
    setCooldown(60);
    const timer = window.setInterval(() => {
      setCooldown((value) => {
        if (value <= 1) { window.clearInterval(timer); return 0; }
        return value - 1;
      });
    }, 1000);
  };

  const requestOtp = async (event) => {
    event?.preventDefault();
    if (!identifier.trim()) return toast.error("Enter your email, Client ID or Reviewer ID");
    setBusy(true);
    try {
      await api.post("/auth/password/forgot", { identifier: identifier.trim() });
      setStep(1);
      startCooldown();
      toast.success("Verification code sent if the account exists");
    } catch (error) { toast.error(apiError(error.response?.data?.detail)); }
    finally { setBusy(false); }
  };

  const resend = async () => {
    if (cooldown) return;
    setBusy(true);
    try {
      await api.post("/auth/password/resend", { identifier: identifier.trim() });
      startCooldown();
      toast.success("New verification code sent");
    } catch (error) { toast.error(apiError(error.response?.data?.detail)); }
    finally { setBusy(false); }
  };

  const reset = async (event) => {
    event.preventDefault();
    if (password !== confirm) return toast.error("Passwords do not match");
    setBusy(true);
    try {
      await api.post("/auth/password/reset", {
        identifier: identifier.trim(), otp, new_password: password, confirm_password: confirm,
      });
      toast.success("Password reset successfully");
      navigate("/portal/login", { replace: true });
    } catch (error) { toast.error(apiError(error.response?.data?.detail)); }
    finally { setBusy(false); }
  };

  return <div className="min-h-screen bg-[#F6F8FA] px-4 py-10 flex items-center justify-center">
    <div className="w-full max-w-md">
      <Link to="/portal/login" className="mb-5 inline-flex items-center gap-2 text-sm text-[#667085] hover:text-[#172033]"><ArrowLeft className="h-4 w-4" /> Back to sign in</Link>
      <div className="rounded-2xl border border-[#E4E7EC] bg-white p-7 shadow-sm">
        <span className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-[#E9FFF2]"><KeyRound className="h-6 w-6 text-[#172033]" /></span>
        {step === 0 ? <form onSubmit={requestOtp} className="space-y-5">
          <div><h1 className="text-2xl font-semibold text-[#111827]">Forgot password</h1><p className="mt-1 text-sm text-[#667085]">Use your registered email, Client ID (CLI-xxxxxx) or Reviewer ID (REV-xxxxxx).</p></div>
          <label className="block"><span className="mb-1.5 block text-sm font-medium text-[#172033]">Email or generated ID</span><input autoFocus className={inputClass} value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="you@company.com or REV-000001" /></label>
          <button disabled={busy} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#27F580] px-4 py-3 font-semibold text-[#172033] hover:bg-[#20DB72] disabled:opacity-60">{busy && <Loader2 className="h-4 w-4 animate-spin" />} Send verification code</button>
        </form> : <form onSubmit={reset} className="space-y-4">
          <div className="mb-2"><MailCheck className="h-6 w-6 text-[#3B82F6]" /><h1 className="mt-3 text-2xl font-semibold text-[#111827]">Verify & reset</h1><p className="mt-1 text-sm text-[#667085]">The 6-digit code is valid for 5 minutes.</p></div>
          <label className="block"><span className="mb-1.5 block text-sm font-medium text-[#172033]">Verification code</span><input required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} className={`${inputClass} text-center text-xl tracking-[.35em]`} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} /></label>
          <label className="block"><span className="mb-1.5 block text-sm font-medium text-[#172033]">New password</span><input required type="password" className={inputClass} value={password} onChange={(e) => setPassword(e.target.value)} /></label>
          <label className="block"><span className="mb-1.5 block text-sm font-medium text-[#172033]">Confirm password</span><input required type="password" className={inputClass} value={confirm} onChange={(e) => setConfirm(e.target.value)} /></label>
          <p className="text-xs text-[#667085]">Minimum 8 characters with uppercase, lowercase and a number.</p>
          <button disabled={busy} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#27F580] px-4 py-3 font-semibold text-[#172033] hover:bg-[#20DB72] disabled:opacity-60">{busy && <Loader2 className="h-4 w-4 animate-spin" />} Reset password</button>
          <button type="button" disabled={busy || cooldown > 0} onClick={resend} className="w-full text-center text-sm font-semibold text-[#172033] disabled:text-[#98A2B3]">{cooldown ? `Resend in ${cooldown}s` : "Resend code"}</button>
        </form>}
      </div>
    </div>
  </div>;
}
