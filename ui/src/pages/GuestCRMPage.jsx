import React, { Suspense } from 'react';
import GuestCRM from '../components/GuestCRM.jsx';

export default function GuestCRMPage() {
  return (
    <Suspense fallback={<p>Loading...</p>}>
      <GuestCRM />
    </Suspense>
  );
}
