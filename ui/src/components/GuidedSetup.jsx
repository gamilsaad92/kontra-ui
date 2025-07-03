import React, { useState } from 'react'

export default function GuidedSetup({ onDone }) {
  const [step, setStep] = useState(0)

  const next = () => {
    if (step < 2) setStep(step + 1)
    else onDone && onDone()
  }

  const steps = [
    (
      <div className="text-center space-y-4">
        <h2 className="text-xl font-bold">Welcome!</h2>
        <p>Confirm your name and contact details.</p>
        <button onClick={next} className="bg-blue-600 text-white px-4 py-2 rounded">
          Next
        </button>
      </div>
    ),
    (
      <div className="text-center space-y-4">
        <h2 className="text-xl font-bold">Connect Bank</h2>
        <p>Link your bank account via Plaid or similar.</p>
        <button onClick={next} className="bg-blue-600 text-white px-4 py-2 rounded">
          Next
        </button>
      </div>
    ),
    (
      <div className="text-center space-y-4">
        <h2 className="text-xl font-bold">Dashboard Tour</h2>
        <p>Here's a quick look at your dashboard widgets.</p>
        <button onClick={next} className="bg-blue-600 text-white px-4 py-2 rounded">
          Finish
        </button>
      </div>
    )
  ]

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
      <div className="bg-white p-6 rounded shadow w-80">{steps[step]}</div>
    </div>
  )
}
