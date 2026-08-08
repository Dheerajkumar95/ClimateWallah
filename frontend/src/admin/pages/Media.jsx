import React, { useEffect, useState, useRef } from "react";
import { Upload, Copy, Trash2, Loader2, Image as ImageIcon } from "lucide-react";
import { api, apiError } from "@/lib/api";
import { toast } from "sonner";
import { Btn, ConfirmDialog, Loader, Empty } from "@/admin/components/ui";

export default function Media() {
  const [items, setItems] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const ref = useRef();

  const load = async () => { try { const { data } = await api.get("/admin/uploads"); setItems(data); } catch { setItems([]); } };
  useEffect(() => { load(); }, []);

  const upload = async (files) => {
    setUploading(true);
    try {
      for (const file of files) {
        const fd = new FormData();
        fd.append("file", file);
        await api.post("/admin/uploads", fd, { headers: { "Content-Type": "multipart/form-data" } });
      }
      toast.success("Uploaded");
      load();
    } catch (e) { toast.error(apiError(e.response?.data?.detail)); }
    finally { setUploading(false); }
  };

  const del = async () => {
    try { await api.delete(`/admin/uploads/${confirm.id}`); toast.success("Deleted"); setConfirm(null); load(); }
    catch (e) { toast.error(apiError(e.response?.data?.detail)); }
  };

  const copy = (url) => { navigator.clipboard.writeText(url); toast.success("URL copied"); };

  return (
    <div data-testid="admin-media">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-serif text-deep-forest-green">Media Library</h1>
          <p className="text-charcoal/60 mt-1">Upload and manage images (JPEG, PNG, WebP).</p>
        </div>
        <Btn onClick={() => ref.current?.click()} disabled={uploading} data-testid="upload-media">
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Upload images
        </Btn>
        <input ref={ref} type="file" accept="image/*" multiple className="hidden" onChange={(e) => upload(Array.from(e.target.files))} />
      </div>

      <div className="mt-6">
        {items === null ? <Loader /> : items.length === 0 ? (
          <div className="bg-white border border-border rounded-xl"><Empty message="No images uploaded yet." /></div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {items.map((m) => (
              <div key={m.id} className="bg-white border border-border rounded-xl overflow-hidden group">
                <div className="aspect-square bg-warm-beige overflow-hidden"><img src={m.url} alt={m.original_name} className="h-full w-full object-cover" /></div>
                <div className="p-3">
                  <div className="text-xs text-charcoal/60 truncate">{m.original_name}</div>
                  <div className="mt-2 flex gap-2">
                    <button onClick={() => copy(m.url)} className="flex-1 inline-flex items-center justify-center gap-1 text-xs bg-warm-beige rounded-lg py-1.5 hover:bg-light-mint transition-colors"><Copy className="h-3.5 w-3.5" /> Copy</button>
                    <button onClick={() => setConfirm(m)} className="inline-flex items-center justify-center text-destructive bg-destructive/10 rounded-lg px-2.5 py-1.5"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog open={!!confirm} onClose={() => setConfirm(null)} onConfirm={del} title="Delete image" message="Warning: if this image is used on the website, it will break. Delete anyway?" />
    </div>
  );
}
