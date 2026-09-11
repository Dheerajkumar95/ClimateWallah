import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Leaf, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { usePortalAuth, apiError } from "../PortalAuthContext";

const inpCls = "w-full bg-white border border-[#E4E7EC] rounded-lg px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#27F580] transition-shadow";

function roleHome(role) {
  return role === "admin" ? "/admin" : role === "reviewer" ? "/reviewer/dashboard" : "/portal/dashboard";
}

export default function PortalLogin() {
  const { login } = usePortalAuth();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await login(identifier, password);
      toast.success(`Welcome back, ${user.name || "there"}`);
      navigate(roleHome(user.role));
    } catch (err) {
      toast.error(apiError(err.response?.data?.detail) || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F6F8FA] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <Link to="/" className="flex items-center justify-center gap-2.5 mb-8">
          <span className="h-11 w-11 rounded-xl bg-[#E9FFF2] flex items-center justify-center"><Leaf className="h-6 w-6 text-[#172033]" /></span>
          <span className="font-serif text-2xl text-[#172033]">ClimateWallah Portal</span>
        </Link>
        <div className="bg-white border border-border rounded-2xl shadow-sm p-8">
          <h1 className="text-2xl font-serif text-[#172033]">Sign in</h1>
          <p className="text-sm text-charcoal/60 mt-1 mb-6">Access your certification workspace.</p>
          <form onSubmit={submit} className="space-y-4" data-testid="portal-login-form">
            <div>
              <label className="block text-sm font-medium text-charcoal/80 mb-1.5">Email / Client ID / Reviewer ID</label>
              <input className={inpCls} type="text" value={identifier} onChange={(e) => setIdentifier(e.target.value)}
                placeholder="you@company.com, CLI-000001 or REV-000001" required data-testid="login-email-input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-charcoal/80 mb-1.5">Password</label>
              <input className={inpCls} type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••" required data-testid="login-password-input" />
            </div>
            <button type="submit" disabled={loading} data-testid="login-submit-btn"
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[#172033] text-white px-4 py-3 text-sm font-medium hover:bg-[#111827] transition-colors disabled:opacity-60">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />} Sign in
            </button>
            <div className="text-right"><Link to="/portal/forgot-password" className="text-sm font-semibold text-[#172033] hover:underline">Forgot password?</Link></div>
          </form>
          <p className="text-sm text-charcoal/60 mt-6 text-center">
            New client?{" "}
            <Link to="/portal/register" className="text-[#172033] font-semibold hover:underline" data-testid="go-register-link">Create an account</Link>
          </p>
          <div className="my-5 flex items-center gap-3 text-xs text-[#667085]"><span className="h-px flex-1 bg-[#E4E7EC]" />OR<span className="h-px flex-1 bg-[#E4E7EC]" /></div>
          <Link to="/portal/reviewer-register" className="flex w-full items-center justify-center rounded-lg border border-[#27F580] bg-[#E9FFF2] px-4 py-3 text-sm font-semibold text-[#172033] hover:bg-[#27F580]">Become a Reviewer</Link>
        </div>
        <p className="text-xs text-[#667085] text-center mt-6">Admin access is invitation-only. Reviewer profiles require verification.</p>
      </div>
    </div>
  );
}
