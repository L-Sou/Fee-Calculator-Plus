import React, { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Calculator, RotateCcw, Briefcase, FileText, UtensilsCrossed, PlaneTakeoff, CalendarDays } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Currency formatter ───────────────────────────────────────────────────────
const formatCurrency = (val: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 2 }).format(val);

// ─── Shared number input ──────────────────────────────────────────────────────
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

// ─── Half / Full / Custom day rate selector ───────────────────────────────────
const DayToggle = ({
  mode, onModeChange, customVal, onCustomChange,
}: {
  mode: 'half' | 'full' | 'custom'; onModeChange: (v: 'half' | 'full' | 'custom') => void;
  customVal: string; onCustomChange: (v: string) => void;
}) => (
  <div className="space-y-2">
    <div className="flex items-center gap-1 p-1 bg-input/40 border border-input rounded-xl w-fit">
      <button
        onClick={() => onModeChange('half')}
        className={cn('px-3 py-1 rounded-lg text-sm font-bold transition-all',
          mode === 'half' ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground hover:text-foreground')}
      >0.5 day</button>
      <button
        onClick={() => onModeChange('full')}
        className={cn('px-3 py-1 rounded-lg text-sm font-bold transition-all',
          mode === 'full' ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground hover:text-foreground')}
      >Full day</button>
      <button
        onClick={() => onModeChange('custom')}
        className={cn('px-3 py-1 rounded-lg text-sm font-bold transition-all',
          mode === 'custom' ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground hover:text-foreground')}
      >Custom</button>
    </div>
    {mode === 'custom' && (
      <NumInput value={customVal} onChange={onCustomChange} suffix="days" placeholder="0.5" />
    )}
  </div>
);

// ─── UK Bank Holidays (England & Wales) 2024–2028 ────────────────────────────
const UK_BANK_HOLIDAYS = new Set([
  // 2024
  '2024-01-01','2024-03-29','2024-04-01','2024-05-06','2024-05-27','2024-08-26','2024-12-25','2024-12-26',
  // 2025
  '2025-01-01','2025-04-18','2025-04-21','2025-05-05','2025-05-26','2025-08-25','2025-12-25','2025-12-26',
  // 2026
  '2026-01-01','2026-04-03','2026-04-06','2026-05-04','2026-05-25','2026-08-31','2026-12-25','2026-12-28',
  // 2027
  '2027-01-01','2027-03-26','2027-03-29','2027-05-03','2027-05-31','2027-08-30','2027-12-27','2027-12-28',
  // 2028
  '2028-01-03','2028-04-14','2028-04-17','2028-05-01','2028-05-29','2028-08-28','2028-12-25','2028-12-26',
]);

// Parse a YYYY-MM-DD string as a local date (avoids UTC-offset issues)
function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatUK(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function isWeekend(d: Date) { return d.getDay() === 0 || d.getDay() === 6; }
function isBankHoliday(d: Date) { return UK_BANK_HOLIDAYS.has(isoDate(d)); }
function isWorkingDay(d: Date) { return !isWeekend(d) && !isBankHoliday(d); }

/** Most recent Sunday strictly before `date` (or 7 days back if date is itself a Sunday) */
function sundayBefore(date: Date): Date {
  const dow = date.getDay(); // 0 = Sun
  return addDays(date, -(dow === 0 ? 7 : dow));
}

/** Monthly payday: 28th of month, moving back to prev working day if needed */
function monthlyPayday(year: number, month: number): Date {
  let d = new Date(year, month, 28);
  while (!isWorkingDay(d)) d = addDays(d, -1);
  return d;
}

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

interface PayrollSplit {
  periodStart: Date;
  periodEnd: Date;
  cutoff: Date;
  payday: Date;
  periodLabel: string;
  days: number;
}

// Fortnightly anchor: 9 Jan 2026 (Friday)
const FN_ANCHOR = new Date(2026, 0, 9);

/** All fortnightly {payday, cutoff} pairs where cutoff >= start, up to and including the first cutoff >= finish */
function getAllFortnightlyCutoffs(start: Date, finish: Date): Array<{ payday: Date; cutoff: Date }> {
  const diffDays = Math.round((start.getTime() - FN_ANCHOR.getTime()) / 86400000);
  // No Math.max — allow negative indices so dates before the anchor (2026) work correctly
  let idx = Math.floor(diffDays / 14);
  // Walk back if needed so we don't miss the first relevant cut-off
  while (sundayBefore(addDays(FN_ANCHOR, (idx - 1) * 14)).getTime() >= start.getTime()) idx--;
  // Advance until cutoff >= start
  while (sundayBefore(addDays(FN_ANCHOR, idx * 14)).getTime() < start.getTime()) idx++;
  const results: Array<{ payday: Date; cutoff: Date }> = [];
  for (;;) {
    const payday = addDays(FN_ANCHOR, idx * 14);
    const cutoff = sundayBefore(payday);
    results.push({ payday, cutoff });
    if (cutoff.getTime() >= finish.getTime()) break;
    idx++;
  }
  return results;
}

/** All monthly {payday, cutoff} pairs where cutoff >= start, up to and including the first cutoff >= finish */
function getAllMonthlyCutoffs(start: Date, finish: Date): Array<{ payday: Date; cutoff: Date }> {
  let year = start.getFullYear();
  let month = start.getMonth();
  const results: Array<{ payday: Date; cutoff: Date }> = [];

  for (let i = 0; i < 25; i++) {
    const payday = monthlyPayday(year, month);
    const cutoff = new Date(year, month, 20); // 20th of the month

    if (cutoff.getTime() >= start.getTime()) {
      results.push({ payday, cutoff });
      if (cutoff.getTime() >= finish.getTime()) break;
    }

    if (++month > 11) {
      month = 0;
      year++;
    }
  }

  return results;
}

/**
 * Split the assignment [start, finish] across payroll cut-offs.
 * Each split covers from the day after the previous cut-off to the next cut-off (or finish).
 * Only the overall first day uses startVal; only the overall last day uses finishVal.
 * All other days (including the first day of subsequent periods) count as 1.0.
 *
 * Monthly payroll periods are capped at a maximum of 31 payable days. A period can run
 * longer than that in calendar terms when the previous month's payday was pulled earlier
 * by a weekend/bank holiday (shortening that period) while the current month's payday
 * lands on its normal date (lengthening this one) — when that happens, only 31 days are
 * billed in this payment and the excess is carried forward onto the following month's
 * payment instead.
 */
function computePayrollSplits(
  start: Date, finish: Date, startVal: number, finishVal: number,
  payrollType: 'monthly' | 'fortnightly',
): PayrollSplit[] {
  const cutoffs = payrollType === 'fortnightly'
    ? getAllFortnightlyCutoffs(start, finish)
    : getAllMonthlyCutoffs(start, finish);
  const splits: PayrollSplit[] = [];
  let periodStart = start;
  let carryDays = 0; // payable days over the 31/month cap, rolled into the next payment
  let finishReached = false;
  let i = 0;

  while (true) {
    if (i >= cutoffs.length) {
      if (payrollType === 'monthly' && carryDays > 0) {
        // The final period overflowed past the 31-day cap — extend the monthly
        // schedule by one more payday purely to place the carried-over days.
        const lastEntry = cutoffs[cutoffs.length - 1];
        let month = lastEntry.payday.getMonth() + 1;
        let year = lastEntry.payday.getFullYear();
        if (month > 11) { month = 0; year++; }
        const nextPayday = monthlyPayday(year, month);
        cutoffs.push({
          payday: nextPayday,
          cutoff: new Date(year, month, 20),
        });
      } else {
        break;
      }
    }

    const { payday, cutoff } = cutoffs[i];
    const isFirst = i === 0;
    let rawDays: number;
    let periodEnd: Date;

    if (finishReached) {
      // Catch-up payment: no additional calendar days are worked here, it exists
      // purely to pay out days carried over from an earlier, overflowing period.
      periodEnd = cutoff;
      rawDays = 0;
    } else {
      const isLast = cutoff.getTime() >= finish.getTime();
      periodEnd = isLast ? finish : cutoff;
      const diff = Math.round((periodEnd.getTime() - periodStart.getTime()) / 86400000);
      if (diff === 0) {
        // Single-day period
        rawDays = isFirst ? startVal : isLast ? finishVal : 1.0;
      } else {
        const firstVal = isFirst ? startVal : 1.0;
        const lastVal = isLast ? finishVal : 1.0;
        rawDays = firstVal + (diff - 1) + lastVal;
      }
      if (isLast) finishReached = true;
    }

    let days = rawDays + carryDays;
    carryDays = 0;
    if (payrollType === 'monthly' && days > 31) {
      carryDays = days - 31;
      days = 31;
    }

    const m = payday.getMonth();
    const y = payday.getFullYear();
    const periodLabel = payrollType === 'monthly'
      ? `${MONTH_NAMES[m]} ${y}`
      : `${formatUK(periodStart)} – ${formatUK(periodEnd)}`;
    splits.push({ periodStart, periodEnd, cutoff, payday, periodLabel, days });

    if (finishReached && carryDays <= 0) break;
    periodStart = addDays(cutoff, 1);
    i++;
  }
  return splits;
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function CalculatorPage() {
  const [mode, setMode] = useState<'contract' | 'perm' | 'paydays'>('contract');

  // Contract State
  const [consolidatedRate, setConsolidatedRate] = useState('');
  const [margin, setMargin] = useState('');
  const [includeNI, setIncludeNI] = useState(false);
  const [subsistence, setSubsistence] = useState('');
  const [includeSubsistence, setIncludeSubsistence] = useState(false);
  const [subsistenceInFee, setSubsistenceInFee] = useState(true);

  // Trip State
  const [includeTrip, setIncludeTrip] = useState(false);
  const [workingDays, setWorkingDays] = useState('');
  const [travelDays, setTravelDays] = useState('');
  const [travelDayFull, setTravelDayFull] = useState(false);

  // Perm State
  const [salary, setSalary] = useState('50000');
  const [placementFee, setPlacementFee] = useState('20');
  const [includePermNI, setIncludePermNI] = useState(false);

  // Payment Days State
  const [pdPayrollType, setPdPayrollType] = useState<'monthly' | 'fortnightly'>('monthly');
  const [pdStartDate, setPdStartDate] = useState('');
  const [pdStartMode, setPdStartMode] = useState<'half' | 'full' | 'custom'>('full');
  const [pdStartCustomVal, setPdStartCustomVal] = useState('0.5');
  const [pdFinishDate, setPdFinishDate] = useState('');
  const [pdFinishMode, setPdFinishMode] = useState<'half' | 'full' | 'custom'>('full');
  const [pdFinishCustomVal, setPdFinishCustomVal] = useState('0.5');
  const [pdIncludeSubsistence, setPdIncludeSubsistence] = useState(false);
  const [pdSubsistenceRate, setPdSubsistenceRate] = useState('');

  const reset = () => {
    setConsolidatedRate(''); setMargin(''); setIncludeNI(false);
    setSubsistence(''); setIncludeSubsistence(false); setSubsistenceInFee(true);
    setIncludeTrip(false); setWorkingDays(''); setTravelDays(''); setTravelDayFull(false);
    setSalary('50000'); setPlacementFee('20'); setIncludePermNI(false);
    setPdStartDate(''); setPdStartMode('full'); setPdStartCustomVal('0.5');
    setPdFinishDate(''); setPdFinishMode('full'); setPdFinishCustomVal('0.5');
    setPdIncludeSubsistence(false); setPdSubsistenceRate('');
  };

  // ── Contract Calculations ──────────────────────────────────────────────────
  const cRate = parseFloat(consolidatedRate) || 0;
  const cMargin = parseFloat(margin) || 0;
  const cSubsistenceAmt = includeSubsistence ? (parseFloat(subsistence) || 0) : 0;
  const cEmployerNI = includeNI ? cRate * 0.155 : 0;
  const cFeeBase = cRate + cEmployerNI + (subsistenceInFee ? cSubsistenceAmt : 0);
  const cManagementFee = cFeeBase * (cMargin / 100);
  const cTotalCharge = cRate + cEmployerNI + cSubsistenceAmt + cManagementFee;

  // Travel day calculations
  const cTravelRate = cRate * (travelDayFull ? 1 : 0.5);
  const cTravelNI = includeNI ? cTravelRate * 0.155 : 0;
  const cTravelFeeBase = cTravelRate + cTravelNI + (subsistenceInFee ? cSubsistenceAmt : 0);
  const cTravelManagementFee = cTravelFeeBase * (cMargin / 100);
  const cTravelDayCharge = cTravelRate + cTravelNI + cSubsistenceAmt + cTravelManagementFee;

  // Trip totals
  const nWorkingDays = Math.max(0, parseInt(workingDays) || 0);
  const nTravelDays = Math.max(0, parseInt(travelDays) || 0);
  const tripWorkingTotal = nWorkingDays * cTotalCharge;
  const tripTravelTotal = nTravelDays * cTravelDayCharge;
  const tripGrandTotal = tripWorkingTotal + tripTravelTotal;

  // ── Perm Calculations ──────────────────────────────────────────────────────
  const pSalary = parseFloat(salary) || 0;
  const pFeePct = parseFloat(placementFee) || 0;
  const pPlacementFee = pSalary * (pFeePct / 100);
  const pEmployerNI = includePermNI ? Math.max(0, (pSalary - 9100) * 0.15) : 0;
  const pTotalCost = pPlacementFee + (includePermNI ? pEmployerNI : 0);

  // ── Payment Days Calculations ──────────────────────────────────────────────
  const pdStartVal = pdStartMode === 'full' ? 1.0 : pdStartMode === 'half' ? 0.5 : (parseFloat(pdStartCustomVal) || 0);
  const pdFinishVal = pdFinishMode === 'full' ? 1.0 : pdFinishMode === 'half' ? 0.5 : (parseFloat(pdFinishCustomVal) || 0);
  const pdSubsistenceAmt = pdIncludeSubsistence ? (parseFloat(pdSubsistenceRate) || 0) : 0;

  let pdSplits: PayrollSplit[] = [];
  let pdTotalDays: number | null = null;
  let pdTotalSubsistence: number | null = null;
  let pdError: string | null = null;

  if (pdStartDate && pdFinishDate) {
    const start = parseDate(pdStartDate);
    const finish = parseDate(pdFinishDate);
    if (finish < start) {
      pdError = 'Finish date must be on or after the start date.';
    } else {
      try {
        pdSplits = computePayrollSplits(start, finish, pdStartVal, pdFinishVal, pdPayrollType);
        pdTotalDays = pdSplits.reduce((sum, s) => sum + s.days, 0);
        pdTotalSubsistence = pdIncludeSubsistence ? pdSplits.reduce((sum, s) => sum + s.days * pdSubsistenceAmt, 0) : null;
      } catch {
        pdError = 'Could not determine payroll period.';
      }
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-[100dvh] bg-background py-10 px-4 sm:px-6 md:px-8 flex flex-col items-center">
      <div className="w-full max-w-5xl">
        <header className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
              <div className="p-2.5 bg-primary/10 rounded-xl text-primary"><Calculator className="h-7 w-7" /></div>
              Fee Calculator
            </h1>
            <p className="mt-2 text-muted-foreground font-medium">Precise breakdown of margins, costs, and placement fees.</p>
          </div>
          <button onClick={reset} className="self-start md:self-auto flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors px-4 py-2 rounded-lg hover:bg-input/50">
            <RotateCcw className="h-4 w-4" />Reset Values
          </button>
        </header>

        <Tabs value={mode} onValueChange={(v) => setMode(v as typeof mode)} className="w-full">
          <TabsList className="grid w-full max-w-2xl grid-cols-3 mb-8">
            <TabsTrigger value="contract" className="flex gap-2 text-xs sm:text-sm">
              <FileText className="h-4 w-4" />Contract / Day Rate
            </TabsTrigger>
            <TabsTrigger value="perm" className="flex gap-2 text-xs sm:text-sm">
              <Briefcase className="h-4 w-4" />Permanent
            </TabsTrigger>
            <TabsTrigger value="paydays" className="flex gap-2 text-xs sm:text-sm">
              <CalendarDays className="h-4 w-4" />Payment Days
            </TabsTrigger>
          </TabsList>

          {/* ─────────────── CONTRACT TAB ─────────────── */}
          <TabsContent value="contract" className="m-0">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
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
                      <label className="text-sm font-bold text-foreground cursor-pointer" onClick={() => setIncludeNI(!includeNI)}>Include Employer's NI</label>
                      <p className="text-xs text-muted-foreground font-medium">15.5% of the consolidated rate. Added to total charge.</p>
                    </div>
                    <Switch checked={includeNI} onCheckedChange={setIncludeNI} />
                  </div>
                </div>

                {/* Subsistence */}
                <div className="bg-card border border-card-border p-7 rounded-2xl shadow-sm space-y-5">
                  <div className="flex items-center gap-3 border-b border-border pb-4">
                    <div className="p-2 bg-primary/10 rounded-lg text-primary"><UtensilsCrossed className="h-4 w-4" /></div>
                    <div className="flex-1">
                      <h2 className="text-base font-bold">Subsistence</h2>
                      <p className="text-xs text-muted-foreground font-medium mt-0.5">Daily allowance added to the client charge</p>
                    </div>
                    <Switch checked={includeSubsistence} onCheckedChange={(v) => { setIncludeSubsistence(v); if (!v) setSubsistenceInFee(false); }} />
                  </div>
                  <div className={cn('space-y-5 transition-opacity duration-200', !includeSubsistence && 'opacity-40 pointer-events-none')}>
                    <div className="space-y-2">
                      <label className="block text-sm font-bold text-foreground">Subsistence Rate (£ per day)</label>
                      <NumInput value={subsistence} onChange={setSubsistence} prefix="£" />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="space-y-1 pr-4">
                        <label className="text-sm font-bold text-foreground cursor-pointer" onClick={() => includeSubsistence && setSubsistenceInFee(!subsistenceInFee)}>Include in management fee</label>
                        <p className="text-xs text-muted-foreground font-medium">Apply the {cMargin > 0 ? `${cMargin}%` : 'margin'} fee to subsistence as well.</p>
                      </div>
                      <Switch checked={subsistenceInFee} onCheckedChange={setSubsistenceInFee} disabled={!includeSubsistence} />
                    </div>
                  </div>
                </div>

                {/* Trip */}
                <div className="bg-card border border-card-border p-7 rounded-2xl shadow-sm space-y-5">
                  <div className="flex items-center gap-3 border-b border-border pb-4">
                    <div className="p-2 bg-primary/10 rounded-lg text-primary"><PlaneTakeoff className="h-4 w-4" /></div>
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
                      <p className="text-xs text-muted-foreground font-medium -mt-1">Subsistence always at full rate regardless of day rate.</p>
                      <NumInput value={travelDays} onChange={setTravelDays} placeholder="0" />
                      <div className="flex items-center gap-1 mt-2 p-1 bg-input/40 border border-input rounded-xl w-fit">
                        <button onClick={() => setTravelDayFull(false)} className={cn('px-4 py-1.5 rounded-lg text-sm font-bold transition-all', !travelDayFull ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground hover:text-foreground')}>0.5 day</button>
                        <button onClick={() => setTravelDayFull(true)} className={cn('px-4 py-1.5 rounded-lg text-sm font-bold transition-all', travelDayFull ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground hover:text-foreground')}>Full day</button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right panel */}
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
                          Fee is {cMargin}% of {['worker pay', includeNI ? "NI" : null, subsistenceInFee && cSubsistenceAmt > 0 ? 'subsistence' : null].filter(Boolean).join(' + ')} ({formatCurrency(cFeeBase)})
                        </p>
                      )}
                    </div>
                  </div>

                  {includeTrip && (
                    <div className="mt-8 pt-6 border-t border-primary-foreground/20">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-bold uppercase tracking-widest text-primary-foreground/60">Travel Day Rate</h3>
                        <span className="text-xs font-bold px-2.5 py-1 bg-primary-foreground/10 rounded-full">{travelDayFull ? 'Full' : '0.5'} day</span>
                      </div>
                      <div className="space-y-2.5">
                        <LineItem label={`Consolidated Rate (×${travelDayFull ? '1' : '0.5'})`} value={cTravelRate} />
                        {includeNI && <LineItem label="Employers NIC on travel rate" value={cTravelNI} />}
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

                <div className="bg-primary-foreground/5 p-8 md:p-10 border-t border-primary-foreground/10">
                  {includeTrip ? (
                    <>
                      <h3 className="text-xs font-bold uppercase tracking-widest text-primary-foreground/60 mb-6">Trip Invoice</h3>
                      <div className="space-y-4">
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
                        <div className="bg-primary-foreground/5 p-4 rounded-xl space-y-2">
                          <div className="flex items-center justify-between text-sm font-bold text-primary-foreground/80">
                            <span>Travel Days</span>
                            <span className="text-primary-foreground/50 font-medium">{nTravelDays} × {formatCurrency(cTravelDayCharge)}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-primary-foreground/50 font-medium">{travelDayFull ? 'Full' : '0.5'} rate + full subsistence</span>
                            <span className="font-mono font-bold">{formatCurrency(tripTravelTotal)}</span>
                          </div>
                        </div>
                        {includeSubsistence && cSubsistenceAmt > 0 && (
                          <div className="bg-primary-foreground/5 p-4 rounded-xl flex items-center justify-between">
                            <div>
                              <span className="text-sm font-bold text-primary-foreground/80 block">Total Subsistence</span>
                              <span className="text-xs text-primary-foreground/50 font-medium">{nWorkingDays + nTravelDays} days × {formatCurrency(cSubsistenceAmt)}</span>
                            </div>
                            <span className="font-mono font-bold">{formatCurrency((nWorkingDays + nTravelDays) * cSubsistenceAmt)}</span>
                          </div>
                        )}
                        <div className="pt-2 border-t-2 border-primary-foreground/30 flex items-center justify-between">
                          <div>
                            <span className="text-lg font-bold block">Total Trip Invoice</span>
                            <span className="text-xs text-primary-foreground/50 font-medium">{nWorkingDays + nTravelDays} days total ({nWorkingDays} working + {nTravelDays} travel)</span>
                          </div>
                          <span className="text-3xl font-mono font-bold tracking-tight text-chart-1">{formatCurrency(tripGrandTotal)}</span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <h3 className="text-xs font-bold uppercase tracking-widest text-primary-foreground/60 mb-6">Projections</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <ProjectionCard label="Weekly" days={5} totalCharge={cTotalCharge} consolidatedRate={cRate} managementFee={cManagementFee} subsistence={includeSubsistence ? cSubsistenceAmt : 0} employerNI={cEmployerNI} />
                        <ProjectionCard label="Monthly" days={21} totalCharge={cTotalCharge} consolidatedRate={cRate} managementFee={cManagementFee} subsistence={includeSubsistence ? cSubsistenceAmt : 0} employerNI={cEmployerNI} />
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* ─────────────── PERMANENT TAB ─────────────── */}
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
                      <label className="text-sm font-bold text-foreground cursor-pointer" onClick={() => setIncludePermNI(!includePermNI)}>Include Employer's NI</label>
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
                    {includePermNI && (<><div className="h-px bg-primary-foreground/20 my-4" /><LineItem label="Employer's NI on Salary" value={pEmployerNI} /></>)}
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

          {/* ─────────────── PAYMENT DAYS TAB ─────────────── */}
          <TabsContent value="paydays" className="m-0">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

              {/* Inputs */}
              <div className="lg:col-span-5 flex flex-col gap-6">
                <div className="bg-card border border-card-border p-7 rounded-2xl shadow-sm space-y-6">
                  <h2 className="text-lg font-bold border-b border-border pb-4">Payment Days Calculator</h2>

                  {/* Payroll type */}
                  <div className="space-y-2">
                    <label className="block text-sm font-bold text-foreground">Payroll Type</label>
                    <div className="flex items-center gap-1 p-1 bg-input/40 border border-input rounded-xl">
                      <button
                        onClick={() => setPdPayrollType('monthly')}
                        className={cn('flex-1 py-2 rounded-lg text-sm font-bold transition-all',
                          pdPayrollType === 'monthly' ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground hover:text-foreground')}
                      >Monthly</button>
                      <button
                        onClick={() => setPdPayrollType('fortnightly')}
                        className={cn('flex-1 py-2 rounded-lg text-sm font-bold transition-all',
                          pdPayrollType === 'fortnightly' ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground hover:text-foreground')}
                      >Fortnightly</button>
                    </div>
                    {pdPayrollType === 'monthly' && (
                      <p className="text-xs text-muted-foreground font-medium">Payday: 28th of each month (or previous working day). Cut-off: Sunday before payday.</p>
                    )}
                    {pdPayrollType === 'fortnightly' && (
                      <p className="text-xs text-muted-foreground font-medium">First payday: 09/01/2026. Every 14 days thereafter. Cut-off: Sunday before payday.</p>
                    )}
                  </div>

                  {/* Start date */}
                  <div className="space-y-3">
                    <label className="block text-sm font-bold text-foreground">Start Date</label>
                    <input
                      type="date"
                      value={pdStartDate}
                      onChange={e => setPdStartDate(e.target.value)}
                      className="w-full px-4 py-3 bg-input/40 border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all text-base font-medium"
                    />
                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wide">First day rate</label>
                      <DayToggle mode={pdStartMode} onModeChange={setPdStartMode} customVal={pdStartCustomVal} onCustomChange={setPdStartCustomVal} />
                    </div>
                  </div>

                  {/* Finish date */}
                  <div className="space-y-3 pt-4 border-t border-border/60">
                    <label className="block text-sm font-bold text-foreground">Finish Date</label>
                    <input
                      type="date"
                      value={pdFinishDate}
                      onChange={e => setPdFinishDate(e.target.value)}
                      className="w-full px-4 py-3 bg-input/40 border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all text-base font-medium"
                    />
                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wide">Last day rate</label>
                      <DayToggle mode={pdFinishMode} onModeChange={setPdFinishMode} customVal={pdFinishCustomVal} onCustomChange={setPdFinishCustomVal} />
                    </div>
                  </div>

                  {/* Subsistence */}
                  <div className="space-y-3 pt-4 border-t border-border/60">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-bold text-foreground cursor-pointer" onClick={() => setPdIncludeSubsistence(!pdIncludeSubsistence)}>Include Subsistence</label>
                      <Switch checked={pdIncludeSubsistence} onCheckedChange={setPdIncludeSubsistence} />
                    </div>
                    <div className={cn('space-y-1 transition-opacity duration-200', !pdIncludeSubsistence && 'opacity-40 pointer-events-none')}>
                      <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wide">Subsistence Rate (£ per day)</label>
                      <NumInput value={pdSubsistenceRate} onChange={setPdSubsistenceRate} prefix="£" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Results */}
              <div className="lg:col-span-7 bg-primary text-primary-foreground rounded-2xl shadow-xl overflow-hidden flex flex-col">
                <div className="p-8 md:p-10 flex-grow">
                  <div className="flex items-center justify-between mb-8">
                    <h2 className="text-xl font-bold">Payroll Summary</h2>
                    <span className="text-xs uppercase tracking-widest font-bold px-3 py-1.5 bg-primary-foreground/10 rounded-full">
                      {pdPayrollType === 'monthly' ? 'Monthly' : 'Fortnightly'}
                    </span>
                  </div>

                  {!pdStartDate || !pdFinishDate ? (
                    <div className="flex flex-col items-center justify-center h-40 text-primary-foreground/40 gap-3">
                      <CalendarDays className="h-10 w-10" />
                      <p className="text-sm font-medium">Enter start and finish dates to calculate</p>
                    </div>
                  ) : pdError ? (
                    <div className="flex items-center gap-3 bg-red-500/20 border border-red-500/30 rounded-xl p-4">
                      <span className="text-sm font-semibold text-red-300">{pdError}</span>
                    </div>
                  ) : (
                    <div className="space-y-5">
                      {/* Total payable days — hero figure */}
                      <div className="bg-primary-foreground/10 rounded-2xl p-6 text-center">
                        <p className="text-sm font-bold uppercase tracking-widest text-primary-foreground/60 mb-1">Total Payable Days</p>
                        <p className="text-6xl font-mono font-bold text-chart-1">{pdTotalDays}</p>
                        {pdStartDate === pdFinishDate ? (
                          <p className="text-xs text-primary-foreground/50 font-medium mt-2">
                            Single day ({pdStartMode === 'custom' ? `${pdStartVal}` : pdStartMode} day)
                          </p>
                        ) : (
                          <p className="text-xs text-primary-foreground/50 font-medium mt-2">
                            {formatUK(parseDate(pdStartDate))} → {formatUK(parseDate(pdFinishDate))}
                            {pdSplits.length > 1 && <span className="ml-2 text-chart-1">· {pdSplits.length} payments</span>}
                          </p>
                        )}
                        {pdIncludeSubsistence && pdSubsistenceAmt > 0 && pdTotalSubsistence !== null && (
                          <div className="mt-4 pt-4 border-t border-primary-foreground/10 flex items-center justify-between">
                            <span className="text-xs font-bold uppercase tracking-widest text-primary-foreground/50">Total Subsistence</span>
                            <span className="font-mono font-bold text-chart-1">{formatCurrency(pdTotalSubsistence)}</span>
                          </div>
                        )}
                      </div>

                      {/* Payment schedule — one card per payroll split */}
                      <div className="space-y-3">
                        <p className="text-xs font-bold uppercase tracking-widest text-primary-foreground/50 px-1">
                          Payment Schedule
                        </p>
                        {pdSplits.map((split, idx) => (
                          <div key={idx} className="bg-primary-foreground/10 rounded-xl overflow-hidden">
                            {/* Period header */}
                            <div className="flex items-center justify-between px-4 py-3 border-b border-primary-foreground/10">
                              <span className="text-sm font-bold text-white">
                                {pdPayrollType === 'fortnightly'
                                  ? split.periodLabel
                                  : `${formatUK(split.periodStart)} – ${formatUK(split.periodEnd)}`}
                              </span>
                              <span className="font-mono font-bold text-chart-1 text-base">
                                {split.days % 1 === 0 ? split.days.toFixed(0) : split.days} days
                              </span>
                            </div>
                            {/* Cut-off + Payday */}
                            <div className="grid grid-cols-2 divide-x divide-primary-foreground/10">
                              <div className="px-4 py-2.5">
                                <p className="text-xs text-primary-foreground/50 font-medium mb-0.5">Cut-off</p>
                                <p className="font-mono font-bold text-sm text-white">{formatUK(split.cutoff)}</p>
                              </div>
                              <div className="px-4 py-2.5">
                                <p className="text-xs text-primary-foreground/50 font-medium mb-0.5">Payday</p>
                                <p className="font-mono font-bold text-sm text-chart-1">{formatUK(split.payday)}</p>
                              </div>
                            </div>
                            {/* Monthly period label (if monthly) */}
                            {pdPayrollType === 'monthly' && (
                              <div className="px-4 py-2 bg-primary-foreground/5 border-t border-primary-foreground/10">
                                <span className="text-xs text-primary-foreground/50 font-medium">{split.periodLabel} payroll</span>
                              </div>
                            )}
                            {/* Subsistence for this period */}
                            {pdIncludeSubsistence && pdSubsistenceAmt > 0 && (
                              <div className="px-4 py-2.5 border-t border-primary-foreground/10 flex items-center justify-between">
                                <span className="text-xs text-primary-foreground/50 font-medium">
                                  Subsistence ({split.days % 1 === 0 ? split.days.toFixed(0) : split.days} × {formatCurrency(pdSubsistenceAmt)})
                                </span>
                                <span className="font-mono font-bold text-sm text-chart-1">{formatCurrency(split.days * pdSubsistenceAmt)}</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
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

function PayrollRow({ label, value, highlight = false, accent = false }: {
  label: string; value: string; highlight?: boolean; accent?: boolean;
}) {
  return (
    <div className={cn(
      'flex items-center justify-between rounded-xl px-4 py-3',
      highlight ? 'bg-primary-foreground/10' : 'bg-primary-foreground/5',
    )}>
      <span className="text-sm font-medium text-primary-foreground/70">{label}</span>
      <span className={cn('font-mono font-bold text-sm', accent ? 'text-chart-1 text-base' : 'text-white')}>
        {value}
      </span>
    </div>
  );
}

function ProjectionCard({ label, days, totalCharge, consolidatedRate, managementFee, subsistence, employerNI }: {
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