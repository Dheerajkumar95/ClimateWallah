import React from "react";
import { Link } from "react-router-dom";
import * as Icons from "lucide-react";

export function ServiceIcon({ name, className = "h-7 w-7" }) {
  const key = (name || "leaf")
    .split("-")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join("");
  const Cmp = Icons[key] || Icons.Leaf;
  return <Cmp className={className} strokeWidth={1.5} />;
}

export function CertBadge({ children }) {
  return (
    <span className="inline-block bg-light-mint text-deep-forest-green text-xs uppercase tracking-wider font-semibold px-3 py-1 rounded-full">
      {children}
    </span>
  );
}

export function Overline({ children, className = "" }) {
  return (
    <span className={`text-sm font-sans uppercase tracking-[0.2em] font-semibold text-deep-forest-green ${className}`}>
      {children}
    </span>
  );
}

export function TeamAvatar({ name, image, size = "h-28 w-28" }) {
  const initials = (name || "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  if (image) {
    return <img src={image} alt={name} className={`${size} rounded-full object-cover`} />;
  }
  return (
    <div className={`${size} rounded-full bg-light-mint text-deep-forest-green flex items-center justify-center font-serif text-3xl`}>
      {initials}
    </div>
  );
}

export function ProjectCard({ project }) {
  return (
    <Link
      to={`/projects/${project.slug}`}
      data-testid={`project-card-${project.slug}`}
      className="group block bg-white border border-black/5 rounded-lg overflow-hidden"
    >
      <div className="aspect-[4/3] overflow-hidden bg-warm-beige">
        <img
          src={project.cover_image}
          alt={project.title}
          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
      </div>
      <div className="p-6">
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <CertBadge>{project.category}</CertBadge>
        </div>
        <h3 className="text-xl md:text-2xl text-deep-forest-green leading-snug">{project.title}</h3>
        <div className="mt-2 flex items-center gap-1.5 text-sm text-charcoal/60">
          <Icons.MapPin className="h-4 w-4" />
          {project.location}
        </div>
      </div>
    </Link>
  );
}
