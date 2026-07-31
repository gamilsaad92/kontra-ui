import { createContext, useContext, useState, ReactNode } from "react";
import type { WorkflowPack } from "@/lib/packs";

interface DemoState {
  selectedPack: WorkflowPack | null;
  dealName: string;
  setSelectedPack: (pack: WorkflowPack | null) => void;
  setDealName: (name: string) => void;
}

const DemoContext = createContext<DemoState>({
  selectedPack: null,
  dealName: "",
  setSelectedPack: () => {},
  setDealName: () => {},
});

export function DemoProvider({ children }: { children: ReactNode }) {
  const [selectedPack, setSelectedPack] = useState<WorkflowPack | null>(null);
  const [dealName, setDealName] = useState("");

  return (
    <DemoContext.Provider value={{ selectedPack, dealName, setSelectedPack, setDealName }}>
      {children}
    </DemoContext.Provider>
  );
}

export function useDemoContext() {
  return useContext(DemoContext);
}
