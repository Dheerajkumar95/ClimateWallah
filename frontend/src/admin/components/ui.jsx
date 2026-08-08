import React, { useState, useRef } from "react";
import { X, Upload, Loader2, Plus, Trash2 } from "lucide-react";
import { api, apiError } from "@/lib/api";
import { toast } from "sonner";

export function Btn({ children, variant = "primary", className = "", ...props }) {
  const base = "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-60";
  const styles = {
    primary: "bg-deep-forest-green text-off-white hover:bg-natural-green",
    outline: "border border-border bg-white text-charcoal hover:bg-warm-beige",
    danger: "bg-destructive text-white hover:opacity-90",
    ghost: "text-charcoal/70 hover:bg-warm-beige",
  };
  return <button className={`${base} ${styles[variant]} ${className}`} {...props}>{children}</button>;
}

export function Field({ label, help, children }) {
  return (
    <div>
      {label && <label className="block text-sm font-medium text-charcoal/80 mb-1.5">{label}</label>}
      {children}
      {help && <p className="mt-1 text-xs text-charcoal/50">{help}</p>}
    </div>
  );
}

const inpCls = "w-full bg-white border border-border rounded-lg px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-natural-green transition-shadow";

export function TextInput({ value, onChange, ...props }) {
  return <input className={inpCls} value={value ?? ""} onChange={(e) => onChange(e.target.value)} {...props} />;
}

export function TextArea({ value, onChange, rows = 4, ...props }) {
  return <textarea rows={rows} className={inpCls + " resize-y"} value={value ?? ""} onChange={(e) => onChange(e.target.value)} {...props} />;
}

export function Select({ value, onChange, options, ...props }) {
  return (
    <select className={inpCls} value={value ?? ""} onChange={(e) => onChange(e.target.value)} {...props}>
      {options.map((o) => (typeof o === "string" ? <option key={o} value={o}>{o}</option> : <option key={o.value} value={o.value}>{o.label}</option>))}
    </select>
  );
}

export function Toggle({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="inline-flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-natural-green rounded-full"
    >
      <span className={`h-7 w-12 rounded-full transition-colors relative shrink-0 ${checked ? "bg-natural-green" : "bg-charcoal/25"}`}>
        <span className={`absolute top-1 left-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${checked ? "translate-x-5" : "translate-x-0"}`} />
      </span>
      {label && <span className="text-sm text-charcoal/80">{label}</span>}
    </button>
  );
}

export function Modal({ open, onClose, title, children, wide }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/50 p-4 py-10" onClick={onClose}>
      <div className={`bg-off-white rounded-xl shadow-2xl w-full ${wide ? "max-w-3xl" : "max-w-xl"} my-auto`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h3 className="text-lg font-serif text-deep-forest-green">{title}</h3>
          <button onClick={onClose} className="text-charcoal/50 hover:text-charcoal"><X className="h-5 w-5" /></button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

export function ConfirmDialog({ open, onClose, onConfirm, title, message }) {
  return (
    <Modal open={open} onClose={onClose} title={title || "Confirm"}>
      <p className="text-charcoal/70">{message}</p>
      <div className="mt-6 flex justify-end gap-3">
        <Btn variant="outline" onClick={onClose}>Cancel</Btn>
        <Btn variant="danger" onClick={onConfirm} data-testid="confirm-delete">Delete</Btn>
      </div>
    </Modal>
  );
}

export function ImagePicker({ value, onChange, label = "Image" }) {
  const [uploading, setUploading] = useState(false);
  const ref = useRef();
  const upload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await api.post("/admin/uploads", fd, { headers: { "Content-Type": "multipart/form-data" } });
      onChange(data.url);
      toast.success("Image uploaded");
    } catch (e) {
      toast.error(apiError(e.response?.data?.detail));
    } finally {
      setUploading(false);
    }
  };
  return (
    <Field label={label}>
      <div className="flex items-center gap-4">
        {value ? <img src={value} alt="" className="h-16 w-16 rounded-lg object-cover border border-border" /> : <div className="h-16 w-16 rounded-lg bg-warm-beige border border-border" />}
        <div className="flex-1 flex gap-2">
          <TextInput value={value} onChange={onChange} placeholder="Image URL or upload" />
          <Btn variant="outline" type="button" onClick={() => ref.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          </Btn>
          <input ref={ref} type="file" accept="image/*" className="hidden" onChange={(e) => upload(e.target.files[0])} />
        </div>
      </div>
    </Field>
  );
}

export function TagsEditor({ value = [], onChange, label, placeholder = "Add item and press Enter" }) {
  const [text, setText] = useState("");
  const add = () => { if (text.trim()) { onChange([...(value || []), text.trim()]); setText(""); } };
  return (
    <Field label={label}>
      <div className="flex gap-2">
        <TextInput value={text} onChange={setText} placeholder={placeholder} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
        <Btn variant="outline" type="button" onClick={add}><Plus className="h-4 w-4" /></Btn>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {(value || []).map((v, i) => (
          <span key={i} className="inline-flex items-center gap-1.5 bg-light-mint text-deep-forest-green text-sm px-3 py-1 rounded-full">
            {v}
            <button type="button" onClick={() => onChange(value.filter((_, idx) => idx !== i))}><X className="h-3.5 w-3.5" /></button>
          </span>
        ))}
      </div>
    </Field>
  );
}

export function Loader() {
  return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-natural-green" /></div>;
}

export function Empty({ message, action }) {
  return (
    <div className="text-center py-20 text-charcoal/50">
      <p>{message}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
