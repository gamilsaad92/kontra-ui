import React from 'react';

export default function DetailDrawer({ open = false, onClose, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex" onClick={onClose}>
      <div
        className="bg-white w-96 ml-auto overflow-y-auto p-4"
        onClick={e => e.stopPropagation()}
      >
        <button className="float-right" onClick={onClose}>✖</button>
        {children}
      </div>
    </div>
  );
}
