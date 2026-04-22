import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { 
  CheckCircle2, 
  Circle, 
  Clock, 
  AlertCircle, 
  ShieldCheck, 
  ArrowLeft,
  ChevronRight,
  User,
  Shield,
  FileCheck,
  Building2,
  TrendingUp,
  LineChart,
  Lock,
  Layers,
  Banknote
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useAppContext } from "@/App";
import { useToast } from "@/hooks/use-toast";

export default function Workflow() {
  const [, setLocation] = useLocation();
  const { analysisData } = useAppContext();
  const { toast } = useToast();
  
  const [isTokenizing, setIsTokenizing] = useState(false);
  const [tokenized, setTokenized] = useState(false);

  useEffect(() => {
    if (!analysisData) {
      setLocation("/");
    }
  }, [analysisData, setLocation]);

  if (!analysisData) return null;

  const { property, workflow, tokenization } = analysisData;

  const handleTokenize = () => {
    setIsTokenizing(true);
    // Mock blockchain delay
    setTimeout(() => {
      setIsTokenizing(false);
      setTokenized(true);
      toast({
        title: "Tokenization Complete",
        description: "Asset has been digitized and published to the capital market pool.",
      });
    }, 2500);
  };

  const getStatusIcon = (status: string) => {
    switch(status) {
      case "complete": return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
      case "in-progress": return <Clock className="w-5 h-5 text-amber-500" />;
      case "required": return <AlertCircle className="w-5 h-5 text-destructive" />;
      default: return <Circle className="w-5 h-5 text-muted-foreground" />;
    }
  };

  const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);
  const formatPercent = (val: number) => `${val.toFixed(1)}%`;
  const formatNumber = (val: number) => new Intl.NumberFormat('en-US').format(val);

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => setLocation("/analysis")}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="text-foreground font-serif font-bold text-xl">
              Execution & Capital Markets
            </div>
          </div>
          <div className="text-sm font-mono text-muted-foreground flex items-center gap-2">
            <Building2 className="w-4 h-4" /> {property.name}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid lg:grid-cols-2 gap-8 h-full">
          
          {/* LEFT PANEL - Workflow */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-serif">Action Workflow</h2>
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 font-mono">
                {workflow.type}
              </Badge>
            </div>
            
            <p className="text-muted-foreground text-sm">
              Generated dynamically based on document analysis and Kontra servicing policies.
            </p>

            <Card className="bg-card">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg">{workflow.title}</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border">
                  {workflow.items.map((item, idx) => (
                    <div key={item.id} className="p-4 sm:p-6 hover:bg-accent/10 transition-colors">
                      <div className="flex items-start gap-4">
                        <div className="mt-1">
                          {getStatusIcon(item.status)}
                        </div>
                        <div className="flex-1 space-y-1">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <h4 className={`font-medium ${item.status === 'complete' ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                              {item.label}
                            </h4>
                            <div className="flex items-center gap-2 text-xs">
                              <Badge variant="secondary" className="font-mono text-[10px]">
                                {item.responsible}
                              </Badge>
                              <span className="text-muted-foreground whitespace-nowrap">Due: {item.dueDate}</span>
                            </div>
                          </div>
                          
                          {item.auditNote && (
                            <div className="text-xs text-muted-foreground bg-background p-2 rounded mt-2 font-mono flex items-center gap-2 border border-border">
                              <Shield className="w-3 h-3" />
                              {item.auditNote}
                            </div>
                          )}
                          
                          {item.status === 'in-progress' && (
                            <div className="mt-3">
                              <Button size="sm" variant="outline" className="h-8 text-xs">
                                Update Status
                              </Button>
                            </div>
                          )}
                          
                          {item.status === 'required' && (
                            <div className="mt-3">
                              <Button size="sm" className="h-8 text-xs bg-primary text-primary-foreground hover:bg-primary/90">
                                Take Action
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-4 uppercase tracking-wider font-mono">System Audit Log</h3>
              <div className="space-y-3 border-l-2 border-border ml-2 pl-4">
                <div className="relative">
                  <div className="absolute -left-[21px] top-1 w-2 h-2 rounded-full bg-border"></div>
                  <div className="text-xs font-mono text-muted-foreground mb-0.5">Today, 09:14 AM</div>
                  <div className="text-sm">Document package uploaded by Servicing Agent</div>
                </div>
                <div className="relative">
                  <div className="absolute -left-[21px] top-1 w-2 h-2 rounded-full bg-border"></div>
                  <div className="text-xs font-mono text-muted-foreground mb-0.5">Today, 09:15 AM</div>
                  <div className="text-sm">Kontra AI extraction & analysis complete</div>
                </div>
                <div className="relative">
                  <div className="absolute -left-[21px] top-1 w-2 h-2 rounded-full bg-primary"></div>
                  <div className="text-xs font-mono text-muted-foreground mb-0.5">Today, 09:15 AM</div>
                  <div className="text-sm text-foreground">Risk assessment generated and workflow applied</div>
                </div>
              </div>
            </div>
          </motion.div>


          {/* RIGHT PANEL - Tokenization */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-serif">Capital Markets</h2>
              {tokenized && (
                <Badge className="bg-emerald-500/20 text-emerald-500 border-emerald-500/50 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" /> LIVE ON CHAIN
                </Badge>
              )}
            </div>

            <Card className={`border-2 transition-all duration-1000 relative overflow-hidden ${tokenized ? 'border-primary shadow-[0_0_30px_rgba(128,0,32,0.15)] bg-card' : 'border-border bg-card/50'}`}>
              
              {/* Background abstract element when tokenized */}
              {tokenized && (
                <div className="absolute -right-20 -top-20 w-64 h-64 bg-primary/10 rounded-full blur-3xl pointer-events-none"></div>
              )}

              <CardHeader className="border-b border-border/50 pb-6 relative z-10">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <Layers className={`w-5 h-5 ${tokenized ? 'text-primary' : 'text-muted-foreground'}`} />
                    <CardTitle className="text-xl">Asset Securitization</CardTitle>
                  </div>
                  {tokenized ? (
                    <Badge variant="outline" className="border-primary/50 text-primary font-mono bg-primary/5">STANDARDIZED</Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground font-mono">PENDING</Badge>
                  )}
                </div>
                <CardDescription className="text-base mt-2">
                  This loan is structured, auditable, and ready for fractional investment pools.
                </CardDescription>
              </CardHeader>
              
              <CardContent className="pt-6 relative z-10">
                <div className="grid grid-cols-2 gap-x-4 gap-y-6">
                  <div>
                    <div className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
                      <Building2 className="w-3 h-3" /> Underlying Asset
                    </div>
                    <div className="text-lg font-bold">{formatCurrency(tokenization.loanBalance)}</div>
                  </div>
                  
                  <div>
                    <div className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
                      <Banknote className="w-3 h-3" /> Total Pool Value
                    </div>
                    <div className="text-lg font-bold">{formatCurrency(tokenization.poolValue)}</div>
                  </div>

                  <Separator className="col-span-2 my-2" />

                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Projected Yield</div>
                    <div className="text-2xl font-mono text-emerald-500 font-bold">
                      {formatPercent(tokenization.yieldRate)}
                    </div>
                  </div>

                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Monthly Cash Flow</div>
                    <div className="text-2xl font-mono font-bold">
                      {formatCurrency(tokenization.projectedCashFlow)}
                    </div>
                  </div>

                  <Separator className="col-span-2 my-2" />

                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Total Shares</div>
                    <div className="text-lg font-mono">{formatNumber(tokenization.investorShares)}</div>
                  </div>

                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Share Price</div>
                    <div className="text-lg font-mono">{formatCurrency(tokenization.shareValue)}</div>
                  </div>
                  
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Risk Rating</div>
                    <Badge variant="outline" className="font-bold border-primary text-primary">{tokenization.riskRating}</Badge>
                  </div>
                  
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Status</div>
                    <div className="text-sm font-medium">{tokenized ? "Active & Trading" : "Awaiting Execution"}</div>
                  </div>
                </div>

                {tokenized && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="mt-8 p-4 bg-background rounded-lg border border-border"
                  >
                    <div className="flex items-center gap-2 text-sm font-medium mb-3">
                      <LineChart className="w-4 h-4 text-emerald-500" /> Live Market Data
                    </div>
                    <div className="flex justify-between items-center text-sm font-mono">
                      <span className="text-muted-foreground">Current Bids</span>
                      <span>42 active</span>
                    </div>
                    <div className="flex justify-between items-center text-sm font-mono mt-2">
                      <span className="text-muted-foreground">Volume (24h)</span>
                      <span>{formatCurrency(1250000)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm font-mono mt-2 pt-2 border-t border-border">
                      <span className="text-muted-foreground">Smart Contract</span>
                      <span className="text-primary truncate max-w-[120px]">0x7F...3b9A</span>
                    </div>
                  </motion.div>
                )}
              </CardContent>
              
              <CardFooter className="bg-card border-t border-border/50 pt-6 relative z-10">
                {!tokenized ? (
                  <Button 
                    className="w-full h-14 text-lg font-medium tracking-wide bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20"
                    size="lg"
                    onClick={handleTokenize}
                    disabled={isTokenizing}
                  >
                    {isTokenizing ? (
                      <>Processing <span className="animate-pulse ml-2">...</span></>
                    ) : (
                      <>
                        <Lock className="mr-2 w-5 h-5" /> Enable Tokenization
                      </>
                    )}
                  </Button>
                ) : (
                  <Button 
                    className="w-full h-14 text-lg font-medium tracking-wide"
                    variant="outline"
                    size="lg"
                  >
                    View Ledger <ChevronRight className="ml-2 w-5 h-5" />
                  </Button>
                )}
              </CardFooter>
            </Card>

          </motion.div>
        </div>
      </main>
    </div>
  );
}
