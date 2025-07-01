import React from 'react';

export default function AssetDetailDrawer({ asset, onClose }) {
  if (!asset) return null;
  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex"
      onClick={onClose}
    >
      <div
        className="bg-white w-96 ml-auto p-4"
        onClick={e => e.stopPropagation()}
      >
        <button className="float-right" onClick={onClose}>
          ✖
        </button>
        <h3 className="text-xl mb-2">{asset.name || asset.address}</h3>
        <p>Value: {asset.value ?? '—'}</p>
        {asset.predicted_risk !== undefined && (
          <p>Risk: {asset.predicted_risk}</p>
        )}
        <p>Status: {asset.status}</p>
      </div>
    </div>
  );
}
