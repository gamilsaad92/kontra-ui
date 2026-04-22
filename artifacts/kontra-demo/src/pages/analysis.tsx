import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Building, MapPin, Key, Hash, FileWarning, AlertTriangle, AlertCircle, FileCheck, ArrowRight, Loader2, DollarSign, Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useAppContext } from "@/App";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

const LOADING_STEPS = [
  "Ingesting document...",
  "Running OCR extraction...",
  "Structuring tabular data...",
  "Computing financial metrics...",
  "Cross-referencing covenants...",
  "Flagging portfolio risks...",
  "Generating servicer workflow..."
];

export default function Analysis() {
  const [, setLocation] = useLocation();
  const { analysisData } = useAppContext();
  
  const [isLoading, setIsLoading] = useState(true);
  const [loadingStep, setLoadingStep] = useState(0);
  const [progress, setProgress] = useState(0);

  // Animated numbers
  const [displayOccupancy, setDisplayOccupancy] = useState(0);
  const [displayDscr, setDisplayDscr] = useState(0);

  useEffect(() => {
    if (!analysisData && !isLoading) {
      // Go back if we have no data and aren't loading
      setLocation("/");
      return;
    }

    if (isLoading) {
      const stepDuration = 4500 / LOADING_STEPS.length;
      
      const progressInterval = setInterval(() => {
        setProgress(p => {
          if (p >= 100) return 100;
          return p + (100 / (4500 / 50));
        });
      }, 50);

      const stepInterval = setInterval(() => {
        setLoadingStep(s => {
          if (s >= LOADING_STEPS.length - 1) return s;
          return s + 1;
        });
      }, stepDuration);

      const timeout = setTimeout(() => {
        setIsLoading(false);
        clearInterval(progressInterval);
        clearInterval(stepInterval);
      }, 4500);

      return () => {
        clearInterval(progressInterval);
        clearInterval(stepInterval);
        clearTimeout(timeout);
      };
    }
  }, [isLoading, analysisData, setLocation]);

  // Animate numbers when data is loaded
  useEffect(() => {
    if (!isLoading && analysisData) {
      const duration = 1000;
      const steps = 60;
      const interval = duration / steps;
      
      let step = 0;
      const timer = setInterval(() => {
        step++;
        const progress = step / steps;
        
        setDisplayOccupancy(analysisData.metrics.occupancy * progress);
        setDisplayDscr(analysisData.metrics.dscr * progress);
        
        if (step >= steps) {
          clearInterval(timer);
        }
      }, interval);
      
      return () => clearInterval(timer);
    }
  }, [isLoading, analysisData]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center space-y-2">
            <h2 className="text-3xl font-serif text-primary">Kontra Engine</h2>
            <p className="text-muted-foreground animate-pulse">Processing institutional data...</p>
          </div>
          
          <div className="space-y-4">
            <Progress value={progress} className="h-2 w-full bg-secondary" />
            <div className="flex justify-between text-sm font-mono text-muted-foreground">
              <span>{Math.round(progress)}%</span>
              <span className="animate-pulse">{LOADING_STEPS[loadingStep]}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!analysisData) return null;

  const { property, metrics, aiSummary, risks, complianceFlags, recommendedActions } = analysisData;

  const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);
  const formatPercent = (val: number) => `${val.toFixed(1)}%`;

  // Color logic for metrics
  const getDscrColor = (dscr: number) => {
    if (dscr >= 1.25) return "text-emerald-500";
    if (dscr >= 1.1) return "text-amber-500";
    return "text-destructive";
  };
  
  const getOccupancyColor = (occ: number) => {
    if (occ >= 90) return "text-emerald-500";
    if (occ >= 85) return "text-amber-500";
    return "text-destructive";
  };

  const getRiskColor = (level: string) => {
    switch(level) {
      case "HIGH": return "bg-destructive/10 text-destructive border-destructive/20";
      case "MEDIUM": return "bg-amber-500/10 text-amber-500 border-amber-500/20";
      case "LOW": return "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
      default: return "bg-secondary text-secondary-foreground";
    }
  };

  const getComplianceColor = (type: string) => {
    switch(type) {
      case "VIOLATION": return "bg-destructive text-destructive-foreground";
      case "WATCHLIST": return "bg-amber-500 text-amber-950";
      case "NOTICE": return "bg-blue-500 text-blue-950";
      default: return "bg-secondary text-secondary-foreground";
    }
  };

  const chartData = [
    { name: 'NOI', value: metrics.noi, fill: 'hsl(var(--primary))' },
    { name: 'Debt Svc', value: metrics.debtService, fill: 'hsl(var(--muted))' }
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 text-primary font-serif font-bold text-xl">
            <Activity className="w-5 h-5" />
            Kontra Analysis
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs font-mono text-muted-foreground">ID: {property.loanId}</span>
            <Button size="sm" onClick={() => setLocation("/workflow")}>
              Generate Workflow <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <motion.main 
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8"
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        {/* Property Info Header */}
        <motion.div variants={itemVariants}>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-serif font-bold mb-2">{property.name}</h1>
              <div className="flex flex-wrap items-center gap-4 text-muted-foreground text-sm">
                <span className="flex items-center gap-1"><MapPin className="w-4 h-4" /> {property.address}</span>
                <span className="flex items-center gap-1"><Building className="w-4 h-4" /> {property.type}</span>
                <span className="flex items-center gap-1"><Key className="w-4 h-4" /> {property.loanType}</span>
                <span className="flex items-center gap-1"><DollarSign className="w-4 h-4" /> {formatCurrency(property.loanBalance)}</span>
              </div>
            </div>
            <Badge variant="outline" className="text-sm px-3 py-1 font-mono uppercase border-primary/30 text-primary self-start md:self-end">
              Analyzed Just Now
            </Badge>
          </div>
        </motion.div>

        {/* Key Metrics Row */}
        <motion.div variants={itemVariants} className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="bg-card">
            <CardContent className="pt-6">
              <div className="text-sm text-muted-foreground mb-1 font-medium">Occupancy</div>
              <div className={`text-3xl font-mono font-bold ${getOccupancyColor(metrics.occupancy)}`}>
                {formatPercent(displayOccupancy)}
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-card">
            <CardContent className="pt-6">
              <div className="text-sm text-muted-foreground mb-1 font-medium">DSCR</div>
              <div className={`text-3xl font-mono font-bold ${getDscrColor(metrics.dscr)}`}>
                {displayDscr.toFixed(2)}x
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-card">
            <CardContent className="pt-6">
              <div className="text-sm text-muted-foreground mb-1 font-medium">NOI</div>
              <div className="text-3xl font-mono font-bold text-foreground">
                {formatCurrency(metrics.noi)}
              </div>
              <div className={`text-xs mt-1 ${metrics.noiVariance < 0 ? 'text-destructive' : 'text-emerald-500'}`}>
                {metrics.noiVariance > 0 ? '+' : ''}{metrics.noiVariance}% YoY
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card">
            <CardContent className="pt-6">
              <div className="text-sm text-muted-foreground mb-1 font-medium">Debt Service</div>
              <div className="text-3xl font-mono font-bold text-foreground">
                {formatCurrency(metrics.debtService)}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card">
            <CardContent className="pt-6">
              <div className="text-sm text-muted-foreground mb-1 font-medium">LTV</div>
              <div className="text-3xl font-mono font-bold text-foreground">
                {formatPercent(metrics.ltv)}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8">
          <div className="md:col-span-2 space-y-8">
            {/* AI Summary */}
            <motion.div variants={itemVariants}>
              <Card className="bg-accent/10 border-primary/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-primary font-serif">
                    <Activity className="w-5 h-5" /> Executive Summary
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-lg leading-relaxed">{aiSummary}</p>
                </CardContent>
              </Card>
            </motion.div>

            {/* Risk Flags */}
            <motion.div variants={itemVariants} className="space-y-4">
              <h2 className="text-2xl font-serif flex items-center gap-2">
                <AlertTriangle className="w-6 h-6 text-amber-500" /> Risk Analysis
              </h2>
              <div className="grid gap-4">
                {risks.map((risk, idx) => (
                  <Card key={idx} className="bg-card">
                    <CardContent className="p-0">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center">
                        <div className={`p-4 sm:p-6 sm:w-40 flex-shrink-0 flex items-center gap-2 font-mono font-bold text-sm ${getRiskColor(risk.level)} border-b sm:border-b-0 sm:border-r`}>
                          {risk.level === 'HIGH' && <AlertCircle className="w-4 h-4" />}
                          {risk.level === 'MEDIUM' && <AlertTriangle className="w-4 h-4" />}
                          {risk.level === 'LOW' && <FileCheck className="w-4 h-4" />}
                          {risk.level} RISK
                        </div>
                        <div className="p-4 sm:p-6 flex-1">
                          <div className="text-xs text-muted-foreground font-mono uppercase tracking-wider mb-1">{risk.category}</div>
                          <div className="font-medium text-lg mb-2">{risk.description}</div>
                          <div className="text-sm text-muted-foreground bg-secondary/50 p-2 rounded inline-block">Trigger: {risk.trigger}</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </motion.div>
          </div>

          <div className="space-y-8">
            {/* Chart */}
            <motion.div variants={itemVariants}>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Cash Flow Coverage</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[200px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                        <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis 
                          stroke="hsl(var(--muted-foreground))" 
                          fontSize={12} 
                          tickLine={false} 
                          axisLine={false}
                          tickFormatter={(value) => `$${value/1000}k`}
                        />
                        <Tooltip 
                          formatter={(value: number) => formatCurrency(value)}
                          contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }}
                          itemStyle={{ color: 'hsl(var(--foreground))' }}
                        />
                        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                          {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Compliance Flags */}
            <motion.div variants={itemVariants} className="space-y-4">
              <h2 className="text-xl font-serif">Compliance Status</h2>
              <div className="space-y-3">
                {complianceFlags.map((flag, idx) => (
                  <div key={idx} className="bg-card border border-border p-4 rounded-lg">
                    <div className="flex justify-between items-start mb-2">
                      <Badge className={getComplianceColor(flag.type)} variant="outline">
                        {flag.type}
                      </Badge>
                      <span className="text-xs font-mono text-muted-foreground">{flag.deadline}</span>
                    </div>
                    <div className="font-medium mb-1">{flag.description}</div>
                    <div className="text-sm text-muted-foreground">Required: {flag.action}</div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Recommended Actions */}
            <motion.div variants={itemVariants} className="space-y-4">
              <h2 className="text-xl font-serif">System Recommendations</h2>
              <Card>
                <CardContent className="p-0">
                  <ul className="divide-y divide-border">
                    {recommendedActions.map((action, idx) => (
                      <li key={idx} className="p-4 flex gap-3">
                        <div className="mt-0.5 bg-primary/20 text-primary rounded-full w-5 h-5 flex items-center justify-center text-xs flex-shrink-0">
                          {idx + 1}
                        </div>
                        <span className="text-sm">{action}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </motion.main>
    </div>
  );
}
