import React, { useEffect, useState } from "react";
import { Eye } from "lucide-react";
import { toast } from "sonner";
import { api, apiError } from "@/lib/api";
import { Empty, InfoItem, ModalShell, Spin, Table } from "./PortalUi";

export default function PortalClients() {
  const [rows, setRows] = useState(null);
  const [clientId, setClientId] = useState(null);

  useEffect(() => {
    api.get("/admin/portal/clients")
      .then(({ data }) => setRows(data))
      .catch(() => setRows([]));
  }, []);

  if (rows === null) return <Spin />;

  return (
    <div>
      <h1 className="mb-1 text-2xl font-serif text-[#172033]">Portal Clients</h1>
      <p className="mb-6 text-sm text-[#667085]">Clients who self-registered for the certification portal.</p>

      <Table head={["Name", "Email", "Organization", "Projects", "Registered", "Actions"]} testid="clients-table">
        {rows.length === 0 ? <Empty text="No clients yet." /> : rows.map((client) => (
          <tr key={client.id} data-testid={`client-row-${client.id}`}>
            <td className="px-4 py-3 font-medium text-[#172033]">{client.name}</td>
            <td className="px-4 py-3 text-[#667085]">{client.email}</td>
            <td className="px-4 py-3 text-[#667085]">{client.organization || "—"}</td>
            <td className="px-4 py-3 text-[#172033]">{client.project_count}</td>
            <td className="px-4 py-3 text-[#667085]">{(client.created_at || "").slice(0, 10)}</td>
            <td className="px-4 py-3">
              <button
                type="button"
                onClick={() => setClientId(client.id)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#E4E7EC] bg-white px-3 py-1.5 text-xs font-semibold text-[#172033] hover:border-[#27F580] hover:bg-[#E9FFF2]"
                data-testid={`client-view-${client.id}`}
              >
                <Eye className="h-3.5 w-3.5" /> View
              </button>
            </td>
          </tr>
        ))}
      </Table>

      {clientId && <ClientDetailModal clientId={clientId} onClose={() => setClientId(null)} />}
    </div>
  );
}

function ClientDetailModal({ clientId, onClose }) {
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    api.get(`/admin/portal/clients/${clientId}`)
      .then(({ data }) => setDetail(data))
      .catch((error) => {
        toast.error(apiError(error.response?.data?.detail));
        onClose();
      });
  }, [clientId, onClose]);

  return (
    <ModalShell title="Client Details" subtitle={detail?.email} onClose={onClose}>
      {!detail ? <Spin /> : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <InfoItem label="Name" value={detail.name} />
            <InfoItem label="Email" value={detail.email} />
            <InfoItem label="Phone" value={detail.phone} />
            <InfoItem label="Organization" value={detail.organization} />
            <InfoItem label="City" value={detail.city} />
            <InfoItem label="Email verified" value={detail.email_verified ? "Yes" : "No"} />
            <InfoItem label="Registered" value={(detail.created_at || "").slice(0, 10)} />
            <InfoItem label="Total projects" value={detail.project_count || 0} />
          </div>

          <div>
            <h3 className="mb-3 font-semibold text-[#111827]">Projects</h3>
            <Table head={["Project", "Type", "Status", "Score", "Reviewer", "Created"]}>
              {!detail.projects?.length ? <Empty text="No projects." /> : detail.projects.map((project) => (
                <tr key={project.id}>
                  <td className="px-4 py-3 font-medium text-[#172033]">{project.name}</td>
                  <td className="px-4 py-3 text-[#667085]">{project.project_type}</td>
                  <td className="px-4 py-3 capitalize text-[#667085]">{(project.status || "").replace(/_/g, " ")}</td>
                  <td className="px-4 py-3 text-[#172033]">{project.claimed_total || 0}/{project.total_max || 0}</td>
                  <td className="px-4 py-3 text-[#667085]">{project.reviewer?.name || "—"}</td>
                  <td className="px-4 py-3 text-[#667085]">{(project.created_at || "").slice(0, 10)}</td>
                </tr>
              ))}
            </Table>
          </div>
        </div>
      )}
    </ModalShell>
  );
}