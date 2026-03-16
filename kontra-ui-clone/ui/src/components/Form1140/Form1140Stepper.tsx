import React, { useState } from 'react'
import PartINotification from './PartINotification'
import PartIFollowUp from './PartIFollowUp'
import PartIIRestoration from './PartIIRestoration'
import AttachmentsAndReview from './AttachmentsAndReview'
import { API_BASE } from '../../lib/apiBase'

export default function Form1140Stepper({ drawId, onClose }) {
  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState({ draw_id: drawId })

  const next = (data) => {
    setFormData(prev => ({ ...prev, ...data }))
    setStep(step + 1)
  }

 const submit = async () => {
    try {
      await fetch(`${API_BASE}/api/hazard-loss`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
    } catch {
      // ignore
    }
    if (onClose) onClose()
  }

  return (
    <div className="max-w-3xl mx-auto">
      {step === 1 && <PartINotification onNext={next} defaultValues={formData} />}
      {step === 2 && <PartIFollowUp onNext={next} defaultValues={formData} />}
      {step === 3 && <PartIIRestoration onNext={next} defaultValues={formData} />}
      {step === 4 && <AttachmentsAndReview formData={formData} onSubmit={submit} />}
    </div>
  )
}
