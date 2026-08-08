import React from "react";
import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center text-center px-6" data-testid="notfound-page">
      <div className="text-8xl font-serif text-light-mint">404</div>
      <h1 className="mt-4 text-3xl font-serif text-deep-forest-green">Page not found</h1>
      <p className="mt-3 text-charcoal/60">The page you're looking for doesn't exist.</p>
      <Link to="/" className="mt-8 rounded-full bg-deep-forest-green text-off-white px-7 py-3 font-medium hover:bg-natural-green transition-colors">Back home</Link>
    </div>
  );
}
