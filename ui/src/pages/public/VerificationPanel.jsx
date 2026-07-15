import React, { useState, useEffect } from "react";

const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/+$/, "");

const STATUS_CONFIG = {
  verified: {
    icon: "✓",
    label: "Verified",
    bg: "#f0fdf4",
    border: "#bbf7d0",
    color: "#16a34a",
    dot: "#16a34a",
  },
  discrepancy: {
    icon: "⚠",
    label: "Discrepancy Found",
    bg: "#fff7ed",
    border: "#fed7aa",
    color: "#c2410c",
    dot: "#f97316",
  },
  pending_review: {
    icon: "○",
    label: "Pending Review",
    bg: "#f9fafb",
    border: "#e5e7eb",
    color: "#6b7280",
    dot: "#d1d5db",
  },
};

const SEVERITY_COLOR = {
  critical: "#dc2626",
  warning: "#d97706",
  info: "#6b7280",
};

function StatusBadge({ status, small }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending_review;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: small ? 3 : 4,
        padding: small ? "2px 7px" : "3px 9px",
        borderRadius: 999,
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        color: cfg.color,
        fontSize: small ? 10 : 11,
        fontWeight: 700,
        letterSpacing: "0.02em",
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ fontSize: small ? 9 : 10 }}>{cfg.icon}</span>
      {cfg.label}
    </span>
  );
}

function SummaryBar({ summary }) {
  const total = (summary.verified || 0) + (summary.discrepancies || 0) + (summary.pending || 0);
  if (total === 0) return null;
  const hasDisco = summary.discrepancies > 0;
  const color = hasDisco ? "#f97316" : summary.pending > 0 ? "#6b7280" : "#16a34a";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "10px 16px",
        background: hasDisco ? "#fff7ed" : "#f0fdf4",
        border: `1px solid ${hasDisco ? "#fed7aa" : "#bbf7d0"}`,
        borderRadius: 12,
        marginBottom: 14,
      }}
    >
      <div style={{ fontSize: 20 }}>{hasDisco ? "⚠️" : "🔎"}</div>
      <div style={{ flex: 1 }}>
        <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color }}>
          {hasDisco
            ? `${summary.discrepancies} discrepanc${summary.discrepancies === 1 ? "y" : "ies"} found`
            : summary.pending > 0
            ? "Verification in progress"
            : "All checks verified"}
        </p>
        <p style={{ margin: 0, fontSize: 11, color: "#6b7280", marginTop: 1 }}>
          {summary.verified} verified · {summary.discrepancies} discrepancy · {summary.pending} pending
        </p>
      </div>
    </div>
  );
}

function CheckRow({ check, isLast }) {
  const cfg = STATUS_CONFIG[check.status] || STATUS_CONFIG.pending_review;
  const sevColor = SEVERITY_COLOR[check.severity] || SEVERITY_COLOR.info;

  return (
    <div
      style={{
        borderTop: "1px solid #f3f4f6",
        padding: "10px 0",
        ...(isLast ? {} : {}),
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <div
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: check.status === "discrepancy" ? sevColor : cfg.dot,
            marginTop: 5,
            flexShrink: 0,
          }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <StatusBadge status={check.status} small />
            {check.doc_section_a && (
              <span
                style={{
                  fontSize: 10,
                  color: "#9ca3af",
                  background: "#f9fafb",
                  padding: "1px 6px",
                  borderRadius: 4,
                  border: "1px solid #e5e7eb",
                }}
              >
                {[check.doc_section_a, check.doc_section_b]
                  .filter(Boolean)
                  .map((s) => s.replace(/_/g, " "))
                  .join(" × ")}
              </span>
            )}
          </div>
          <p style={{ margin: 0, fontSize: 12, color: "#374151", lineHeight: 1.5 }}>
            {check.description}
          </p>
          {check.value_a != null && check.value_b != null && check.delta_pct != null && (
            <p style={{ margin: "4px 0 0", fontSize: 11, color: "#6b7280" }}>
              Gap: {check.delta_pct.toFixed(1)}%
            </p>
          )}
          <p style={{ margin: "3px 0 0", fontSize: 10, color: "#9ca3af" }}>
            {new Date(check.run_at || check.created_at).toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function VerificationPanel({ propertyId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const autoTriggered = React.useRef(false);

  async function runAndReload() {
    try {
      await fetch(`${API_BASE}/api/public/deal-room/${propertyId}/verification/run`, {
        method: "POST",
      });
    } catch { /* best effort */ }
    // Wait briefly then reload to pick up results
    await new Promise(r => setTimeout(r, 2500));
    try {
      const res = await fetch(`${API_BASE}/api/public/deal-room/${propertyId}/verification`, {
        headers: { "Cache-Control": "no-store" },
      });
      if (res.ok) {
        const json = await res.json();
        const runs = json.runs || [];
        setData({
          summary: json.summary || { verified: 0, discrepancies: 0, pending: 0 },
          runs,
        });
      }
    } catch { /* ignore */ }
  }

  useEffect(() => {
    if (!propertyId) return;
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(`${API_BASE}/api/public/deal-room/${propertyId}/verification`, {
          headers: { "Cache-Control": "no-store" },
        });
        if (!res.ok) throw new Error("not ok");
        const json = await res.json();
        if (!cancelled) {
          const runs = json.runs || [];
          setData({
            summary: json.summary || { verified: 0, discrepancies: 0, pending: 0 },
            runs,
          });
          // Auto-trigger a first run if the deal has never been checked yet
          // (handles existing deals with pre-uploaded documents)
          if (runs.length === 0 && !autoTriggered.current) {
            autoTriggered.current = true;
            runAndReload().catch(() => {});
          }
        }
      } catch {
        if (!cancelled) setData({ summary: { verified: 0, discrepancies: 0, pending: 0 }, runs: [] });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    // Refresh every 20s to pick up background analysis results
    const interval = setInterval(load, 20000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [propertyId]);

  async function triggerRun() {
    setTriggering(true);
    try {
      await fetch(`${API_BASE}/api/public/deal-room/${propertyId}/verification/run`, {
        method: "POST",
      });
      // Reload after short delay to pick up results
      setTimeout(async () => {
        try {
          const res = await fetch(`${API_BASE}/api/public/deal-room/${propertyId}/verification`, {
            headers: { "Cache-Control": "no-store" },
          });
          if (res.ok) {
            const json = await res.json();
            const runs = json.runs || [];
            setData({ summary: json.summary || { verified: 0, discrepancies: 0, pending: 0 }, runs });
          }
        } catch {}
        setTriggering(false);
      }, 2000);
    } catch {
      setTriggering(false);
    }
  }

  if (loading) {
    return (
      <div
        style={{
          background: "#fff",
          borderRadius: 16,
          border: "1px solid #e5e7eb",
          padding: 20,
          marginTop: 16,
        }}
      >
        <p style={{ fontSize: 11, color: "#9ca3af", margin: 0 }}>Loading verification…</p>
      </div>
    );
  }

  const allRuns = data?.runs || [];
  const summary = data?.summary || { verified: 0, discrepancies: 0, pending: 0 };
  const hasAny = allRuns.length > 0;

  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 16,
        border: "1px solid #e5e7eb",
        overflow: "hidden",
        marginTop: 16,
      }}
    >
      {/* Header */}
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 20px",
          background: "none",
          border: "none",
          cursor: "pointer",
          borderBottom: open ? "1px solid #f3f4f6" : "none",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              background: "#fef3c7",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 14,
            }}
          >
            🔎
          </div>
          <div style={{ textAlign: "left" }}>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "#111827" }}>
              Verification Log
            </p>
            <p style={{ margin: 0, fontSize: 10, color: "#9ca3af" }}>
              {hasAny
                ? `${summary.verified} verified · ${summary.discrepancies} discrepanc${summary.discrepancies === 1 ? "y" : "ies"} · ${summary.pending} pending`
                : "No checks run yet — upload documents to start"}
            </p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {summary.discrepancies > 0 && (
            <span
              style={{
                background: "#fff7ed",
                border: "1px solid #fed7aa",
                borderRadius: 999,
                padding: "2px 8px",
                fontSize: 10,
                fontWeight: 700,
                color: "#c2410c",
              }}
            >
              {summary.discrepancies} ⚠
            </span>
          )}
          <span style={{ fontSize: 12, color: "#9ca3af" }}>{open ? "▲" : "▼"}</span>
        </div>
      </button>

      {open && (
        <div style={{ padding: "14px 20px" }}>
          {!hasAny ? (
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <p style={{ fontSize: 28, margin: "0 0 8px" }}>🔎</p>
              <p style={{ fontSize: 13, fontWeight: 600, color: "#374151", margin: "0 0 4px" }}>
                No verification checks yet
              </p>
              <p style={{ fontSize: 12, color: "#6b7280", margin: 0 }}>
                Upload documents to trigger automatic cross-document verification.
              </p>
            </div>
          ) : (
            <>
              <SummaryBar summary={summary} />
              {allRuns.map((run, runIdx) => {
                const runChecks = [...(run.checks || [])].sort((a, b) => {
                  const order = { discrepancy: 0, pending_review: 1, verified: 2 };
                  return (order[a.status] ?? 3) - (order[b.status] ?? 3);
                });
                const runNum = allRuns.length - runIdx;
                const runTime = new Date(run.run_at || runChecks[0]?.created_at).toLocaleString();
                return (
                  <div key={run.run_id} style={{ marginBottom: runIdx < allRuns.length - 1 ? 20 : 0 }}>
                    <div style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      fontSize: 10, fontWeight: 700, color: '#9ca3af', letterSpacing: '0.05em',
                      textTransform: 'uppercase', paddingBottom: 4,
                      borderBottom: '1px solid #f3f4f6', marginBottom: 2,
                    }}>
                      <span>Run #{runNum} · {runChecks.length} check{runChecks.length !== 1 ? 's' : ''}</span>
                      <span>{runTime}</span>
                    </div>
                    {runChecks.map((check, i) => (
                      <CheckRow
                        key={check.id || `${run.run_id}-${check.check_type}-${i}`}
                        check={check}
                        isLast={i === runChecks.length - 1}
                      />
                    ))}
                  </div>
                );
              })}
            </>
          )}

          <button
            onClick={triggerRun}
            disabled={triggering}
            style={{
              marginTop: 14,
              width: "100%",
              padding: "8px 0",
              background: triggering ? "#f3f4f6" : "#f9fafb",
              border: "1px solid #e5e7eb",
              borderRadius: 8,
              fontSize: 11,
              fontWeight: 600,
              color: triggering ? "#9ca3af" : "#374151",
              cursor: triggering ? "not-allowed" : "pointer",
            }}
          >
            {triggering ? "Running verification…" : "Re-run verification checks"}
          </button>
        </div>
      )}
    </div>
  );
}
