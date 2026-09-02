import React from 'react'

export default function HelpTooltip({ text }) {
  return (
    <span className="relative group inline-block ml-1">
      <button
        className="text-blue-600 focus:outline-none"
        aria-label="Help"
        type="button"
      >
        ?
      </button>
      <span className="absolute z-40 hidden group-hover:block group-focus:block bg-gray-800 text-white text-xs rounded p-1 whitespace-nowrap -translate-x-1/2 left-1/2 bottom-full mb-1">
        {text}
      </span>
    </span>
  )
}
