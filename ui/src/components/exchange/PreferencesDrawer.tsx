import React, { useState } from 'react';

export default function PreferencesDrawer() {
  const [open, setOpen] = useState(false);
  return (
   <>
      <button
        onClick={() => setOpen(true)}
        className="px-3 py-1 border rounded"
      >
        Preferences
      </button>
      {open && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-end">
          <div className="bg-white w-64 p-4 space-y-2">
            <h3 className="font-semibold">Buyer Preferences</h3>
            {/* preference form placeholder */}
            <button
              onClick={() => setOpen(false)}
              className="mt-4 px-4 py-2 bg-gray-200 rounded"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
