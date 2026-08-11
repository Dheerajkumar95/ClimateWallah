import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Leaf, Loader2, MailCheck } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { usePortalAuth, apiError } from "../PortalAuthContext";

const inpCls = "w-full bg-white border border-border rounded-lg px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-natural-green transition-shadow";

export default function Register() {
  const { verifyOtp } = usePortalAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState("details"); // details | otp
  const [form, setForm] = useState({ name: "", email: "", organization: "", phone: "", password: "" });
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const sendOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post("/auth/client/register", form);
      toast.success("Verification code sent to your email");
      setStep("otp");
    } catch (err) {
      toast.error(apiError(err.response?.data?.detail) || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const verify = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await verifyOtp(form.email, otp);
      toast.success(`Welcome, ${user.name}!`);
      navigate("/portal/dashboard");
    } catch (err) {
      toast.error(apiError(err.response?.data?.detail) || "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    try {
      await api.post("/auth/client/resend-otp", { email: form.email });
      toast.success("A new code has been sent");
    } catch (err) {
      toast.error(apiError(err.response?.data?.detail) || "Could not resend");
    }
  };

  return (
    <div className="min-h-screen bg-off-white flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <Link to="/" className="flex items-center justify-center gap-2.5 mb-8">
          <span className="h-11 w-11 rounded-xl bg-natural-green/10 flex items-center justify-center"><Leaf className="h-6 w-6 text-natural-green" /></span>
          <span className="font-serif text-2xl text-deep-forest-green">RES Certification Portal</span>
        </Link>
        <div className="bg-white border border-border rounded-2xl shadow-sm p-8">
          {step === "details" ? (
            <>
              <h1 className="text-2xl font-serif text-deep-forest-green">Create your account</h1>
              <p className="text-sm text-charcoal/60 mt-1 mb-6">Register as a client to start a certification project.</p>
              <form onSubmit={sendOtp} className="space-y-4" data-testid="register-form">
                <div>
                  <label className="block text-sm font-medium text-charcoal/80 mb-1.5">Full name</label>
                  <input className={inpCls} value={form.name} onChange={set("name")} required data-testid="reg-name-input" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-charcoal/80 mb-1.5">Email</label>
                  <input className={inpCls} type="email" value={form.email} onChange={set("email")} required data-testid="reg-email-input" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-charcoal/80 mb-1.5">Organization</label>
                    <input className={inpCls} value={form.organization} onChange={set("organization")} data-testid="reg-org-input" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-charcoal/80 mb-1.5">Phone</label>
                    <input className={inpCls} value={form.phone} onChange={set("phone")} data-testid="reg-phone-input" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-charcoal/80 mb-1.5">Password</label>
                  <input className={inpCls} type="password" value={form.password} onChange={set("password")} required data-testid="reg-password-input" />
                  <p className="mt-1 text-xs text-charcoal/50">Min 8 chars with upper, lower and a number.</p>
                </div>
                <button type="submit" disabled={loading} data-testid="reg-submit-btn"
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-deep-forest-green text-off-white px-4 py-3 text-sm font-medium hover:bg-natural-green transition-colors disabled:opacity-60">
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />} Send verification code
                </button>
              </form>
              <p className="text-sm text-charcoal/60 mt-6 text-center">
                Already registered?{" "}
                <Link to="/portal/login" className="text-deep-forest-green font-medium hover:underline">Sign in</Link>
              </p>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 text-natural-green mb-2"><MailCheck className="h-5 w-5" /><span className="text-sm font-medium">Check your inbox</span></div>
              <h1 className="text-2xl font-serif text-deep-forest-green">Enter your code</h1>
              <p className="text-sm text-charcoal/60 mt-1 mb-6">We sent a 6-digit code to <strong>{form.email}</strong>. It expires in 5 minutes.</p>
              <form onSubmit={verify} className="space-y-4" data-testid="otp-form">
                <input
                  className={inpCls + " text-center text-2xl tracking-[0.5em] font-semibold"}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  inputMode="numeric" maxLength={6} placeholder="000000" required data-testid="otp-input" />
                <button type="submit" disabled={loading || otp.length < 6} data-testid="otp-submit-btn"
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-deep-forest-green text-off-white px-4 py-3 text-sm font-medium hover:bg-natural-green transition-colors disabled:opacity-60">
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />} Verify & continue
                </button>
              </form>
              <div className="flex items-center justify-between mt-6 text-sm">
                <button onClick={() => setStep("details")} className="text-charcoal/60 hover:underline">← Edit details</button>
                <button onClick={resend} className="text-deep-forest-green font-medium hover:underline" data-testid="resend-otp-btn">Resend code</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
