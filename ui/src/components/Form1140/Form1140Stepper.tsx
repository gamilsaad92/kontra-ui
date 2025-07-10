import { useState } from 'react'
import PartINotification from './PartINotification'
import PartIFollowUp from './PartIFollowUp'
import PartIIRestoration from './PartIIRestoration'
import AttachmentsAndReview from './AttachmentsAndReview'

export default function Form1140Stepper() {
  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState({})

  const next = (data) => {
    setFormData(prev => ({ ...prev, ...data }))
    setStep(step + 1)
  }

  const submit = () => {
    console.log("Final Data Submission:", formData)
    // TODO: Submit to backend
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
