/**
 * Tokenization Exchange Center — Phase 8
 * Route: /exchange
 */
import React from "react";
import CommandCenterShell from "./CommandCenterShell";

const icon = (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
    <path d="M12 .75a8.25 8.25 0 100 16.5A8.25 8.25 0 0012 .75zM9.813 10.5a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zm5.25 3.75a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z"/>
  </svg>
);

export default function TokenizationExchangeCenter() {
  return (
    <CommandCenterShell
      centerId="exchange"
      title="Tokenization Exchange Center"
      subtitle="ERC-1400 token registry · KYC/AML wallets · Transfer approvals · Stablecoin settlements · Dividends"
      accentColor="emerald"
      accentHex="#059669"
      icon={icon}
    />
  );
}
