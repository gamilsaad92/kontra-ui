import React, { useEffect, useState } from 'react';
import { API_BASE } from '../lib/apiBase';
import { BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';

export default function ReportBuilder() {
  const [name, setName] = useState('');
  const [table, setTable] = useState('');
 const [available, setAvailable] = useState([]);
  const [fields, setFields] = useState([]);
  const [filters, setFilters] = useState('{}');
   const [groupBy, setGroupBy] = useState('');
  const [viz, setViz] = useState('table');
  const [rows, setRows] = useState([]);
  const [email, setEmail] = useState('');
   const [schedule, setSchedule] = useState('daily');
  const [saved, setSaved] = useState([]);
  const [message, setMessage] = useState('');
  const [aiDescription, setAiDescription] = useState('');
  const [aiRole, setAiRole] = useState('Servicing');
  const [aiOutlook, setAiOutlook] = useState('');
  const [aiIncludeSummary, setAiIncludeSummary] = useState(true);
  const [aiProposal, setAiProposal] = useState(null);
  const [aiApproval, setAiApproval] = useState(false);
  const [aiHooks, setAiHooks] = useState({});
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  
    useEffect(() => {
    if (!table) return;
    fetch(`${API_BASE}/api/reports/fields?table=${table}`)
      .then(res => res.json())
      .then(data => setAvailable(data.fields || []))
      .catch(() => setAvailable([]));
  }, [table]);

  useEffect(() => {
    fetch(`${API_BASE}/api/reports/saved`)
      .then(res => res.json())
      .then(data => setSaved(data.reports || []));
  }, [message]);

  const run = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/reports/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table,
                 fields: fields.join(','),
          filters: JSON.parse(filters || '{}'),
                  format: 'json',
          groupBy
        })
      });
          const data = await res.json();
      setRows(data.rows || []);
    } catch (err) {
      setMessage('Failed to run report');
    }
  };

    const requestAiProposal = async () => {
    setAiLoading(true);
    setAiError('');
    try {
      const res = await fetch(`${API_BASE}/api/reports/ai/propose`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: aiDescription,
          role: aiRole,
          outlook_days: aiOutlook ? Number(aiOutlook) : null,
          include_executive_summary: aiIncludeSummary
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setAiError(data.message || 'Failed to generate AI proposal');
        return;
      }
      setAiProposal(data);
      setAiApproval(false);
      const hookDefaults = (data.automationHooks || []).reduce((acc, hook) => {
        acc[hook.action_type] = false;
        return acc;
      }, {});
      setAiHooks(hookDefaults);
      if (data.spec) {
        setTable(data.spec.table || '');
        setFields(Array.isArray(data.spec.fields) ? data.spec.fields : []);
        setFilters(JSON.stringify(data.spec.filters || {}, null, 2));
        setGroupBy(data.spec.groupBy || '');
      }
    } catch (err) {
      setAiError('Failed to generate AI proposal');
    } finally {
      setAiLoading(false);
    }
  };

  const runAiReport = async () => {
    if (!aiProposal?.spec) return;
    try {
      const selectedHooks = Object.entries(aiHooks)
        .filter(([, enabled]) => enabled)
        .map(([action_type]) => action_type);
      const res = await fetch(`${API_BASE}/api/reports/ai/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spec: aiProposal.spec,
          approved: aiApproval,
          explanation: aiProposal.explanation,
          confidence: aiProposal.confidence,
          include_executive_summary: aiIncludeSummary,
          selectedAutomationHooks: selectedHooks
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.message || 'Failed to run AI report');
        return;
      }
      setRows(data.rows || []);
      setMessage(`AI report ran in ${data.durationMs}ms`);
    } catch (err) {
      setMessage('Failed to run AI report');
    }
  };

  const saveAiReport = async () => {
    if (!aiProposal?.spec) return;
    if (!name) {
      setMessage('Add a report name before saving.');
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/reports/ai/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          spec: aiProposal.spec,
          approved: aiApproval,
          explanation: aiProposal.explanation,
          confidence: aiProposal.confidence
        })
      });
      if (res.ok) setMessage('AI report saved');
      else {
        const data = await res.json();
        setMessage(data.message || 'Failed to save AI report');
      }
    } catch {
      setMessage('Failed to save AI report');
    }
  };

  const save = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/reports/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, table, fields: fields.join(','), filters: JSON.parse(filters || '{}') })
      });
      if (res.ok) setMessage('Saved');
      else setMessage('Failed to save');
    } catch {
      setMessage('Failed to save');
    }
  };

  const scheduleReport = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/reports/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
         schedule,
          table,
          fields: fields.join(','),
          filters: JSON.parse(filters || '{}')
        })
      });
      if (res.ok) setMessage('Scheduled');
      else setMessage('Failed to schedule');
    } catch {
      setMessage('Failed to schedule');
    }
  };

    const onDragStart = field => e => {
    e.dataTransfer.setData('text/plain', field);
  };

  const onDrop = e => {
    e.preventDefault();
    const field = e.dataTransfer.getData('text/plain');
    if (field && !fields.includes(field)) {
      setFields([...fields, field]);
    }
  };

  const removeField = f => {
    setFields(fields.filter(x => x !== f));
  };

  return (
    <div className="space-y-4">
    <h3 className="text-xl font-bold">Custom Report</h3>
            <div className="rounded border border-slate-200 bg-slate-50 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-lg font-semibold text-slate-800">AI Report Agent</h4>
          <span className="text-xs uppercase tracking-wide text-slate-500">Proposal → Review → Run</span>
        </div>
        <div className="space-y-2">
          <textarea
            className="border p-2 rounded w-full"
            rows="2"
            placeholder="Describe the report you want"
            value={aiDescription}
            onChange={e => setAiDescription(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <select className="border p-2 rounded" value={aiRole} onChange={e => setAiRole(e.target.value)}>
              <option value="Servicing">Servicing</option>
              <option value="Risk">Risk</option>
              <option value="Capital Markets">Capital Markets</option>
              <option value="Compliance">Compliance</option>
            </select>
            <select className="border p-2 rounded" value={aiOutlook} onChange={e => setAiOutlook(e.target.value)}>
              <option value="">No outlook</option>
              <option value="30">30-day outlook</option>
              <option value="60">60-day outlook</option>
              <option value="90">90-day outlook</option>
            </select>
            <label className="flex items-center space-x-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={aiIncludeSummary}
                onChange={e => setAiIncludeSummary(e.target.checked)}
              />
              <span>Generate executive summary</span>
            </label>
          </div>
          <button
            className="bg-indigo-600 text-white px-3 py-1 rounded"
            onClick={requestAiProposal}
            disabled={aiLoading}
          >
            {aiLoading ? 'Generating...' : 'Generate AI Proposal'}
          </button>
          {aiError && <p className="text-sm text-red-600">{aiError}</p>}
        </div>
        {aiProposal && (
          <div className="space-y-3">
            <div className="rounded border border-indigo-200 bg-white p-3 space-y-2">
              <div className="flex flex-wrap items-center gap-3 text-sm text-slate-700">
                <span className="font-semibold text-slate-800">AI Proposal</span>
                <span>Confidence: {(aiProposal.confidence * 100).toFixed(0)}%</span>
                <span>Spec hash: {aiProposal.specHash}</span>
              </div>
              <p className="text-sm text-slate-700">{aiProposal.explanation}</p>
              {aiProposal.executiveSummary && (
                <p className="text-sm text-slate-700">{aiProposal.executiveSummary}</p>
              )}
              {aiProposal.warnings && aiProposal.warnings.length > 0 && (
                <ul className="list-disc list-inside text-sm text-amber-700">
                  {aiProposal.warnings.map((warning, idx) => (
                    <li key={`${warning}-${idx}`}>{warning}</li>
                  ))}
                </ul>
              )}
              <div>
                <p className="text-sm font-semibold text-slate-700">Suggested automation hooks</p>
                <div className="flex flex-wrap gap-3 text-sm text-slate-600">
                  {(aiProposal.automationHooks || []).map((hook) => (
                    <label key={hook.action_type} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={Boolean(aiHooks[hook.action_type])}
                        onChange={e => setAiHooks({ ...aiHooks, [hook.action_type]: e.target.checked })}
                      />
                      <span>{hook.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <label className="flex items-center space-x-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={aiApproval}
                  onChange={e => setAiApproval(e.target.checked)}
                />
                <span>I approve this AI proposal for execution or saving.</span>
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  className="bg-emerald-600 text-white px-3 py-1 rounded disabled:opacity-50"
                  onClick={runAiReport}
                  disabled={!aiApproval}
                >
                  Run approved AI report
                </button>
                <button
                  className="bg-slate-700 text-white px-3 py-1 rounded disabled:opacity-50"
                  onClick={saveAiReport}
                  disabled={!aiApproval}
                >
                  Save approved AI report
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="space-y-2">
        <input className="border p-2 rounded w-full" placeholder="report name" value={name} onChange={e => setName(e.target.value)} />
        <input className="border p-2 rounded w-full" placeholder="table" value={table} onChange={e => setTable(e.target.value)} />
        <textarea className="border p-2 rounded w-full" rows="2" placeholder="filters JSON" value={filters} onChange={e => setFilters(e.target.value)} />
        <input className="border p-2 rounded w-full" placeholder="group by" value={groupBy} onChange={e => setGroupBy(e.target.value)} />
      </div>
      <div className="flex space-x-4">
        <div className="w-1/2">
          <h4 className="font-semibold">Available Fields</h4>
          <div className="border p-2 min-h-[100px] space-y-1">
            {available.map(f => (
              <div key={f} className="bg-gray-100 p-1 rounded cursor-move" draggable onDragStart={onDragStart(f)}>
                {f}
              </div>
            ))}
          </div>
        </div>
        <div className="w-1/2">
          <h4 className="font-semibold">Selected Fields</h4>
          <div className="border p-2 min-h-[100px] space-y-1" onDragOver={e => e.preventDefault()} onDrop={onDrop}>
            {fields.map(f => (
              <div key={f} className="bg-blue-100 p-1 rounded flex justify-between">
                <span>{f}</span>
                <button onClick={() => removeField(f)}>x</button>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="space-x-2">
            <select className="border p-2 rounded" value={viz} onChange={e => setViz(e.target.value)}>
          <option value="table">Table</option>
          <option value="bar">Bar</option>  
        </select>
           <button className="bg-blue-600 text-white px-3 py-1 rounded" onClick={run}>Run</button>
        <button className="bg-gray-600 text-white px-3 py-1 rounded" onClick={save}>Save</button>
      </div>
      <div className="space-x-2">
                <input className="border p-2 rounded" placeholder="email" value={email} onChange={e => setEmail(e.target.value)} />
        <select className="border p-2 rounded" value={schedule} onChange={e => setSchedule(e.target.value)}>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
        </select>
        <button className="bg-green-600 text-white px-3 py-1 rounded" onClick={scheduleReport}>Schedule</button>
      </div>
        {viz === 'table' && rows.length > 0 && (
        <pre className="bg-gray-100 p-2 overflow-auto text-xs">{JSON.stringify(rows, null, 2)}</pre>
      )}
      {viz === 'bar' && rows.length > 0 && groupBy && (
        <BarChart width={400} height={300} data={rows} className="bg-white">
          <XAxis dataKey={groupBy} />
          <YAxis />
          <Tooltip />
          <Bar dataKey={fields[0]} fill="#8884d8" />
        </BarChart>
      )}
      {saved.length > 0 && (
        <div>
          <h4 className="font-semibold">Saved Reports</h4>
          <ul className="list-disc list-inside">
            {saved.map(r => (
              <li key={r.id}>{r.name}</li>
            ))}
          </ul>
        </div>
      )}
      {message && <p>{message}</p>}
    </div>
  );
}
