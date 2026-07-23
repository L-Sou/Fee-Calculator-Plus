import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import {
  Calculator, RotateCcw, Briefcase, FileText, UtensilsCrossed, PlaneTakeoff, 
  CalendarDays, Globe, RefreshCw, AlertCircle, Copy, Download, Printer, 
  ChevronDown, Check, Info, Ship, Anchor
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Logo from './Logo';

// ─── 1. Utilities & Constants ─────────────────────────────────────────────────

const formatCurrency = (val: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 2 }).format(val);

const formatCurrencyIn = (val: number, currency: string) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency, minimumFractionDigits: 2 }).format(val);

const formatNumber = (val: number) =>
  new Intl.NumberFormat('en-GB', { maximumFractionDigits: 2 }).format(val);

const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF', 'AUD', 'CAD'] as const;
type CurrencyCode = typeof CURRENCIES[number];

const FALLBACK_BANK_HOLIDAYS = new Set([
  '2024-01-01','2024-03-29','2024-04-01','2024-05-06','2024-05-27','2024-08-26','2024-12-25','2024-12-26',
  '2025-01-01','2025-04-18','2025-04-21','2025-05-05','2025-05-26','2025-08-25','2025-12-25','2025-12-26',
  '2026-01-01','2026-04-03','2026-04-06','2026-05-04','2026-05-25','2026-08-31','2026-12-25','2026-12-28'
]);

// ─── 2. Domain Logic & Math ───────────────────────────────────────────────────

function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0); 
}
const isoDate = (d: Date) => d.toISOString().slice(0, 10);
const formatUK = (d: Date) => new Intl.DateTimeFormat('en-GB').format(d);
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);
const isWeekend = (d: Date) => d.getDay() === 0 || d.getDay() === 6;
const sundayBefore = (date: Date) => addDays(date, -(date.getDay() === 0 ? 7 : date.getDay()));

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const FN_ANCHOR = new Date(2026, 0, 9, 12, 0, 0, 0);

interface PayrollSplit {
  periodStart: Date; periodEnd: Date; cutoff: Date; payday: Date; periodLabel: string; days: number;
}

// ─── 3. Custom Hooks ──────────────────────────────────────────────────────────

function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') return initialValue;
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setValue = useCallback((value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      if (typeof window !== 'undefined') window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.warn(`Error setting localStorage key "${key}":`, error);
    }
  }, [key, storedValue]);

  return [storedValue, setValue] as const;
}

function useToast() {
  const [toasts, setToasts] = useState<{ id: number; message: string }[]>([]);
  const showToast = useCallback((message: string) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
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

function useBankHolidays() {
  const [holidays, setHolidays] = useState<Set<string>>(FALLBACK_BANK_HOLIDAYS);
  useEffect(() => {
    fetch('https://www.gov.uk/bank-holidays.json')
      .then(res => res.json())
      .then(data => {
        const ew = data['england-and-wales'].events.map((e: any) => e.date);
        setHolidays(new Set([...FALLBACK_BANK_HOLIDAYS, ...ew]));
      })
      .catch(() => console.warn('Failed to fetch bank holidays, using fallback.'));
  }, []);
  return holidays;
}

// ─── 4. Reusable Sub-components ───────────────────────────────────────────────

const NumInput = ({ value, onChange, prefix, suffix, placeholder = '0.00', 'aria-label': ariaLabel }: any) => (
  <div className="relative group">
    {prefix && <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-mono pointer-events-none transition-colors group-focus-within:text-primary">{prefix}</span>}
    <input
      type="number" value={value} onChange={e => onChange(e.target.value)} aria-label={ariaLabel} placeholder={placeholder}
      className={cn('w-full py-3 bg-input/40 border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all font-mono text-base font-medium',
        prefix ? (prefix.length > 1 ? 'pl-16 pr-4' : 'pl-10 pr-4') : suffix ? 'pl-4 pr-10' : 'px-4')}
    />
    {suffix && <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground font-mono transition-colors group-focus-within:text-primary">{suffix}</span>}
  </div>
);

const SegmentedControl = ({ value, onChange, options, ariaLabel }: { value: string, onChange: (v: any) => void, options: {label: string, value: string}[], ariaLabel: string }) => (
  <div className="flex items-center gap-1 p-1 bg-input/40 border border-input rounded-xl w-full" role="radiogroup" aria-label={ariaLabel}>
    {options.map(opt => (
      <label key={opt.value} className={cn('flex-1 text-center cursor-pointer px-3 py-1.5 rounded-lg text-sm font-bold transition-all focus-within:ring-2 focus-within:ring-primary',
        value === opt.value ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground hover:text-foreground')}
      >
        <input type="radio" className="sr-only" value={opt.value} checked={value === opt.value} onChange={(e) => onChange(e.target.value)} />
        {opt.label}
      </label>
    ))}
  </div>
);

const ActionButton = ({ onClick, icon: Icon, label }: any) => (
  <button onClick={onClick} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary-foreground/10 hover:bg-primary-foreground/20 text-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white" title={label} aria-label={label}>
    <Icon className="h-3.5 w-3.5" /><span className="hidden sm:inline">{label}</span>
  </button>
);

// ─── 5. Main Application Component ────────────────────────────────────────────

export default function CalculatorPage() {
  const { showToast, ToastContainer } = useToast();
  const bankHolidays = useBankHolidays();
  const [mode, setMode] = useState<'contract' | 'perm' | 'paydays'>('contract');

  // Core Contract State
  const [consolidatedRate, setConsolidatedRate] = useState('');
  const [margin, setMargin] = useLocalStorage('calc_margin', '15');
  const [includeNI, setIncludeNI] = useLocalStorage('calc_inc_ni', true);
  const [seafarerExempt, setSeafarerExempt] = useLocalStorage('calc_sea_exempt', false);

  // Maritime Subsistence State
  const [includeSubsistence, setIncludeSubsistence] = useLocalStorage('calc_inc_sub', false);
  const [subsistenceTransit, setSubsistenceTransit] = useLocalStorage('calc_sub_transit', '50');
  const [subsistenceOnboard, setSubsistenceOnboard] = useLocalStorage('calc_sub_onboard', '0');
  const [subsistenceInFee, setSubsistenceInFee] = useLocalStorage('calc_sub_in_fee', true);

  // Hitch & Logistics State
  const [includeTrip, setIncludeTrip] = useLocalStorage('calc_inc_trip', false);
  const [workingDays, setWorkingDays] = useState('28'); // Default Hitch Days
  const [travelDays, setTravelDays] = useState('2');
  const [travelDayFull, setTravelDayFull] = useLocalStorage('calc_travel_full', false);
  const [rotationOffDays, setRotationOffDays] = useState('28');

  // Mob/Demob Costs
  const [mobFlights, setMobFlights] = useState('');
  const [mobVisas, setMobVisas] = useState('');
  const [mobAgent, setMobAgent] = useState('');
  const [logisticsInFee, setLogisticsInFee] = useLocalStorage('calc_logistics_fee', false);

  // Perm State
  const [salary, setSalary] = useState('50000');
  const [placementFee, setPlacementFee] = useLocalStorage('calc_perm_fee', '20');
  const [includePermNI, setIncludePermNI] = useLocalStorage('calc_perm_ni', false);
  const [pCurrency, setPCurrency] = useLocalStorage<CurrencyCode>('calc_currency', 'GBP');
  const [pFxDate, setPFxDate] = useState(() => new Date().toISOString().slice(0, 10));

  // Paydays State
  const [pdPayrollType, setPdPayrollType] = useLocalStorage<'monthly' | 'fortnightly'>('calc_payroll_type', 'monthly');
  const [pdStartDate, setPdStartDate] = useState('');
  const [pdStartMode, setPdStartMode] = useLocalStorage<'half' | 'full' | 'custom'>('calc_pd_start_mode', 'full');
  const [pdStartCustomVal, setPdStartCustomVal] = useState('0.5');
  const [pdFinishDate, setPdFinishDate] = useState('');
  const [pdFinishMode, setPdFinishMode] = useLocalStorage<'half' | 'full' | 'custom'>('calc_pd_finish_mode', 'full');
  const [pdFinishCustomVal, setPdFinishCustomVal] = useState('0.5');
  const [pdIncludeSubsistence, setPdIncludeSubsistence] = useLocalStorage('calc_pd_inc_sub', false);
  const [pdSubsistenceRate, setPdSubsistenceRate] = useLocalStorage('calc_pd_sub_rate', '');

  // FX Rate State
  const [pFxRate, setPFxRate] = useState<number | null>(null);
  const [pFxLoading, setPFxLoading] = useState(false);
  const [pFxError, setPFxError] = useState<string | null>(null);
  const [pFxRefreshKey, setPFxRefreshKey] = useState(0);

  const reset = () => {
    setConsolidatedRate(''); setWorkingDays('28'); setTravelDays('2'); setRotationOffDays('28');
    setMobFlights(''); setMobVisas(''); setMobAgent(''); setSalary('50000');
    setPdStartDate(''); setPdFinishDate('');
    showToast('Session values reset. Settings preserved.');
  };

  // FX Rate Effect
  useEffect(() => {
    if (pCurrency === 'GBP') { setPFxRate(null); setPFxError(null); return; }
    let cancelled = false;
    setPFxLoading(true); setPFxError(null);
    const datePart = pFxDate > new Date().toISOString().slice(0, 10) ? 'latest' : pFxDate;

    fetch(`https://api.frankfurter.dev/v1/${datePart}?base=${pCurrency}&symbols=GBP`)
      .then(res => res.json())
      .then(data => {
        if (!cancelled && data?.rates?.GBP) {
          setPFxRate(data.rates.GBP);
          if (datePart === 'latest' && pFxDate > new Date().toISOString().slice(0, 10)) setPFxError('future-date-fallback');
        }
      })
      .catch(() => { if (!cancelled) setPFxError('Exchange rate service offline.'); })
      .finally(() => { if (!cancelled) setPFxLoading(false); });
    return () => { cancelled = true; };
  }, [pCurrency, pFxDate, pFxRefreshKey]);

  // ─── Memoized Calculations ───

  const contract = useMemo(() => {
    const cRate = parseFloat(consolidatedRate) || 0;
    const cMargin = parseFloat(margin) || 0;
    const cNiMultiplier = (includeNI && !seafarerExempt) ? 0.155 : 0;

    // Subsistence values
    const cSubTransitAmt = includeSubsistence ? (parseFloat(subsistenceTransit) || 0) : 0;
    const cSubOnboardAmt = includeSubsistence ? (parseFloat(subsistenceOnboard) || 0) : 0;

    // Daily Onboard Charge
    const cEmployerNI = cRate * cNiMultiplier;
    const cFeeBase = cRate + cEmployerNI + (subsistenceInFee ? cSubOnboardAmt : 0);
    const cManagementFee = cFeeBase * (cMargin / 100);
    const cTotalCharge = cRate + cEmployerNI + cSubOnboardAmt + cManagementFee;

    // Daily Transit Charge
    const cTravelRate = cRate * (travelDayFull ? 1 : 0.5);
    const cTravelNI = cTravelRate * cNiMultiplier;
    const cTravelFeeBase = cTravelRate + cTravelNI + (subsistenceInFee ? cSubTransitAmt : 0);
    const cTravelManagementFee = cTravelFeeBase * (cMargin / 100);
    const cTravelDayCharge = cTravelRate + cTravelNI + cSubTransitAmt + cTravelManagementFee;

    // Hitch Totals
    const nWorkingDays = Math.max(0, parseInt(workingDays) || 0);
    const nTravelDays = Math.max(0, parseInt(travelDays) || 0);
    const nOffDays = Math.max(0, parseInt(rotationOffDays) || 0);

    // Logistics
    const fFlights = parseFloat(mobFlights) || 0;
    const fVisas = parseFloat(mobVisas) || 0;
    const fAgent = parseFloat(mobAgent) || 0;
    const logisticsBase = fFlights + fVisas + fAgent;
    const logisticsFee = logisticsInFee ? (logisticsBase * (cMargin / 100)) : 0;
    const logisticsTotal = logisticsBase + logisticsFee;

    const tripWorkingTotal = nWorkingDays * cTotalCharge;
    const tripTravelTotal = nTravelDays * cTravelDayCharge;
    const tripGrandTotal = tripWorkingTotal + tripTravelTotal + logisticsTotal;

    // Rotation Projections
    const rotationCycleDays = nWorkingDays + nOffDays;
    const cyclesPerYear = rotationCycleDays > 0 ? 365 / rotationCycleDays : 0;
    const annualDaysOnboard = cyclesPerYear * nWorkingDays;
    const annualDaysTransit = cyclesPerYear * nTravelDays;

    const projAnnualCharge = (annualDaysOnboard * cTotalCharge) + (annualDaysTransit * cTravelDayCharge) + (cyclesPerYear * logisticsTotal);
    const projAnnualFee = (annualDaysOnboard * cManagementFee) + (annualDaysTransit * cTravelManagementFee) + (cyclesPerYear * logisticsFee);

    return {
      cRate, cMargin, cEmployerNI, cTotalCharge, cManagementFee,
      cSubTransitAmt, cSubOnboardAmt,
      cTravelRate, cTravelNI, cTravelManagementFee, cTravelDayCharge,
      nWorkingDays, nTravelDays, nOffDays,
      logisticsBase, logisticsFee, logisticsTotal,
      tripWorkingTotal, tripTravelTotal, tripGrandTotal,
      projAnnualCharge, projAnnualFee, annualDaysOnboard,
      totalBarVal: Math.max(cTotalCharge, 1)
    };
  }, [consolidatedRate, margin, includeNI, seafarerExempt, subsistenceTransit, subsistenceOnboard, includeSubsistence, subsistenceInFee, travelDayFull, workingDays, travelDays, rotationOffDays, mobFlights, mobVisas, mobAgent, logisticsInFee]);

  const perm = useMemo(() => {
    const pSalaryInput = parseFloat(salary) || 0;
    const pFxReady = pCurrency === 'GBP' || pFxRate !== null;
    const pSalary = pCurrency === 'GBP' ? pSalaryInput : (pFxRate !== null ? pSalaryInput * pFxRate : 0);
    const pFeePct = parseFloat(placementFee) || 0;
    const pPlacementFee = pFxReady ? pSalary * (pFeePct / 100) : 0;
    const pEmployerNI = includePermNI ? Math.max(0, (pSalary - 9100) * 0.15) : 0;

    return { pSalaryInput, pFxReady, pSalary, pFeePct, pPlacementFee, pEmployerNI, pTotalCost: pPlacementFee + pEmployerNI };
  }, [salary, placementFee, includePermNI, pCurrency, pFxRate]);

  const paydays = useMemo(() => {
    if (!pdStartDate || !pdFinishDate) return { splits: [], error: null, totalDays: null, totalSub: null };
    const start = parseDate(pdStartDate);
    const finish = parseDate(pdFinishDate);
    if (finish < start) return { splits: [], error: 'Finish date must be on or after start date.', totalDays: null, totalSub: null };

    const startVal = pdStartMode === 'full' ? 1 : pdStartMode === 'half' ? 0.5 : parseFloat(pdStartCustomVal) || 0;
    const finishVal = pdFinishMode === 'full' ? 1 : pdFinishMode === 'half' ? 0.5 : parseFloat(pdFinishCustomVal) || 0;
    const subAmt = pdIncludeSubsistence ? parseFloat(pdSubsistenceRate) || 0 : 0;

    const isWorkingDay = (d: Date) => !isWeekend(d) && !bankHolidays.has(isoDate(d));
    const monthlyPayday = (y: number, m: number) => {
      let d = new Date(y, m, 28, 12, 0, 0, 0);
      while (!isWorkingDay(d)) d = addDays(d, -1);
      return d;
    };

    try {
      const cutoffs: Array<{ payday: Date; cutoff: Date }> = [];
      if (pdPayrollType === 'fortnightly') {
        let idx = Math.floor(Math.round((start.getTime() - FN_ANCHOR.getTime()) / 86400000) / 14);
        while (sundayBefore(addDays(FN_ANCHOR, (idx - 1) * 14)).getTime() >= start.getTime()) idx--;
        while (sundayBefore(addDays(FN_ANCHOR, idx * 14)).getTime() < start.getTime()) idx++;
        for (;;) {
          const payday = addDays(FN_ANCHOR, idx * 14);
          const cutoff = sundayBefore(payday);
          cutoffs.push({ payday, cutoff });
          if (cutoff.getTime() >= finish.getTime()) break;
          idx++;
        }
      } else {
        let year = start.getFullYear(), month = start.getMonth();
        for (let i = 0; i < 25; i++) {
          const cutoff = new Date(year, month, 20, 12, 0, 0, 0);
          if (cutoff.getTime() >= start.getTime()) {
            cutoffs.push({ payday: monthlyPayday(year, month), cutoff });
            if (cutoff.getTime() >= finish.getTime()) break;
          }
          if (++month > 11) { month = 0; year++; }
        }
      }

      const splits: PayrollSplit[] = [];
      let periodStart = start, carryDays = 0, finishReached = false, i = 0;

      while (true) {
        if (i >= cutoffs.length) {
          if (pdPayrollType === 'monthly' && carryDays > 0) {
            const last = cutoffs[cutoffs.length - 1];
            let m = last.payday.getMonth() + 1, y = last.payday.getFullYear();
            if (m > 11) { m = 0; y++; }
            cutoffs.push({ payday: monthlyPayday(y, m), cutoff: new Date(y, m, 20, 12, 0, 0, 0) });
          } else break;
        }

        const { payday, cutoff } = cutoffs[i];
        let rawDays = 0, periodEnd = cutoff;

        if (finishReached) { rawDays = 0; }
        else {
          const isLast = cutoff.getTime() >= finish.getTime();
          periodEnd = isLast ? finish : cutoff;
          const diff = Math.round((periodEnd.getTime() - periodStart.getTime()) / 86400000);
          rawDays = diff === 0 ? (i === 0 ? startVal : isLast ? finishVal : 1) : ((i === 0 ? startVal : 1) + (diff - 1) + (isLast ? finishVal : 1));
          if (isLast) finishReached = true;
        }

        let days = rawDays + carryDays;
        carryDays = pdPayrollType === 'monthly' && days > 31 ? days - 31 : 0;
        if (carryDays > 0) days = 31;

        const periodLabel = pdPayrollType === 'monthly' ? `${MONTH_NAMES[payday.getMonth()]} ${payday.getFullYear()}` : `${formatUK(periodStart)} – ${formatUK(periodEnd)}`;
        splits.push({ periodStart, periodEnd, cutoff, payday, periodLabel, days });

        if (finishReached && carryDays <= 0) break;
        periodStart = addDays(cutoff, 1);
        i++;
      }
      return { 
        splits, 
        error: null, 
        totalDays: splits.reduce((sum, s) => sum + s.days, 0), 
        totalSub: pdIncludeSubsistence ? splits.reduce((sum, s) => sum + s.days * subAmt, 0) : null 
      };
    } catch {
      return { splits: [], error: 'Calculation failed.', totalDays: null, totalSub: null };
    }
  }, [pdStartDate, pdFinishDate, pdPayrollType, pdStartMode, pdStartCustomVal, pdFinishMode, pdFinishCustomVal, pdIncludeSubsistence, pdSubsistenceRate, bankHolidays]);

  // ─── Export Functions ───
  const copyContractBreakdown = () => {
    const text = `Maritime Contract Charge Breakdown (Per Day)
-----------------------------------
Consolidated Rate: ${formatCurrency(contract.cRate)}
${includeNI && !seafarerExempt ? `Employer's NIC: ${formatCurrency(contract.cEmployerNI)}\n` : ''}${seafarerExempt ? `Employer's NIC: Exempt (Seafarer/Non-UKCS)\n` : ''}${includeSubsistence && contract.cSubOnboardAmt > 0 ? `Victualling/Onboard Subsistence: ${formatCurrency(contract.cSubOnboardAmt)}\n` : ''}Management Fee (${contract.cMargin}%): ${formatCurrency(contract.cManagementFee)}
-----------------------------------
Total Charge Rate (Onboard): ${formatCurrency(contract.cTotalCharge)}`;
    navigator.clipboard.writeText(text);
    showToast('Charge breakdown copied');
  };

  const copyTripSummary = () => {
    const text = `Hitch & Crew Change Invoice Summary
-----------------------------------
Hitch Days (${contract.nWorkingDays}): ${formatCurrency(contract.tripWorkingTotal)}
Transit Days (${contract.nTravelDays}): ${formatCurrency(contract.tripTravelTotal)}
${contract.logisticsTotal > 0 ? `Mob/Demob Logistics: ${formatCurrency(contract.logisticsTotal)}\n` : ''}-----------------------------------
Total Hitch Invoice: ${formatCurrency(contract.tripGrandTotal)}`;
    navigator.clipboard.writeText(text);
    showToast('Hitch summary copied');
  };

  const copyPermSummary = () => {
    const text = `Permanent Placement Summary
-----------------------------------
Annual Salary: ${formatCurrencyIn(perm.pSalaryInput, pCurrency)}
${pCurrency !== 'GBP' ? `Converted Salary (GBP): ${formatCurrency(perm.pSalary)} (@ ${pFxRate?.toFixed(4)})\n` : ''}Placement Fee (${perm.pFeePct}%): ${formatCurrency(perm.pPlacementFee)}
${includePermNI ? `Employer's NI: ${formatCurrency(perm.pEmployerNI)}\n` : ''}-----------------------------------
Total ${includePermNI ? 'Cost' : 'Invoice'}: ${formatCurrency(includePermNI ? perm.pTotalCost : perm.pPlacementFee)}`;
    navigator.clipboard.writeText(text);
    showToast('Permanent summary copied');
  };

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-[100dvh] bg-background py-10 px-4 sm:px-6 md:px-8 flex flex-col items-center pb-28 md:pb-10">
      <ToastContainer />
      <div className="w-full max-w-5xl">
        <header className="mb-10 flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <Logo />
            <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">Maritime Fee Calculator</h1>
            <p className="mt-2 text-muted-foreground font-medium">Specialised breakdown for seafarer hitch rotations, logistics, and margins.</p>
          </div>
          <button onClick={reset} className="flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors px-4 py-2 rounded-lg hover:bg-input/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
            <RotateCcw className="h-4 w-4" />Reset Values
          </button>
        </header>

        <Tabs value={mode} onValueChange={(v) => setMode(v as typeof mode)} className="w-full">
          <TabsList className="grid w-full max-w-2xl grid-cols-3 mb-8 bg-input/40 p-1 rounded-xl">
            <TabsTrigger value="contract" className="flex gap-2 text-xs sm:text-sm rounded-lg data-[state=active]:shadow-sm"><Ship className="h-4 w-4" />Contract <span className="hidden sm:inline">& Hitch</span></TabsTrigger>
            <TabsTrigger value="perm" className="flex gap-2 text-xs sm:text-sm rounded-lg data-[state=active]:shadow-sm"><Briefcase className="h-4 w-4" />Permanent</TabsTrigger>
            <TabsTrigger value="paydays" className="flex gap-2 text-xs sm:text-sm rounded-lg data-[state=active]:shadow-sm"><CalendarDays className="h-4 w-4" />Payment Days</TabsTrigger>
          </TabsList>

          {/* ─────────────── MARITIME CONTRACT TAB ─────────────── */}
          <TabsContent value="contract" className="m-0 animate-in fade-in duration-300">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-5 flex flex-col gap-6">

                {/* Core inputs */}
                <div className="bg-card border border-card-border p-7 rounded-2xl shadow-sm space-y-6">
                  <h2 className="text-lg font-bold border-b border-border pb-4">Day Rate & Tax</h2>
                  <div className="space-y-2">
                    <label className="block text-sm font-bold">Consolidated Rate — Seafarer Pay (£/day)</label>
                    <NumInput value={consolidatedRate} onChange={setConsolidatedRate} prefix="£" aria-label="Consolidated Rate" />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-bold">Management Fee (%)</label>
                    <NumInput value={margin} onChange={setMargin} suffix="%" placeholder="0.0" />
                  </div>
                  <div className="pt-4 space-y-4 border-t border-border/60">
                    <div className="flex justify-between group">
                      <div className="space-y-1 pr-4">
                        <label className="text-sm font-bold cursor-pointer group-hover:text-primary transition-colors" onClick={() => setIncludeNI(!includeNI)}>Include Employer's NI</label>
                      </div>
                      <Switch checked={includeNI} onCheckedChange={setIncludeNI} />
                    </div>
                    {includeNI && (
                      <div className="flex justify-between group bg-amber-500/10 p-3 rounded-lg border border-amber-500/20">
                        <div className="space-y-1 pr-4">
                          <label className="text-sm font-bold text-amber-600 dark:text-amber-400 cursor-pointer" onClick={() => setSeafarerExempt(!seafarerExempt)}>Seafarer Exemption</label>
                          <p className="text-xs text-amber-600/80 dark:text-amber-400/80 font-medium">Vessel non-UK flagged / outside UKCS. NI evaluates to £0.</p>
                        </div>
                        <Switch checked={seafarerExempt} onCheckedChange={setSeafarerExempt} className="data-[state=checked]:bg-amber-500" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Split Subsistence */}
                <div className="bg-card border border-card-border p-7 rounded-2xl shadow-sm space-y-5">
                  <div className="flex items-center gap-3 border-b border-border pb-4">
                    <div className="p-2 bg-primary/10 rounded-lg text-primary"><UtensilsCrossed className="h-4 w-4" /></div>
                    <div className="flex-1">
                      <h2 className="text-base font-bold">Subsistence & Victualling</h2>
                    </div>
                    <Switch checked={includeSubsistence} onCheckedChange={(v) => { setIncludeSubsistence(v); if (!v) setSubsistenceInFee(false); }} />
                  </div>
                  <div className={cn('space-y-5 transition-all', !includeSubsistence && 'opacity-40 pointer-events-none h-0 overflow-hidden !my-0')}>
                    <div className="grid grid-cols-2 gap-4 pt-2">
                      <div className="space-y-2">
                        <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wide">Transit (£/day)</label>
                        <NumInput value={subsistenceTransit} onChange={setSubsistenceTransit} prefix="£" />
                      </div>
                      <div className="space-y-2">
                        <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wide">Onboard (£/day)</label>
                        <NumInput value={subsistenceOnboard} onChange={setSubsistenceOnboard} prefix="£" />
                      </div>
                    </div>
                    <div className="flex justify-between group">
                      <div className="space-y-1 pr-4">
                        <label className="text-sm font-bold cursor-pointer group-hover:text-primary transition-colors" onClick={() => includeSubsistence && setSubsistenceInFee(!subsistenceInFee)}>Apply margin to subsistence</label>
                      </div>
                      <Switch checked={subsistenceInFee} onCheckedChange={setSubsistenceInFee} disabled={!includeSubsistence} />
                    </div>
                  </div>
                </div>

                {/* Hitch Calculator */}
                <div className="bg-card border border-card-border p-7 rounded-2xl shadow-sm space-y-5">
                  <div className="flex items-center gap-3 border-b border-border pb-4">
                    <div className="p-2 bg-primary/10 rounded-lg text-primary"><Anchor className="h-4 w-4" /></div>
                    <div className="flex-1">
                      <h2 className="text-base font-bold">Hitch & Mob/Demob Scheduler</h2>
                    </div>
                    <Switch checked={includeTrip} onCheckedChange={setIncludeTrip} />
                  </div>

                  <div className={cn('space-y-5 transition-all duration-300', !includeTrip && 'opacity-40 pointer-events-none scale-[0.98] h-0 overflow-hidden !my-0')}>
                    <div className="grid grid-cols-2 gap-4 pt-2">
                      <div className="space-y-2">
                        <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wide">Days Onboard</label>
                        <NumInput value={workingDays} onChange={setWorkingDays} placeholder="28" />
                      </div>
                      <div className="space-y-2">
                        <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wide">Leave Days</label>
                        <NumInput value={rotationOffDays} onChange={setRotationOffDays} placeholder="28" />
                      </div>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-border/50">
                      <label className="block text-sm font-bold">Transit / Travel Days</label>
                      <div className="grid grid-cols-2 gap-4">
                        <NumInput value={travelDays} onChange={setTravelDays} placeholder="2" />
                        <SegmentedControl 
                          value={travelDayFull ? 'full' : 'half'} 
                          onChange={(v) => setTravelDayFull(v === 'full')} 
                          options={[{label: '0.5 rate', value: 'half'}, {label: 'Full rate', value: 'full'}]} 
                          ariaLabel="Travel Day Rate"
                        />
                      </div>
                    </div>

                    <div className="space-y-3 pt-4 border-t border-border/50">
                      <div className="flex items-center justify-between">
                        <label className="block text-sm font-bold">Logistics Costs (Mob/Demob)</label>
                        <div className="flex items-center gap-2">
                          <label className="text-xs font-bold text-muted-foreground cursor-pointer" onClick={() => setLogisticsInFee(!logisticsInFee)}>Add Margin</label>
                          <Switch checked={logisticsInFee} onCheckedChange={setLogisticsInFee} className="scale-75 origin-right" />
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <NumInput value={mobFlights} onChange={setMobFlights} placeholder="Flights" prefix="£" />
                        <NumInput value={mobVisas} onChange={setMobVisas} placeholder="Visas" prefix="£" />
                        <NumInput value={mobAgent} onChange={setMobAgent} placeholder="Agent" prefix="£" />
                      </div>
                    </div>
                  </div>
                </div>

                <AssumptionsAccordion maritime={true} />
              </div>

              {/* Right panel */}
              <div className="lg:col-span-7 bg-primary text-primary-foreground rounded-2xl shadow-xl overflow-hidden flex flex-col relative transition-all duration-500">
                {contract.cRate === 0 && !consolidatedRate ? (
                  <div className="absolute inset-0 z-10 bg-primary/95 flex flex-col items-center justify-center text-center p-10 animate-in fade-in duration-500">
                    <div className="p-4 bg-primary-foreground/10 rounded-full mb-4">
                      <Ship className="h-8 w-8 text-primary-foreground/60" />
                    </div>
                    <h3 className="text-xl font-bold mb-2">Awaiting Parameters</h3>
                    <p className="text-primary-foreground/70 font-medium max-w-sm">
                      Enter a consolidated day rate and management fee to generate the maritime charge breakdown.
                    </p>
                  </div>
                ) : null}

                <div className="p-8 md:p-10 flex-grow relative">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                    <h2 className="text-xl font-bold">Charge Rate Breakdown</h2>
                    <div className="flex items-center gap-3">
                      <ActionButton onClick={copyContractBreakdown} icon={Copy} label="Copy" />
                      <span className="text-xs uppercase tracking-widest font-bold px-3 py-1.5 bg-primary-foreground/10 rounded-full">Per Day Onboard</span>
                    </div>
                  </div>

                  <div className="w-full h-3 bg-primary-foreground/10 rounded-full mb-6 overflow-hidden flex transition-all">
                    <div className="bg-white h-full transition-all duration-500" style={{ width: `${(contract.cRate / contract.totalBarVal) * 100}%` }} title="Worker Pay" />
                    <div className="bg-white/70 h-full transition-all duration-500 border-l border-primary/20" style={{ width: `${(contract.cEmployerNI / contract.totalBarVal) * 100}%` }} title="Employer NI" />
                    <div className="bg-white/40 h-full transition-all duration-500 border-l border-primary/20" style={{ width: `${(contract.cSubOnboardAmt / contract.totalBarVal) * 100}%` }} title="Subsistence" />
                    <div className="bg-white/20 h-full transition-all duration-500 border-l border-primary/20" style={{ width: `${(contract.cManagementFee / contract.totalBarVal) * 100}%` }} title="Management Fee" />
                  </div>

                  <div className="space-y-3 relative z-0">
                    <LineItem label="Consolidated Day Rate" value={contract.cRate} isBold />
                    {includeNI && (
                      <LineItem 
                        label={seafarerExempt ? "Employers NIC (Exempt)" : "Employers NIC (15.5%)"} 
                        value={contract.cEmployerNI} 
                      />
                    )}
                    {includeSubsistence && contract.cSubOnboardAmt > 0 && <LineItem label="Onboard Victualling/Sub" value={contract.cSubOnboardAmt} />}
                    <LineItem label={`Management Fee (${contract.cMargin > 0 ? `${contract.cMargin}%` : '—'})`} value={contract.cManagementFee} />

                    {contract.cMargin > 0 && contract.cTotalCharge > 0 && (
                      <div className="text-xs text-primary-foreground/60 font-medium bg-primary-foreground/5 p-2.5 rounded-lg mt-1 inline-flex items-center gap-2">
                        <Info className="h-3.5 w-3.5 shrink-0" />
                        Fee = {contract.cMargin}% × ({formatCurrency(contract.cRate)} 
                        {includeNI && !seafarerExempt ? ` + ${formatCurrency(contract.cEmployerNI)} NI` : ''} 
                        {subsistenceInFee && contract.cSubOnboardAmt > 0 ? ` + ${formatCurrency(contract.cSubOnboardAmt)} Sub` : ''})
                      </div>
                    )}

                    <div className="mt-4 pt-5 border-t-2 border-primary-foreground/30 transition-all">
                      <div className="flex items-center justify-between">
                        <span className="text-lg font-bold">Total Charge (Onboard)</span>
                        <span className="text-3xl font-mono font-bold tracking-tight text-chart-1 transition-all duration-300" key={contract.cTotalCharge}>{formatCurrency(contract.cTotalCharge)}</span>
                      </div>
                    </div>
                  </div>

                  {includeTrip && (
                    <div className="mt-8 pt-6 border-t border-primary-foreground/20 animate-in fade-in slide-in-from-top-4 duration-300">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-bold uppercase tracking-widest text-primary-foreground/60">Transit Day Rate</h3>
                        <span className="text-xs font-bold px-2.5 py-1 bg-primary-foreground/10 rounded-full">{travelDayFull ? 'Full' : '0.5'} day</span>
                      </div>
                      <div className="space-y-2.5">
                        <LineItem label={`Consolidated Rate (×${travelDayFull ? '1' : '0.5'})`} value={contract.cTravelRate} />
                        {includeNI && !seafarerExempt && <LineItem label="Employers NIC on travel rate" value={contract.cTravelNI} />}
                        {includeSubsistence && contract.cSubTransitAmt > 0 && <LineItem label="Transit Subsistence (full)" value={contract.cSubTransitAmt} />}
                        <LineItem label={`Management Fee (${contract.cMargin > 0 ? `${contract.cMargin}%` : '—'})`} value={contract.cTravelManagementFee} />
                        <div className="pt-3 border-t border-primary-foreground/20 flex items-center justify-between">
                          <span className="text-sm font-bold">Transit Day Total</span>
                          <span className="font-mono font-bold text-base text-chart-1 transition-all" key={contract.cTravelDayCharge}>{formatCurrency(contract.cTravelDayCharge)}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="bg-primary-foreground/5 p-8 md:p-10 border-t border-primary-foreground/10 relative z-0">
                  {includeTrip ? (
                    <div className="animate-in fade-in duration-300">
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-primary-foreground/60">Hitch Crew-Change Invoice</h3>
                        <ActionButton onClick={copyTripSummary} icon={Copy} label="Copy" />
                      </div>
                      <div className="space-y-4">
                        <div className="bg-primary-foreground/5 p-4 rounded-xl space-y-2 hover:bg-primary-foreground/10 transition-colors">
                          <div className="flex items-center justify-between text-sm font-bold text-primary-foreground/80">
                            <span>Days Onboard</span>
                            <span className="text-primary-foreground/50 font-medium">{contract.nWorkingDays} × {formatCurrency(contract.cTotalCharge)}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-primary-foreground/50 font-medium">Standard hitch rate</span>
                            <span className="font-mono font-bold transition-all" key={contract.tripWorkingTotal}>{formatCurrency(contract.tripWorkingTotal)}</span>
                          </div>
                        </div>
                        <div className="bg-primary-foreground/5 p-4 rounded-xl space-y-2 hover:bg-primary-foreground/10 transition-colors">
                          <div className="flex items-center justify-between text-sm font-bold text-primary-foreground/80">
                            <span>Transit Days</span>
                            <span className="text-primary-foreground/50 font-medium">{contract.nTravelDays} × {formatCurrency(contract.cTravelDayCharge)}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-primary-foreground/50 font-medium">{travelDayFull ? 'Full' : '0.5'} rate + transit sub</span>
                            <span className="font-mono font-bold transition-all" key={contract.tripTravelTotal}>{formatCurrency(contract.tripTravelTotal)}</span>
                          </div>
                        </div>
                        {contract.logisticsTotal > 0 && (
                          <div className="bg-primary-foreground/5 p-4 rounded-xl flex flex-col gap-2 hover:bg-primary-foreground/10 transition-colors">
                            <div className="flex items-center justify-between text-sm font-bold text-primary-foreground/80">
                              <span>Mob/Demob Logistics</span>
                              <span className="font-mono font-bold transition-all" key={contract.logisticsTotal}>{formatCurrency(contract.logisticsTotal)}</span>
                            </div>
                            <span className="text-xs text-primary-foreground/50 font-medium">
                              Flights: £{mobFlights || '0'} | Visas: £{mobVisas || '0'} | Agent: £{mobAgent || '0'} 
                              {logisticsInFee && ` | Fee: ${formatCurrency(contract.logisticsFee)}`}
                            </span>
                          </div>
                        )}
                        <div className="pt-2 border-t-2 border-primary-foreground/30 flex items-center justify-between">
                          <div>
                            <span className="text-lg font-bold block">Total Hitch Invoice</span>
                            <span className="text-xs text-primary-foreground/50 font-medium">{contract.nWorkingDays + contract.nTravelDays} days total</span>
                          </div>
                          <span className="text-3xl font-mono font-bold tracking-tight text-chart-1 transition-all duration-300" key={contract.tripGrandTotal}>{formatCurrency(contract.tripGrandTotal)}</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="animate-in fade-in duration-300">
                      <h3 className="text-xs font-bold uppercase tracking-widest text-primary-foreground/60 mb-6">Standard Revenue Projections</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <ProjectionCard label="Weekly" days={5} charge={contract.cTotalCharge} fee={contract.cManagementFee} />
                        <ProjectionCard label="Monthly" days={21} charge={contract.cTotalCharge} fee={contract.cManagementFee} />
                        <ProjectionCard label="Annual" days={230} charge={contract.cTotalCharge} fee={contract.cManagementFee} />
                      </div>
                      <p className="text-xs text-primary-foreground/40 mt-4 text-center">Enable the Hitch Scheduler to see rotation-specific annual projections.</p>
                    </div>
                  )}

                  {includeTrip && contract.nOffDays > 0 && (
                    <div className="mt-6 pt-6 border-t border-primary-foreground/10">
                      <h3 className="text-xs font-bold uppercase tracking-widest text-primary-foreground/60 mb-4">Annual Rotation Projection ({contract.nWorkingDays} On / {contract.nOffDays} Off)</h3>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-primary-foreground/70">Projected Days Onboard / Yr</span>
                        <span className="font-mono font-bold text-white">{contract.annualDaysOnboard.toFixed(1)} days</span>
                      </div>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-primary-foreground/70">Projected Annual Revenue</span>
                        <span className="font-mono font-bold text-chart-1">{formatCurrency(contract.projAnnualCharge)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-primary-foreground/70">Projected Annual Gross Margin</span>
                        <span className="font-mono font-bold text-white">{formatCurrency(contract.projAnnualFee)}</span>
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
                    <div className="space-y-2">
                      <label className="block text-sm font-bold text-foreground">Salary Currency</label>
                      <SegmentedControl 
                        value={pCurrency} 
                        onChange={setPCurrency} 
                        options={CURRENCIES.map(c => ({label: c, value: c}))} 
                        ariaLabel="Salary Currency"
                      />
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
                          <button onClick={() => setPFxRefreshKey(k => k + 1)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-input/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                            <RefreshCw className={cn('h-3.5 w-3.5', pFxLoading && 'animate-spin')} />
                          </button>
                        </div>
                        {pFxError === 'future-date-fallback' && (
                          <div className="flex items-start gap-2 text-xs text-amber-500/90 font-medium">
                            <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                            <span>Future date selected. Showing today's latest rate instead.</span>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="space-y-2">
                      <label className="block text-sm font-bold text-foreground">Placement Fee (%)</label>
                      <NumInput value={placementFee} onChange={setPlacementFee} suffix="%" placeholder="0.0" />
                    </div>
                    <div className="pt-4 flex justify-between border-t border-border/60 group">
                      <div className="space-y-1 pr-4">
                        <label className="text-sm font-bold text-foreground cursor-pointer group-hover:text-primary transition-colors" onClick={() => setIncludePermNI(!includePermNI)}>Include Employer's NI</label>
                        <p className="text-xs text-muted-foreground font-medium">Informational only. (15% over £9,100)</p>
                      </div>
                      <Switch checked={includePermNI} onCheckedChange={setIncludePermNI} />
                    </div>
                  </div>
                </div>
                <AssumptionsAccordion />
              </div>

              <div className="lg:col-span-7 bg-primary text-primary-foreground rounded-2xl shadow-xl overflow-hidden flex flex-col relative">
                {perm.pSalaryInput === 0 && !salary ? (
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
                    <LineItem label={`Annual Salary (${pCurrency})`} value={perm.pSalaryInput} currency={pCurrency} />
                    {pCurrency !== 'GBP' && (
                      <LineItem
                        label={pFxRate !== null ? `Converted @ 1 ${pCurrency} = ${pFxRate.toFixed(4)} GBP` : 'Converted (awaiting rate…)'}
                        value={perm.pSalary}
                      />
                    )}
                    {!perm.pFxReady ? (
                      <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 text-sm font-semibold text-amber-300">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        Waiting on exchange rate...
                      </div>
                    ) : (
                      <>
                        <LineItem label={`Placement Fee (${perm.pFeePct.toFixed(1)}%)`} value={perm.pPlacementFee} isBold />
                        <div className="text-xs text-primary-foreground/60 font-medium bg-primary-foreground/5 p-2.5 rounded-lg inline-flex items-center gap-2">
                          <Info className="h-3.5 w-3.5 shrink-0" />
                          Fee = {perm.pFeePct}% × {formatCurrency(perm.pSalary)}
                        </div>
                      </>
                    )}
                    {includePermNI && perm.pFxReady && (<><div className="h-px bg-primary-foreground/20 my-4" /><LineItem label="Employer's NI on Salary" value={perm.pEmployerNI} /></>)}

                    <div className="mt-4 pt-5 border-t-2 border-primary-foreground/30">
                      <div className="flex items-center justify-between">
                        <span className="text-lg font-bold">Total Invoice to Client</span>
                        <span className="text-3xl font-mono font-bold tracking-tight text-chart-1 transition-all duration-300" key={perm.pPlacementFee}>{formatCurrency(perm.pPlacementFee)}</span>
                      </div>
                      <p className="text-xs text-primary-foreground/50 font-medium mt-1">Invoiced in GBP regardless of salary currency.</p>
                    </div>
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

                  <div className="space-y-2">
                    <label className="block text-sm font-bold">Payroll Type</label>
                    <SegmentedControl 
                      value={pdPayrollType} 
                      onChange={setPdPayrollType} 
                      options={[{label: 'Monthly', value: 'monthly'}, {label: 'Fortnightly', value: 'fortnightly'}]} 
                      ariaLabel="Payroll Type"
                    />
                  </div>

                  <div className="space-y-3">
                    <label className="block text-sm font-bold">Start Date</label>
                    <input type="date" value={pdStartDate} onChange={e => setPdStartDate(e.target.value)} className="w-full px-4 py-3 bg-input/40 border border-input rounded-xl font-medium" />
                    <SegmentedControl value={pdStartMode} onChange={setPdStartMode} options={[{label: '0.5 rate', value: 'half'}, {label: 'Full', value: 'full'}, {label: 'Custom', value: 'custom'}]} ariaLabel="Start Mode" />
                    {pdStartMode === 'custom' && <NumInput value={pdStartCustomVal} onChange={setPdStartCustomVal} placeholder="0.5" suffix="days" />}
                  </div>

                  <div className="space-y-3 pt-4 border-t border-border/60">
                    <label className="block text-sm font-bold">Finish Date</label>
                    <input type="date" value={pdFinishDate} onChange={e => setPdFinishDate(e.target.value)} className="w-full px-4 py-3 bg-input/40 border border-input rounded-xl font-medium" />
                    <SegmentedControl value={pdFinishMode} onChange={setPdFinishMode} options={[{label: '0.5 rate', value: 'half'}, {label: 'Full', value: 'full'}, {label: 'Custom', value: 'custom'}]} ariaLabel="Finish Mode" />
                    {pdFinishMode === 'custom' && <NumInput value={pdFinishCustomVal} onChange={setPdFinishCustomVal} placeholder="0.5" suffix="days" />}
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
                  </div>

                  {!pdStartDate || !pdFinishDate ? (
                    <div className="absolute inset-0 z-10 bg-primary/95 flex flex-col items-center justify-center text-center p-10 animate-in fade-in duration-500 print:hidden">
                      <div className="p-4 bg-primary-foreground/10 rounded-full mb-4">
                        <CalendarDays className="h-8 w-8 text-primary-foreground/60" />
                      </div>
                      <h3 className="text-xl font-bold mb-2">Select Dates</h3>
                      <p className="text-primary-foreground/70 font-medium max-w-sm">
                        Choose a start and finish date to automatically generate the payment schedule.
                      </p>
                    </div>
                  ) : paydays.error ? (
                    <div className="flex items-center gap-3 bg-red-500/20 border border-red-500/30 rounded-xl p-4 animate-in fade-in">
                      <span className="text-sm font-semibold text-red-300">{paydays.error}</span>
                    </div>
                  ) : (
                    <div className="space-y-5 animate-in fade-in duration-500">
                      <div className="bg-primary-foreground/10 rounded-2xl p-6 text-center print:bg-gray-100">
                        <p className="text-sm font-bold uppercase tracking-widest text-primary-foreground/60 mb-1 print:text-gray-600">Total Payable Days</p>
                        <p className="text-6xl font-mono font-bold text-chart-1 transition-all" key={paydays.totalDays}>{paydays.totalDays}</p>
                        {pdStartDate === pdFinishDate ? (
                          <p className="text-xs text-primary-foreground/50 font-medium mt-2 print:text-gray-500">
                            Single day
                          </p>
                        ) : (
                          <p className="text-xs text-primary-foreground/50 font-medium mt-2 print:text-gray-500">
                            {formatUK(parseDate(pdStartDate))} → {formatUK(parseDate(pdFinishDate))}
                          </p>
                        )}
                      </div>

                      <div className="space-y-3">
                        <p className="text-xs font-bold uppercase tracking-widest text-primary-foreground/50 px-1 print:text-gray-600">
                          Payment Schedule
                        </p>
                        {paydays.splits.map((split, idx) => (
                          <div key={idx} className="bg-primary-foreground/10 rounded-xl overflow-hidden hover:bg-primary-foreground/20 transition-colors print:border print:border-gray-300 print:bg-white print:text-black">
                            <div className="flex items-center justify-between px-4 py-3 border-b border-primary-foreground/10 print:border-gray-200">
                              <span className="text-sm font-bold text-white print:text-black">
                                {pdPayrollType === 'fortnightly' ? split.periodLabel : `${formatUK(split.periodStart)} – ${formatUK(split.periodEnd)}`}
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
            {mode === 'contract' ? (includeTrip ? 'Total Hitch' : 'Charge Rate') : mode === 'perm' ? 'Placement Fee' : 'Total Days'}
          </div>
          <div className="text-xl font-mono font-bold text-chart-1 transition-all" key={mode}>
            {mode === 'contract' ? (includeTrip ? formatCurrency(contract.tripGrandTotal) : formatCurrency(contract.cTotalCharge)) 
              : mode === 'perm' ? formatCurrency(perm.pPlacementFee) 
              : (paydays.totalDays ?? 0)}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function LineItem({ label, value, isBold = false, currency = 'GBP' }: any) {
  return (
    <div className={cn('flex items-center justify-between py-1 group', isBold ? 'text-white font-bold' : 'text-primary-foreground/80 hover:text-white transition-colors')}>
      <span className="text-sm font-medium">{label}</span>
      <span className={cn('font-mono tracking-tight transition-all', isBold ? 'text-base font-bold' : 'text-sm font-semibold')}>
        {formatCurrencyIn(value, currency)}
      </span>
    </div>
  );
}

function ProjectionCard({ label, days, charge, fee }: { label: string; days: number; charge: number; fee: number }) {
  return (
    <div className="bg-primary-foreground/5 p-5 rounded-xl hover:bg-primary-foreground/10 transition-colors">
      <div className="text-sm font-bold text-white mb-4 flex items-center justify-between border-b border-primary-foreground/10 pb-2">
        {label}
        <span className="text-xs font-medium text-primary-foreground/60 bg-primary-foreground/10 px-2 py-0.5 rounded-md">{days} Days</span>
      </div>
      <div className="space-y-2.5">
        <div className="flex justify-between text-sm">
          <span className="text-primary-foreground/70 font-medium">Charge</span>
          <span className="font-mono font-bold text-chart-1 transition-all">{formatCurrency(charge * days)}</span>
        </div>
        <div className="flex justify-between text-sm pt-2 border-t border-primary-foreground/10">
          <span className="text-primary-foreground/70 font-medium">Fee Margin</span>
          <span className="font-mono font-bold text-white transition-all">{formatCurrency(fee * days)}</span>
        </div>
      </div>
    </div>
  );
}

function AssumptionsAccordion({ maritime = false }: { maritime?: boolean }) {
  return (
    <details className="group [&_summary::-webkit-details-marker]:hidden bg-card border border-card-border rounded-2xl shadow-sm transition-all overflow-hidden">
      <summary className="flex items-center justify-between cursor-pointer font-bold text-sm p-6 hover:bg-input/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
        Calculation Assumptions
        <ChevronDown className="h-4 w-4 text-muted-foreground group-open:rotate-180 transition-transform duration-300" />
      </summary>
      <div className="px-6 pb-6 pt-0 space-y-4 text-xs text-muted-foreground font-medium border-t border-border/40 mt-2">
        {maritime ? (
          <>
            <div className="space-y-1">
              <strong className="text-foreground block">Seafarer NI Exemption</strong>
              <p>Standard NI is calculated at 15.5%. When "Seafarer Exemption" is toggled, Employer NI evaluates to 0, assuming the vessel operates fully outside the UK Continental Shelf (UKCS) or is a non-UK flagged vessel avoiding UK NIC obligations.</p>
            </div>
            <div className="space-y-1">
              <strong className="text-foreground block">Subsistence Rules (Transit vs Victualling)</strong>
              <p>Transit subsistence is only applied to travel days. Onboard subsistence (victualling) is applied to working days. In maritime, onboard subsistence is typically £0 as room and board are provided by the vessel.</p>
            </div>
            <div className="space-y-1">
              <strong className="text-foreground block">Rotation Projections</strong>
              <p>Annual projections are calculated by taking 365 days, dividing by the total hitch cycle (Days On + Leave Days), and multiplying the cycles by the respective charges.</p>
            </div>
          </>
        ) : (
          <div className="space-y-1">
            <strong className="text-foreground block">Employer NI Calculation</strong>
            <p>Perm NI informational calculation assumes 15% over the £9,100 secondary threshold.</p>
          </div>
        )}
        <div className="space-y-1">
          <strong className="text-foreground block">Payroll Cut-offs</strong>
          <p>Monthly payday lands on the 28th, moving backward to the previous working day if falling on a weekend/bank holiday. Fortnightly runs on a fixed 14-day cycle from 09/01/2026.</p>
        </div>
      </div>
    </details>
  );
}