import React, { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { api, apiError } from "@/lib/api";
import { toast } from "sonner";
import { Btn, Field } from "@/admin/components/ui";

function PwInput({ value, onChange, testid }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input data-testid={testid} type={show ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full bg-white border border-border rounded-lg px-3.5 py-2.5 pr-11 text-sm outline-none focus:ring-2 focus:ring-natural-green" />
      <button type="button" onClick={() => setShow((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-charcoal/50">{show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}</button>
    </div>
  );
}

export default function ChangePassword() {
  const [cur, setCur] = useState("");
  const [nw, setNw] = useState("");
  const [conf, setConf] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (nw !== conf) { toast.error("New passwords do not match"); return; }
    setSaving(true);
    try {
      await api.post("/admin/auth/change-password", { current_password: cur, new_password: nw, confirm_password: conf });
      toast.success("Password changed successfully");
      setCur(""); setNw(""); setConf("");
    } catch (err) { toast.error(apiError(err.response?.data?.detail)); }
    finally { setSaving(false); }
  };

  return (
    <div data-testid="admin-change-password">
      <h1 className="text-3xl font-serif text-deep-forest-green">Change Password</h1>
      <p className="text-charcoal/60 mt-1">New password must contain upper-case, lower-case and numeric characters.</p>
      <form onSubmit={submit} className="mt-6 bg-white border border-border rounded-xl p-6 md:p-8 max-w-md space-y-4">
        <Field label="Current password"><PwInput value={cur} onChange={setCur} testid="current-password" /></Field>
        <Field label="New password"><PwInput value={nw} onChange={setNw} testid="new-password" /></Field>
        <Field label="Confirm new password"><PwInput value={conf} onChange={setConf} testid="confirm-password" /></Field>
        <Btn type="submit" disabled={saving} data-testid="submit-change-password">{saving ? "Updating..." : "Update password"}</Btn>
      </form>
    </div>
  );
}
