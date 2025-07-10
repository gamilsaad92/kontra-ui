import { useState } from 'react'
import PartINotification from './PartINotification'

export default function Form1140Stepper() {
  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState({})

  const next = (data) => {
    setFormData(prev => ({ ...prev, ...data }))
    setStep(step + 1)
  }

  return (
    <div className="max-w-3xl mx-auto">
      {step === 1 && <PartINotification onNext={next} defaultValues={formData} />}
      {step > 1 && <div>Next steps will be rendered here…</div>}
    </div>
  )
}
