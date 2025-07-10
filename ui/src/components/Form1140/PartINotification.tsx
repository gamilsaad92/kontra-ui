import { useForm } from 'react-hook-form'

export default function PartINotification({ onNext, defaultValues }) {
  const { register, handleSubmit } = useForm({ defaultValues })

  const onSubmit = data => {
    // call backend to create hazard_losses record
    console.log('Part I Data:', data)
    onNext(data)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <h2 className="text-xl font-bold">Hazard Loss Notification</h2>

      <div>
        <label>Property Name</label>
        <input {...register('property_name')} className="input" />
      </div>

      <div>
        <label>Deal Number</label>
        <input {...register('deal_number')} className="input" />
      </div>

      <div>
        <label>Freddie Mac Loan No.</label>
        <input {...register('freddie_mac_loan_no')} className="input" />
      </div>

      <div>
        <label>Type of Loss</label>
        <input {...register('type_of_loss')} className="input" />
      </div>

      <div>
        <label>Date of Loss</label>
        <input type="date" {...register('date_of_loss')} className="input" />
      </div>

      <div>
        <label>Estimated Loss Amount</label>
        <input type="number" step="any" {...register('initial_loss_amount')} className="input" />
      </div>

      <div>
        <label>Submitted By</label>
        <input {...register('submitted_by')} className="input" />
      </div>

      <div>
        <label>Submitted Email</label>
        <input type="email" {...register('submitted_email')} className="input" />
      </div>

      <button type="submit" className="btn btn-primary">Next</button>
    </form>
  )
}
