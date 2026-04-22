import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { createContext, useState, useContext, ReactNode } from "react";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Analysis from "@/pages/analysis";
import Workflow from "@/pages/workflow";
import type { AnalysisResult } from "@/lib/types";

const queryClient = new QueryClient();

interface AppContextType {
  analysisData: AnalysisResult | null;
  setAnalysisData: (data: AnalysisResult | null) => void;
}

export const AppContext = createContext<AppContextType>({
  analysisData: null,
  setAnalysisData: () => {},
});

export function useAppContext() {
  return useContext(AppContext);
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/analysis" component={Analysis} />
      <Route path="/workflow" component={Workflow} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppProvider({ children }: { children: ReactNode }) {
  const [analysisData, setAnalysisData] = useState<AnalysisResult | null>(null);

  return (
    <AppContext.Provider value={{ analysisData, setAnalysisData }}>
      {children}
    </AppContext.Provider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AppProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <div className="dark min-h-[100dvh] bg-background text-foreground font-sans">
              <main className="w-full h-full min-h-[100dvh]">
                <Router />
              </main>
            </div>
          </WouterRouter>
        </AppProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
