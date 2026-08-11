import React, { useState } from "react";
import { useNavigate, useLocation, Navigate } from "react-router-dom";
import { Eye, EyeOff, Leaf, Loader2 } from "lucide-react";
import { useAuth, apiError } from "@/context/AuthContext";

export default function Login() {
  const { user, login } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  if (user && user !== false) return <Navigate to={location.state?.from?.pathname || "/admin"} replace />;

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(identifier, password);
      navigate(location.state?.from?.pathname || "/admin", { replace: true });
    } catch (err) {
      setError(apiError(err.response?.data?.detail) || "Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-deep-forest-green flex items-center justify-center px-6" data-testid="admin-login-page">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2.5 text-off-white justify-center mb-8">
          <span className="h-11 w-11 rounded-full bg-off-white/15 flex items-center justify-center"><Leaf className="h-6 w-6" /></span>
          <span className="font-serif text-3xl">RES Admin</span>
        </div>
        <div className="bg-off-white rounded-2xl p-8 shadow-2xl">
          <h1 className="text-2xl font-serif text-deep-forest-green">Sign in</h1>
          <p className="text-sm text-charcoal/60 mt-1">Access the RES content management panel.</p>
          <form onSubmit={submit} className="mt-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-charcoal/80 mb-1.5">Admin ID or Email</label>
              <input data-testid="login-identifier" value={identifier} onChange={(e) => setIdentifier(e.target.value)} required autoFocus
                className="w-full bg-white border border-border rounded-lg px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-natural-green" />
            </div>
            <div>
              <label className="block text-sm font-medium text-charcoal/80 mb-1.5">Password</label>
              <div className="relative">
                <input data-testid="login-password" type={show ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} required
                  className="w-full bg-white border border-border rounded-lg px-3.5 py-2.5 pr-11 text-sm outline-none focus:ring-2 focus:ring-natural-green" />
                <button type="button" data-testid="toggle-password" onClick={() => setShow((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-charcoal/50 hover:text-charcoal">
                  {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>
            {error && <div data-testid="login-error" className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</div>}
            <button type="submit" data-testid="login-submit" disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-deep-forest-green text-off-white py-3 font-medium hover:bg-natural-green transition-colors disabled:opacity-60">
              {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Signing in...</> : "Sign in"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
