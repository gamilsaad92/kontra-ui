import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { Upload, FileText, CheckCircle2, ArrowRight, FileSpreadsheet, Building } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useAppContext } from "@/App";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import type { AnalysisResponse } from "@/lib/types";

const SAMPLES = [
  {
    id: "rent-roll",
    title: "Multifamily Rent Roll",
    description: "Excel format. Contains tenant details, lease terms, and current rent.",
    icon: FileSpreadsheet,
  },
  {
    id: "inspection",
    title: "Property Inspection",
    description: "PDF report. Includes deferred maintenance, safety hazards, and photos.",
    icon: Building,
  },
  {
    id: "financials",
    title: "T12 Financial Statement",
    description: "Trailing 12-month financials. Operating expenses and net operating income.",
    icon: FileText,
  }
];

export default function Home() {
  const [, setLocation] = useLocation();
  const { setAnalysisData } = useAppContext();
  const { toast } = useToast();
  
  const [selectedSample, setSelectedSample] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      setFile(droppedFile);
      setSelectedSample(null);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setSelectedSample(null);
    }
  };

  const handleSampleSelect = (id: string) => {
    setSelectedSample(id);
    setFile(null);
  };

  const handleStartAnalysis = async () => {
    if (!selectedSample && !file) {
      toast({
        title: "No document selected",
        description: "Please select a sample document or upload your own.",
        variant: "destructive"
      });
      return;
    }

    setIsUploading(true);
    setLocation("/analysis");

    try {
      const formData = new FormData();
      if (file) {
        formData.append("file", file);
      } else if (selectedSample) {
        formData.append("sampleType", selectedSample);
      }

      const response = await fetch('/api/analyze', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Analysis failed');
      }

      const data: AnalysisResponse = await response.json();
      setAnalysisData(data.analysis);
      
    } catch (error) {
      console.error(error);
      toast({
        title: "Analysis Failed",
        description: "There was an error analyzing the document. Please try again.",
        variant: "destructive"
      });
      // Fallback for demo purposes if API fails
      generateMockData();
    } finally {
      setIsUploading(false);
    }
  };

  // Mock data fallback for the demo
  const generateMockData = () => {
    setAnalysisData({
      property: {
        name: "Grand Horizon Apartments",
        address: "1234 Horizon Blvd, Austin, TX",
        type: "Multifamily",
        loanId: "LN-98421",
        loanBalance: 12500000,
        loanType: "Fixed Rate CMBS"
      },
      metrics: {
        occupancy: 92.5,
        dscr: 1.15,
        noi: 1450000,
        debtService: 1260000,
        ltv: 65.2,
        noiVariance: -4.2
      },
      aiSummary: "The property is generally stable but shows slight compression in DSCR due to a 4.2% drop in NOI trailing 12 months. Occupancy remains healthy at 92.5%. Two major leases are expiring in the next 90 days which poses a short-term cash flow risk.",
      risks: [
        {
          level: "HIGH",
          category: "Financial",
          description: "DSCR approaching covenant threshold of 1.10x",
          trigger: "Current DSCR at 1.15x"
        },
        {
          level: "MEDIUM",
          category: "Leasing",
          description: "Major tenant roll rollover in Q3",
          trigger: "15% of NRA expiring within 90 days"
        }
      ],
      complianceFlags: [
        {
          type: "NOTICE",
          description: "Annual Financials Due",
          action: "Collect audited T12",
          deadline: "2024-05-15"
        },
        {
          type: "WATCHLIST",
          description: "Insurance Renewal Pending",
          action: "Verify hazard coverage",
          deadline: "2024-04-30"
        }
      ],
      issues: ["Deferred maintenance on roof", "Missing rent roll for Building B"],
      recommendedActions: ["Schedule site inspection", "Request updated rent roll", "Issue warning letter for DSCR covenant"],
      workflow: {
        type: "Compliance Review",
        title: "Annual Review Checklist",
        items: [
          { id: "1", label: "Upload T12 Financials", status: "complete", responsible: "Borrower", dueDate: "2024-04-01", auditNote: "Uploaded by Borrower on Apr 1" },
          { id: "2", label: "AI Data Extraction", status: "complete", responsible: "System", dueDate: "2024-04-01", auditNote: "Completed automatically" },
          { id: "3", label: "Analyst Review", status: "in-progress", responsible: "Servicer", dueDate: "2024-04-15" },
          { id: "4", label: "Covenant Testing", status: "pending", responsible: "System", dueDate: "2024-04-15" },
          { id: "5", label: "Final Approval", status: "required", responsible: "Portfolio Manager", dueDate: "2024-04-20" }
        ]
      },
      tokenization: {
        poolValue: 50000000,
        loanBalance: 12500000,
        investorShares: 12500,
        shareValue: 1000,
        projectedCashFlow: 85000,
        yieldRate: 8.2,
        riskRating: "B+",
        status: "Ready"
      }
    });
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-screen pt-20 pb-12 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto"
    >
      <div className="text-center mb-12">
        <h1 className="text-4xl md:text-5xl font-bold mb-4 font-serif text-primary">Kontra</h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto font-sans font-light">
          Upload a document. Kontra extracts, structures, and flags risk — instantly.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-12 items-start">
        <div className="space-y-6">
          <h2 className="text-2xl font-serif border-b border-border pb-2">Select a Sample</h2>
          <div className="grid gap-4">
            {SAMPLES.map((sample) => {
              const Icon = sample.icon;
              const isSelected = selectedSample === sample.id;
              
              return (
                <Card 
                  key={sample.id}
                  className={`cursor-pointer transition-all border-l-4 ${
                    isSelected 
                      ? 'border-l-primary bg-accent/50' 
                      : 'border-l-transparent hover:bg-accent/30'
                  }`}
                  onClick={() => handleSampleSelect(sample.id)}
                >
                  <CardHeader className="flex flex-row items-start space-y-0 pb-2">
                    <div className="flex-1">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Icon className="w-5 h-5 text-primary" />
                        {sample.title}
                      </CardTitle>
                    </div>
                    {isSelected && <CheckCircle2 className="w-5 h-5 text-primary" />}
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{sample.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        <div className="space-y-6">
          <h2 className="text-2xl font-serif border-b border-border pb-2">Or Upload Document</h2>
          
          <div
            className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
              isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
            } ${file ? 'bg-accent/20' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              onChange={handleFileChange}
              accept=".pdf,.xlsx,.xls,.csv"
            />
            
            {file ? (
              <div className="space-y-4">
                <FileText className="w-12 h-12 text-primary mx-auto" />
                <div>
                  <p className="font-medium text-lg">{file.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setFile(null)}
                >
                  Remove
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <Upload className="w-12 h-12 text-muted-foreground mx-auto" />
                <div>
                  <p className="text-lg font-medium">Drag & drop your document</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Supports PDF, Excel, or CSV
                  </p>
                </div>
                <Button 
                  variant="secondary"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Browse Files
                </Button>
              </div>
            )}
          </div>

          <div className="pt-6">
            <Button 
              className="w-full h-14 text-lg font-medium tracking-wide"
              size="lg"
              onClick={handleStartAnalysis}
              disabled={!selectedSample && !file || isUploading}
            >
              Start Analysis
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
