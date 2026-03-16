import React, { useMemo, useState, useEffect } from 'react';
import { API_BASE } from '../lib/apiBase';

const emptyEvidence = { notifications: [], waivers: [], application: null };

export default function Compliance() {
  const [scanText, setScanText] = useState('');
  const [scanResult, setScanResult] = useState(null);
  const [scanLoading, setScanLoading] = useState(false);
  const [scanError, setScanError] = useState('');

  const [loanId, setLoanId] = useState('');
  const [evidence, setEvidence] = useState(null);
  const [evidenceLoading, setEvidenceLoading] = useState(false);
  const [evidenceError, setEvidenceError] = useState('');

  const [closingForm, setClosingForm] = useState({
    borrower: '',
    property: '',
    loan_amount: '',
    closing_date: '',
  });
  const [closingUrl, setClosingUrl] = useState('');
  const [closingStatus, setClosingStatus] = useState('');
  const [closingError, setClosingError] = useState('');
  const [closingLoading, setClosingLoading] = useState(false);

  useEffect(() => () => {
    if (closingUrl) URL.revokeObjectURL(closingUrl);
  }, [closingUrl]);

  const issues = useMemo(() => scanResult?.issues ?? [], [scanResult]);
  const evidenceSummary = useMemo(() => evidence ?? emptyEvidence, [evidence]);

  const handleScan = async (event) => {
    event.preventDefault();
    setScanError('');
    setScanResult(null);
    if (!scanText.trim()) {
      setScanError('Provide document text to scan.');
      return;
    }
    setScanLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/regulatory-scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: scanText }),
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.message || 'Scan failed');
      }
      setScanResult(payload);
    } catch (err) {
      setScanError(err.message || 'Failed to run scan');
    } finally {
      setScanLoading(false);
    }
  };

  const handleEvidence = async (event) => {
    event.preventDefault();
    setEvidenceError('');
    setEvidence(null);
    if (!loanId.trim()) {
      setEvidenceError('Enter a loan ID to gather evidence.');
      return;
    }
    setEvidenceLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/evidence-dossier/${loanId}`);
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.message || 'Evidence lookup failed');
      }
      setEvidence(payload.evidence || emptyEvidence);
    } catch (err) {
      setEvidenceError(err.message || 'Failed to gather evidence');
    } finally {
      setEvidenceLoading(false);
    }
  };

  const handleClosingChange = (field) => (event) => {
    const value = event.target.value;
    setClosingForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleClosingDoc = async (event) => {
    event.preventDefault();
    setClosingStatus('');
    setClosingError('');
    const { borrower, property, loan_amount, closing_date } = closingForm;
    if (!borrower || !property || !loan_amount || !closing_date) {
      setClosingError('All closing statement fields are required.');
      return;
    }
    setClosingLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/generate-closing-doc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          borrower,
          property,
          loan_amount,
          closing_date,
        }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.message || 'Failed to generate closing doc');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      if (closingUrl) URL.revokeObjectURL(closingUrl);
      setClosingUrl(url);
      setClosingStatus('Closing statement ready for download.');
    } catch (err) {
      setClosingError(err.message || 'Failed to generate closing doc');
    } finally {
      setClosingLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-lg bg-white p-6 shadow">
        <header className="mb-4">
          <h2 className="text-xl font-semibold text-slate-900">Regulatory Scan</h2>
          <p className="text-sm text-slate-600">
            Run automated policy checks on disclosure copy or closing documents before they reach the customer.
          </p>
        </header>
        <form onSubmit={handleScan} className="space-y-4">
          <textarea
            className="h-32 w-full rounded border border-slate-300 p-3 text-sm focus:border-red-500 focus:outline-none"
            placeholder="Paste marketing or disclosure text for review"
            value={scanText}
            onChange={(event) => setScanText(event.target.value)}
          />
          <button
            type="submit"
            className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            disabled={scanLoading}
          >
            {scanLoading ? 'Scanning…' : 'Run Regulatory Scan'}
          </button>
        </form>
        {scanError && <p className="mt-3 text-sm text-red-600">{scanError}</p>}
        {issues.length > 0 && (
          <div className="mt-4">
            <h3 className="text-sm font-semibold text-slate-800">Flagged Issues</h3>
            <ul className="mt-2 space-y-2">
              {issues.map((issue, index) => (
                <li key={`${issue.rule}-${index}`} className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  <p className="font-medium">{issue.rule}</p>
                  <p>{issue.message}</p>
                </li>
              ))}
            </ul>
          </div>
        )}
        {issues.length === 0 && scanResult && (
          <p className="mt-3 rounded border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            No compliance exceptions detected in this draft.
          </p>
        )}
      </section>

      <section className="rounded-lg bg-white p-6 shadow">
        <header className="mb-4">
          <h2 className="text-xl font-semibold text-slate-900">Evidence Dossier</h2>
          <p className="text-sm text-slate-600">
            Retrieve the communications, waivers, and application package tied to a specific loan.
          </p>
        </header>
        <form onSubmit={handleEvidence} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex-1 text-sm">
            <span className="mb-1 block font-medium text-slate-700">Loan ID</span>
            <input
              className="w-full rounded border border-slate-300 p-2 focus:border-red-500 focus:outline-none"
              placeholder="e.g. 18"
              value={loanId}
              onChange={(event) => setLoanId(event.target.value)}
            />
          </label>
          <button
            type="submit"
            className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
            disabled={evidenceLoading}
          >
            {evidenceLoading ? 'Loading…' : 'Assemble Dossier'}
          </button>
        </form>
        {evidenceError && <p className="mt-3 text-sm text-red-600">{evidenceError}</p>}
        {evidence && (
          <div className="mt-4 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-800">Notifications ({evidenceSummary.notifications.length})</h3>
              {evidenceSummary.notifications.length === 0 ? (
                <p className="text-sm text-slate-500">No borrower communications captured for this loan.</p>
              ) : (
                <ul className="mt-2 space-y-2 text-sm">
                  {evidenceSummary.notifications.map((item, index) => (
                    <li key={`notification-${index}`} className="rounded border border-slate-200 p-3">
                      <p className="font-medium">{item.subject || 'Notification'}</p>
                      <p className="text-slate-600">{item.message || 'Message body unavailable.'}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-800">Lien Waivers ({evidenceSummary.waivers.length})</h3>
              {evidenceSummary.waivers.length === 0 ? (
                <p className="text-sm text-slate-500">No waivers uploaded.</p>
              ) : (
                <ul className="mt-2 grid gap-2 text-sm md:grid-cols-2">
                  {evidenceSummary.waivers.map((waiver) => (
                    <li key={waiver.id} className="rounded border border-slate-200 p-3">
                      <p className="font-medium">{waiver.file_url || 'Uploaded file'}</p>
                      <p className="text-slate-600">
                        {waiver.verification_passed ? 'Verified ✅' : 'Verification pending'}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-800">Application Summary</h3>
              {evidenceSummary.application ? (
                <pre className="mt-2 max-h-60 overflow-auto rounded border border-slate-200 bg-slate-50 p-3 text-xs">
                  {JSON.stringify(evidenceSummary.application, null, 2)}
                </pre>
              ) : (
                <p className="text-sm text-slate-500">Loan application details were not located.</p>
              )}
            </div>
          </div>
        )}
      </section>

      <section className="rounded-lg bg-white p-6 shadow">
        <header className="mb-4">
          <h2 className="text-xl font-semibold text-slate-900">Generate Closing Statement</h2>
          <p className="text-sm text-slate-600">
            Produce a borrower-ready PDF using the compliance-approved template.
          </p>
        </header>
        <form onSubmit={handleClosingDoc} className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Borrower</span>
            <input
              className="w-full rounded border border-slate-300 p-2 focus:border-red-500 focus:outline-none"
              value={closingForm.borrower}
              onChange={handleClosingChange('borrower')}
              placeholder="Borrower name"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Property</span>
            <input
              className="w-full rounded border border-slate-300 p-2 focus:border-red-500 focus:outline-none"
              value={closingForm.property}
              onChange={handleClosingChange('property')}
              placeholder="123 Main St"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Loan Amount</span>
            <input
              className="w-full rounded border border-slate-300 p-2 focus:border-red-500 focus:outline-none"
              value={closingForm.loan_amount}
              onChange={handleClosingChange('loan_amount')}
              placeholder="250000"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Closing Date</span>
            <input
              type="date"
              className="w-full rounded border border-slate-300 p-2 focus:border-red-500 focus:outline-none"
              value={closingForm.closing_date}
              onChange={handleClosingChange('closing_date')}
            />
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              disabled={closingLoading}
            >
              {closingLoading ? 'Generating…' : 'Generate Closing Doc'}
            </button>
          </div>
        </form>
        {closingStatus && (
          <p className="mt-3 rounded border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{closingStatus}</p>
        )}
        {closingError && <p className="mt-3 text-sm text-red-600">{closingError}</p>}
        {closingUrl && (
          <a
            href={closingUrl}
            download="closing-statement.pdf"
            className="mt-4 inline-flex items-center text-sm font-medium text-red-700 hover:text-red-900"
          >
            Download closing statement ↗
          </a>
        )}
      </section>
    </div>
  );
}
