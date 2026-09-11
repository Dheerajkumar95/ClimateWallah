import React, { useState } from "react";
import { Copy, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { money } from "@/lib/razorpay";
import { resolveUploadUrl } from "@/lib/api";

export default function QrPaymentDialog({ order, busy, onSubmit, onCancel }) {
  const [utr, setUtr] = useState("");
  if (!order) return null;
  const copy = async (value) => {
    try { await navigator.clipboard.writeText(value); toast.success("Copied"); } catch { toast.error("Could not copy"); }
  };
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4" onClick={() => !busy && onCancel?.()}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div><p className="text-xs font-semibold uppercase tracking-[.14em] text-[#667085]">QR / UPI payment</p><h2 className="mt-1 text-xl font-semibold text-[#111827]">Pay {money(order.amount)}</h2></div>
          <button onClick={() => !busy && onCancel?.()}><X className="h-5 w-5 text-[#667085]" /></button>
        </div>
        {order.qr_image_url ? <div className="mt-5 flex justify-center"><img src={resolveUploadUrl(order.qr_image_url)} alt="Payment QR" className="h-56 w-56 rounded-xl border border-[#E4E7EC] object-contain p-2" /></div> : <div className="mt-5 rounded-xl border border-dashed border-[#D0D5DD] bg-[#F9FAFB] p-6 text-center text-sm text-[#667085]">Use the UPI ID below to make the payment.</div>}
        <div className="mt-4 rounded-xl bg-[#F6F8FA] p-4 text-sm">
          <div className="flex items-center justify-between gap-3"><span className="text-[#667085]">UPI ID</span><button type="button" onClick={() => copy(order.upi_id)} className="flex items-center gap-1 font-semibold text-[#172033]">{order.upi_id}<Copy className="h-3.5 w-3.5" /></button></div>
          {order.payee_name && <div className="mt-2 flex justify-between gap-3"><span className="text-[#667085]">Payee</span><span className="font-medium text-[#172033]">{order.payee_name}</span></div>}
          <div className="mt-2 flex justify-between gap-3"><span className="text-[#667085]">Exact amount</span><span className="font-semibold text-[#172033]">{money(order.amount)}</span></div>
        </div>
        <label className="mt-5 block"><span className="mb-1.5 block text-sm font-medium text-[#172033]">UTR / Transaction reference</span><input value={utr} onChange={(e) => setUtr(e.target.value)} placeholder="Enter after successful payment" className="w-full rounded-lg border border-[#E4E7EC] px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#27F580]" /></label>
        <p className="mt-2 text-xs leading-5 text-[#667085]">Your payment will be marked as paid only after Admin verifies the transaction reference.</p>
        <button onClick={() => onSubmit?.(utr.trim())} disabled={busy || utr.trim().length < 4} className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-[#27F580] px-4 py-3 text-sm font-semibold text-[#172033] disabled:opacity-50">{busy && <Loader2 className="h-4 w-4 animate-spin" />} Submit for verification</button>
      </div>
    </div>
  );
}
