import { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { ArrowRight, Building2, TrendingUp, Rocket, Sparkles, ChevronRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PACK_LIST, type WorkflowPack } from "@/lib/packs";
import { useDemoContext } from "@/context/DemoContext";

const PACK_ICONS: Record<string, React.ElementType> = {
  cre: Building2,
  acquisition: TrendingUp,
  fundraising: Rocket,
};

const PACK_ICON_BG: Record<string, string> = {
  cre: "bg-amber-500/10 text-amber-400",
  acquisition: "bg-blue-500/10 text-blue-400",
  fundraising: "bg-violet-500/10 text-violet-400",
};

const PLATFORM_PILLARS = [
  { label: "AI Document Intelligence", detail: "Extracts, structures, and scores any document in seconds" },
  { label: "Role-Based Collaboration", detail: "Every participant sees only what their role should see" },
  { label: "Configurable Workflow Packs", detail: "Transaction logic adapts — no CRE assumptions by default" },
  { label: "Structured Closing Package", detail: "Audit-ready deal room from first upload to final signature" },
];

export default function Home() {
  const [, setLocation] = useLocation();
  const { setSelectedPack, setDealName } = useDemoContext();
  const [hoveredPack, setHoveredPack] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleSelectPack = (pack: WorkflowPack) => {
    setSelectedId(pack.id);
    setSelectedPack(pack);
    setDealName(pack.sampleDealName);
    setTimeout(() => setLocation("/generating"), 180);
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-5 border-b border-border/50">
        <span className="font-serif text-xl text-primary font-semibold tracking-tight">Kontra</span>
        <span className="text-xs text-muted-foreground bg-accent/60 border border-border rounded px-2.5 py-1">
          Interactive Demo
        </span>
      </nav>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center px-6 pt-20 pb-10 text-center max-w-5xl mx-auto w-full">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-1.5 mb-8">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-medium text-primary">Powered by Workflow Packs</span>
          </div>

          <h1 className="text-5xl md:text-6xl font-serif font-semibold tracking-tight mb-5 leading-[1.1]">
            The AI Transaction<br />
            <span className="text-primary">Workspace</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-4 leading-relaxed">
            Kontra is not built for one industry. It adapts to any private transaction through
            <strong className="text-foreground font-medium"> Workflow Packs</strong> — configurable intelligence
            layers that define participants, stages, document checklists, and AI scoring for each transaction type.
          </p>
          <p className="text-sm text-muted-foreground mb-12">
            Select a Workflow Pack below to create a live workspace.
          </p>
        </motion.div>

        {/* Pack cards */}
        <motion.div
          className="grid md:grid-cols-3 gap-4 w-full mb-14"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
        >
          {PACK_LIST.map((pack) => {
            const Icon = PACK_ICONS[pack.id] ?? Sparkles;
            const iconBg = PACK_ICON_BG[pack.id] ?? "bg-muted/30 text-muted-foreground";
            const isSelected = selectedId === pack.id;
            const isHovered = hoveredPack === pack.id;

            return (
              <motion.button
                key={pack.id}
                onClick={() => handleSelectPack(pack)}
                onMouseEnter={() => setHoveredPack(pack.id)}
                onMouseLeave={() => setHoveredPack(null)}
                whileTap={{ scale: 0.98 }}
                className={`
                  relative text-left rounded-xl border p-6 transition-all duration-200 cursor-pointer
                  ${isSelected
                    ? "border-primary bg-primary/5"
                    : isHovered
                    ? "border-border/80 bg-card/80"
                    : "border-border/50 bg-card/40"
                  }
                `}
              >
                {/* Pack badge */}
                <div className="flex items-start justify-between mb-4">
                  <div className={`rounded-lg p-2.5 ${iconBg}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-mono font-medium text-muted-foreground border border-border/60 rounded px-1.5 py-0.5">
                    {pack.badge}
                  </span>
                </div>

                <h3 className="font-serif font-semibold text-lg mb-1">{pack.name}</h3>
                <p className="text-sm text-muted-foreground mb-4 leading-relaxed">{pack.description}</p>

                {/* Stage count */}
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {pack.stages.map((s, i) => (
                    <span key={s.id} className="text-[10px] text-muted-foreground bg-accent/50 rounded px-2 py-0.5">
                      {i + 1}. {s.label}
                    </span>
                  ))}
                </div>

                <div className={`flex items-center gap-1.5 text-sm font-medium transition-colors ${isHovered || isSelected ? "text-primary" : "text-muted-foreground"}`}>
                  {isSelected ? (
                    <><Check className="w-4 h-4" /> Creating workspace...</>
                  ) : (
                    <>Create workspace <ChevronRight className="w-4 h-4" /></>
                  )}
                </div>
              </motion.button>
            );
          })}
        </motion.div>

        {/* Platform pillars */}
        <motion.div
          className="w-full border-t border-border/40 pt-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-6 font-medium">
            The same platform — adapted to every transaction
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {PLATFORM_PILLARS.map((p) => (
              <div key={p.label} className="text-left">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                  <span className="text-sm font-medium">{p.label}</span>
                </div>
                <p className="text-xs text-muted-foreground pl-3.5 leading-relaxed">{p.detail}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </section>
    </div>
  );
}
