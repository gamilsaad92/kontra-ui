import React from 'react';
import InspectionForm from '../components/InspectionForm';
import InspectionList from '../components/InspectionList';

export default function Inspections() {
  return (
    <div className="space-y-6">
      <InspectionForm />
      <InspectionList />
    </div>
  );
}
