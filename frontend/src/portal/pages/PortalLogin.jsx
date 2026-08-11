import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Leaf, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { usePortalAuth, apiError } from "../PortalAuthContext";

const inpCls = "w-full bg-white border border-border rounded-lg px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-natural-green transition-shadow";

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
    <div className="min-h-screen bg-off-white flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <Link to="/" className="flex items-center justify-center gap-2.5 mb-8">
          <span className="h-11 w-11 rounded-xl bg-natural-green/10 flex items-center justify-center"><Leaf className="h-6 w-6 text-natural-green" /></span>
          <span className="font-serif text-2xl text-deep-forest-green">RES Certification Portal</span>
        </Link>
        <div className="bg-white border border-border rounded-2xl shadow-sm p-8">
          <h1 className="text-2xl font-serif text-deep-forest-green">Sign in</h1>
          <p className="text-sm text-charcoal/60 mt-1 mb-6">Access your certification workspace.</p>
          <form onSubmit={submit} className="space-y-4" data-testid="portal-login-form">
            <div>
              <label className="block text-sm font-medium text-charcoal/80 mb-1.5">Email</label>
              <input className={inpCls} type="text" value={identifier} onChange={(e) => setIdentifier(e.target.value)}
                placeholder="you@company.com" required data-testid="login-email-input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-charcoal/80 mb-1.5">Password</label>
              <input className={inpCls} type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••" required data-testid="login-password-input" />
            </div>
            <button type="submit" disabled={loading} data-testid="login-submit-btn"
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-deep-forest-green text-off-white px-4 py-3 text-sm font-medium hover:bg-natural-green transition-colors disabled:opacity-60">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />} Sign in
            </button>
          </form>
          <p className="text-sm text-charcoal/60 mt-6 text-center">
            New client?{" "}
            <Link to="/portal/register" className="text-deep-forest-green font-medium hover:underline" data-testid="go-register-link">Create an account</Link>
          </p>
        </div>
        <p className="text-xs text-charcoal/40 text-center mt-6">Reviewer & admin accounts are provisioned by RES.</p>
      </div>
    </div>
  );
}
