/**
 * Compliance & Covenant Center — Phase 8
 * Route: /compliance-center
 */
import React from "react";
import CommandCenterShell from "./CommandCenterShell";

const icon = (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
    <path fillRule="evenodd" d="M12 2.25a.75.75 0 01.75.75v.756a49.106 49.106 0 019.152 1 .75.75 0 01-.152 1.485h-1.918l2.474 10.124a.75.75 0 01-.375.84A6.723 6.723 0 0118.75 18a6.723 6.723 0 01-3.131-.745.75.75 0 01-.375-.84l2.474-10.124H12.75V21a.75.75 0 01-1.5 0V7.291H7.182l2.474 10.124a.75.75 0 01-.375.84A6.723 6.723 0 015.25 19a6.723 6.723 0 01-3.131-.745.75.75 0 01-.375-.84L4.218 7.29H2.3a.75.75 0 01-.152-1.485 49.105 49.105 0 019.152-1V3a.75.75 0 01.75-.75z" clipRule="evenodd"/>
  </svg>
);

export default function ComplianceCovenantCenter() {
  return (
    <CommandCenterShell
      centerId="compliance"
      title="Compliance & Covenant Center"
      subtitle="DSCR/LTV monitoring · AML/SAR workflows · Occupancy & insurance covenants · Regulatory flags"
      accentColor="violet"
      accentHex="#7c3aed"
      icon={icon}
    />
  );
}
