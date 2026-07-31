import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Loader2 } from "lucide-react";
import { useDemoContext } from "@/context/DemoContext";

const STEPS = [
  { label: "Identifying transaction type", detail: "Matching Workflow Pack to deal structure" },
  { label: "Configuring workflow stages", detail: "Building lifecycle from term sheet to close" },
  { label: "Assigning participant roles", detail: "Role permissions and visibility rules applied" },
  { label: "Building document checklist", detail: "Required and optional items from pack definition" },
  { label: "Calibrating AI intelligence", detail: "Benchmarks, risk thresholds, and scoring model loaded" },
];

const STEP_DELAY_MS = 620;

export default function Generating() {
  const [, setLocation] = useLocation();
  const { selectedPack, dealName } = useDemoContext();
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [activeStep, setActiveStep] = useState(0);
  const [done, setDone] = useState(false);

  // Redirect if no pack selected (e.g. direct navigation)
  useEffect(() => {
    if (!selectedPack) {
      setLocation("/");
    }
  }, [selectedPack, setLocation]);

  // Step through the generation sequence
  useEffect(() => {
    if (!selectedPack) return;

    const timers: ReturnType<typeof setTimeout>[] = [];

    STEPS.forEach((_, i) => {
      // mark step as active
      timers.push(setTimeout(() => setActiveStep(i), i * STEP_DELAY_MS));
      // mark as complete shortly after becoming active
      timers.push(setTimeout(() => {
        setCompletedSteps((prev) => [...prev, i]);
      }, i * STEP_DELAY_MS + 480));
    });

    // All done
    timers.push(setTimeout(() => setDone(true), STEPS.length * STEP_DELAY_MS + 300));
    timers.push(setTimeout(() => setLocation("/workspace"), STEPS.length * STEP_DELAY_MS + 900));

    return () => timers.forEach(clearTimeout);
  }, [selectedPack, setLocation]);

  if (!selectedPack) return null;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6">
      {/* Pack badge */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-10 text-center"
      >
        <div className="inline-flex items-center gap-2 border border-border rounded-full px-4 py-1.5 mb-4">
          <span className="text-xs font-mono text-muted-foreground">{selectedPack.badge} Workflow Pack</span>
        </div>
        <h2 className="text-3xl font-serif font-semibold mb-2">
          {selectedPack.name}
        </h2>
        <p className="text-muted-foreground text-sm max-w-sm mx-auto">
          Creating workspace for <span className="text-foreground font-medium">"{dealName}"</span>
        </p>
      </motion.div>

      {/* Steps */}
      <div className="w-full max-w-md space-y-3">
        {STEPS.map((step, i) => {
          const isComplete = completedSteps.includes(i);
          const isActive = activeStep === i && !isComplete;

          return (
            <motion.div
              key={step.label}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: activeStep >= i ? 1 : 0.3, x: 0 }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
              className={`flex items-start gap-3 p-4 rounded-lg border transition-colors ${
                isComplete
                  ? "border-primary/30 bg-primary/5"
                  : isActive
                  ? "border-border bg-card"
                  : "border-border/40 bg-card/30"
              }`}
            >
              <div className="flex-shrink-0 mt-0.5">
                <AnimatePresence mode="wait">
                  {isComplete ? (
                    <motion.div
                      key="check"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center"
                    >
                      <Check className="w-3 h-3 text-primary" />
                    </motion.div>
                  ) : isActive ? (
                    <motion.div key="spin" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                      <Loader2 className="w-5 h-5 text-primary animate-spin" />
                    </motion.div>
                  ) : (
                    <div key="idle" className="w-5 h-5 rounded-full border border-border/50" />
                  )}
                </AnimatePresence>
              </div>
              <div>
                <p className={`text-sm font-medium ${isComplete ? "text-foreground" : isActive ? "text-foreground" : "text-muted-foreground"}`}>
                  {step.label}
                </p>
                {(isActive || isComplete) && (
                  <motion.p
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="text-xs text-muted-foreground mt-0.5"
                  >
                    {step.detail}
                  </motion.p>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Done state */}
      <AnimatePresence>
        {done && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-8 text-center"
          >
            <p className="text-sm font-medium text-primary">Workspace ready — launching...</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Subtle progress bar */}
      <div className="w-full max-w-md mt-8 h-0.5 bg-border/40 rounded overflow-hidden">
        <motion.div
          className="h-full bg-primary rounded"
          initial={{ width: "0%" }}
          animate={{ width: done ? "100%" : `${(completedSteps.length / STEPS.length) * 100}%` }}
          transition={{ duration: 0.4 }}
        />
      </div>
    </div>
  );
}
