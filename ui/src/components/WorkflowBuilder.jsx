import React, { useState } from 'react';

export default function WorkflowBuilder() {
  const [steps, setSteps] = useState([]);
  const triggers = ['New Application', 'Payment Received'];
  const actions = ['Send Email', 'Create Task', 'Notify'];

  function onDragStart(e, item) {
    e.dataTransfer.setData('text/plain', item);
  }

  function onDrop(e) {
    e.preventDefault();
    const item = e.dataTransfer.getData('text/plain');
    setSteps([...steps, item]);
  }

  function onDragOver(e) {
    e.preventDefault();
  }

  async function saveWorkflow() {
    await fetch('/api/workflows', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'My Workflow', steps })
    });
  }

  return (
    <div className="workflow-builder flex gap-4">
      <div className="palette border p-2">
        <h3 className="font-bold">Triggers</h3>
        {triggers.map(t => (
          <div key={t} draggable onDragStart={e => onDragStart(e, `trigger:${t}`)} className="p-1 border mb-1 cursor-move">
            {t}
          </div>
        ))}
        <h3 className="font-bold mt-2">Actions</h3>
        {actions.map(a => (
          <div key={a} draggable onDragStart={e => onDragStart(e, `action:${a}`)} className="p-1 border mb-1 cursor-move">
            {a}
          </div>
        ))}
      </div>
      <div className="canvas flex-1 border p-2" onDragOver={onDragOver} onDrop={onDrop}>
        {steps.map((s, i) => (
          <div key={i} className="p-1 border mb-1 bg-gray-100">
            {s}
          </div>
        ))}
      </div>
      <button className="border p-2" onClick={saveWorkflow}>Save Workflow</button>
    </div>
  );
}
