import React, { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Calculator, RotateCcw, Briefcase, FileText, UtensilsCrossed, PlaneTakeoff } from 'lucide-react';
import { cn } from '@/lib/utils';

const formatCurrency = (val: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 2 }).format(val);

const NumInput = ({
  value, onChange, prefix, suffix, placeholder = '0.00',
}: {
  value: string; onChange: (v: string) => void; prefix?: string; suffix?: string; placeholder?: string;
}) => (
  <div className="relative">
    {prefix && <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-mono">{prefix}</span>}
    <input
      type="number"
      value={value}
      onChange={e => onChange(e.target.value)}
      className={cn(
        'w-full py-3 bg-input/40 border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all font-mono text-base font-medium',
        prefix ? 'pl-10 pr-4' : suffix ? 'pl-4 pr-10' : 'px-4',
      )}
      placeholder={placeholder}
    />
    {suffix && <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground font-mono">{suffix}</span>}
  </div>
);

export default function CalculatorPage() {
  const [mode, setMode] = useState<'contract' | 'perm'>('contract');

  // Contract State
  const [consolidatedRate, setConsolidatedRate] = useState('');
  const [margin, setMargin] = useState('');
  const [includeNI, setIncludeNI] = useState(true);
  const [subsistence, setSubsistence] = useState('');
  const [includeSubsistence, setIncludeSubsistence] = useState(true);
  const [subsistenceInFee, setSubsistenceInFee] = useState(true);

  // Trip State
  const [includeTrip, setIncludeTrip] = useState(false);
  const [workingDays, setWorkingDays] = useState('');
  const [travelDays, setTravelDays] = useState('');

  // Perm State
  const [salary, setSalary] = useState('50000');
  const [placementFee, setPlacementFee] = useState('20');
  const [includePermNI, setIncludePermNI] = useState(false);

  const reset = () => {
    setConsolidatedRate('');
    setMargin('');
    setIncludeNI(true);
    setSubsistence('');
    setIncludeSubsistence(true);
    setSubsistenceInFee(true);
    setIncludeTrip(false);
    setWorkingDays('');
    setTravelDays('');
    setSalary('50000');
    setPlacementFee('20');
    setIncludePermNI(false);
  };

  // --- Contract Calculations (per day, full rate) ---
  const cRate = parseFloat(consolidatedRate) || 0;
  const cMargin = parseFloat(margin) || 0;
  const cSubsistenceAmt = includeSubsistence ? (parseFloat(subsistence) || 0) : 0;

  // NI: 15.5% of the full consolidated rate
  const cEmployerNI = includeNI ? cRate * 0.155 : 0;

  // Management fee base = consolidated rate + NI + subsistence (if subsistenceInFee)
  const cFeeBase = cRate + cEmployerNI + (subsistenceInFee ? cSubsistenceAmt : 0);
  const cManagementFee = cFeeBase * (cMargin / 100);

  // Full-day total charge to client
  const cTotalCharge = cRate + cEmployerNI + cSubsistenceAmt + cManagementFee;

  // --- Travel day calculations (0.5 rate, full subsistence) ---
  const cTravelRate = cRate * 0.5;
  const cTravelNI = includeNI ? cTravelRate * 0.155 : 0;
  const cTravelFeeBase = cTravelRate + cTravelNI + (subsistenceInFee ? cSubsistenceAmt : 0);
  const cTravelManagementFee = cTravelFeeBase * (cMargin / 100);
  // Subsistence always at full rate on travel days
  const cTravelDayCharge = cTravelRate + cTravelNI + cSubsistenceAmt + cTravelManagementFee;

  // --- Trip totals ---
  const nWorkingDays = Math.max(0, parseInt(workingDays) || 0);
  const nTravelDays = Math.max(0, parseInt(travelDays) || 0);
  const tripWorkingTotal = nWorkingDays * cTotalCharge;
  const tripTravelTotal = nTravelDays * cTravelDayCharge;
  const tripGrandTotal = tripWorkingTotal + tripTravelTotal;

  // --- Perm Calculations ---
  const pSalary = parseFloat(salary) || 0;
  const pFeePct = parseFloat(placementFee) || 0;
  const pPlacementFee = pSalary * (pFeePct / 100);
  const pEmployerNI = includePermNI ? Math.max(0, (pSalary - 9100) * 0.15) : 0;
  const pTotalCost = pPlacementFee + (includePermNI ? pEmployerNI : 0);

  return (
    <div className="min-h-[100dvh] bg-background py-10 px-4 sm:px-6 md:px-8 flex flex-col items-center">
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

        <Tabs value={mode} onValueChange={(v) => setMode(v as 'contract' | 'perm')} className="w-full">
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

          {/* ─────────────────── CONTRACT TAB ─────────────────── */}
          <TabsContent value="contract" className="m-0">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

              {/* Left column */}
              <div className="lg:col-span-5 flex flex-col gap-6">

                {/* Core inputs */}
                <div className="bg-card border border-card-border p-7 rounded-2xl shadow-sm space-y-6">
                  <h2 className="text-lg font-bold border-b border-border pb-4">Input Parameters</h2>

                  <div className="space-y-2">
                    <label className="block text-sm font-bold text-foreground">Consolidated Rate — Worker Pay (£/day)</label>
                    <p className="text-xs text-muted-foreground font-medium -mt-1">The rate paid to the worker. Fee and NI are added on top.</p>
                    <NumInput value={consolidatedRate} onChange={setConsolidatedRate} prefix="£" />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-bold text-foreground">Management Fee (%)</label>
                    <NumInput value={margin} onChange={setMargin} suffix="%" placeholder="0.0" />
                  </div>

                  <div className="pt-4 flex items-center justify-between border-t border-border/60">
                    <div className="space-y-1 pr-4">
                      <label className="text-sm font-bold text-foreground cursor-pointer" onClick={() => setIncludeNI(!includeNI)}>
                        Include Employer's NI
                      </label>
                      <p className="text-xs text-muted-foreground font-medium">15.5% of the consolidated rate. Added to total charge.</p>
                    </div>
                    <Switch checked={includeNI} onCheckedChange={setIncludeNI} />
                  </div>
                </div>

                {/* Subsistence card */}
                <div className="bg-card border border-card-border p-7 rounded-2xl shadow-sm space-y-5">
                  <div className="flex items-center gap-3 border-b border-border pb-4">
                    <div className="p-2 bg-primary/10 rounded-lg text-primary">
                      <UtensilsCrossed className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <h2 className="text-base font-bold">Subsistence</h2>
                      <p className="text-xs text-muted-foreground font-medium mt-0.5">Daily allowance added to the client charge</p>
                    </div>
                    <Switch
                      checked={includeSubsistence}
                      onCheckedChange={(v) => { setIncludeSubsistence(v); if (!v) setSubsistenceInFee(false); }}
                    />
                  </div>

                  <div className={cn('space-y-5 transition-opacity duration-200', !includeSubsistence && 'opacity-40 pointer-events-none')}>
                    <div className="space-y-2">
                      <label className="block text-sm font-bold text-foreground">Subsistence Rate (£ per day)</label>
                      <NumInput value={subsistence} onChange={setSubsistence} prefix="£" />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-1 pr-4">
                        <label
                          className="text-sm font-bold text-foreground cursor-pointer"
                          onClick={() => includeSubsistence && setSubsistenceInFee(!subsistenceInFee)}
                        >
                          Include in management fee
                        </label>
                        <p className="text-xs text-muted-foreground font-medium">
                          Apply the {cMargin > 0 ? `${cMargin}%` : 'margin'} fee to subsistence as well.
                        </p>
                      </div>
                      <Switch checked={subsistenceInFee} onCheckedChange={setSubsistenceInFee} disabled={!includeSubsistence} />
                    </div>
                  </div>
                </div>

                {/* Trip card */}
                <div className="bg-card border border-card-border p-7 rounded-2xl shadow-sm space-y-5">
                  <div className="flex items-center gap-3 border-b border-border pb-4">
                    <div className="p-2 bg-primary/10 rounded-lg text-primary">
                      <PlaneTakeoff className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <h2 className="text-base font-bold">Trip Calculator</h2>
                      <p className="text-xs text-muted-foreground font-medium mt-0.5">Calculate the total invoice for a temporary placement</p>
                    </div>
                    <Switch checked={includeTrip} onCheckedChange={setIncludeTrip} />
                  </div>

                  <div className={cn('space-y-5 transition-opacity duration-200', !includeTrip && 'opacity-40 pointer-events-none')}>
                    <div className="space-y-2">
                      <label className="block text-sm font-bold text-foreground">Working Days</label>
                      <p className="text-xs text-muted-foreground font-medium -mt-1">Full day rate days on site</p>
                      <NumInput value={workingDays} onChange={setWorkingDays} placeholder="0" />
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-bold text-foreground">Travel Days</label>
                      <p className="text-xs text-muted-foreground font-medium -mt-1">Charged at 0.5 day rate. Subsistence always at full rate.</p>
                      <NumInput value={travelDays} onChange={setTravelDays} placeholder="0" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Right column */}
              <div className="lg:col-span-7 bg-primary text-primary-foreground rounded-2xl shadow-xl overflow-hidden flex flex-col">
                <div className="p-8 md:p-10 flex-grow">
                  <div className="flex items-center justify-between mb-8">
                    <h2 className="text-xl font-bold">Charge Rate Breakdown</h2>
                    <span className="text-xs uppercase tracking-widest font-bold px-3 py-1.5 bg-primary-foreground/10 rounded-full">Per Day</span>
                  </div>

                  <div className="space-y-3">
                    <LineItem label="Consolidated Rate" value={cRate} isBold />
                    {includeNI && <LineItem label="Employers NIC (15.5%)" value={cEmployerNI} />}
                    {includeSubsistence && cSubsistenceAmt > 0 && <LineItem label="Subsistence" value={cSubsistenceAmt} />}
                    <LineItem label={`Management Fee (${cMargin > 0 ? `${cMargin}%` : '—'})`} value={cManagementFee} />

                    <div className="mt-4 pt-5 border-t-2 border-primary-foreground/30">
                      <div className="flex items-center justify-between">
                        <span className="text-lg font-bold">Total Charge Rate</span>
                        <span className="text-3xl font-mono font-bold tracking-tight text-chart-1">{formatCurrency(cTotalCharge)}</span>
                      </div>
                      {cMargin > 0 && (
                        <p className="text-xs text-primary-foreground/50 font-medium mt-2">
                          Fee is {cMargin}% of {[
                            'worker pay',
                            includeNI ? "NI" : null,
                            subsistenceInFee && cSubsistenceAmt > 0 ? 'subsistence' : null,
                          ].filter(Boolean).join(' + ')} ({formatCurrency(cFeeBase)})
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Travel day per-day summary (shown when trip is active) */}
                  {includeTrip && (
                    <div className="mt-8 pt-6 border-t border-primary-foreground/20">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-bold uppercase tracking-widest text-primary-foreground/60">Travel Day Rate</h3>
                        <span className="text-xs font-bold px-2.5 py-1 bg-primary-foreground/10 rounded-full">0.5 day</span>
                      </div>
                      <div className="space-y-2.5">
                        <LineItem label="Consolidated Rate (×0.5)" value={cTravelRate} />
                        {includeNI && <LineItem label="Employers NIC on half rate" value={cTravelNI} />}
                        {includeSubsistence && cSubsistenceAmt > 0 && <LineItem label="Subsistence (full)" value={cSubsistenceAmt} />}
                        <LineItem label={`Management Fee (${cMargin > 0 ? `${cMargin}%` : '—'})`} value={cTravelManagementFee} />
                        <div className="pt-3 border-t border-primary-foreground/20 flex items-center justify-between">
                          <span className="text-sm font-bold">Travel Day Total</span>
                          <span className="font-mono font-bold text-base text-chart-1">{formatCurrency(cTravelDayCharge)}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer: trip invoice or projections */}
                <div className="bg-primary-foreground/5 p-8 md:p-10 border-t border-primary-foreground/10">
                  {includeTrip ? (
                    <>
                      <h3 className="text-xs font-bold uppercase tracking-widest text-primary-foreground/60 mb-6">Trip Invoice</h3>
                      <div className="space-y-4">
                        {/* Working days */}
                        <div className="bg-primary-foreground/5 p-4 rounded-xl space-y-2">
                          <div className="flex items-center justify-between text-sm font-bold text-primary-foreground/80">
                            <span>Working Days</span>
                            <span className="text-primary-foreground/50 font-medium">{nWorkingDays} × {formatCurrency(cTotalCharge)}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-primary-foreground/50 font-medium">Full rate per day</span>
                            <span className="font-mono font-bold">{formatCurrency(tripWorkingTotal)}</span>
                          </div>
                        </div>

                        {/* Travel days */}
                        <div className="bg-primary-foreground/5 p-4 rounded-xl space-y-2">
                          <div className="flex items-center justify-between text-sm font-bold text-primary-foreground/80">
                            <span>Travel Days</span>
                            <span className="text-primary-foreground/50 font-medium">{nTravelDays} × {formatCurrency(cTravelDayCharge)}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-primary-foreground/50 font-medium">0.5 rate + full subsistence</span>
                            <span className="font-mono font-bold">{formatCurrency(tripTravelTotal)}</span>
                          </div>
                        </div>

                        {/* Grand total */}
                        <div className="pt-2 border-t-2 border-primary-foreground/30 flex items-center justify-between">
                          <div>
                            <span className="text-lg font-bold block">Total Trip Invoice</span>
                            <span className="text-xs text-primary-foreground/50 font-medium">
                              {nWorkingDays + nTravelDays} days total ({nWorkingDays} working + {nTravelDays} travel)
                            </span>
                          </div>
                          <span className="text-3xl font-mono font-bold tracking-tight text-chart-1">{formatCurrency(tripGrandTotal)}</span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <h3 className="text-xs font-bold uppercase tracking-widest text-primary-foreground/60 mb-6">Projections</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <ProjectionCard
                          label="Weekly" days={5}
                          totalCharge={cTotalCharge} consolidatedRate={cRate}
                          managementFee={cManagementFee} subsistence={includeSubsistence ? cSubsistenceAmt : 0}
                          employerNI={cEmployerNI}
                        />
                        <ProjectionCard
                          label="Monthly" days={21}
                          totalCharge={cTotalCharge} consolidatedRate={cRate}
                          managementFee={cManagementFee} subsistence={includeSubsistence ? cSubsistenceAmt : 0}
                          employerNI={cEmployerNI}
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* ─────────────────── PERMANENT TAB ─────────────────── */}
          <TabsContent value="perm" className="m-0">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-5 space-y-6 bg-card border border-card-border p-7 rounded-2xl shadow-sm">
                <h2 className="text-lg font-bold border-b border-border pb-4">Input Parameters</h2>
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="block text-sm font-bold text-foreground">Candidate Annual Salary (£)</label>
                    <NumInput value={salary} onChange={setSalary} prefix="£" />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-bold text-foreground">Placement Fee (%)</label>
                    <NumInput value={placementFee} onChange={setPlacementFee} suffix="%" placeholder="0.0" />
                  </div>
                  <div className="pt-4 flex items-center justify-between border-t border-border/60">
                    <div className="space-y-1 pr-4">
                      <label className="text-sm font-bold text-foreground cursor-pointer" onClick={() => setIncludePermNI(!includePermNI)}>
                        Include Employer's NI
                      </label>
                      <p className="text-xs text-muted-foreground font-medium">Informational only. Borne by client, not agency. (15% over £9,100)</p>
                    </div>
                    <Switch checked={includePermNI} onCheckedChange={setIncludePermNI} />
                  </div>
                </div>
              </div>

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
                        <div className="h-px bg-primary-foreground/20 my-4" />
                        <LineItem label="Employer's NI on Salary" value={pEmployerNI} />
                      </>
                    )}
                    <div className="mt-4 pt-5 border-t-2 border-primary-foreground/30">
                      <div className="flex items-center justify-between">
                        <span className="text-lg font-bold">Total Invoice to Client</span>
                        <span className="text-3xl font-mono font-bold tracking-tight text-chart-1">{formatCurrency(pPlacementFee)}</span>
                      </div>
                    </div>
                    {includePermNI && (
                      <div className="flex items-center justify-between mt-2 text-primary-foreground/70 bg-primary-foreground/5 p-4 rounded-xl border border-primary-foreground/10">
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
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function LineItem({ label, value, isBold = false }: { label: string; value: number; isBold?: boolean }) {
  return (
    <div className={cn('flex items-center justify-between', isBold ? 'text-white font-bold' : 'text-primary-foreground/80')}>
      <span className="text-sm font-medium">{label}</span>
      <span className={cn('font-mono tracking-tight', isBold ? 'text-base font-bold' : 'text-sm font-semibold')}>
        {formatCurrency(value)}
      </span>
    </div>
  );
}

function ProjectionCard({
  label, days, totalCharge, consolidatedRate, managementFee, subsistence, employerNI,
}: {
  label: string; days: number; totalCharge: number; consolidatedRate: number;
  managementFee: number; subsistence: number; employerNI: number;
}) {
  return (
    <div className="bg-primary-foreground/5 p-5 rounded-xl">
      <div className="text-sm font-bold text-primary-foreground/80 mb-3 flex items-center justify-between">
        {label}
        <span className="text-xs font-medium text-primary-foreground/50">{days} Days</span>
      </div>
      <div className="space-y-2.5">
        <div className="flex justify-between text-sm">
          <span className="text-primary-foreground/70 font-medium">Total Charge</span>
          <span className="font-mono font-bold text-chart-1">{formatCurrency(totalCharge * days)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-primary-foreground/70 font-medium">Consolidated Rate</span>
          <span className="font-mono font-bold">{formatCurrency(consolidatedRate * days)}</span>
        </div>
        {employerNI > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-primary-foreground/70 font-medium">Employers NIC</span>
            <span className="font-mono font-bold">{formatCurrency(employerNI * days)}</span>
          </div>
        )}
        {subsistence > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-primary-foreground/70 font-medium">Subsistence</span>
            <span className="font-mono font-bold">{formatCurrency(subsistence * days)}</span>
          </div>
        )}
        <div className="flex justify-between text-sm pt-2 border-t border-primary-foreground/10">
          <span className="text-primary-foreground/70 font-medium">Management Fee</span>
          <span className="font-mono font-bold">{formatCurrency(managementFee * days)}</span>
        </div>
      </div>
    </div>
  );
}
