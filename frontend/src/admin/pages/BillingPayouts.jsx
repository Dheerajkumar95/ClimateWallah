import React, { useEffect, useMemo, useState } from "react";
import { Banknote, CheckCircle2, CreditCard, IndianRupee, Loader2, Save, Send, Settings2, Upload, WalletCards, X, XCircle } from "lucide-react";
import { toast } from "sonner";
import { api, apiError, resolveUploadUrl } from "@/lib/api";
import { money } from "@/lib/razorpay";

const inputClass = "w-full rounded-lg border border-[#E4E7EC] bg-white px-3 py-2.5 text-sm text-[#172033] outline-none focus:ring-2 focus:ring-[#27F580]";

function groupEarnings(earnings) {
  return Object.values(earnings.filter((item) => item.status === "approved").reduce((groups, item) => {
    const month = String(item.approved_at || item.created_at || "").slice(0, 7) || "Unscheduled";
    const key = `${item.reviewer_id}:${month}`;
    if (!groups[key]) groups[key] = { reviewer_id: item.reviewer_id, reviewer: item.reviewer, month, items: [], amount: 0 };
    groups[key].items.push(item); groups[key].amount += item.gross_paise || item.base_paise || 0; return groups;
  }, {})).sort((a, b) => String(b.month).localeCompare(String(a.month)));
}

export default function BillingPayouts() {
  const [settings, setSettings] = useState(null);
  const [gateway, setGateway] = useState(null);
  const [earnings, setEarnings] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [busy, setBusy] = useState(false);
  const [payoutReviewer, setPayoutReviewer] = useState(null);
  const [markPaid, setMarkPaid] = useState(null);
  const [utr, setUtr] = useState("");

  const load = async () => {
    try {
      const [a,b,c,d,e] = await Promise.all([
        api.get("/admin/portal/billing-settings"), api.get("/admin/portal/payment-settings"),
        api.get("/admin/portal/earnings"), api.get("/admin/portal/payouts"), api.get("/admin/portal/transactions"),
      ]);
      setSettings(a.data); setGateway(b.data); setEarnings(c.data || []); setPayouts(d.data || []); setTransactions(e.data || []);
    } catch (error) { toast.error(apiError(error.response?.data?.detail)); }
  };
  useEffect(() => { load(); }, []);
  const groups = useMemo(() => groupEarnings(earnings), [earnings]);

  const saveBilling = async () => {
    setBusy(true); try {
      const { data } = await api.put("/admin/portal/billing-settings", {
        ...settings, gst_rate: Number(settings.gst_rate), reviewer_monthly_plan_paise: Number(settings.reviewer_monthly_plan_paise),
        reviewer_project_earning_paise: Number(settings.reviewer_project_earning_paise), reviewer_plan_days: Number(settings.reviewer_plan_days),
        area_tiers: (settings.area_tiers || []).map((tier) => ({ ...tier, max_sqft: Number(tier.max_sqft), base_paise: Number(tier.base_paise) })),
      }); setSettings(data); toast.success("Billing settings saved");
    } catch (error) { toast.error(apiError(error.response?.data?.detail)); } finally { setBusy(false); }
  };

  const saveGateway = async () => {
    setBusy(true); try {
      const payload = { ...gateway, key_id: gateway.key_id || undefined, key_secret: gateway.key_secret || undefined, payment_webhook_secret: gateway.payment_webhook_secret || undefined };
      const { data } = await api.put("/admin/portal/payment-settings", payload); setGateway(data); toast.success("Payment gateway settings saved");
    } catch (error) { toast.error(apiError(error.response?.data?.detail)); } finally { setBusy(false); }
  };

  const testRazorpay = async () => {
    setBusy(true); try { await api.post("/admin/portal/payment-settings/test-razorpay"); toast.success("Razorpay connection successful"); await load(); }
    catch (error) { toast.error(apiError(error.response?.data?.detail)); } finally { setBusy(false); }
  };

  const uploadQr = async (file) => {
    if (!file) return; setBusy(true);
    try { const body = new FormData(); body.append("file", file); const { data } = await api.post("/admin/portal/payment-settings/qr-image", body); setGateway({ ...gateway, qr_image_url: data.qr_image_url }); toast.success("QR image uploaded"); }
    catch (error) { toast.error(apiError(error.response?.data?.detail)); } finally { setBusy(false); }
  };

  const createPayout = async () => {
    setBusy(true); try { const { data } = await api.post("/admin/portal/payouts", { reviewer_id: payoutReviewer.reviewer_id, earning_ids: payoutReviewer.items.map((x) => x.id), notes: "Month-end reviewer payout" }); toast.success(data.status === "awaiting_manual_transfer" ? "Manual payout batch created" : "Payout initiated"); setPayoutReviewer(null); await load(); }
    catch (error) { toast.error(apiError(error.response?.data?.detail)); } finally { setBusy(false); }
  };

  const completeManual = async () => {
    if (!utr.trim()) return toast.error("Enter UTR / transaction reference"); setBusy(true);
    try { await api.post(`/admin/portal/payouts/${markPaid.id}/mark-paid`, { utr }); toast.success("Payout marked as paid"); setMarkPaid(null); setUtr(""); await load(); }
    catch (error) { toast.error(apiError(error.response?.data?.detail)); } finally { setBusy(false); }
  };

  const decidePayment = async (row, decision) => {
    setBusy(true); try { await api.post(`/admin/portal/transactions/${row.id}/${decision}`, { notes: decision === "reject" ? "Transaction could not be verified." : null }); toast.success(decision === "approve" ? "Payment approved" : "Payment rejected"); await load(); }
    catch (error) { toast.error(apiError(error.response?.data?.detail)); } finally { setBusy(false); }
  };

  if (!settings || !gateway) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  const pendingVerification = transactions.filter((x) => x.provider === "qr_upi" && x.status === "verification_pending").length;

  return <div className="space-y-6 pb-10">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-[#667085]">Finance control</p><h1 className="mt-1 text-3xl font-semibold text-[#111827]">Billing & Payments</h1><p className="mt-1 text-sm text-[#667085]">Production Razorpay, QR/UPI, pricing, transactions and reviewer payouts.</p></div><div className="flex gap-2"><StatusPill active={gateway.razorpay_enabled && gateway.razorpay_configured} label="Razorpay" /><StatusPill active={gateway.qr_enabled} label="QR / UPI" /></div></div>

    <section className="rounded-2xl border border-[#E4E7EC] bg-white p-5 shadow-sm">
      <div className="flex items-start gap-3"><Settings2 className="mt-0.5 h-5 w-5 text-[#27F580]" /><div><h2 className="font-semibold text-[#111827]">Payment Gateway Settings</h2><p className="mt-1 text-sm text-[#667085]">Only active methods are shown to clients and reviewers. Secrets stay server-side and are stored encrypted.</p></div></div>
      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-2">
        <div className="rounded-xl border border-[#E4E7EC] p-4">
          <div className="mb-4 flex items-center justify-between"><div><h3 className="font-semibold text-[#172033]">Razorpay</h3><p className="text-xs text-[#667085]">Online UPI, cards and netbanking.</p></div><Toggle checked={!!gateway.razorpay_enabled} onChange={(v) => setGateway({ ...gateway, razorpay_enabled: v })} /></div>
          <div className="space-y-3"><Field label={`Key ID ${gateway.key_id_masked ? `(${gateway.key_id_masked})` : ""}`}><input className={inputClass} value={gateway.key_id || ""} onChange={(e) => setGateway({ ...gateway, key_id: e.target.value })} placeholder="rzp_live_..." /></Field><Field label={`Key Secret ${gateway.key_secret_masked ? `(${gateway.key_secret_masked})` : ""}`}><input type="password" className={inputClass} value={gateway.key_secret || ""} onChange={(e) => setGateway({ ...gateway, key_secret: e.target.value })} placeholder="Leave blank to keep saved secret" /></Field><Field label={`Webhook Secret ${gateway.webhook_secret_masked ? `(${gateway.webhook_secret_masked})` : ""}`}><input type="password" className={inputClass} value={gateway.payment_webhook_secret || ""} onChange={(e) => setGateway({ ...gateway, payment_webhook_secret: e.target.value })} placeholder="Optional but recommended" /></Field></div>
          <button type="button" onClick={testRazorpay} disabled={busy || !gateway.razorpay_configured} className="mt-4 rounded-lg border border-[#E4E7EC] px-4 py-2 text-sm font-semibold text-[#172033] disabled:opacity-50">Test connection</button>
        </div>
        <div className="rounded-xl border border-[#E4E7EC] p-4">
          <div className="mb-4 flex items-center justify-between"><div><h3 className="font-semibold text-[#172033]">QR / UPI</h3><p className="text-xs text-[#667085]">Manual verification by Admin.</p></div><Toggle checked={!!gateway.qr_enabled} onChange={(v) => setGateway({ ...gateway, qr_enabled: v })} /></div>
          <div className="grid gap-3 sm:grid-cols-2"><Field label="UPI ID"><input className={inputClass} value={gateway.upi_id || ""} onChange={(e) => setGateway({ ...gateway, upi_id: e.target.value })} placeholder="business@bank" /></Field><Field label="Payee name"><input className={inputClass} value={gateway.payee_name || ""} onChange={(e) => setGateway({ ...gateway, payee_name: e.target.value })} /></Field></div>
          <div className="mt-4 flex items-center gap-4">{gateway.qr_image_url ? <img src={resolveUploadUrl(gateway.qr_image_url)} alt="Payment QR" className="h-28 w-28 rounded-xl border object-contain p-1" /> : <div className="flex h-28 w-28 items-center justify-center rounded-xl border border-dashed text-xs text-[#667085]">No QR</div>}<label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[#E4E7EC] px-4 py-2 text-sm font-semibold text-[#172033]"><Upload className="h-4 w-4" /> Upload QR<input type="file" accept=".png,.jpg,.jpeg,.webp" className="hidden" onChange={(e) => uploadQr(e.target.files?.[0])} /></label></div>
        </div>
      </div>
      <button onClick={saveGateway} disabled={busy} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#172033] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"><Save className="h-4 w-4" /> Save payment settings</button>
    </section>

    <section className="rounded-2xl border border-[#E4E7EC] bg-white p-5 shadow-sm"><h2 className="font-semibold text-[#111827]">Pricing & GST</h2><div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-4"><Field label="GST rate (%)"><input className={inputClass} type="number" value={settings.gst_rate} onChange={(e) => setSettings({ ...settings, gst_rate: e.target.value })} /></Field><Field label="Reviewer plan base (₹)"><RupeeInput paise={settings.reviewer_monthly_plan_paise} onChange={(v) => setSettings({ ...settings, reviewer_monthly_plan_paise: v })} /></Field><Field label="Reviewer earning/project (₹)"><RupeeInput paise={settings.reviewer_project_earning_paise} onChange={(v) => setSettings({ ...settings, reviewer_project_earning_paise: v })} /></Field><Field label="Plan days"><input className={inputClass} type="number" value={settings.reviewer_plan_days} onChange={(e) => setSettings({ ...settings, reviewer_plan_days: e.target.value })} /></Field></div><div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">{(settings.area_tiers || []).map((tier,index) => <div key={tier.id} className="rounded-xl bg-[#F6F8FA] p-4"><input className={`${inputClass} mb-2`} value={tier.label} onChange={(e) => setSettings({ ...settings, area_tiers: settings.area_tiers.map((x,i) => i===index ? {...x,label:e.target.value}:x) })} /><Field label="Maximum sq ft"><input className={inputClass} type="number" value={tier.max_sqft} onChange={(e) => setSettings({ ...settings, area_tiers: settings.area_tiers.map((x,i) => i===index ? {...x,max_sqft:e.target.value}:x) })} /></Field><Field label="Base price (₹)"><RupeeInput paise={tier.base_paise} onChange={(v) => setSettings({ ...settings, area_tiers: settings.area_tiers.map((x,i) => i===index ? {...x,base_paise:v}:x) })} /></Field></div>)}</div><button onClick={saveBilling} disabled={busy} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#172033] px-5 py-2.5 text-sm font-semibold text-white"><Save className="h-4 w-4" /> Save pricing</button></section>

    <div className="grid grid-cols-1 gap-4 md:grid-cols-4"><Metric Icon={IndianRupee} label="Approved unpaid" value={money(groups.reduce((s,g)=>s+g.amount,0))} /><Metric Icon={WalletCards} label="Transactions" value={transactions.length} /><Metric Icon={CreditCard} label="Awaiting QR verification" value={pendingVerification} /><Metric Icon={Banknote} label="Payout batches" value={payouts.length} /></div>

    <section className="rounded-2xl border border-[#E4E7EC] bg-white p-5 shadow-sm"><h2 className="font-semibold text-[#111827]">Payment transactions</h2><p className="mt-1 text-xs text-[#667085]">Razorpay payments are signature-verified automatically. QR / UPI payments require Admin approval.</p><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[1000px] text-left text-sm"><thead className="bg-[#F6F8FA] text-xs uppercase text-[#667085]"><tr><th className="px-4 py-3">Reference</th><th>Owner</th><th>Purpose</th><th>Method</th><th>Amount</th><th>Status</th><th>Date</th><th className="px-4">Action</th></tr></thead><tbody>{transactions.map((row)=><tr key={row.id} className="border-t"><td className="px-4 py-3 font-mono text-xs">{row.transaction_id || row.provider_order_id || row.razorpay_order_id || "—"}</td><td><div>{row.owner?.name || row.owner_id}</div><div className="text-xs text-[#667085]">{row.owner?.public_id || row.owner?.email}</div></td><td className="capitalize text-[#667085]">{String(row.kind||"").replace(/_/g," ")}</td><td><MethodBadge provider={row.provider} /></td><td className="font-semibold">{money(row.amount_paise)}</td><td className="capitalize text-[#667085]">{String(row.status||"").replace(/_/g," ")}</td><td className="text-[#667085]">{(row.created_at||"").slice(0,10)}</td><td className="px-4">{row.provider === "qr_upi" && row.status === "verification_pending" ? <div className="flex gap-2"><button onClick={() => decidePayment(row,"approve")} disabled={busy} className="inline-flex items-center gap-1 rounded-lg bg-[#E9FFF2] px-3 py-2 text-xs font-semibold text-[#172033]"><CheckCircle2 className="h-4 w-4"/> Approve</button><button onClick={() => decidePayment(row,"reject")} disabled={busy} className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700"><XCircle className="h-4 w-4"/> Reject</button></div> : "—"}</td></tr>)}{!transactions.length && <tr><td colSpan="8" className="p-10 text-center text-[#667085]">No payment transactions yet.</td></tr>}</tbody></table></div></section>

    <PayoutGroups groups={groups} onSelect={setPayoutReviewer} />
    <section className="rounded-2xl border border-[#E4E7EC] bg-white p-5 shadow-sm"><h2 className="font-semibold text-[#111827]">Payout history</h2><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead className="bg-[#F6F8FA] text-xs uppercase text-[#667085]"><tr><th className="px-4 py-3">Reviewer</th><th>Provider</th><th>Amount</th><th>Status</th><th>Reference</th><th>Created</th><th className="px-4">Action</th></tr></thead><tbody>{payouts.map((p)=><tr key={p.id} className="border-t"><td className="px-4 py-3">{p.reviewer?.name || p.reviewer_id}</td><td className="capitalize">{p.provider}</td><td className="font-semibold">{money(p.amount_paise)}</td><td className="capitalize text-[#667085]">{String(p.status||"").replace(/_/g," ")}</td><td className="font-mono text-xs text-[#667085]">{p.transaction_id || p.utr || p.razorpay_payout_id || "—"}</td><td className="text-[#667085]">{(p.created_at||"").slice(0,10)}</td><td className="px-4">{p.status === "awaiting_manual_transfer" ? <button onClick={() => setMarkPaid(p)} className="rounded-lg border border-[#27F580] px-3 py-2 text-xs font-semibold">Mark paid</button> : "—"}</td></tr>)}</tbody></table></div></section>

    {payoutReviewer && <Modal title="Confirm payout" close={() => setPayoutReviewer(null)}><p className="text-sm text-[#667085]">Create a payout batch for approved reviewer earnings.</p><div className="my-5 rounded-xl bg-[#E9FFF2] p-5 text-center text-3xl font-semibold">{money(payoutReviewer.amount)}</div><button onClick={createPayout} disabled={busy} className="w-full rounded-lg bg-[#27F580] px-4 py-3 font-semibold">Create payout</button></Modal>}
    {markPaid && <Modal title="Record manual payout" close={() => setMarkPaid(null)}><Field label="UTR / bank transaction reference"><input autoFocus value={utr} onChange={(e)=>setUtr(e.target.value)} className={inputClass}/></Field><button onClick={completeManual} disabled={busy} className="mt-5 w-full rounded-lg bg-[#172033] px-4 py-3 font-semibold text-white">Confirm payment</button></Modal>}
  </div>;
}

function PayoutGroups({ groups, onSelect }) { return <section className="rounded-2xl border border-[#E4E7EC] bg-white p-5 shadow-sm"><h2 className="font-semibold text-[#111827]">Reviewer payouts due</h2><p className="mt-1 text-xs text-[#667085]">Only approved real earnings appear here.</p><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm"><thead className="bg-[#F6F8FA] text-xs uppercase text-[#667085]"><tr><th className="px-4 py-3">Reviewer</th><th>Month</th><th>Projects</th><th>Payable</th><th className="px-4">Action</th></tr></thead><tbody>{groups.map((g)=><tr key={`${g.reviewer_id}:${g.month}`} className="border-t"><td className="px-4 py-3"><div className="font-medium">{g.reviewer?.name || g.reviewer_id}</div><div className="text-xs text-[#667085]">{g.reviewer?.email}</div></td><td>{g.month}</td><td>{g.items.length}</td><td className="font-semibold">{money(g.amount)}</td><td className="px-4"><button onClick={()=>onSelect(g)} className="inline-flex items-center gap-2 rounded-lg bg-[#27F580] px-3 py-2 text-xs font-semibold"><Send className="h-4 w-4"/> Create payout</button></td></tr>)}{!groups.length&&<tr><td colSpan="5" className="p-10 text-center text-[#667085]">No approved unpaid earnings.</td></tr>}</tbody></table></div></section>; }
function StatusPill({active,label}) { return <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${active ? "bg-[#E9FFF2] text-[#172033]" : "bg-[#F2F4F7] text-[#667085]"}`}>{label}: {active ? "Active" : "Inactive"}</span>; }
function MethodBadge({provider}) { return <span className="rounded-full bg-[#F2F4F7] px-2.5 py-1 text-xs font-semibold text-[#172033]">{provider === "qr_upi" ? "QR / UPI" : provider === "razorpay" ? "Razorpay" : provider || "—"}</span>; }
function Toggle({checked,onChange}) { return <button type="button" onClick={()=>onChange(!checked)} className={`relative h-6 w-11 rounded-full transition ${checked ? "bg-[#27F580]" : "bg-[#D0D5DD]"}`}><span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${checked ? "left-5" : "left-0.5"}`}/></button>; }
function Field({label,children}) { return <label className="block"><span className="mb-1.5 block text-sm font-medium text-[#172033]">{label}</span>{children}</label>; }
function RupeeInput({paise,onChange}) { return <input className={inputClass} type="number" min="0" step="0.01" value={Number(paise||0)/100} onChange={(e)=>onChange(Math.round(Number(e.target.value||0)*100))}/>; }
function Metric({Icon,label,value}) { return <div className="rounded-2xl border border-[#E4E7EC] bg-white p-5"><Icon className="h-5 w-5 text-[#27F580]"/><div className="mt-3 text-2xl font-semibold">{value}</div><div className="text-sm text-[#667085]">{label}</div></div>; }
function Modal({title,close,children}) { return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" onClick={close}><div className="w-full max-w-lg rounded-2xl bg-white p-6" onClick={(e)=>e.stopPropagation()}><div className="mb-5 flex items-center justify-between"><h2 className="text-xl font-semibold">{title}</h2><button onClick={close}><X className="h-5 w-5 text-[#667085]"/></button></div>{children}</div></div>; }
