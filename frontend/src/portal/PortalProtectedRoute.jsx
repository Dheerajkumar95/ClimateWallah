import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { usePortalAuth } from "./PortalAuthContext";

export function PortalProtectedRoute({ children, roles }) {
  const { user } = usePortalAuth();
  const location = useLocation();

  if (user === null) {
    return (
      <div className="min-h-screen bg-off-white flex items-center justify-center" data-testid="portal-loading">
        <Loader2 className="h-6 w-6 animate-spin text-natural-green" />
      </div>
    );
  }
  if (user === false) {
    return <Navigate to="/portal/login" state={{ from: location }} replace />;
  }
  if (roles && !roles.includes(user.role)) {
    const home = user.role === "reviewer" ? "/reviewer" : user.role === "admin" ? "/admin" : "/portal";
    return <Navigate to={home} replace />;
  }
  return children;
}
