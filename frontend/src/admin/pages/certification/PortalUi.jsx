import React from "react";
import { Loader2, X } from "lucide-react";

export const Table = ({ head, children, testid }) => (
  <div className="overflow-hidden rounded-xl border border-[#E4E7EC] bg-white" data-testid={testid}>
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-[#F6F8FA] text-[#667085]">
          <tr>
            {head.map((item) => (
              <th key={item} className="whitespace-nowrap px-4 py-3 text-left font-medium">
                {item}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#E4E7EC]">{children}</tbody>
      </table>
    </div>
  </div>
);

export const Empty = ({ text }) => (
  <tr>
    <td colSpan={12} className="px-4 py-10 text-center text-[#667085]">
      {text}
    </td>
  </tr>
);

export const Spin = () => (
  <div className="flex justify-center py-16">
    <Loader2 className="h-6 w-6 animate-spin text-[#27F580]" />
  </div>
);

export function ModalShell({ title, subtitle, onClose, children, width = "max-w-4xl" }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" onClick={onClose}>
      <div
        className={`flex max-h-[90vh] w-full ${width} flex-col overflow-hidden rounded-2xl border border-[#E4E7EC] bg-white shadow-2xl`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-[#E4E7EC] px-6 py-4">
          <div>
            <h2 className="text-xl font-semibold text-[#111827]">{title}</h2>
            {subtitle && <p className="mt-1 text-sm text-[#667085]">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-[#667085] hover:bg-[#F6F8FA] hover:text-[#172033]"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  );
}

export function InfoItem({ label, value }) {
  const displayValue = value === null || value === undefined || value === "" ? "—" : String(value);
  return (
    <div className="rounded-xl border border-[#E4E7EC] bg-[#F6F8FA] px-4 py-3">
      <div className="text-xs font-medium uppercase tracking-wide text-[#667085]">{label}</div>
      <div className="mt-1 break-words text-sm font-medium text-[#172033]">{displayValue}</div>
    </div>
  );
}