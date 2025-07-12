import React from 'react'

export default function ErrorBanner({ message, onClose }) {
  if (!message) return null
  return (
    <div className="bg-red-500 text-white p-3 rounded mb-4 flex justify-between items-center" role="alert">
      <span>{message}</span>
      {onClose && (
        <button onClick={onClose} aria-label="Close" className="font-bold ml-2">&times;</button>
      )}
    </div>
  )
}
