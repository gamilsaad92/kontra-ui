import { useState } from "react";
import { getAuthToken } from "../../../lib/authToken";
import { useServicingContext } from "./ServicingContext";

const varianceDrivers = [
  "Rent collections down 6% due to seasonal turnover.",
  "Utilities expense up 12% from HVAC replacements.",
  "Capex draw timing shifted two weeks later than forecast.",
];

const riskFlags = [
  "Debt service coverage trending below 1.20x.",
  "Occupancy slipped from 94% to 89% in Q2.",
  "Renewal pipeline delayed for two anchor tenants.",
];

export default function ServicingBorrowerFinancialsPage() {
  const { addAlert, addTask, logAudit, requestApproval } = useServicingContext();
  const [fileName, setFileName] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [analysisReady, setAnalysisReady] = useState(false);

 const handleUpload = async () => {
    if (!selectedFile) {
      console.error("Financial analysis failed: no file selected.");
      return;
    }

    const formData = new FormData();
    formData.append("file", selectedFile);

     const token = await getAuthToken();
    const headers: HeadersInit = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    try {
      const response = await fetch("/api/servicing/financials/analyze", {
        method: "POST",
        headers,
        body: formData,
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error("Financial analysis failed.", {
          status: response.status,
          body: errorBody,
        });
        return;
      }

      const result = await response.json();
      console.info("Financial analysis succeeded.", result);

      setAnalysisReady(true);
      addAlert({
        id: "alert-financial-upload",
        title: "Borrower financial upload received",
        detail: "May 2024 package uploaded; AI summary ready for review.",
        severity: "medium",
        category: "Borrower Financials",
      });
      addTask({
        id: "task-financial-summary",
        title: "Review AI financial summary",
        detail: "Validate variance drivers and confirm borrower explanations.",
        status: "open",
        category: "Borrower Financials",
      });
      logAudit({
        id: `audit-upload-${Date.now()}`,
        action: "Borrower financials uploaded",
        detail: `Uploaded package: ${fileName || "Financials-May-2024.xlsx"}`,
        timestamp: new Date().toISOString(),
        status: "logged",
      });
    } catch (error) {
      console.error("Financial analysis failed.", error);
    }
  };

  const handleRequestClarification = () => {
    requestApproval(
      "Send borrower clarification request",
      "Request follow-up on revenue variance and vacancy assumptions."
    );
  };

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Borrower Financial Uploads</h2>
        <p className="mt-1 text-sm text-slate-500">
          Collect borrower financials, run AI analysis, and route outputs for human approval.
        </p>
        <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center">
          <input
            type="file"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              setSelectedFile(file);
              setFileName(file?.name || "");
            }}
          />
          <button
            type="button"
            onClick={handleUpload}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
          >
            Upload & analyze
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-400">
          {fileName ? `Selected: ${fileName}` : "No file selected yet."}
        </p>
      </section>

      <section className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            AI period summary
          </h3>
          {analysisReady ? (
            <div className="mt-3 space-y-4 text-sm text-slate-700">
              <p>
                Q2 revenue held at $1.82M with NOI compressing 4% due to utilities and insurance
                increases. Operating cash flow remains positive, but DSCR dipped to 1.17x.
              </p>
              <div>
                <p className="text-xs font-semibold uppercase text-slate-500">Variance drivers</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
                  {varianceDrivers.map((driver) => (
                    <li key={driver}>{driver}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-slate-500">Risk indicators</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
                  {riskFlags.map((risk) => (
                    <li key={risk}>{risk}</li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-500">
              Upload the borrower package to generate an AI summary for review.
            </p>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Approval actions
          </h3>
          <p className="mt-3 text-sm text-slate-600">
            External notifications and borrower follow-ups require human approval before release.
          </p>
          <button
            type="button"
            onClick={handleRequestClarification}
            className="mt-4 w-full rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-900"
          >
            Request clarification approval
          </button>
          <div className="mt-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
            AI summary is stored in the servicing audit log once approved.
          </div>
        </div>
      </section>
    </div>
  );
}
