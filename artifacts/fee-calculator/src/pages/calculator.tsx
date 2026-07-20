import React, { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Calculator, RotateCcw, Briefcase, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

// Helper to format currency
const formatCurrency = (val: number) => 
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 2 }).format(val);

export default function CalculatorPage() {
  const [mode, setMode] = useState<"contract" | "perm">("contract");

  // Contract State
  const [dayRate, setDayRate] = useState("500");
  const [margin, setMargin] = useState("15");
  const [includeNI, setIncludeNI] = useState(true);

  // Perm State
  const [salary, setSalary] = useState("50000");
  const [placementFee, setPlacementFee] = useState("20");
  const [includePermNI, setIncludePermNI] = useState(false);

  const reset = () => {
    setDayRate("500");
    setMargin("15");
    setIncludeNI(true);
    setSalary("50000");
    setPlacementFee("20");
    setIncludePermNI(false);
  };

  // --- Contract Calculations ---
  const cDayRate = parseFloat(dayRate) || 0;
  const cMargin = parseFloat(margin) || 0;

  const cManagementFee = cDayRate * (cMargin / 100);
  const cGrossPay = cDayRate - cManagementFee;
  // NI calculation: 15% of (gross worker pay − 35.00)
  const cEmployerNI = includeNI ? Math.max(0, (cGrossPay - 35) * 0.15) : 0;
  const cWorkerNet = cGrossPay - cEmployerNI;

  // --- Perm Calculations ---
  const pSalary = parseFloat(salary) || 0;
  const pFeePct = parseFloat(placementFee) || 0;

  const pPlacementFee = pSalary * (pFeePct / 100);
  // NI calculation: 15% of (annual salary - 9100)
  const pEmployerNI = includePermNI ? Math.max(0, (pSalary - 9100) * 0.15) : 0;
  const pTotalCost = pPlacementFee + (includePermNI ? pEmployerNI : 0);

  return (
    <div className="min-h-[100dvh] bg-background py-10 px-4 sm:px-6 md:px-8 flex flex-col items-center">
       {/* Max Width Container */}
       <div className="w-full max-w-5xl">
          <header className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
                <div className="p-2.5 bg-primary/10 rounded-xl text-primary">
                  <Calculator className="h-7 w-7" />
                </div>
                Fee Calculator
              </h1>
              <p className="mt-2 text-muted-foreground font-medium">Precise breakdown of margins, costs, and placement fees.</p>
            </div>
            <button 
              onClick={reset} 
              className="self-start md:self-auto flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors px-4 py-2 rounded-lg hover:bg-input/50"
            >
              <RotateCcw className="h-4 w-4" />
              Reset Values
            </button>
          </header>

          <Tabs value={mode} onValueChange={(v) => setMode(v as "contract" | "perm")} className="w-full">
            <TabsList className="grid w-full max-w-md grid-cols-2 mb-8">
              <TabsTrigger value="contract" className="flex gap-2">
                <FileText className="h-4 w-4" /> 
                Contract / Day Rate
              </TabsTrigger>
              <TabsTrigger value="perm" className="flex gap-2">
                <Briefcase className="h-4 w-4" /> 
                Permanent
              </TabsTrigger>
            </TabsList>

            <TabsContent value="contract" className="m-0">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                 {/* Inputs */}
                 <div className="lg:col-span-5 space-y-6 bg-card border border-card-border p-7 rounded-2xl shadow-sm">
                    <h2 className="text-lg font-bold border-b border-border pb-4">Input Parameters</h2>
                    
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <label className="block text-sm font-bold text-foreground">Day Rate Charged to Client (£)</label>
                        <div className="relative group">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-mono">£</span>
                          <input 
                            type="number" 
                            value={dayRate} 
                            onChange={e => setDayRate(e.target.value)} 
                            className="w-full pl-10 pr-4 py-3 bg-input/40 border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all font-mono text-base font-medium" 
                            placeholder="0.00"
                          />
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <label className="block text-sm font-bold text-foreground">Agency Margin (%)</label>
                        <div className="relative group">
                          <input 
                            type="number" 
                            value={margin} 
                            onChange={e => setMargin(e.target.value)} 
                            className="w-full pl-4 pr-10 py-3 bg-input/40 border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all font-mono text-base font-medium" 
                            placeholder="0.0"
                          />
                          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground font-mono">%</span>
                        </div>
                      </div>

                      <div className="pt-4 flex items-center justify-between border-t border-border/60">
                        <div className="space-y-1 pr-4">
                          <label className="text-sm font-bold text-foreground cursor-pointer" onClick={() => setIncludeNI(!includeNI)}>Include Employer's NI</label>
                          <p className="text-xs text-muted-foreground font-medium">15% of gross pay over the £35 daily secondary threshold.</p>
                        </div>
                        <Switch checked={includeNI} onCheckedChange={setIncludeNI} />
                      </div>
                    </div>
                 </div>

                 {/* Outputs */}
                 <div className="lg:col-span-7 bg-primary text-primary-foreground rounded-2xl shadow-xl overflow-hidden flex flex-col">
                    <div className="p-8 md:p-10 flex-grow">
                      <div className="flex items-center justify-between mb-8">
                        <h2 className="text-xl font-bold">Cost Breakdown</h2>
                        <span className="text-xs uppercase tracking-widest font-bold px-3 py-1.5 bg-primary-foreground/10 rounded-full">Per Day</span>
                      </div>

                      <div className="space-y-5">
                        <LineItem label="Day Rate (Client Cost)" value={cDayRate} isBold />
                        <LineItem label="Agency Management Fee" value={cManagementFee} indent />
                        <LineItem label="Gross Worker Pay" value={cGrossPay} />
                        {includeNI && <LineItem label="Employer's NI" value={cEmployerNI} indent isSubtracted />}
                        
                        <div className="h-px bg-primary-foreground/20 my-6" />
                        
                        <div className="flex items-center justify-between">
                          <span className="text-lg font-bold">Worker's Net Pay</span>
                          <span className="text-3xl font-mono font-bold tracking-tight text-white">{formatCurrency(cWorkerNet)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Projections footer */}
                    <div className="bg-primary-foreground/5 p-8 md:p-10 border-t border-primary-foreground/10">
                      <h3 className="text-xs font-bold uppercase tracking-widest text-primary-foreground/60 mb-6">Projections</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                        <div className="bg-primary-foreground/5 p-5 rounded-xl">
                          <div className="text-sm font-bold text-primary-foreground/80 mb-3 flex items-center justify-between">
                            Weekly <span className="text-xs font-medium text-primary-foreground/50 tracking-normal">5 Days</span>
                          </div>
                          <div className="space-y-3">
                            <div className="flex justify-between text-sm">
                              <span className="text-primary-foreground/70 font-medium">Client Cost</span> 
                              <span className="font-mono font-bold">{formatCurrency(cDayRate * 5)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-primary-foreground/70 font-medium">Agency Fee</span> 
                              <span className="font-mono font-bold text-chart-1">{formatCurrency(cManagementFee * 5)}</span>
                            </div>
                          </div>
                        </div>
                        <div className="bg-primary-foreground/5 p-5 rounded-xl">
                          <div className="text-sm font-bold text-primary-foreground/80 mb-3 flex items-center justify-between">
                            Monthly <span className="text-xs font-medium text-primary-foreground/50 tracking-normal">21 Days</span>
                          </div>
                          <div className="space-y-3">
                            <div className="flex justify-between text-sm">
                              <span className="text-primary-foreground/70 font-medium">Client Cost</span> 
                              <span className="font-mono font-bold">{formatCurrency(cDayRate * 21)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-primary-foreground/70 font-medium">Agency Fee</span> 
                              <span className="font-mono font-bold text-chart-1">{formatCurrency(cManagementFee * 21)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                 </div>
              </div>
            </TabsContent>

            <TabsContent value="perm" className="m-0">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Inputs */}
                <div className="lg:col-span-5 space-y-6 bg-card border border-card-border p-7 rounded-2xl shadow-sm">
                  <h2 className="text-lg font-bold border-b border-border pb-4">Input Parameters</h2>
                  
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="block text-sm font-bold text-foreground">Candidate Annual Salary (£)</label>
                      <div className="relative group">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-mono">£</span>
                        <input 
                          type="number" 
                          value={salary} 
                          onChange={e => setSalary(e.target.value)} 
                          className="w-full pl-10 pr-4 py-3 bg-input/40 border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all font-mono text-base font-medium" 
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <label className="block text-sm font-bold text-foreground">Placement Fee (%)</label>
                      <div className="relative group">
                        <input 
                          type="number" 
                          value={placementFee} 
                          onChange={e => setPlacementFee(e.target.value)} 
                          className="w-full pl-4 pr-10 py-3 bg-input/40 border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all font-mono text-base font-medium" 
                          placeholder="0.0"
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground font-mono">%</span>
                      </div>
                    </div>

                    <div className="pt-4 flex flex-col gap-3 border-t border-border/60">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1 pr-4">
                          <label className="text-sm font-bold text-foreground cursor-pointer" onClick={() => setIncludePermNI(!includePermNI)}>Include Employer's NI</label>
                          <p className="text-xs text-muted-foreground font-medium">Informational only. Borne by client, not agency. (15% over £9,100)</p>
                        </div>
                        <Switch checked={includePermNI} onCheckedChange={setIncludePermNI} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Outputs */}
                <div className="lg:col-span-7 bg-primary text-primary-foreground rounded-2xl shadow-xl overflow-hidden flex flex-col">
                  <div className="p-8 md:p-10 flex-grow">
                    <div className="flex items-center justify-between mb-8">
                      <h2 className="text-xl font-bold">Invoice Breakdown</h2>
                      <span className="text-xs uppercase tracking-widest font-bold px-3 py-1.5 bg-primary-foreground/10 rounded-full">Permanent</span>
                    </div>

                    <div className="space-y-5">
                      <LineItem label="Annual Salary" value={pSalary} />
                      <LineItem label={`Placement Fee (${pFeePct.toFixed(1)}%)`} value={pPlacementFee} isBold />
                      
                      {includePermNI && (
                        <>
                          <div className="h-px bg-primary-foreground/20 my-6" />
                          <LineItem label="Employer's NI on Salary" value={pEmployerNI} indent />
                        </>
                      )}
                      
                      <div className="h-px bg-primary-foreground/20 my-6" />
                      
                      <div className="flex items-center justify-between">
                        <span className="text-lg font-bold">Total Invoice to Client</span>
                        <span className="text-3xl font-mono font-bold tracking-tight text-chart-1">{formatCurrency(pPlacementFee)}</span>
                      </div>
                      
                      {includePermNI && (
                        <div className="flex items-center justify-between mt-4 text-primary-foreground/70 bg-primary-foreground/5 p-4 rounded-xl border border-primary-foreground/10">
                          <span className="text-sm font-semibold">Total Cost to Client (inc. NI)</span>
                          <span className="font-mono text-base font-bold text-white">{formatCurrency(pTotalCost)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
       </div>
    </div>
  )
}

function LineItem({ 
  label, 
  value, 
  indent = false, 
  isBold = false, 
  isSubtracted = false 
}: { 
  label: string, 
  value: number, 
  indent?: boolean, 
  isBold?: boolean, 
  isSubtracted?: boolean 
}) {
  return (
    <div className={cn(
      "flex items-center justify-between transition-colors", 
      indent ? "pl-6 text-primary-foreground/70" : "text-primary-foreground/90", 
      isBold && "font-bold text-white"
    )}>
      <span className="text-sm font-medium">{label}</span>
      <span className={cn("font-mono tracking-tight", isBold ? "text-base" : "text-sm")}>
        {isSubtracted && "- "}{formatCurrency(value)}
      </span>
    </div>
  )
}