import { useState } from "react";
import { useServicingContext } from "./ServicingContext";

type PhotoItem = {
  id: string;
  name: string;
  status: "pass" | "fail" | "needs-review";
};

export default function ServicingPhotoValidationPanel({ context }: { context: string }) {
  const { addAlert, addTask, logAudit, requestApproval } = useServicingContext();
  const [uploads, setUploads] = useState<PhotoItem[]>([
    { id: `${context}-1`, name: "photo-set-001.jpg", status: "needs-review" },
  ]);

  const handleUpload = (fileName: string) => {
    const id = `${context}-${Date.now()}`;
    setUploads((prev) => [{ id, name: fileName, status: "needs-review" }, ...prev]);
    addAlert({
      id: `alert-${id}`,
      title: "AI photo validation queued",
      detail: `${fileName} queued for AI validation in ${context}.`,
      severity: "medium",
      category: "AI Validation",
    });
    addTask({
      id: `task-${id}`,
      title: "Review AI photo validation",
      detail: `Validate ${fileName} results for ${context}.`,
      status: "open",
      category: "AI Validation",
    });
    logAudit({
      id: `audit-${id}`,
      action: "Photo validation queued",
      detail: `${fileName} uploaded for ${context}.`,
      timestamp: new Date().toISOString(),
      status: "logged",
    });
  };

  const updateStatus = (id: string, status: PhotoItem["status"]) => {
    setUploads((prev) => prev.map((item) => (item.id === id ? { ...item, status } : item)));
    logAudit({
      id: `audit-status-${id}`,
      action: "Photo validation status updated",
      detail: `${context} ${id} marked ${status}.`,
      timestamp: new Date().toISOString(),
      status: "logged",
    });
  };

  const requestReleaseApproval = (item: PhotoItem) => {
    requestApproval(
      "Approve photo validation release",
      `Approve external release for ${item.name} in ${context}.`
    );
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">AI photo validation</h3>
          <p className="text-sm text-slate-500">
            Upload and validate photos with AI. Human approval required before any external actions.
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
          {context}
        </span>
      </div>

      <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center">
        <input
          type="file"
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) handleUpload(file.name);
          }}
        />
      </div>

      <div className="mt-4 space-y-3">
        {uploads.map((item) => (
          <div key={item.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-slate-900">{item.name}</p>
                <p className="text-xs text-slate-500">Status: {item.status.replace("-", " ")}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => updateStatus(item.id, "pass")}
                  className="rounded-full border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-700"
                >
                  Pass
                </button>
                <button
                  type="button"
                  onClick={() => updateStatus(item.id, "fail")}
                  className="rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-600"
                >
                  Fail
                </button>
                <button
                  type="button"
                  onClick={() => updateStatus(item.id, "needs-review")}
                  className="rounded-full border border-amber-200 px-3 py-1 text-xs font-semibold text-amber-700"
                >
                  Needs review
                </button>
                <button
                  type="button"
                  onClick={() => requestReleaseApproval(item)}
                  className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700"
                >
                  Request release approval
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
