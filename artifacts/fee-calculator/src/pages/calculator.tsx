import React, { useState, useEffect, useCallback } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import {
  Calculator, RotateCcw, Briefcase, FileText, UtensilsCrossed, PlaneTakeoff, 
  CalendarDays, Globe, RefreshCw, AlertCircle, Copy, Download, Printer, 
  ChevronDown, Check, Info
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Logo from './Logo'; // <--- Your new Logo component import

// ─── Utility & Formatting ─────────────────────────────────────────────────────

const formatCurrency = (val: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 2 }).format(val);

const formatCurrencyIn = (val: number, currency: string) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency, minimumFractionDigits: 2 }).format(val);

const formatNumber = (val: number) =>
  new Intl.NumberFormat('en-GB', { maximumFractionDigits: 2 }).format(val);

const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF', 'AUD', 'CAD'] as const;
type CurrencyCode = typeof CURRENCIES[number];

// ─── Hooks ────────────────────────────────────────────────────────────────────

// Feature 1: Remember User Preferences
function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') return initialValue;
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  const setValue = useCallback((value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
      }
    } catch (error) {
      console.warn(`Error setting localStorage key "${key}":`, error);
    }
  }, [key, storedValue]);

  return [storedValue, setValue] as const;
}

// Feature 10: Success Feedback (Toasts)
function useToast() {
  const [toasts, setToasts] = useState<{ id: number; message: string }[]>([]);

  const showToast = useCallback((message: string) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  }, []);

  const ToastContainer = () => (
    <div className="fixed bottom-20 md:bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className="animate-in slide-in-from-bottom-2 fade-in duration-300 bg-foreground text-background px-4 py-3 rounded-xl shadow-xl flex items-center gap-2.5 font-medium text-sm">
          <div className="p-1 bg-background/20 rounded-full"><Check className="h-3.5 w-3.5 text-background" /></div>
          {t.message}
        </div>
      ))}
    </div>
  );

  return { showToast, ToastContainer };
}

// ─── Shared Components ────────────────────────────────────────────────────────

const NumInput = ({
  value, onChange, prefix, suffix, placeholder = '0.00', 'aria-label': ariaLabel
}: {
  value: string; onChange: (v: string) => void; prefix?: string; suffix?: string; placeholder?: string; 'aria-label'?: string;
}) => (
  <div className="relative group">
    {prefix && (
      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-mono whitespace-nowrap pointer-events-none transition-colors group-focus-within:text-primary">
        {prefix}
      </span>
    )}
    <input
      type="number"
      value={value}
      onChange={e => onChange(e.target.value)}
      aria-label={ariaLabel}
      className={cn(
        'w-full py-3 bg-input/40 border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all font-mono text-base font-medium',
        prefix ? (prefix.length > 1 ? 'pl-16 pr-4' : 'pl-10 pr-4') : suffix ? 'pl-4 pr-10' : 'px-4',
      )}
      placeholder={placeholder}
    />
    {suffix && <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground font-mono transition-colors group-focus-within:text-primary">{suffix}</span>}
  </div>
);

const DayToggle = ({
  mode, onModeChange, customVal, onCustomChange, label
}: {
  mode: 'half' | 'full' | 'custom'; onModeChange: (v: 'half' | 'full' | 'custom') => void;
  customVal: string; onCustomChange: (v: string) => void; label: string;
}) => (
  <div className="space-y-2" role="group" aria-label={label}>
    <div className="flex items-center gap-1 p-1 bg-input/40 border border-input rounded-xl w-fit">
      {(['half', 'full', 'custom'] as const).map(m => (
        <button
          key={m}
          onClick={() => onModeChange(m)}
          className={cn('px-3 py-1 rounded-lg text-sm font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
            mode === m ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground hover:text-foreground')}
        >
          {m === 'half' ? '0.5 day' : m === 'full' ? 'Full day' : 'Custom'}
        </button>
      ))}
    </div>
    {mode === 'custom' && (
      <div className="animate-in fade-in slide-in-from-top-1 duration-200">
        <NumInput value={customVal} onChange={onCustomChange} suffix="days" placeholder="0.5" aria-label={`Custom days for ${label}`} />
      </div>
    )}
  </div>
);

const ActionButton = ({ onClick, icon: Icon, label }: { onClick: () => void, icon: React.ElementType, label: string }) => (
  <button 
    onClick={onClick} 
    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary-foreground/10 hover:bg-primary-foreground/20 text-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
    title={label}
    aria-label={label}
  >
    <Icon className="h-3.5 w-3.5" />
    <span className="hidden sm:inline">{label}</span>
  </button>
);

// ─── Calculations & Domain Logic (Unchanged) ──────────────────────────────────

const UK_BANK_HOLIDAYS = new Set([
  '2024-01-01','2024-03-29','2024-04-01','2024-05-06','2024-05-27','2024-08-26','2024-12-25','2024-12-26',
  '2025-01-01','2025-04-18','2025-04-21','2025-05-05','2025-05-26','2025-08-25','2025-12-25','2025-12-26',
  '2026-01-01','2026-04-03','2026-04-06','2026-05-04','2026-05-25','2026-08-31','2026-12-25','2026-12-28',
  '2027-01-01','2027-03-26','2027-03-29','2027-05-03','2027-05-31','2027-08-30','2027-12-27','2027-12-28',
  '2028-01-03','2028-04-14','2028-04-17','2028-05-01','2028-05-29','2028-08-28','2028-12-25','2028-12-26',
]);

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
function sundayBefore(date: Date): Date {
  const dow = date.getDay();
  return addDays(date, -(dow === 0 ? 7 : dow));
}
function monthlyPayday(year: number, month: number): Date {
  let d = new Date(year, month, 28);
  while (!isWorkingDay(d)) d = addDays(d, -1);
  return d;
}

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

interface PayrollSplit {
  periodStart: Date; periodEnd: Date; cutoff: Date; payday: Date; periodLabel: string; days: number;
}

const FN_ANCHOR = new Date(2026, 0, 9);

function getAllFortnightlyCutoffs(start: Date, finish: Date): Array<{ payday: Date; cutoff: Date }> {
  const diffDays = Math.round((start.getTime() - FN_ANCHOR.getTime()) / 86400000);
  let idx = Math.floor(diffDays / 14);
  while (sundayBefore(addDays(FN_ANCHOR, (idx - 1) * 14)).getTime() >= start.getTime()) idx--;
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

function getAllMonthlyCutoffs(start: Date, finish: Date): Array<{ payday: Date; cutoff: Date }> {
  let year = start.getFullYear();
  let month = start.getMonth();
  const results: Array<{ payday: Date; cutoff: Date }> = [];
  for (let i = 0; i < 25; i++) {
    const payday = monthlyPayday(year, month);
    const cutoff = new Date(year, month, 20);
    if (cutoff.getTime() >= start.getTime()) {
      results.push({ payday, cutoff });
      if (cutoff.getTime() >= finish.getTime()) break;
    }
    if (++month > 11) { month = 0; year++; }
  }
  return results;
}

function computePayrollSplits(start: Date, finish: Date, startVal: number, finishVal: number, payrollType: 'monthly' | 'fortnightly'): PayrollSplit[] {
  const cutoffs = payrollType === 'fortnightly' ? getAllFortnightlyCutoffs(start, finish) : getAllMonthlyCutoffs(start, finish);
  const splits: PayrollSplit[] = [];
  let periodStart = start;
  let carryDays = 0;
  let finishReached = false;
  let i = 0;

  while (true) {
    if (i >= cutoffs.length) {
      if (payrollType === 'monthly' && carryDays > 0) {
        const lastEntry = cutoffs[cutoffs.length - 1];
        let month = lastEntry.payday.getMonth() + 1;
        let year = lastEntry.payday.getFullYear();
        if (month > 11) { month = 0; year++; }
        cutoffs.push({ payday: monthlyPayday(year, month), cutoff: new Date(year, month, 20) });
      } else { break; }
    }
    const { payday, cutoff } = cutoffs[i];
    const isFirst = i === 0;
    let rawDays: number;
    let periodEnd: Date;

    if (finishReached) {
      periodEnd = cutoff;
      rawDays = 0;
    } else {
      const isLast = cutoff.getTime() >= finish.getTime();
      periodEnd = isLast ? finish : cutoff;
      const diff = Math.round((periodEnd.getTime() - periodStart.getTime()) / 86400000);
      if (diff === 0) {
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
    const periodLabel = payrollType === 'monthly' ? `${MONTH_NAMES[m]} ${y}` : `${formatUK(periodStart)} – ${formatUK(periodEnd)}`;
    splits.push({ periodStart, periodEnd, cutoff, payday, periodLabel, days });

    if (finishReached && carryDays <= 0) break;
    periodStart = addDays(cutoff, 1);
    i++;
  }
  return splits;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CalculatorPage() {
  const { showToast, ToastContainer } = useToast();
  const [mode, setMode] = useState<'contract' | 'perm' | 'paydays'>('contract');

  // Feature 1: Persisted State via LocalStorage
  const [consolidatedRate, setConsolidatedRate] = useState(''); // deliberately not persisted for privacy/freshness
  const [margin, setMargin] = useLocalStorage('calc_margin', '15');
  const [includeNI, setIncludeNI] = useLocalStorage('calc_inc_ni', false);
  const [subsistence, setSubsistence] = useLocalStorage('calc_subsistence', '');
  const [includeSubsistence, setIncludeSubsistence] = useLocalStorage('calc_inc_sub', false);
  const [subsistenceInFee, setSubsistenceInFee] = useLocalStorage('calc_sub_in_fee', true);

  const [includeTrip, setIncludeTrip] = useLocalStorage('calc_inc_trip', false);
  const [workingDays, setWorkingDays] = useState('');
  const [travelDays, setTravelDays] = useState('');
  const [travelDayFull, setTravelDayFull] = useLocalStorage('calc_travel_full', false);

  const [salary, setSalary] = useState('50000'); // not persisted for freshness
  const [placementFee, setPlacementFee] = useLocalStorage('calc_perm_fee', '20');
  const [includePermNI, setIncludePermNI] = useLocalStorage('calc_perm_ni', false);
  const [pCurrency, setPCurrency] = useLocalStorage<CurrencyCode>('calc_currency', 'GBP');
  const [pFxDate, setPFxDate] = useState(() => new Date().toISOString().slice(0, 10));

  const [pdPayrollType, setPdPayrollType] = useLocalStorage<'monthly' | 'fortnightly'>('calc_payroll_type', 'monthly');
  const [pdStartDate, setPdStartDate] = useState('');
  const [pdStartMode, setPdStartMode] = useLocalStorage<'half' | 'full' | 'custom'>('calc_pd_start_mode', 'full');
  const [pdStartCustomVal, setPdStartCustomVal] = useState('0.5');
  const [pdFinishDate, setPdFinishDate] = useState('');
  const [pdFinishMode, setPdFinishMode] = useLocalStorage<'half' | 'full' | 'custom'>('calc_pd_finish_mode', 'full');
  const [pdFinishCustomVal, setPdFinishCustomVal] = useState('0.5');
  const [pdIncludeSubsistence, setPdIncludeSubsistence] = useLocalStorage('calc_pd_inc_sub', false);
  const [pdSubsistenceRate, setPdSubsistenceRate] = useLocalStorage('calc_pd_sub_rate', '');

  const [pFxRate, setPFxRate] = useState<number | null>(null);
  const [pFxLoading, setPFxLoading] = useState(false);
  const [pFxError, setPFxError] = useState<string | null>(null);
  const [pFxRefreshKey, setPFxRefreshKey] = useState(0);

  const reset = () => {
    setConsolidatedRate(''); setMargin('15'); setIncludeNI(false);
    setSubsistence(''); setIncludeSubsistence(false); setSubsistenceInFee(true);
    setIncludeTrip(false); setWorkingDays(''); setTravelDays(''); setTravelDayFull(false);
    setSalary('50000'); setPlacementFee('20'); setIncludePermNI(false);
    setPCurrency('GBP'); setPFxDate(new Date().toISOString().slice(0, 10)); setPFxRate(null); setPFxError(null);
    setPdStartDate(''); setPdStartMode('full'); setPdStartCustomVal('0.5');
    setPdFinishDate(''); setPdFinishMode('full'); setPdFinishCustomVal('0.5');
    setPdIncludeSubsistence(false); setPdSubsistenceRate('');
    showToast('Values reset to defaults');
  };

  // FX rate fetch
  useEffect(() => {
    if (pCurrency === 'GBP') {
      setPFxRate(null); setPFxError(null); setPFxLoading(false); return;
    }
    let cancelled = false;
    setPFxLoading(true); setPFxError(null);
    const today = new Date().toISOString().slice(0, 10);
    const isFuture = pFxDate > today;
    const datePart = isFuture ? 'latest' : pFxDate;

    fetch(`https://api.frankfurter.dev/v1/${datePart}?base=${pCurrency}&symbols=GBP`)
      .then(res => { if (!res.ok) throw new Error('lookup failed'); return res.json(); })
      .then(data => {
        if (cancelled) return;
        const rate = data?.rates?.GBP;
        if (typeof rate === 'number') {
          setPFxRate(rate);
          if (isFuture) setPFxError('future-date-fallback');
        } else { setPFxError('No rate available for that date.'); }
      })
      .catch(() => { if (!cancelled) setPFxError('Could not reach the exchange rate service.'); })
      .finally(() => { if (!cancelled) setPFxLoading(false); });

    return () => { cancelled = true; };
  }, [pCurrency, pFxDate, pFxRefreshKey]);

  // Contract Calcs
  const cRate = parseFloat(consolidatedRate) || 0;
  const cMargin = parseFloat(margin) || 0;
  const cSubsistenceAmt = includeSubsistence ? (parseFloat(subsistence) || 0) : 0;
  const cEmployerNI = includeNI ? cRate * 0.155 : 0;
  const cFeeBase = cRate + cEmployerNI + (subsistenceInFee ? cSubsistenceAmt : 0);
  const cManagementFee = cFeeBase * (cMargin / 100);
  const cTotalCharge = cRate + cEmployerNI + cSubsistenceAmt + cManagementFee;

  const cTravelRate = cRate * (travelDayFull ? 1 : 0.5);
  const cTravelNI = includeNI ? cTravelRate * 0.155 : 0;
  const cTravelFeeBase = cTravelRate + cTravelNI + (subsistenceInFee ? cSubsistenceAmt : 0);
  const cTravelManagementFee = cTravelFeeBase * (cMargin / 100);
  const cTravelDayCharge = cTravelRate + cTravelNI + cSubsistenceAmt + cTravelManagementFee;

  const nWorkingDays = Math.max(0, parseInt(workingDays) || 0);
  const nTravelDays = Math.max(0, parseInt(travelDays) || 0);
  const tripWorkingTotal = nWorkingDays * cTotalCharge;
  const tripTravelTotal = nTravelDays * cTravelDayCharge;
  const tripGrandTotal = tripWorkingTotal + tripTravelTotal;

  // Perm Calcs
  const pSalaryInput = parseFloat(salary) || 0;
  const pFxReady = pCurrency === 'GBP' || pFxRate !== null;
  const pSalary = pCurrency === 'GBP' ? pSalaryInput : (pFxRate !== null ? pSalaryInput * pFxRate : 0);
  const pFeePct = parseFloat(placementFee) || 0;
  const pPlacementFee = pFxReady ? pSalary * (pFeePct / 100) : 0;
  const pEmployerNI = includePermNI ? Math.max(0, (pSalary - 9100) * 0.15) : 0;
  const pTotalCost = pPlacementFee + (includePermNI ? pEmployerNI : 0);

  // Payment Days Calcs
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

  // Feature 2: Export Functions
  const copyContractBreakdown = () => {
    const text = `Contract Charge Breakdown (Per Day)
-----------------------------------
Consolidated Rate: ${formatCurrency(cRate)}
${includeNI ? `Employer's NIC: ${formatCurrency(cEmployerNI)}\n` : ''}${includeSubsistence && cSubsistenceAmt > 0 ? `Subsistence: ${formatCurrency(cSubsistenceAmt)}\n` : ''}Management Fee (${cMargin}%): ${formatCurrency(cManagementFee)}
-----------------------------------
Total Charge Rate: ${formatCurrency(cTotalCharge)}`;
    navigator.clipboard.writeText(text);
    showToast('Charge breakdown copied');
  };

  const copyTripSummary = () => {
    const text = `Trip Invoice Summary
-----------------------------------
Working Days (${nWorkingDays}): ${formatCurrency(tripWorkingTotal)}
Travel Days (${nTravelDays}): ${formatCurrency(tripTravelTotal)}
${includeSubsistence && cSubsistenceAmt > 0 ? `Total Subsistence: ${formatCurrency((nWorkingDays + nTravelDays) * cSubsistenceAmt)}\n` : ''}-----------------------------------
Total Trip Invoice: ${formatCurrency(tripGrandTotal)}`;
    navigator.clipboard.writeText(text);
    showToast('Trip summary copied');
  };

  const copyPermSummary = () => {
    const text = `Permanent Placement Summary
-----------------------------------
Annual Salary: ${formatCurrencyIn(pSalaryInput, pCurrency)}
${pCurrency !== 'GBP' ? `Converted Salary (GBP): ${formatCurrency(pSalary)} (@ ${pFxRate?.toFixed(4)})\n` : ''}Placement Fee (${pFeePct}%): ${formatCurrency(pPlacementFee)}
${includePermNI ? `Employer's NI: ${formatCurrency(pEmployerNI)}\n` : ''}-----------------------------------
Total ${includePermNI ? 'Cost' : 'Invoice'}: ${formatCurrency(includePermNI ? pTotalCost : pPlacementFee)}`;
    navigator.clipboard.writeText(text);
    showToast('Permanent summary copied');
  };

  const exportScheduleCSV = () => {
    if (!pdSplits.length) return;
    const headers = "Period,Cut-off,Payday,Payable Days,Subsistence Amount\n";
    const rows = pdSplits.map(s => 
      `"${s.periodLabel}","${formatUK(s.cutoff)}","${formatUK(s.payday)}",${s.days},${pdIncludeSubsistence ? s.days * pdSubsistenceAmt : 0}`
    ).join("\n");
    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `payment_schedule_${pdStartDate}_to_${pdFinishDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('CSV Schedule Exported');
  };

  const printSchedule = () => {
    window.print();
    showToast('Preparing to print...');
  };

  // Feature 4: Visual Breakdown calculations
  const totalBarVal = cTotalCharge > 0 ? cTotalCharge : 1;
  const workerPct = (cRate / totalBarVal) * 100;
  const niPct = (cEmployerNI / totalBarVal) * 100;
  const subPct = (cSubsistenceAmt / totalBarVal) * 100;
  const feePct = (cManagementFee / totalBarVal) * 100;

  return (
    <div className="min-h-[100dvh] bg-background py-10 px-4 sm:px-6 md:px-8 flex flex-col items-center pb-28 md:pb-10">
      <ToastContainer />
      <div className="w-full max-w-5xl">
        <header className="mb-10 flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <Logo />
            <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
              Fee Calculator
            </h1>
            <p className="mt-2 text-muted-foreground font-medium">Precise breakdown of margins, costs, and placement fees.</p>
          </div>
          <button onClick={reset} className="self-start md:self-auto flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors px-4 py-2 rounded-lg hover:bg-input/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
            <RotateCcw className="h-4 w-4" />Reset Values
          </button>
        </header>

        <Tabs value={mode} onValueChange={(v) => setMode(v as typeof mode)} className="w-full">
          <TabsList className="grid w-full max-w-2xl grid-cols-3 mb-8 bg-input/40 p-1 rounded-xl">
            <TabsTrigger value="contract" className="flex gap-2 text-xs sm:text-sm rounded-lg data-[state=active]:shadow-sm">
              <FileText className="h-4 w-4" />Contract <span className="hidden sm:inline">/ Day Rate</span>
            </TabsTrigger>
            <TabsTrigger value="perm" className="flex gap-2 text-xs sm:text-sm rounded-lg data-[state=active]:shadow-sm">
              <Briefcase className="h-4 w-4" />Permanent
            </TabsTrigger>
            <TabsTrigger value="paydays" className="flex gap-2 text-xs sm:text-sm rounded-lg data-[state=active]:shadow-sm">
              <CalendarDays className="h-4 w-4" />Payment Days
            </TabsTrigger>
          </TabsList>

          {/* ─────────────── CONTRACT TAB ─────────────── */}
          <TabsContent value="contract" className="m-0 animate-in fade-in duration-300">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-5 flex flex-col gap-6">

                {/* Core inputs */}
                <div className="bg-card border border-card-border p-7 rounded-2xl shadow-sm space-y-6">
                  <h2 className="text-lg font-bold border-b border-border pb-4">Input Parameters</h2>
                  <div className="space-y-2">
                    <label className="block text-sm font-bold text-foreground">Consolidated Rate — Worker Pay (£/day)</label>
                    <p className="text-xs text-muted-foreground font-medium -mt-1">The rate paid to the worker. Fee and NI are added on top.</p>
                    <NumInput value={consolidatedRate} onChange={setConsolidatedRate} prefix="£" aria-label="Consolidated Rate" />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-bold text-foreground">Management Fee (%)</label>
                    <NumInput value={margin} onChange={setMargin} suffix="%" placeholder="0.0" aria-label="Management Fee Percentage" />
                  </div>
                  <div className="pt-4 flex items-center justify-between border-t border-border/60 group">
                    <div className="space-y-1 pr-4">
                      <label className="text-sm font-bold text-foreground cursor-pointer group-hover:text-primary transition-colors" onClick={() => setIncludeNI(!includeNI)}>Include Employer's NI</label>
                      <p className="text-xs text-muted-foreground font-medium">15.5% of the consolidated rate. Added to total charge.</p>
                    </div>
                    <Switch checked={includeNI} onCheckedChange={setIncludeNI} aria-label="Include Employers NI" />
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
                    <Switch checked={includeSubsistence} onCheckedChange={(v) => { setIncludeSubsistence(v); if (!v) setSubsistenceInFee(false); }} aria-label="Enable Subsistence" />
                  </div>
                  <div className={cn('space-y-5 transition-all duration-300', !includeSubsistence && 'opacity-40 pointer-events-none scale-[0.98] h-0 overflow-hidden !my-0')}>
                    <div className="space-y-2 pt-2">
                      <label className="block text-sm font-bold text-foreground">Subsistence Rate (£ per day)</label>
                      <NumInput value={subsistence} onChange={setSubsistence} prefix="£" aria-label="Subsistence Rate" />
                    </div>
                    <div className="flex items-center justify-between group">
                      <div className="space-y-1 pr-4">
                        <label className="text-sm font-bold text-foreground cursor-pointer group-hover:text-primary transition-colors" onClick={() => includeSubsistence && setSubsistenceInFee(!subsistenceInFee)}>Include in management fee</label>
                        <p className="text-xs text-muted-foreground font-medium">Apply the {cMargin > 0 ? `${cMargin}%` : 'margin'} fee to subsistence.</p>
                      </div>
                      <Switch checked={subsistenceInFee} onCheckedChange={setSubsistenceInFee} disabled={!includeSubsistence} aria-label="Include subsistence in fee" />
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
                    <Switch checked={includeTrip} onCheckedChange={setIncludeTrip} aria-label="Enable Trip Calculator" />
                  </div>
                  <div className={cn('space-y-5 transition-all duration-300', !includeTrip && 'opacity-40 pointer-events-none scale-[0.98] h-0 overflow-hidden !my-0')}>
                    <div className="space-y-2 pt-2">
                      <label className="block text-sm font-bold text-foreground">Working Days</label>
                      <p className="text-xs text-muted-foreground font-medium -mt-1">Full day rate days on site</p>
                      <NumInput value={workingDays} onChange={setWorkingDays} placeholder="0" aria-label="Working Days" />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-sm font-bold text-foreground">Travel Days</label>
                      <p className="text-xs text-muted-foreground font-medium -mt-1">Subsistence always at full rate regardless of day rate.</p>
                      <NumInput value={travelDays} onChange={setTravelDays} placeholder="0" aria-label="Travel Days" />
                      <div className="flex items-center gap-1 mt-2 p-1 bg-input/40 border border-input rounded-xl w-fit">
                        <button onClick={() => setTravelDayFull(false)} className={cn('px-4 py-1.5 rounded-lg text-sm font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary', !travelDayFull ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground hover:text-foreground')}>0.5 day</button>
                        <button onClick={() => setTravelDayFull(true)} className={cn('px-4 py-1.5 rounded-lg text-sm font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary', travelDayFull ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground hover:text-foreground')}>Full day</button>
                      </div>
                    </div>
                  </div>
                </div>

                <AssumptionsAccordion />
              </div>

              {/* Right panel */}
              <div className="lg:col-span-7 bg-primary text-primary-foreground rounded-2xl shadow-xl overflow-hidden flex flex-col relative transition-all duration-500">
                {/* Feature 9: Better Empty States */}
                {cRate === 0 && !consolidatedRate ? (
                  <div className="absolute inset-0 z-10 bg-primary/95 flex flex-col items-center justify-center text-center p-10 animate-in fade-in duration-500">
                    <div className="p-4 bg-primary-foreground/10 rounded-full mb-4">
                      <Calculator className="h-8 w-8 text-primary-foreground/60" />
                    </div>
                    <h3 className="text-xl font-bold mb-2">Awaiting Parameters</h3>
                    <p className="text-primary-foreground/70 font-medium max-w-sm">
                      Enter a consolidated rate and management fee to generate the charge breakdown and projections.
                    </p>
                  </div>
                ) : null}

                <div className="p-8 md:p-10 flex-grow relative">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                    <h2 className="text-xl font-bold">Charge Rate Breakdown</h2>
                    <div className="flex items-center gap-3">
                      <ActionButton onClick={copyContractBreakdown} icon={Copy} label="Copy" />
                      <span className="text-xs uppercase tracking-widest font-bold px-3 py-1.5 bg-primary-foreground/10 rounded-full">Per Day</span>
                    </div>
                  </div>

                  {/* Feature 4: Visual Breakdown */}
                  <div className="w-full h-3 bg-primary-foreground/10 rounded-full mb-6 overflow-hidden flex transition-all">
                    <div className="bg-white h-full transition-all duration-500" style={{ width: `${workerPct}%` }} title="Worker Pay" />
                    <div className="bg-white/70 h-full transition-all duration-500 border-l border-primary/20" style={{ width: `${niPct}%` }} title="Employer NI" />
                    <div className="bg-white/40 h-full transition-all duration-500 border-l border-primary/20" style={{ width: `${subPct}%` }} title="Subsistence" />
                    <div className="bg-white/20 h-full transition-all duration-500 border-l border-primary/20" style={{ width: `${feePct}%` }} title="Management Fee" />
                  </div>

                  <div className="space-y-3 relative z-0">
                    <LineItem label="Consolidated Rate" value={cRate} isBold />
                    {includeNI && <LineItem label="Employers NIC (15.5%)" value={cEmployerNI} />}
                    {includeSubsistence && cSubsistenceAmt > 0 && <LineItem label="Subsistence" value={cSubsistenceAmt} />}
                    <LineItem label={`Management Fee (${cMargin > 0 ? `${cMargin}%` : '—'})`} value={cManagementFee} />

                    {/* Feature 5: Formula Explanations */}
                    {cMargin > 0 && cTotalCharge > 0 && (
                      <div className="text-xs text-primary-foreground/60 font-medium bg-primary-foreground/5 p-2.5 rounded-lg mt-1 inline-flex items-center gap-2">
                        <Info className="h-3.5 w-3.5 shrink-0" />
                        Fee = {cMargin}% × ({formatCurrency(cRate)} 
                        {includeNI ? ` + ${formatCurrency(cEmployerNI)} NI` : ''} 
                        {subsistenceInFee && cSubsistenceAmt > 0 ? ` + ${formatCurrency(cSubsistenceAmt)} Sub` : ''})
                      </div>
                    )}

                    <div className="mt-4 pt-5 border-t-2 border-primary-foreground/30 transition-all">
                      <div className="flex items-center justify-between">
                        <span className="text-lg font-bold">Total Charge Rate</span>
                        <span className="text-3xl font-mono font-bold tracking-tight text-chart-1 transition-all duration-300" key={cTotalCharge}>{formatCurrency(cTotalCharge)}</span>
                      </div>
                    </div>
                  </div>

                  {includeTrip && (
                    <div className="mt-8 pt-6 border-t border-primary-foreground/20 animate-in fade-in slide-in-from-top-4 duration-300">
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
                          <span className="font-mono font-bold text-base text-chart-1 transition-all" key={cTravelDayCharge}>{formatCurrency(cTravelDayCharge)}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="bg-primary-foreground/5 p-8 md:p-10 border-t border-primary-foreground/10 relative z-0">
                  {includeTrip ? (
                    <div className="animate-in fade-in duration-300">
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-primary-foreground/60">Trip Invoice</h3>
                        <ActionButton onClick={copyTripSummary} icon={Copy} label="Copy" />
                      </div>
                      <div className="space-y-4">
                        <div className="bg-primary-foreground/5 p-4 rounded-xl space-y-2 hover:bg-primary-foreground/10 transition-colors">
                          <div className="flex items-center justify-between text-sm font-bold text-primary-foreground/80">
                            <span>Working Days</span>
                            <span className="text-primary-foreground/50 font-medium">{nWorkingDays} × {formatCurrency(cTotalCharge)}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-primary-foreground/50 font-medium">Full rate per day</span>
                            <span className="font-mono font-bold transition-all" key={tripWorkingTotal}>{formatCurrency(tripWorkingTotal)}</span>
                          </div>
                        </div>
                        <div className="bg-primary-foreground/5 p-4 rounded-xl space-y-2 hover:bg-primary-foreground/10 transition-colors">
                          <div className="flex items-center justify-between text-sm font-bold text-primary-foreground/80">
                            <span>Travel Days</span>
                            <span className="text-primary-foreground/50 font-medium">{nTravelDays} × {formatCurrency(cTravelDayCharge)}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-primary-foreground/50 font-medium">{travelDayFull ? 'Full' : '0.5'} rate + full subsistence</span>
                            <span className="font-mono font-bold transition-all" key={tripTravelTotal}>{formatCurrency(tripTravelTotal)}</span>
                          </div>
                        </div>
                        {includeSubsistence && cSubsistenceAmt > 0 && (
                          <div className="bg-primary-foreground/5 p-4 rounded-xl flex items-center justify-between hover:bg-primary-foreground/10 transition-colors">
                            <div>
                              <span className="text-sm font-bold text-primary-foreground/80 block">Total Subsistence</span>
                              <span className="text-xs text-primary-foreground/50 font-medium">{nWorkingDays + nTravelDays} days × {formatCurrency(cSubsistenceAmt)}</span>
                            </div>
                            <span className="font-mono font-bold transition-all" key={(nWorkingDays + nTravelDays) * cSubsistenceAmt}>{formatCurrency((nWorkingDays + nTravelDays) * cSubsistenceAmt)}</span>
                          </div>
                        )}
                        <div className="pt-2 border-t-2 border-primary-foreground/30 flex items-center justify-between">
                          <div>
                            <span className="text-lg font-bold block">Total Trip Invoice</span>
                            <span className="text-xs text-primary-foreground/50 font-medium">{nWorkingDays + nTravelDays} days total</span>
                          </div>
                          <span className="text-3xl font-mono font-bold tracking-tight text-chart-1 transition-all duration-300" key={tripGrandTotal}>{formatCurrency(tripGrandTotal)}</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="animate-in fade-in duration-300">
                      <h3 className="text-xs font-bold uppercase tracking-widest text-primary-foreground/60 mb-6">Revenue Projections</h3>
                      {/* Feature 3: Better Revenue Projections */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <ProjectionCard label="Weekly" days={5} totalCharge={cTotalCharge} consolidatedRate={cRate} managementFee={cManagementFee} subsistence={includeSubsistence ? cSubsistenceAmt : 0} employerNI={cEmployerNI} />
                        <ProjectionCard label="Monthly" days={21} totalCharge={cTotalCharge} consolidatedRate={cRate} managementFee={cManagementFee} subsistence={includeSubsistence ? cSubsistenceAmt : 0} employerNI={cEmployerNI} />
                        <ProjectionCard label="Annual" days={230} totalCharge={cTotalCharge} consolidatedRate={cRate} managementFee={cManagementFee} subsistence={includeSubsistence ? cSubsistenceAmt : 0} employerNI={cEmployerNI} />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* ─────────────── PERMANENT TAB ─────────────── */}
          <TabsContent value="perm" className="m-0 animate-in fade-in duration-300">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-5 space-y-6">
                <div className="bg-card border border-card-border p-7 rounded-2xl shadow-sm">
                  <h2 className="text-lg font-bold border-b border-border pb-4">Input Parameters</h2>
                  <div className="space-y-6 mt-4">
                    <div className="space-y-2" role="radiogroup" aria-label="Salary Currency">
                      <label className="block text-sm font-bold text-foreground">Salary Currency</label>
                      <div className="grid grid-cols-3 gap-1 p-1 bg-input/40 border border-input rounded-xl">
                        {CURRENCIES.map(c => (
                          <button
                            key={c}
                            role="radio"
                            aria-checked={pCurrency === c}
                            onClick={() => setPCurrency(c)}
                            className={cn('py-1.5 rounded-lg text-sm font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                              pCurrency === c ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground hover:text-foreground')}
                          >{c}</button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-bold text-foreground">Candidate Annual Salary ({pCurrency})</label>
                      <NumInput value={salary} onChange={setSalary} prefix={pCurrency} aria-label="Annual Salary" />
                    </div>

                    {pCurrency !== 'GBP' && (
                      <div className="space-y-3 p-4 bg-input/30 border border-input rounded-xl animate-in slide-in-from-top-2 fade-in duration-300">
                        <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                          <Globe className="h-4 w-4" />Exchange Rate
                        </div>
                        <div className="space-y-1">
                          <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wide">Placement / Start Date</label>
                          <input
                            type="date"
                            value={pFxDate}
                            onChange={e => setPFxDate(e.target.value)}
                            aria-label="Exchange Rate Date"
                            className="w-full px-4 py-2.5 bg-input/40 border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all text-sm font-medium"
                          />
                        </div>
                        <div className="flex items-center justify-between rounded-lg bg-card/60 px-3 py-2.5">
                          <div className="text-sm font-medium">
                            {pFxLoading ? (
                              <span className="text-muted-foreground">Fetching rate…</span>
                            ) : pFxRate !== null ? (
                              <span className="font-mono font-bold animate-in fade-in duration-300">
                                1 {pCurrency} = {pFxRate.toFixed(4)} GBP
                              </span>
                            ) : (
                              <span className="text-muted-foreground">No rate yet</span>
                            )}
                          </div>
                          <button
                            onClick={() => setPFxRefreshKey(k => k + 1)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-input/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                            title="Refresh rate"
                            aria-label="Refresh exchange rate"
                          >
                            <RefreshCw className={cn('h-3.5 w-3.5', pFxLoading && 'animate-spin')} />
                          </button>
                        </div>
                        {pFxError === 'future-date-fallback' && (
                          <div className="flex items-start gap-2 text-xs text-amber-500/90 font-medium">
                            <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                            <span>Future date selected. Showing today's latest rate instead.</span>
                          </div>
                        )}
                        {pFxError && pFxError !== 'future-date-fallback' && (
                          <div className="flex items-start gap-2 text-xs text-red-400 font-medium">
                            <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                            <span>{pFxError}</span>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="space-y-2">
                      <label className="block text-sm font-bold text-foreground">Placement Fee (%)</label>
                      <NumInput value={placementFee} onChange={setPlacementFee} suffix="%" placeholder="0.0" aria-label="Placement Fee Percentage" />
                    </div>
                    <div className="pt-4 flex items-center justify-between border-t border-border/60 group">
                      <div className="space-y-1 pr-4">
                        <label className="text-sm font-bold text-foreground cursor-pointer group-hover:text-primary transition-colors" onClick={() => setIncludePermNI(!includePermNI)}>Include Employer's NI</label>
                        <p className="text-xs text-muted-foreground font-medium">Informational only. (15% over £9,100)</p>
                      </div>
                      <Switch checked={includePermNI} onCheckedChange={setIncludePermNI} aria-label="Include Permanent Employer NI" />
                    </div>
                  </div>
                </div>
                <AssumptionsAccordion />
              </div>

              <div className="lg:col-span-7 bg-primary text-primary-foreground rounded-2xl shadow-xl overflow-hidden flex flex-col relative">
                {pSalaryInput === 0 && !salary ? (
                  <div className="absolute inset-0 z-10 bg-primary/95 flex flex-col items-center justify-center text-center p-10 animate-in fade-in duration-500">
                    <div className="p-4 bg-primary-foreground/10 rounded-full mb-4">
                      <Briefcase className="h-8 w-8 text-primary-foreground/60" />
                    </div>
                    <h3 className="text-xl font-bold mb-2">Awaiting Parameters</h3>
                    <p className="text-primary-foreground/70 font-medium max-w-sm">
                      Enter a candidate salary and placement fee to generate the invoice breakdown.
                    </p>
                  </div>
                ) : null}

                <div className="p-8 md:p-10 flex-grow relative z-0">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                    <h2 className="text-xl font-bold">Invoice Breakdown</h2>
                    <div className="flex items-center gap-3">
                      <ActionButton onClick={copyPermSummary} icon={Copy} label="Copy" />
                      <span className="text-xs uppercase tracking-widest font-bold px-3 py-1.5 bg-primary-foreground/10 rounded-full">Permanent</span>
                    </div>
                  </div>
                  <div className="space-y-5">
                    <LineItem label={`Annual Salary (${pCurrency})`} value={pSalaryInput} currency={pCurrency} />
                    {pCurrency !== 'GBP' && (
                      <LineItem
                        label={pFxRate !== null ? `Converted @ 1 ${pCurrency} = ${pFxRate.toFixed(4)} GBP` : 'Converted (awaiting rate…)'}
                        value={pSalary}
                      />
                    )}
                    {!pFxReady ? (
                      <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 text-sm font-semibold text-amber-300">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        Waiting on exchange rate...
                      </div>
                    ) : (
                      <>
                        <LineItem label={`Placement Fee (${pFeePct.toFixed(1)}%)`} value={pPlacementFee} isBold />
                        {/* Formula Expansion */}
                        <div className="text-xs text-primary-foreground/60 font-medium bg-primary-foreground/5 p-2.5 rounded-lg inline-flex items-center gap-2">
                          <Info className="h-3.5 w-3.5 shrink-0" />
                          Fee = {pFeePct}% × {formatCurrency(pSalary)}
                        </div>
                      </>
                    )}
                    {includePermNI && pFxReady && (<><div className="h-px bg-primary-foreground/20 my-4" /><LineItem label="Employer's NI on Salary" value={pEmployerNI} /></>)}

                    <div className="mt-4 pt-5 border-t-2 border-primary-foreground/30">
                      <div className="flex items-center justify-between">
                        <span className="text-lg font-bold">Total Invoice to Client</span>
                        <span className="text-3xl font-mono font-bold tracking-tight text-chart-1 transition-all duration-300" key={pPlacementFee}>{formatCurrency(pPlacementFee)}</span>
                      </div>
                      <p className="text-xs text-primary-foreground/50 font-medium mt-1">Invoiced in GBP regardless of salary currency.</p>
                    </div>
                    {includePermNI && pFxReady && (
                      <div className="flex items-center justify-between mt-2 text-primary-foreground/70 bg-primary-foreground/5 p-4 rounded-xl border border-primary-foreground/10 animate-in slide-in-from-top-2 fade-in">
                        <span className="text-sm font-semibold">Total Cost to Client (inc. NI)</span>
                        <span className="font-mono text-base font-bold text-white transition-all" key={pTotalCost}>{formatCurrency(pTotalCost)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* ─────────────── PAYMENT DAYS TAB ─────────────── */}
          <TabsContent value="paydays" className="m-0 animate-in fade-in duration-300">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-5 flex flex-col gap-6">
                <div className="bg-card border border-card-border p-7 rounded-2xl shadow-sm space-y-6">
                  <h2 className="text-lg font-bold border-b border-border pb-4">Payment Days Calculator</h2>

                  <div className="space-y-2" role="radiogroup" aria-label="Payroll Type">
                    <label className="block text-sm font-bold text-foreground">Payroll Type</label>
                    <div className="flex items-center gap-1 p-1 bg-input/40 border border-input rounded-xl">
                      <button
                        role="radio"
                        aria-checked={pdPayrollType === 'monthly'}
                        onClick={() => setPdPayrollType('monthly')}
                        className={cn('flex-1 py-2 rounded-lg text-sm font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                          pdPayrollType === 'monthly' ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground hover:text-foreground')}
                      >Monthly</button>
                      <button
                        role="radio"
                        aria-checked={pdPayrollType === 'fortnightly'}
                        onClick={() => setPdPayrollType('fortnightly')}
                        className={cn('flex-1 py-2 rounded-lg text-sm font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                          pdPayrollType === 'fortnightly' ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground hover:text-foreground')}
                      >Fortnightly</button>
                    </div>
                    {pdPayrollType === 'monthly' && (
                      <p className="text-xs text-muted-foreground font-medium animate-in fade-in">Payday: 28th of each month (or previous working day). Cut-off: Sunday before payday.</p>
                    )}
                    {pdPayrollType === 'fortnightly' && (
                      <p className="text-xs text-muted-foreground font-medium animate-in fade-in">First payday: 09/01/2026. Every 14 days thereafter. Cut-off: Sunday before payday.</p>
                    )}
                  </div>

                  <div className="space-y-3">
                    <label className="block text-sm font-bold text-foreground">Start Date</label>
                    <input
                      type="date"
                      value={pdStartDate}
                      onChange={e => setPdStartDate(e.target.value)}
                      aria-label="Start Date"
                      className="w-full px-4 py-3 bg-input/40 border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all text-base font-medium"
                    />
                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wide">First day rate</label>
                      <DayToggle mode={pdStartMode} onModeChange={setPdStartMode} customVal={pdStartCustomVal} onCustomChange={setPdStartCustomVal} label="Start Date Rate" />
                    </div>
                  </div>

                  <div className="space-y-3 pt-4 border-t border-border/60">
                    <label className="block text-sm font-bold text-foreground">Finish Date</label>
                    <input
                      type="date"
                      value={pdFinishDate}
                      onChange={e => setPdFinishDate(e.target.value)}
                      aria-label="Finish Date"
                      className="w-full px-4 py-3 bg-input/40 border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all text-base font-medium"
                    />
                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wide">Last day rate</label>
                      <DayToggle mode={pdFinishMode} onModeChange={setPdFinishMode} customVal={pdFinishCustomVal} onCustomChange={setPdFinishCustomVal} label="Finish Date Rate" />
                    </div>
                  </div>

                  <div className="space-y-3 pt-4 border-t border-border/60 group">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-bold text-foreground cursor-pointer group-hover:text-primary transition-colors" onClick={() => setPdIncludeSubsistence(!pdIncludeSubsistence)}>Include Subsistence</label>
                      <Switch checked={pdIncludeSubsistence} onCheckedChange={setPdIncludeSubsistence} aria-label="Include Subsistence in Payment Days" />
                    </div>
                    <div className={cn('space-y-1 transition-all duration-300', !pdIncludeSubsistence && 'opacity-40 pointer-events-none h-0 overflow-hidden !my-0')}>
                      <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wide pt-2">Subsistence Rate (£ per day)</label>
                      <NumInput value={pdSubsistenceRate} onChange={setPdSubsistenceRate} prefix="£" aria-label="Payment Days Subsistence Rate" />
                    </div>
                  </div>
                </div>
                <AssumptionsAccordion />
              </div>

              <div className="lg:col-span-7 bg-primary text-primary-foreground rounded-2xl shadow-xl overflow-hidden flex flex-col relative print:shadow-none print:text-black print:bg-white print:border-2">
                <div className="p-8 md:p-10 flex-grow relative z-0">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                    <div className="flex items-center gap-3">
                      <h2 className="text-xl font-bold">Payroll Summary</h2>
                      <span className="text-xs uppercase tracking-widest font-bold px-3 py-1.5 bg-primary-foreground/10 rounded-full print:bg-gray-200">
                        {pdPayrollType === 'monthly' ? 'Monthly' : 'Fortnightly'}
                      </span>
                    </div>
                    {pdSplits.length > 0 && (
                      <div className="flex items-center gap-2 print:hidden">
                        <ActionButton onClick={printSchedule} icon={Printer} label="Print" />
                        <ActionButton onClick={exportScheduleCSV} icon={Download} label="CSV" />
                      </div>
                    )}
                  </div>

                  {!pdStartDate || !pdFinishDate ? (
                    <div className="flex flex-col items-center justify-center h-40 text-primary-foreground/40 gap-3 animate-in fade-in">
                      <CalendarDays className="h-10 w-10" />
                      <p className="text-sm font-medium">Select start and finish dates to generate schedule</p>
                    </div>
                  ) : pdError ? (
                    <div className="flex items-center gap-3 bg-red-500/20 border border-red-500/30 rounded-xl p-4 animate-in fade-in">
                      <span className="text-sm font-semibold text-red-300">{pdError}</span>
                    </div>
                  ) : (
                    <div className="space-y-5 animate-in fade-in duration-500">
                      <div className="bg-primary-foreground/10 rounded-2xl p-6 text-center print:bg-gray-100">
                        <p className="text-sm font-bold uppercase tracking-widest text-primary-foreground/60 mb-1 print:text-gray-600">Total Payable Days</p>
                        <p className="text-6xl font-mono font-bold text-chart-1 transition-all" key={pdTotalDays}>{pdTotalDays}</p>
                        {pdStartDate === pdFinishDate ? (
                          <p className="text-xs text-primary-foreground/50 font-medium mt-2 print:text-gray-500">
                            Single day ({pdStartMode === 'custom' ? `${pdStartVal}` : pdStartMode} day)
                          </p>
                        ) : (
                          <p className="text-xs text-primary-foreground/50 font-medium mt-2 print:text-gray-500">
                            {formatUK(parseDate(pdStartDate))} → {formatUK(parseDate(pdFinishDate))}
                            {pdSplits.length > 1 && <span className="ml-2 text-chart-1">· {pdSplits.length} payments</span>}
                          </p>
                        )}
                        {pdIncludeSubsistence && pdSubsistenceAmt > 0 && pdTotalSubsistence !== null && (
                          <div className="mt-4 pt-4 border-t border-primary-foreground/10 flex items-center justify-between print:border-gray-300">
                            <span className="text-xs font-bold uppercase tracking-widest text-primary-foreground/50 print:text-gray-600">Total Subsistence</span>
                            <span className="font-mono font-bold text-chart-1 transition-all" key={pdTotalSubsistence}>{formatCurrency(pdTotalSubsistence)}</span>
                          </div>
                        )}
                      </div>

                      <div className="space-y-3">
                        <p className="text-xs font-bold uppercase tracking-widest text-primary-foreground/50 px-1 print:text-gray-600">
                          Payment Schedule
                        </p>
                        {pdSplits.map((split, idx) => (
                          <div key={idx} className="bg-primary-foreground/10 rounded-xl overflow-hidden hover:bg-primary-foreground/20 transition-colors print:border print:border-gray-300 print:bg-white print:text-black">
                            <div className="flex items-center justify-between px-4 py-3 border-b border-primary-foreground/10 print:border-gray-200">
                              <span className="text-sm font-bold text-white print:text-black">
                                {pdPayrollType === 'fortnightly'
                                  ? split.periodLabel
                                  : `${formatUK(split.periodStart)} – ${formatUK(split.periodEnd)}`}
                              </span>
                              <span className="font-mono font-bold text-chart-1 text-base">
                                {split.days % 1 === 0 ? split.days.toFixed(0) : formatNumber(split.days)} days
                              </span>
                            </div>
                            <div className="grid grid-cols-2 divide-x divide-primary-foreground/10 print:divide-gray-200">
                              <div className="px-4 py-2.5">
                                <p className="text-xs text-primary-foreground/50 font-medium mb-0.5 print:text-gray-500">Cut-off</p>
                                <p className="font-mono font-bold text-sm text-white print:text-black">{formatUK(split.cutoff)}</p>
                              </div>
                              <div className="px-4 py-2.5">
                                <p className="text-xs text-primary-foreground/50 font-medium mb-0.5 print:text-gray-500">Payday</p>
                                <p className="font-mono font-bold text-sm text-chart-1 print:text-black">{formatUK(split.payday)}</p>
                              </div>
                            </div>
                            {pdPayrollType === 'monthly' && (
                              <div className="px-4 py-2 bg-primary-foreground/5 border-t border-primary-foreground/10 print:bg-gray-50 print:border-gray-200">
                                <span className="text-xs text-primary-foreground/50 font-medium print:text-gray-500">{split.periodLabel} payroll</span>
                              </div>
                            )}
                            {pdIncludeSubsistence && pdSubsistenceAmt > 0 && (
                              <div className="px-4 py-2.5 border-t border-primary-foreground/10 flex items-center justify-between print:border-gray-200">
                                <span className="text-xs text-primary-foreground/50 font-medium print:text-gray-500">
                                  Subsistence ({split.days % 1 === 0 ? split.days.toFixed(0) : formatNumber(split.days)} × {formatCurrency(pdSubsistenceAmt)})
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

      {/* Feature 7: Sticky Mobile Summary */}
      <div className="fixed bottom-0 left-0 right-0 bg-primary border-t border-primary-foreground/10 text-primary-foreground p-4 md:hidden z-40 shadow-[0_-10px_40px_rgba(0,0,0,0.15)] animate-in slide-in-from-bottom-full duration-500">
        <div className="flex items-center justify-between max-w-5xl mx-auto">
          <div className="text-xs font-bold uppercase tracking-widest text-primary-foreground/70">
            {mode === 'contract' ? (includeTrip ? 'Trip Total' : 'Charge Rate') : mode === 'perm' ? 'Placement Fee' : 'Total Days'}
          </div>
          <div className="text-xl font-mono font-bold text-chart-1 transition-all" key={mode}>
            {mode === 'contract' ? (includeTrip ? formatCurrency(tripGrandTotal) : formatCurrency(cTotalCharge)) 
              : mode === 'perm' ? formatCurrency(pPlacementFee) 
              : (pdTotalDays ?? 0)}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function LineItem({ label, value, isBold = false, currency = 'GBP' }: { label: string; value: number; isBold?: boolean; currency?: string }) {
  return (
    <div className={cn('flex items-center justify-between py-1 group', isBold ? 'text-white font-bold' : 'text-primary-foreground/80 hover:text-white transition-colors')}>
      <span className="text-sm font-medium">{label}</span>
      <span className={cn('font-mono tracking-tight transition-all', isBold ? 'text-base font-bold' : 'text-sm font-semibold')} key={value}>
        {formatCurrencyIn(value, currency)}
      </span>
    </div>
  );
}

function ProjectionCard({ label, days, totalCharge, consolidatedRate, managementFee, subsistence, employerNI }: {
  label: string; days: number; totalCharge: number; consolidatedRate: number;
  managementFee: number; subsistence: number; employerNI: number;
}) {
  return (
    <div className="bg-primary-foreground/5 p-5 rounded-xl hover:bg-primary-foreground/10 transition-colors">
      <div className="text-sm font-bold text-white mb-4 flex items-center justify-between border-b border-primary-foreground/10 pb-2">
        {label}
        <span className="text-xs font-medium text-primary-foreground/60 bg-primary-foreground/10 px-2 py-0.5 rounded-md">{days} Days</span>
      </div>
      <div className="space-y-2.5">
        <div className="flex justify-between text-sm">
          <span className="text-primary-foreground/70 font-medium">Charge</span>
          <span className="font-mono font-bold text-chart-1 transition-all" key={totalCharge}>{formatCurrency(totalCharge * days)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-primary-foreground/70 font-medium">Worker</span>
          <span className="font-mono font-bold text-white transition-all" key={consolidatedRate}>{formatCurrency(consolidatedRate * days)}</span>
        </div>
        {employerNI > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-primary-foreground/70 font-medium">NI</span>
            <span className="font-mono font-bold text-white transition-all" key={employerNI}>{formatCurrency(employerNI * days)}</span>
          </div>
        )}
        {subsistence > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-primary-foreground/70 font-medium">Sub</span>
            <span className="font-mono font-bold text-white transition-all" key={subsistence}>{formatCurrency(subsistence * days)}</span>
          </div>
        )}
        <div className="flex justify-between text-sm pt-2 border-t border-primary-foreground/10">
          <span className="text-primary-foreground/70 font-medium">Fee</span>
          <span className="font-mono font-bold text-white transition-all" key={managementFee}>{formatCurrency(managementFee * days)}</span>
        </div>
      </div>
    </div>
  );
}

function AssumptionsAccordion() {
  return (
    <details className="group [&_summary::-webkit-details-marker]:hidden bg-card border border-card-border rounded-2xl shadow-sm transition-all overflow-hidden">
      <summary className="flex items-center justify-between cursor-pointer font-bold text-sm p-6 hover:bg-input/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
        Calculation Assumptions
        <ChevronDown className="h-4 w-4 text-muted-foreground group-open:rotate-180 transition-transform duration-300" />
      </summary>
      <div className="px-6 pb-6 pt-0 space-y-4 text-xs text-muted-foreground font-medium border-t border-border/40 mt-2">
        <div className="space-y-1">
          <strong className="text-foreground block">Employer NI Calculation</strong>
          <p>Calculated at a flat 15.5% on the consolidated worker pay. (Perm NI informational at 15% over £9,100 threshold).</p>
        </div>
        <div className="space-y-1">
          <strong className="text-foreground block">Monthly Payroll Rules</strong>
          <p>Payday lands on the 28th of each month, moving back to the previous working day if it lands on a weekend or bank holiday. Cut-off is the 20th.</p>
        </div>
        <div className="space-y-1">
          <strong className="text-foreground block">Fortnightly Payroll Rules</strong>
          <p>Runs on a 14-day cycle anchored to 9th January 2026. Cut-off is the Sunday prior to payday.</p>
        </div>
        <div className="space-y-1">
          <strong className="text-foreground block">Subsistence & Travel</strong>
          <p>Subsistence is added directly to the client charge and is always charged at a full day rate, even for half working/travel days.</p>
        </div>
        <div className="space-y-1">
          <strong className="text-foreground block">Exchange Rates</strong>
          <p>Sourced from the European Central Bank (via Frankfurter API). Updated daily around 16:00 CET on working days.</p>
        </div>
      </div>
    </details>
  );
}