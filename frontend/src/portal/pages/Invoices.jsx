import React, { useEffect, useState } from "react";
import { Download, FileText, Loader2, ReceiptIndianRupee } from "lucide-react";
import { api, apiError } from "@/lib/api";
import { usePortalAuth } from "../PortalAuthContext";
import { PageHeader, Card } from "./ui";
import { toast } from "sonner";

const money = (paise = 0) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format((paise || 0) / 100);

export default function Invoices() {
  const { user } = usePortalAuth();
  const role = user?.role === "reviewer" ? "reviewer" : "client";
  const [rows, setRows] = useState(null);
  const [busy, setBusy] = useState(null);

  useEffect(() => {
    api.get(`/${role}/invoices`).then(({ data }) => setRows(data || [])).catch(() => setRows([]));
  }, [role]);

  const download = async (row) => {
    setBusy(row.id);
    try {
      const response = await api.get(`/${role}/invoices/${row.id}/pdf`, { responseType: "blob" });
      const url = URL.createObjectURL(response.data);
      const a = document.createElement("a");
      a.href = url; a.download = `${row.invoice_number || "ClimateWallah-Receipt"}.pdf`; document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch (error) { toast.error(apiError(error.response?.data?.detail) || "Unable to download receipt"); }
    finally { setBusy(null); }
  };

  if (rows === null) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-natural-green" /></div>;
  return <div data-testid="portal-invoices">
    <PageHeader title="Invoices & Receipts" subtitle="Download verified payment receipts for your records." />
    {rows.length === 0 ? <Card className="py-12 text-center"><ReceiptIndianRupee className="mx-auto mb-3 h-9 w-9 text-charcoal/30" /><p className="text-sm text-charcoal/60">No paid invoices are available yet.</p></Card> :
      <div className="space-y-3">{rows.map((row) => <Card key={row.id} className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3"><span className="rounded-xl bg-natural-green/10 p-2.5"><FileText className="h-5 w-5 text-natural-green" /></span><div><div className="font-medium text-charcoal">{row.invoice_number}</div><div className="mt-1 text-xs text-charcoal/55">{row.kind === "client_review_fee" ? "Project Review Fee" : "Reviewer Monthly Plan"} · {row.provider === "razorpay" ? "Razorpay" : "QR / UPI"}</div><div className="mt-1 text-xs text-charcoal/45">{row.paid_at ? new Date(row.paid_at).toLocaleString("en-IN") : ""} · {row.transaction_id || ""}</div></div></div>
        <div className="flex items-center gap-3"><div className="text-right"><div className="font-semibold text-deep-forest-green">{money(row.amount_paise)}</div><div className="text-[11px] font-semibold uppercase tracking-wide text-green-700">Paid</div></div><button onClick={() => download(row)} disabled={busy === row.id} className="inline-flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium text-charcoal hover:border-natural-green disabled:opacity-60">{busy === row.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} PDF</button></div>
      </Card>)}</div>}
  </div>;
}
