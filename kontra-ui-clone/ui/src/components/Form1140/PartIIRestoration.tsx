import React from 'react'
import { useForm } from 'react-hook-form'

export default function PartIIRestoration({ onNext, defaultValues }) {
  const { register, handleSubmit } = useForm({ defaultValues })

  const onSubmit = data => {
    onNext(data)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <h2 className="text-xl font-bold">Part II – Restoration Plan</h2>

      <div>
        <label>Reason for Part II Submission</label>
        <textarea {...register('reason_for_part_ii')} className="input" />
      </div>

      <div>
        <label>Repair Completion %</label>
        <input type="number" {...register('repair_percent_complete')} className="input" />
      </div>

      <div>
        <label>Zoning Issues?</label>
        <select {...register('zoning_issues')} className="input">
          <option value="false">No</option>
          <option value="true">Yes</option>
        </select>
      </div>

      <div>
        <label>Environmental Issues?</label>
        <select {...register('environmental_issues')} className="input">
          <option value="false">No</option>
          <option value="true">Yes</option>
        </select>
      </div>

      <div>
        <label>Repair Plan Description</label>
        <textarea {...register('repair_plan')} className="input" />
      </div>

      <button type="submit" className="btn btn-primary">Next</button>
    </form>
  )
}
