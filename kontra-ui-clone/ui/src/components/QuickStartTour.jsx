import React, { useState } from 'react'

export default function QuickStartTour({ onClose }) {
  const [step, setStep] = useState(0)
  const steps = [
    'This is Draw Requests – track your funding needs here.',
    "That's your risk gauge showing overall loan health."
  ]

  const next = () => {
    if (step < steps.length - 1) setStep(step + 1)
    else onClose && onClose()
  }

  return (
    <div className="fixed bottom-4 right-4 bg-white p-4 rounded shadow z-40 w-64">
      <p className="mb-2">{steps[step]}</p>
      <button onClick={next} className="bg-blue-600 text-white px-3 py-1 rounded">
        {step < steps.length - 1 ? 'Next' : 'Done'}
      </button>
    </div>
  )
}
