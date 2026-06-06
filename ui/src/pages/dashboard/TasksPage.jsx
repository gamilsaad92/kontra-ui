import React, { useState } from "react";

const TASKS = [
  { id: 1, title: "Renew Westside Commons insurance policy", property: "Westside Commons", category: "Insurance", priority: "High", due: "Jun 18, 2025", status: "Open", assignee: "You" },
  { id: 2, title: "Schedule HVAC maintenance — Northgate Retail", property: "Northgate Retail Center", category: "Inspection Finding", priority: "Medium", due: "Jul 1, 2025", status: "Open", assignee: "Facilities" },
  { id: 3, title: "Upload Q2 financial statements — all properties", property: "All Properties", category: "Compliance", priority: "Medium", due: "Jul 15, 2025", status: "Open", assignee: "Finance" },
  { id: 4, title: "Request parking lot resurfacing quote", property: "Northgate Retail Center", category: "Deferred Maintenance", priority: "Low", due: "Jul 30, 2025", status: "Open", assignee: "You" },
  { id: 5, title: "Annual physical inspection — Summit Industrial", property: "Summit Industrial Park", category: "Inspection", priority: "Medium", due: "Sep 1, 2025", status: "Scheduled", assignee: "Cardinal Inspections" },
  { id: 6, title: "Covenant compliance report — Q1 2025", property: "Westside Commons", category: "Compliance", priority: "High", due: "May 31, 2025", status: "Complete", assignee: "You" },
];

const PRIORITY_COLORS = { High: "#dc2626", Medium: "#d97706", Low: "#6b7280" };
const STATUS_COLORS = { Open: "#2563eb", Scheduled: "#7c3aed", Complete: "#16a34a" };

export default function TasksPage() {
  const [filter, setFilter] = useState("Open");
  const [tasks, setTasks] = useState(TASKS);

  const filtered = filter === "All" ? tasks : tasks.filter((t) => t.status === filter);
  const open = tasks.filter((t) => t.status === "Open").length;
  const high = tasks.filter((t) => t.priority === "High" && t.status === "Open").length;

  const complete = (id) => setTasks(tasks.map((t) => t.id === id ? { ...t, status: "Complete" } : t));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Tasks</h2>
          <p className="text-sm text-gray-500 mt-0.5">{open} open · {high} high priority</p>
        </div>
        <button className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition hover:opacity-90" style={{ background: "#800020" }}>
          + New Task
        </button>
      </div>

      <div className="flex gap-2 mb-5">
        {["Open", "Scheduled", "Complete", "All"].map((s) => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${filter === s ? "text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`}
            style={filter === s ? { background: "#800020" } : {}}>
            {s}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.map((task) => (
          <div key={task.id} className="bg-white rounded-xl border border-gray-200 hover:shadow-sm transition p-4">
            <div className="flex items-start gap-3">
              <button onClick={() => task.status !== "Complete" && complete(task.id)}
                className={`mt-0.5 w-4 h-4 rounded-full border-2 shrink-0 transition ${task.status === "Complete" ? "bg-green-500 border-green-500" : "border-gray-300 hover:border-green-500"}`}>
              </button>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${task.status === "Complete" ? "line-through text-gray-400" : "text-gray-900"}`}>
                  {task.title}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">{task.property} · {task.category}</p>
                <div className="flex items-center gap-3 mt-2 flex-wrap">
                  <span className="text-xs font-semibold" style={{ color: PRIORITY_COLORS[task.priority] }}>
                    {task.priority} Priority
                  </span>
                  <span className="text-xs text-gray-400">Due: {task.due}</span>
                  <span className="text-xs text-gray-400">Assignee: {task.assignee}</span>
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full"
                    style={{ background: STATUS_COLORS[task.status] + "18", color: STATUS_COLORS[task.status] }}>
                    {task.status}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
            <div className="text-3xl mb-2">✅</div>
            <p className="text-sm font-medium">No {filter.toLowerCase()} tasks</p>
          </div>
        )}
      </div>
    </div>
  );
}
