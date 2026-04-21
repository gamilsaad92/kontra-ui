import React from 'react'
import { useForm } from 'react-hook-form'

export default function PartIFollowUp({ onNext, defaultValues }) {
  const { register, handleSubmit } = useForm({ defaultValues })

  const onSubmit = data => {
    onNext(data)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <h2 className="text-xl font-bold">Part I – Follow-Up</h2>

      <div>
        <label>Final Loss Amount</label>
        <input type="number" step="any" {...register('final_loss_amount')} className="input" />
      </div>

      <div>
        <label>Insurance Compliant?</label>
        <select {...register('insurance_compliant')} className="input">
          <option value="true">Yes</option>
          <option value="false">No</option>
        </select>
      </div>

      <div>
        <label>Mortgagee Clause Correct?</label>
        <select {...register('mortgagee_clause_correct')} className="input">
          <option value="true">Yes</option>
          <option value="false">No</option>
        </select>
      </div>

      <div>
        <label>Repair Completion Date</label>
        <input type="date" {...register('repair_completion_date')} className="input" />
      </div>

      <div>
        <label>Notes</label>
        <textarea {...register('notes')} className="input" />
      </div>

      <button type="submit" className="btn btn-primary">Next</button>
    </form>
  )
}
