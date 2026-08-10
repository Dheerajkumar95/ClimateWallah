import React from "react";

export function PageHeader({ title, subtitle, action }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
      <div>
        <h1 className="text-2xl lg:text-3xl font-serif text-deep-forest-green" data-testid="page-title">{title}</h1>
        {subtitle && <p className="text-sm text-charcoal/60 mt-1">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Card({ children, className = "" }) {
  return <div className={`bg-white border border-border rounded-2xl p-5 ${className}`}>{children}</div>;
}

const STATUS_STYLE = {
  draft: "bg-charcoal/10 text-charcoal/70",
  submitted: "bg-blue-100 text-blue-700",
  assigned: "bg-amber-100 text-amber-700",
  changes_requested: "bg-orange-100 text-orange-700",
  approved: "bg-green-100 text-green-700",
  certified: "bg-natural-green/15 text-natural-green",
  rejected: "bg-red-100 text-red-700",
};

export function StatusBadge({ status }) {
  const label = (status || "draft").replace(/_/g, " ");
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_STYLE[status] || STATUS_STYLE.draft}`} data-testid="status-badge">
      {label}
    </span>
  );
}

const BAND_STYLE = {
  Platinum: "bg-slate-200 text-slate-800",
  Gold: "bg-yellow-100 text-yellow-800",
  Silver: "bg-gray-200 text-gray-700",
  Certified: "bg-natural-green/15 text-natural-green",
  Uncertified: "bg-charcoal/10 text-charcoal/60",
  Pending: "bg-charcoal/10 text-charcoal/50",
};

export function BandBadge({ band }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${BAND_STYLE[band] || BAND_STYLE.Pending}`}>{band}</span>;
}

export function ProgressBar({ value, max }) {
  const pct = max ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="h-2 rounded-full bg-warm-beige overflow-hidden">
      <div className="h-full bg-natural-green transition-all duration-500" style={{ width: `${pct}%` }} />
    </div>
  );
}

export const inpCls = "w-full bg-white border border-border rounded-lg px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-natural-green transition-shadow";
