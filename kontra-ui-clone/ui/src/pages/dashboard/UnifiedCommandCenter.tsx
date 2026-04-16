/**
 * Kontra Unified Command Center
 * One control surface with 6 operational tabs — replacing 6 separate command center pages.
 */

import React, { useState } from "react";
import CommandCenterShell from "./CommandCenterShell";
import {
  BuildingOfficeIcon,
  MagnifyingGlassIcon,
  ShieldExclamationIcon,
  ScaleIcon,
  CubeTransparentIcon,
  Cog8ToothIcon,
} from "@heroicons/react/24/outline";

const TABS = [
  {
    id: "servicing",
    label: "Operations",
    icon: BuildingOfficeIcon,
    accentHex: "#800020",
    title: "Servicing Operations Center",
    subtitle: "Live loan workflow queue · Payments · Draws · Escrow · SLA tracking",
  },
  {
    id: "inspection",
    label: "Inspections",
    icon: MagnifyingGlassIcon,
    accentHex: "#2563eb",
    title: "Inspection Intelligence Center",
    subtitle: "Field inspection queue · Photo validation · AI site review · Draw gates",
  },
  {
    id: "hazard",
    label: "Hazard & Loss",
    icon: ShieldExclamationIcon,
    accentHex: "#d97706",
    title: "Hazard & Loss Recovery Center",
    subtitle: "Insurance claims · Property damage · Reserve analysis · Recovery workflows",
  },
  {
    id: "compliance",
    label: "Compliance",
    icon: ScaleIcon,
    accentHex: "#7c3aed",
    title: "Compliance & Covenant Center",
    subtitle: "Covenant monitoring · Regulatory filings · Policy breach alerts · Audit trails",
  },
  {
    id: "exchange",
    label: "Tokenization",
    icon: CubeTransparentIcon,
    accentHex: "#059669",
    title: "Tokenization Exchange",
    subtitle: "Token order book · Transfer events · Cap table · Distribution queue",
  },
  {
    id: "admin",
    label: "Admin Policy",
    icon: Cog8ToothIcon,
    accentHex: "#dc2626",
    title: "Admin Policy Command",
    subtitle: "Platform-wide rule governance · Escalation routing · Override approvals",
  },
] as const;

export default function UnifiedCommandCenter() {
  const [activeTab, setActiveTab] = useState<string>(TABS[0].id);
  const current = TABS.find(t => t.id === activeTab) ?? TABS[0];

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Tab bar */}
      <div className="border-b border-gray-800 bg-gray-900 sticky top-0 z-20">
        <div className="max-w-screen-2xl mx-auto px-6">
          <div className="flex items-center gap-1 overflow-x-auto py-0 scrollbar-hide">
            {TABS.map(tab => {
              const Icon = tab.icon;
              const isActive = tab.id === activeTab;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className="flex items-center gap-2 px-4 py-3.5 text-sm font-medium whitespace-nowrap border-b-2 transition-all flex-shrink-0"
                  style={{
                    borderBottomColor: isActive ? tab.accentHex : "transparent",
                    color: isActive ? tab.accentHex : "#9ca3af",
                  }}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  {tab.label}
                  {isActive && (
                    <span
                      className="ml-1 w-1.5 h-1.5 rounded-full animate-pulse"
                      style={{ background: tab.accentHex }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Active tab content */}
      <CommandCenterShell
        key={current.id}
        centerId={current.id}
        title={current.title}
        subtitle={current.subtitle}
        accentHex={current.accentHex}
        accentColor={current.id}
        icon={<current.icon className="w-5 h-5" />}
      />
    </div>
  );
}
