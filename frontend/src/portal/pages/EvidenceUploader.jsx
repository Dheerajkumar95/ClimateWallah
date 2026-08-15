import React, { useRef, useState } from "react";
import {
  Paperclip,
  Loader2,
  X,
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import {
  api,
  apiError,
  resolveUploadUrl,
} from "@/lib/api";

const STATUS = {
  pending: {
    Icon: Clock,
    className: "text-amber-600",
    label: "Pending review",
  },
  approved: {
    Icon: CheckCircle2,
    className: "text-[#20DB72]",
    label: "Approved",
  },
  rejected: {
    Icon: XCircle,
    className: "text-red-500",
    label: "Rejected",
  },
};

export function EvidenceUploader({
  projectId,
  criterionId,
  files = [],
  editable = true,
  onChange,
}) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);

  const upload = async (event) => {
    const selectedFiles = Array.from(event.target.files || []);

    if (!selectedFiles.length) return;

    setBusy(true);

    try {
      const uploadedFiles = [];

      for (const selectedFile of selectedFiles) {
        const formData = new FormData();

        formData.append("file", selectedFile);
        formData.append("scope", "evidence");
        formData.append("criterion_id", criterionId);

        const { data } = await api.post(
          `/client/projects/${projectId}/files`,
          formData
        );

        uploadedFiles.push(data);
      }

      onChange?.([...(files || []), ...uploadedFiles]);
      toast.success("Evidence uploaded successfully");
    } catch (error) {
      toast.error(
        apiError(error.response?.data?.detail) || "Upload failed"
      );
    } finally {
      setBusy(false);

      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  };

  const remove = async (fileId) => {
    try {
      await api.delete(
        `/client/projects/${projectId}/files/${fileId}`,
        {
          params: {
            criterion_id: criterionId,
          },
        }
      );

      onChange?.(
        (files || []).filter((file) => file.id !== fileId)
      );

      toast.success("Evidence removed");
    } catch (error) {
      toast.error(apiError(error.response?.data?.detail));
    }
  };

  return (
    <div
      className="mt-3"
      data-testid={`evidence-${criterionId}`}
    >
      {(files || []).length > 0 && (
        <div className="mb-3 space-y-2">
          {files.map((file) => {
            const status = STATUS[file.status] || STATUS.pending;
            const StatusIcon = status.Icon;

            const fallbackUrl =
              `/api/uploads/evidence/${projectId}/${file.filename}`;

            const fileUrl = resolveUploadUrl(
              file.url || fallbackUrl
            );

            return (
              <div
                key={file.id || file.filename}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-[#E4E7EC] bg-white px-3 py-2.5"
              >
                <a
                  href={fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-w-0 flex-1 items-center gap-2 text-sm text-[#172033] hover:text-[#20DB72]"
                  title="Open evidence"
                >
                  <FileText className="h-4 w-4 shrink-0" />

                  <span className="truncate">
                    {file.original_name ||
                      file.filename ||
                      "Evidence file"}
                  </span>
                </a>

                <span
                  className={`inline-flex items-center gap-1 text-xs font-medium ${status.className}`}
                >
                  <StatusIcon className="h-3.5 w-3.5" />
                  {status.label}
                </span>

                {file.review?.comment && (
                  <span
                    className="max-w-xs truncate text-xs text-[#667085]"
                    title={file.review.comment}
                  >
                    “{file.review.comment}”
                  </span>
                )}

                {editable && (
                  <button
                    type="button"
                    onClick={() => remove(file.id)}
                    className="shrink-0 text-[#98A2B3] hover:text-red-500"
                    aria-label={`Remove ${
                      file.original_name || "evidence"
                    }`}
                    data-testid={`evidence-del-${file.id}`}
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {editable && (
        <>
          <input
            ref={inputRef}
            type="file"
            multiple
            hidden
            onChange={upload}
            accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.png,.jpg,.jpeg,.webp,.dwg,.zip"
            data-testid={`evidence-input-${criterionId}`}
          />

          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#172033] hover:text-[#20DB72] disabled:cursor-not-allowed disabled:opacity-60"
            data-testid={`evidence-upload-${criterionId}`}
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Paperclip className="h-4 w-4" />
            )}

            {busy ? "Uploading..." : "Attach evidence"}
          </button>
        </>
      )}
    </div>
  );
}