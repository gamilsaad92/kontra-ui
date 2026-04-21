/**
 * Servicing Operations Center — Phase 8
 * Route: /servicing-ops
 */
import React from "react";
import CommandCenterShell from "./CommandCenterShell";

const icon = (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
    <path d="M4 4a2 2 0 012-2h8a2 2 0 012 2v2h2a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 0v16h12V8h-2V4H6zm3 7a1 1 0 011-1h4a1 1 0 110 2h-4a1 1 0 01-1-1zm0 3a1 1 0 011-1h4a1 1 0 110 2h-4a1 1 0 01-1-1z"/>
  </svg>
);

export default function ServicingOperationsCenter() {
  return (
    <CommandCenterShell
      centerId="servicing"
      title="Servicing Operations Center"
      subtitle="Live payment waterfalls · Escrow management · Reserve draws · Delinquency workflows"
      accentColor="burgundy"
      accentHex="#800020"
      icon={icon}
    />
  );
}
