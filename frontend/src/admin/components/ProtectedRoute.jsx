import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Loader } from "./ui";

export function ProtectedRoute({ children }) {
  const { user } = useAuth();
  const location = useLocation();
  if (user === null) return <div className="min-h-screen bg-off-white"><Loader /></div>;
  if (user === false) return <Navigate to="/admin/login" state={{ from: location }} replace />;
  return children;
}
