import React from "react";
import { Link } from "react-router-dom";
import { Globe, ShieldCheck, ArrowRight } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const Cardy = ({ to, Icon, title, desc, testid }) => (
  <Link to={to} data-testid={testid}
    className="group relative overflow-hidden rounded-2xl border border-border bg-white p-8 hover:border-turquoise transition-colors">
    <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-turquoise/10 group-hover:bg-turquoise/20 transition-colors" />
    <span className="relative inline-flex h-14 w-14 items-center justify-center rounded-xl bg-deep-forest-green text-off-white"><Icon className="h-7 w-7" /></span>
    <h2 className="relative mt-6 text-2xl font-serif text-deep-forest-green">{title}</h2>
    <p className="relative mt-2 text-sm text-charcoal/65 leading-relaxed">{desc}</p>
    <span className="relative mt-6 inline-flex items-center gap-2 text-sm font-medium text-natural-green group-hover:gap-3 transition-all">Open workspace <ArrowRight className="h-4 w-4" /></span>
  </Link>
);

export default function WorkspaceSwitcher() {
  const { user } = useAuth();
  return (
    <div className="max-w-4xl mx-auto py-6" data-testid="workspace-switcher">
      <div className="mb-8">
        <h1 className="text-3xl font-serif text-deep-forest-green">Welcome, {user?.name || "Admin"}</h1>
        <p className="text-sm text-charcoal/60 mt-1">Choose a workspace to manage.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Cardy to="/admin/dashboard" Icon={Globe} title="Website Management" testid="ws-website"
          desc="Manage the public RES website — homepage, content, services, projects, team, events, blog, media, enquiries and SEO." />
        <Cardy to="/admin/certification" Icon={ShieldCheck} title="Certification & Project Portal" testid="ws-certification"
          desc="Manage clients, reviewers, certification projects, assignments, reviews and final assessments." />
      </div>
    </div>
  );
}
