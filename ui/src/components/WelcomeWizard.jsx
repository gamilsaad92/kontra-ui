import React, { useState } from 'react'

export default function WelcomeWizard({ onDone }) {
  const [step, setStep] = useState(0)
  const next = () => {
    if (step < 1) setStep(step + 1)
    else onDone && onDone()
  }

  const steps = [
    (
      <div className="text-center space-y-4">
        <h2 className="text-xl font-bold">Welcome to Kontra!</h2>
        <p>Let's get you oriented with a few quick tips.</p>
        <button onClick={next} className="bg-blue-600 text-white px-4 py-2 rounded">
          Next
        </button>
      </div>
    ),
    (
      <div className="text-center space-y-4">
        <h2 className="text-xl font-bold">Need Help?</h2>
        <p>Use the Docs link in the sidebar whenever you're stuck.</p>
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
