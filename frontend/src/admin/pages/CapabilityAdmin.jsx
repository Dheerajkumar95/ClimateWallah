import React, { useEffect, useState, useRef } from "react";
import { Upload, Download, FileText, Loader2 } from "lucide-react";
import { api, apiError } from "@/lib/api";
import { toast } from "sonner";
import { Btn } from "@/admin/components/ui";

export default function CapabilityAdmin() {
  const [doc, setDoc] = useState(null);
  const [uploading, setUploading] = useState(false);
  const ref = useRef();

  const load = async () => { try { const { data } = await api.get("/admin/capability-profile"); setDoc(data); } catch { setDoc({}); } };
  useEffect(() => { load(); }, []);

  const upload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      await api.post("/admin/capability-profile", fd, { headers: { "Content-Type": "multipart/form-data" } });
      toast.success("Capability PDF updated");
      load();
    } catch (e) { toast.error(apiError(e.response?.data?.detail)); }
    finally { setUploading(false); }
  };

  return (
    <div data-testid="admin-capability">
      <h1 className="text-3xl font-serif text-deep-forest-green">Capability PDF</h1>
      <p className="text-charcoal/60 mt-1">Upload or replace the public capability profile. The public download link stays the same.</p>

      <div className="mt-8 bg-white border border-border rounded-xl p-8 max-w-2xl">
        {doc?.url ? (
          <div className="flex items-center gap-4">
            <span className="h-16 w-16 rounded-xl bg-light-mint text-deep-forest-green flex items-center justify-center"><FileText className="h-8 w-8" /></span>
            <div className="flex-1">
              <div className="font-medium text-charcoal">{doc.original_name || "Capability Profile.pdf"}</div>
              <div className="text-sm text-charcoal/60">{doc.size ? `${(doc.size / 1024 / 1024).toFixed(2)} MB` : ""} · Updated {(doc.updated_at || "").slice(0, 10)}</div>
              <div className="mt-3 flex gap-3">
                <a href={doc.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm text-natural-green font-medium hover:underline"><Download className="h-4 w-4" /> Preview / Download</a>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-charcoal/60 flex items-center gap-3"><FileText className="h-6 w-6" /> No capability PDF uploaded yet.</div>
        )}

        <div className="mt-6 border-t border-border pt-6">
          <Btn onClick={() => ref.current?.click()} disabled={uploading} data-testid="upload-capability">
            {uploading ? <><Loader2 className="h-4 w-4 animate-spin" /> Uploading...</> : <><Upload className="h-4 w-4" /> {doc?.url ? "Replace PDF" : "Upload PDF"}</>}
          </Btn>
          <input ref={ref} type="file" accept="application/pdf" className="hidden" onChange={(e) => upload(e.target.files[0])} />
          <p className="mt-2 text-xs text-charcoal/50">PDF only, up to 10 MB.</p>
        </div>
      </div>
    </div>
  );
}
