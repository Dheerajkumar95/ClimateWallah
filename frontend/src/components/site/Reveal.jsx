import React from "react";
import { motion } from "framer-motion";

export function Reveal({ children, delay = 0, y = 24, className = "", as = "div" }) {
  const M = motion[as] || motion.div;
  return (
    <M
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.8, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </M>
  );
}

// Plain container. Each StaggerItem self-triggers on scroll so items animate
// reliably even when their data loads asynchronously after mount.
export function Stagger({ children, className = "" }) {
  return <div className={className}>{children}</div>;
}

export function StaggerItem({ children, className = "", y = 24, delay = 0 }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}
