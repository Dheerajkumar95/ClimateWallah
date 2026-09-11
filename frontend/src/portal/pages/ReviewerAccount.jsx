import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle, Banknote, Bell, CalendarClock, CheckCircle2, CreditCard, IndianRupee,
  Loader2, RefreshCw, ShieldCheck, WalletCards,
} from "lucide-react";
import { toast } from "sonner";
import { api, apiError } from "@/lib/api";
import { money, openRazorpayCheckout } from "@/lib/razorpay";
import QrPaymentDialog from "@/components/payment/QrPaymentDialog";
import { usePortalAuth } from "../PortalAuthContext";

const fieldClass = "w-full rounded-lg border border-[#E4E7EC] bg-white px-3.5 py-2.5 text-sm text-[#172033] outline-none focus:ring-2 focus:ring-[#27F580]";

export default function ReviewerAccount() {
  const { user } = usePortalAuth();
  const [account, setAccount] = useState(null);
  const [quote, setQuote] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState("razorpay");
  const [qrOrder, setQrOrder] = useState(null);
  const [onboardingAccepted, setOnboardingAccepted] = useState({ guidelines: false, declaration: false });
  const [onboardingBusy, setOnboardingBusy] = useState(false);
  const [payout, setPayout] = useState({
    account_holder_name: "", account_number: "", confirm_account_number: "", ifsc: "",
    upi_id: "", pan: "", gstin: "", gst_registered: false,
  });

  const load = useCallback(async () => {
    try {
      const [{ data }, noticeResponse] = await Promise.all([
        api.get("/reviewer/account"),
        api.get("/reviewer/notifications").catch(() => ({ data: [] })),
      ]);
      setAccount(data);
      setNotifications(noticeResponse.data || []);
      setPayout((current) => ({
        ...current,
        account_holder_name: data.payout_profile?.account_holder_name || data.profile?.name || "",
        ifsc: data.payout_profile?.ifsc || "",
        gstin: data.payout_profile?.gstin || "",
        gst_registered: !!data.payout_profile?.gst_registered,
      }));
      if (data.profile?.reviewer_status === "approved" && data.profile?.requires_subscription) {
        const [response, methodsResponse] = await Promise.all([api.get("/reviewer/plan-quote"), api.get("/payments/methods")]);
        setQuote(response.data);
        const methods = methodsResponse.data || {};
        setPaymentMethods(methods);
        setPaymentMethod(methods.razorpay_enabled ? "razorpay" : "qr");
      }
    } catch (error) {
      toast.error(apiError(error.response?.data?.detail));
      setAccount(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const renew = async () => {
    setBusy(true);
    try {
      if (!paymentMethods?.razorpay_enabled && !paymentMethods?.qr_enabled) throw new Error("No payment method is currently available. Please contact Admin.");
      const { data: order } = await api.post("/reviewer/plan-order", { method: paymentMethod });
      if (paymentMethod === "qr") { setQrOrder(order); return; }
      const result = await openRazorpayCheckout(order, {
        description: `Reviewer plan · ${order.quote?.plan_days || 30} days`,
        prefill: { name: user?.name, email: user?.email, contact: account?.profile?.phone },
      });
      await api.post("/reviewer/payments/verify", result);
      toast.success("Reviewer plan activated successfully");
      await load();
    } catch (error) {
      const message = error.response?.data?.detail || error.message;
      if (message !== "Payment cancelled.") toast.error(apiError(message));
    } finally { setBusy(false); }
  };

  const submitQrPlan = async (utr) => {
    if (!qrOrder) return;
    setBusy(true);
    try {
      await api.post("/reviewer/payments/qr-submit", { internal_id: qrOrder.internal_id, utr });
      toast.success("Payment submitted for Admin verification");
      setQrOrder(null);
      await load();
    } catch (error) { toast.error(apiError(error.response?.data?.detail || error.message)); }
    finally { setBusy(false); }
  };


  const uploadOnboardingDocument = async (documentType, file) => {
    if (!file) return;
    setOnboardingBusy(true);
    try {
      const body = new FormData();
      body.append("document_type", documentType);
      body.append("file", file);
      await api.post("/reviewer/onboarding/documents", body);
      toast.success(`${documentType} document uploaded`);
      await load();
    } catch (error) { toast.error(apiError(error.response?.data?.detail)); }
    finally { setOnboardingBusy(false); }
  };

  const submitOnboarding = async () => {
    if (!onboardingAccepted.guidelines || !onboardingAccepted.declaration) return toast.error("Accept the guidelines and declaration");
    setOnboardingBusy(true);
    try {
      await api.post("/reviewer/onboarding/submit", { guidelines_accepted: true, declaration_accepted: true });
      toast.success("Reviewer application submitted for verification");
      setOnboardingAccepted({ guidelines: false, declaration: false });
      await load();
    } catch (error) { toast.error(apiError(error.response?.data?.detail)); }
    finally { setOnboardingBusy(false); }
  };

  const savePayout = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const { data } = await api.put("/reviewer/payout-profile", payout);
      setAccount((current) => ({ ...current, payout_profile: data }));
      setPayout((current) => ({ ...current, account_number: "", confirm_account_number: "" }));
      toast.success("Payout details saved securely");
    } catch (error) {
      toast.error(apiError(error.response?.data?.detail));
    } finally { setSaving(false); }
  };

  if (account === null) return <div className="flex justify-center py-24"><Loader2 className="h-7 w-7 animate-spin text-[#27F580]" /></div>;
  if (account === false) return <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-700">Unable to load reviewer account.</div>;

  const { profile, subscription, earning_totals: totals, earnings = [], documents = [] } = account;
  const approved = profile?.reviewer_status === "approved";
  const statusTone = approved ? "border-[#27F580] bg-[#E9FFF2]" : profile?.reviewer_status === "rejected" ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50";

  return (
    <div className="space-y-6" data-testid="reviewer-account">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-xs font-semibold uppercase tracking-[.16em] text-[#667085]">Reviewer account</p><h1 className="mt-1 text-3xl font-semibold text-[#111827]">Profile, plan & earnings</h1><p className="mt-1 text-sm text-[#667085]">{profile?.public_id ? `${profile.public_id} · ` : ""}Manage verification, recharge and payout details.</p></div>
        <button onClick={load} className="inline-flex items-center gap-2 self-start rounded-lg border border-[#E4E7EC] bg-white px-3 py-2 text-sm text-[#172033] hover:bg-[#F6F8FA]"><RefreshCw className="h-4 w-4" /> Refresh</button>
      </div>

      <section className={`rounded-2xl border p-5 ${statusTone}`}>
        <div className="flex items-start gap-3">
          {approved ? <CheckCircle2 className="mt-0.5 h-6 w-6 text-[#172033]" /> : <ShieldCheck className="mt-0.5 h-6 w-6 text-amber-700" />}
          <div><div className="font-semibold text-[#172033]">Profile: {reviewerStatusLabel(profile?.reviewer_status)}</div><p className="mt-1 text-sm text-[#667085]">{approved ? "Admin verification complete. Keep the reviewer plan active to receive new assignments." : "Your application is with the admin team. You can sign in and track its status here."}</p>{profile?.reviewer_admin_comment && <p className="mt-2 rounded-lg bg-white/80 p-3 text-sm text-[#172033]"><strong>Admin comment:</strong> {profile.reviewer_admin_comment}</p>}</div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Metric Icon={IndianRupee} label="Available earnings" value={money(totals?.available_paise)} />
        <Metric Icon={Banknote} label="Paid earnings" value={money(totals?.paid_paise)} />
        <Metric Icon={CheckCircle2} label="Projects completed" value={totals?.projects_completed || 0} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border border-[#E4E7EC] bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between"><div><h2 className="flex items-center gap-2 font-semibold text-[#111827]"><CreditCard className="h-5 w-5 text-[#3B82F6]" /> Monthly reviewer plan</h2><p className="mt-1 text-sm text-[#667085]">Required only for receiving new project assignments.</p></div><PlanBadge status={subscription?.status} /></div>
          {subscription?.active && <div className="mb-4 rounded-xl bg-[#E9FFF2] p-4 text-sm text-[#172033]"><div className="font-semibold">Active until {formatDate(subscription.ends_at)}</div><div className="mt-1 text-[#667085]">{subscription.days_remaining} day(s) remaining. Renewal adds time after the current end date.</div></div>}
          {!approved && <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">Plan purchase becomes available after admin approval.</div>}
          {quote && <div className="divide-y divide-[#E4E7EC] rounded-xl border border-[#E4E7EC] px-4 text-sm"><PriceRow label={`Plan (${quote.plan_days} days)`} value={money(quote.subtotal_paise)} /><PriceRow label={`GST (${quote.gst_rate}%)`} value={money(quote.gst_paise)} /><PriceRow label="Total payable" value={money(quote.total_paise)} strong /></div>}
          {approved && profile?.requires_subscription && paymentMethods && <div className="mt-4"><div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#667085]">Payment method</div><div className="grid grid-cols-2 gap-2">{paymentMethods.razorpay_enabled && <button type="button" onClick={() => setPaymentMethod("razorpay")} className={`rounded-lg border px-3 py-2 text-sm font-semibold ${paymentMethod === "razorpay" ? "border-[#27F580] bg-[#E9FFF2]" : "border-[#E4E7EC]"}`}>Razorpay</button>}{paymentMethods.qr_enabled && <button type="button" onClick={() => setPaymentMethod("qr")} className={`rounded-lg border px-3 py-2 text-sm font-semibold ${paymentMethod === "qr" ? "border-[#27F580] bg-[#E9FFF2]" : "border-[#E4E7EC]"}`}>QR / UPI</button>}</div></div>}
          {approved && profile?.requires_subscription && <button onClick={renew} disabled={busy} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#27F580] px-4 py-3 font-semibold text-[#172033] hover:bg-[#20DB72] disabled:opacity-60">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarClock className="h-4 w-4" />} {subscription?.active ? "Extend plan" : "Activate monthly plan"}</button>}
        </section>

        <section className="rounded-2xl border border-[#E4E7EC] bg-white p-5 shadow-sm">
          <h2 className="flex items-center gap-2 font-semibold text-[#111827]"><ShieldCheck className="h-5 w-5 text-[#7C5CFC]" /> Verification documents</h2>
          <div className="mt-4 space-y-2">{documents.length ? documents.map((document) => <div key={document.id} className="flex items-center justify-between rounded-xl border border-[#E4E7EC] px-4 py-3"><div><div className="text-sm font-medium capitalize text-[#172033]">{document.document_type}</div><div className="max-w-[230px] truncate text-xs text-[#667085]">{document.original_name}</div></div><span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold capitalize text-amber-700">{document.status || "pending"}</span></div>) : <p className="rounded-xl border border-dashed border-[#E4E7EC] p-6 text-center text-sm text-[#667085]">No documents uploaded.</p>}</div>
          {["pending_documents", "changes_requested"].includes(profile?.reviewer_status) && <div className="mt-5 rounded-xl border border-[#E4E7EC] bg-[#F6F8FA] p-4"><p className="text-sm font-semibold text-[#172033]">Continue reviewer onboarding</p><p className="mt-1 text-xs text-[#667085]">Upload only missing/corrected files. Existing uploaded files are kept.</p><div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2"><label className="cursor-pointer rounded-lg border border-dashed border-[#98A2B3] bg-white px-3 py-3 text-center text-sm font-medium text-[#172033]">Upload / replace Identity<input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" className="hidden" disabled={onboardingBusy} onChange={(e) => uploadOnboardingDocument("identity", e.target.files?.[0])} /></label><label className="cursor-pointer rounded-lg border border-dashed border-[#98A2B3] bg-white px-3 py-3 text-center text-sm font-medium text-[#172033]">Upload / replace Qualification<input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" className="hidden" disabled={onboardingBusy} onChange={(e) => uploadOnboardingDocument("qualification", e.target.files?.[0])} /></label></div><label className="mt-4 flex items-start gap-2 text-xs text-[#172033]"><input type="checkbox" className="mt-0.5 accent-[#27F580]" checked={onboardingAccepted.guidelines} onChange={(e) => setOnboardingAccepted({ ...onboardingAccepted, guidelines: e.target.checked })} /> I have read and accept the reviewer guidelines.</label><label className="mt-2 flex items-start gap-2 text-xs text-[#172033]"><input type="checkbox" className="mt-0.5 accent-[#27F580]" checked={onboardingAccepted.declaration} onChange={(e) => setOnboardingAccepted({ ...onboardingAccepted, declaration: e.target.checked })} /> I confirm that my submitted information and documents are accurate.</label><button type="button" onClick={submitOnboarding} disabled={onboardingBusy} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#27F580] px-4 py-2.5 text-sm font-semibold text-[#172033] hover:bg-[#20DB72] disabled:opacity-60">{onboardingBusy && <Loader2 className="h-4 w-4 animate-spin" />} Submit / resubmit application</button></div>}
        </section>
      </div>

      <form onSubmit={savePayout} className="rounded-2xl border border-[#E4E7EC] bg-white p-5 shadow-sm">
        <div className="mb-5"><h2 className="flex items-center gap-2 font-semibold text-[#111827]"><WalletCards className="h-5 w-5 text-[#27F580]" /> Payout account</h2><p className="mt-1 text-sm text-[#667085]">Your sensitive bank details are encrypted. Enter either bank details or a UPI ID.</p></div>
        {account.payout_profile?.updated_at && <div className="mb-4 rounded-xl bg-[#F6F8FA] p-3 text-sm text-[#667085]">Saved account: {account.payout_profile.bank_last4 ? `•••• ${account.payout_profile.bank_last4}` : account.payout_profile.upi_masked || "configured"} · {account.payout_profile.verified ? "Verified" : "Pending admin verification"}</div>}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Field label="Account holder name"><input required className={fieldClass} value={payout.account_holder_name} onChange={(e) => setPayout({ ...payout, account_holder_name: e.target.value })} /></Field>
          <Field label="Bank account number"><input className={fieldClass} value={payout.account_number} onChange={(e) => setPayout({ ...payout, account_number: e.target.value })} /></Field>
          <Field label="Confirm account number"><input className={fieldClass} value={payout.confirm_account_number} onChange={(e) => setPayout({ ...payout, confirm_account_number: e.target.value })} /></Field>
          <Field label="IFSC"><input className={fieldClass} value={payout.ifsc} onChange={(e) => setPayout({ ...payout, ifsc: e.target.value.toUpperCase() })} /></Field>
          <Field label="UPI ID (bank alternative)"><input className={fieldClass} value={payout.upi_id} onChange={(e) => setPayout({ ...payout, upi_id: e.target.value })} placeholder="name@bank" /></Field>
          <Field label="PAN"><input className={fieldClass} value={payout.pan} onChange={(e) => setPayout({ ...payout, pan: e.target.value.toUpperCase() })} /></Field>
          <Field label="GSTIN"><input className={fieldClass} value={payout.gstin} onChange={(e) => setPayout({ ...payout, gstin: e.target.value.toUpperCase() })} disabled={!payout.gst_registered} /></Field>
        </div>
        <label className="mt-4 flex items-center gap-2 text-sm text-[#172033]"><input type="checkbox" checked={payout.gst_registered} onChange={(e) => setPayout({ ...payout, gst_registered: e.target.checked })} className="h-4 w-4 accent-[#27F580]" /> I am GST registered (18% GST is added to eligible earnings only when this is enabled).</label>
        <button disabled={saving} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#172033] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#111827] disabled:opacity-60">{saving && <Loader2 className="h-4 w-4 animate-spin" />} Save payout details</button>
      </form>

      <section className="rounded-2xl border border-[#E4E7EC] bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-[#111827]">Earnings ledger</h2>
        <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead><tr className="border-b border-[#E4E7EC] text-xs uppercase tracking-wide text-[#667085]"><th className="py-3">Project</th><th>Completed</th><th>Base</th><th>GST</th><th>Total</th><th>Status</th></tr></thead><tbody>{earnings.map((item) => <tr key={item.id} className="border-b border-[#E4E7EC] last:border-0"><td className="py-3 font-medium text-[#172033]">{item.project_name || item.project_id}</td><td className="text-[#667085]">{formatDate(item.created_at)}</td><td>{money(item.base_paise)}</td><td>{money(item.gst_paise)}</td><td className="font-semibold">{money(item.gross_paise || item.base_paise)}</td><td><span className="capitalize text-[#667085]">{item.status}</span></td></tr>)}{!earnings.length && <tr><td colSpan="6" className="py-10 text-center text-[#667085]">Earnings appear after Admin finalizes your completed projects.</td></tr>}</tbody></table></div>
      </section>

      {!!notifications.length && <section className="rounded-2xl border border-[#E4E7EC] bg-white p-5 shadow-sm"><h2 className="flex items-center gap-2 font-semibold text-[#111827]"><Bell className="h-5 w-5 text-[#F59E0B]" /> Notifications</h2><div className="mt-4 space-y-2">{notifications.slice(0, 8).map((notice) => <div key={notice.id} className="flex items-start gap-3 rounded-xl bg-[#F6F8FA] p-3"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#3B82F6]" /><div><div className="text-sm font-medium text-[#172033]">{notice.title}</div><div className="text-xs text-[#667085]">{notice.message}</div></div></div>)}</div></section>}
      {qrOrder && <QrPaymentDialog order={qrOrder} busy={busy} onCancel={() => setQrOrder(null)} onSubmit={submitQrPlan} />}
    </div>
  );
}

function Field({ label, children }) { return <label className="block"><span className="mb-1.5 block text-sm font-medium text-[#172033]">{label}</span>{children}</label>; }
function Metric({ Icon, label, value }) { return <div className="rounded-2xl border border-[#E4E7EC] bg-white p-5 shadow-sm"><span className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-[#E9FFF2]"><Icon className="h-5 w-5 text-[#172033]" /></span><div className="text-2xl font-semibold text-[#111827]">{value}</div><div className="mt-1 text-sm text-[#667085]">{label}</div></div>; }
function PlanBadge({ status }) { const active = status === "active"; return <span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${active ? "bg-[#E9FFF2] text-[#172033]" : status === "expired" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}>{(status || "not started").replace(/_/g, " ")}</span>; }
function PriceRow({ label, value, strong }) { return <div className={`flex justify-between py-3 ${strong ? "font-semibold text-[#111827]" : "text-[#667085]"}`}><span>{label}</span><span>{value}</span></div>; }
function formatDate(value) { if (!value) return "—"; const date = new Date(value); return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-IN"); }

function reviewerStatusLabel(status) { return ({ pending_documents: "Pending Documents", pending_review: "Under Review", changes_requested: "Changes Requested", approved: "Approved", rejected: "Rejected", suspended: "Suspended" })[status] || "Pending"; }
