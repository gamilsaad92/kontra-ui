import { useState } from 'react'
import FinancialAnalyzer from '../components/FinancialAnalyzer'
import InspectionReview from '../components/InspectionReview'
import DrawReviewForm from '../components/DrawReviewForm'
import PropertyChangeReviewForm from '../components/PropertyChangeReviewForm'

const tabs = [
  { name: 'Financial Analysis', component: <FinancialAnalyzer /> },
  { name: 'Inspections', component: <InspectionReview /> },
  { name: 'Draw Requests', component: <DrawReviewForm /> },
  { name: 'Property Management Changes', component: <PropertyChangeReviewForm /> },
]

export default function AssetManagement() {
  const [activeIndex, setActiveIndex] = useState(0)

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Asset Management</h1>

      <div className="flex border-b mb-6">
        {tabs.map((tab, i) => (
          <button
            key={i}
            className={`px-4 py-2 font-medium ${i === activeIndex ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600'}`}
            onClick={() => setActiveIndex(i)}
          >
            {tab.name}
          </button>
        ))}
      </div>

      <div className="bg-white p-4 rounded shadow">{tabs[activeIndex].component}</div>
    </div>
  )
}
