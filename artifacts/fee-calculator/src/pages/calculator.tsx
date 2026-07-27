import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import {
  Calculator, RotateCcw, Briefcase, FileText, UtensilsCrossed, PlaneTakeoff, 
  CalendarDays, Globe, RefreshCw, AlertCircle, Copy, Download, Printer, 
  ChevronDown, Check, Info, Ship, Anchor, Save
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Logo from './Logo';

// ─── 1. Utilities & Constants ─────────────────────────────────────────────────

const currencyFormatters = new Map<string, Intl.NumberFormat>();
const formatCurrencyIn = (val: number, currency: string) => {
  let fmt = currencyFormatters.get(currency);
  if (!fmt) {
    fmt = new Intl.NumberFormat('en-GB', { style: 'currency', currency, minimumFractionDigits: 2 });
    currencyFormatters.set(currency, fmt);
  }
  return fmt.format(val);
};

const numberFormatter = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 2 });
const formatNumber = (val: number) => numberFormatter.format(val);

const ukDateFormatter = new Intl.DateTimeFormat('en-GB');
const formatUK = (d: Date) => ukDateFormatter.format(d);

const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF', 'AUD', 'CAD'] as const;
type CurrencyCode = typeof CURRENCIES[number];

const curSym = (c: CurrencyCode) => ({ GBP: '£', EUR: '€', USD: '$', CHF: 'CHF', AUD: 'A$', CAD: 'C$' }[c] || '£');

const FISCAL_PROFILES = {
  '2024/2025': { pension: 0.04, apprenticeshipLevy: 0.005, employerNI: 0.138, permNI: 0.138, permNIThreshold: 9100 },
  '2025/2026': { pension: 0.04, apprenticeshipLevy: 0.005, employerNI: 0.155, permNI: 0.15, permNIThreshold: 9100 },
};
type TaxProfile = keyof typeof FISCAL_PROFILES;

const FALLBACK_BANK_HOLIDAYS = new Set([
  '2024-01-01','2024-03-29','2024-04-01','2024-05-06','2024-05-27','2024-08-26','2024-12-25','2024-12-26',
  '2025-01-01','2025-04-18','2025-04-21','2025-05-05','2025-05-26','2025-08-25','2025-12-25','2025-12-26',
  '2026-01-01','2026-04-03','2026-04-06','2026-05-04','2026-05-25','2026-08-31','2026-12-25','2026-12-28'
]);

function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0); 
}
const isoDate = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);
const isWeekend = (d: Date) => d.getDay() === 0 || d.getDay() === 6;
const sundayBefore = (date: Date) => addDays(date, -(date.getDay() === 0 ? 7 : date.getDay()));

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const FN_ANCHOR = new Date(2026, 0, 9, 12, 0, 0, 0);

// Modernized Clipboard API
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

// ─── 2. Pure Mathematical Calculation Engines ──────────────────────────────────

function calculateContract(params: any, fiscalRates: any) {
  const cRate = parseFloat(params.dbConsolidatedRate) || 0;
  const cMarginVal = parseFloat(params.dbMargin) || 0;
  const cTravelFeeVal = parseFloat(params.dbTravelFee) || 0;
  const cContingencyInputVal = parseFloat(params.dbContingencyValue) || 0;

  const cPension = params.includePension ? cRate * fiscalRates.pension : 0;
  const cAppyLevy = params.includeAppyLevy ? cRate * fiscalRates.apprenticeshipLevy : 0;
  const cContingency = params.includeContingency 
    ? (params.contingencyType === 'percentage' ? cRate * (cContingencyInputVal / 100) : cContingencyInputVal) 
    : 0;

  const cTotalAdditions = cPension + cAppyLevy + cContingency;
  const cSubTravelAmt = params.includeSubsistence ? (parseFloat(params.dbSubTravel) || 0) : 0;
  const cSubOnboardAmt = params.includeSubsistence ? (parseFloat(params.dbSubOnboard) || 0) : 0;

  const cNiMultiplier = (params.includeNI && !params.seafarerExempt) ? fiscalRates.employerNI : 0;
  const niBaseAmount = params.niMode === 'total' ? (cRate + cTotalAdditions) : cRate;
  const cEmployerNI = niBaseAmount * cNiMultiplier;

  const cFeeBase = cRate + cTotalAdditions + cEmployerNI + (params.subsistenceInFee ? cSubOnboardAmt : 0);
  const cManagementFee = params.feeType === 'percentage' ? cFeeBase * (cMarginVal / 100) : cMarginVal;

  const cTotalCharge = cRate + cTotalAdditions + cEmployerNI + cSubOnboardAmt + cManagementFee;

  const nWorkingDays = Math.max(0, parseFloat(params.dbWorkingDays) || 0);
  const nTravelDays = Math.max(0, parseFloat(params.dbTravelDays) || 0);

  const travelRateMultiplier = params.travelDayFull ? 1 : 0.5;
  const travelPayableDays = nTravelDays * travelRateMultiplier; 
  const travelSubDays = Math.ceil(nTravelDays); 

  const cTravelRate = cRate * travelRateMultiplier;
  const cTravelPension = params.includePension ? cTravelRate * fiscalRates.pension : 0;
  const cTravelAppyLevy = params.includeAppyLevy ? cTravelRate * fiscalRates.apprenticeshipLevy : 0;
  const cTravelContingency = params.includeContingency 
    ? (params.contingencyType === 'percentage' ? cTravelRate * (cContingencyInputVal / 100) : cContingencyInputVal * travelRateMultiplier) 
    : 0;

  const cTravelTotalAdditions = cTravelPension + cTravelAppyLevy + cTravelContingency;
  const travelNIBaseAmount = params.niMode === 'total' ? (cTravelRate + cTravelTotalAdditions) : cTravelRate;
  const cTravelNI = travelNIBaseAmount * cNiMultiplier;

  const cTravelFeeBaseRef = cTravelRate + cTravelTotalAdditions + cTravelNI + (params.subsistenceInFee ? cSubTravelAmt : 0);
  const cTravelManagementFee = params.feeType === 'percentage' ? cTravelFeeBaseRef * (cMarginVal / 100) : cMarginVal;
  const cTravelDayCharge = cTravelRate + cTravelTotalAdditions + cTravelNI + cSubTravelAmt + cTravelManagementFee;

  const totalTravelPay = travelPayableDays * cRate;
  const totalTravelAdditions = travelPayableDays * cTotalAdditions;
  const totalTravelNIBase = params.niMode === 'total' ? (totalTravelPay + totalTravelAdditions) : totalTravelPay;
  const totalTravelNI = totalTravelNIBase * cNiMultiplier;
  const totalTravelSub = travelSubDays * cSubTravelAmt;

  const totalTravelFeeBase = totalTravelPay + totalTravelAdditions + totalTravelNI + (params.subsistenceInFee ? totalTravelSub : 0);
  const totalTravelManagementFee = params.feeType === 'percentage' 
    ? totalTravelFeeBase * (cMarginVal / 100) 
    : cMarginVal * travelSubDays;

  const tripTravelTotal = totalTravelPay + totalTravelAdditions + totalTravelNI + totalTravelSub + totalTravelManagementFee;

  const fTravel = parseFloat(params.dbMobTravel) || 0;
  const fVisas = parseFloat(params.dbMobVisas) || 0;
  const fAgent = parseFloat(params.dbMobAgent) || 0;
  const logisticsBase = fTravel + fVisas + fAgent;

  const logisticsFee = params.logisticsInFee 
    ? (params.travelFeeType === 'percentage' ? logisticsBase * (cTravelFeeVal / 100) : cTravelFeeVal) 
    : 0;
  const logisticsTotal = logisticsBase + logisticsFee;

  const tripWorkingTotal = nWorkingDays * cTotalCharge;
  const tripGrandTotal = tripWorkingTotal + tripTravelTotal + logisticsTotal;

  return {
    cRate, cMarginVal, feeType: params.feeType, cEmployerNI, cTotalCharge, cManagementFee,
    cPension, cAppyLevy, cContingency, cTotalAdditions,
    cSubTravelAmt, cSubOnboardAmt,
    cTravelRate, cTravelNI, cTravelFeeVal, travelFeeType: params.travelFeeType, cTravelManagementFee, cTravelDayCharge,
    cTravelContingency, // <-- Added this line here
    nWorkingDays, nTravelDays, travelPayableDays, travelSubDays,
    logisticsBase, logisticsFee, logisticsTotal,
    tripWorkingTotal, tripTravelTotal, tripGrandTotal,
    totalBarVal: Math.max(cTotalCharge, 1)
  };
}

function calculatePerm(params: any, fiscalRates: any, fxRate: number | null) {
  const pSalaryInput = parseFloat(params.dbSalary) || 0;
  const pFxReady = params.pCurrency === 'GBP' || fxRate !== null;
  const pSalary = params.pCurrency === 'GBP' ? pSalaryInput : (fxRate !== null ? pSalaryInput * fxRate : 0);
  const pFeePct = parseFloat(params.dbPlacementFee) || 0;

  // Feature: Invoice in Origin Currency
  const pPlacementFee = params.invoiceInOrigin 
    ? pSalaryInput * (pFeePct / 100) 
    : (pFxReady ? pSalary * (pFeePct / 100) : 0);

  // NI is always a UK tax on the GBP equivalent salary
  const pEmployerNI = params.includePermNI ? Math.max(0, (pSalary - fiscalRates.permNIThreshold) * fiscalRates.permNI) : 0;

  return { pSalaryInput, pFxReady, pSalary, pFeePct, pPlacementFee, pEmployerNI, pTotalCost: pPlacementFee + (params.invoiceInOrigin ? 0 : pEmployerNI) };
}

function calculateRawPaydays(params: any, bankHolidays: Set<string>) {
  if (!params.pdStartDate || !params.pdFinishDate) return { splits: [], error: null };
  const start = parseDate(params.pdStartDate);
  const finish = parseDate(params.pdFinishDate);
  if (finish < start) return { splits: [], error: 'Finish date must be on or after start date.' };

  const startVal = params.pdStartMode === 'full' ? 1 : params.pdStartMode === 'half' ? 0.5 : parseFloat(params.pdStartCustomVal) || 0;
  const finishVal = params.pdFinishMode === 'full' ? 1 : params.pdFinishMode === 'half' ? 0.5 : parseFloat(params.pdFinishCustomVal) || 0;

  const isWorkingDay = (d: Date) => !isWeekend(d) && !bankHolidays.has(isoDate(d));
  const monthlyPayday = (y: number, m: number) => {
    let d = new Date(y, m, 28, 12, 0, 0, 0);
    while (!isWorkingDay(d)) d = addDays(d, -1);
    return d;
  };

  try {
    const cutoffs: Array<{ payday: Date; cutoff: Date }> = [];
    if (params.pdPayrollType === 'fortnightly') {
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

    const splits: any[] = [];
    let periodStart = start, carryDays = 0, finishReached = false, i = 0;

    while (true) {
      if (i >= cutoffs.length) {
        if (params.pdPayrollType === 'monthly' && carryDays > 0) {
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
      carryDays = params.pdPayrollType === 'monthly' && days > 31 ? days - 31 : 0;
      if (carryDays > 0) days = 31;

      const periodLabel = params.pdPayrollType === 'monthly' ? `${MONTH_NAMES[payday.getMonth()]} ${payday.getFullYear()}` : `${formatUK(periodStart)} – ${formatUK(periodEnd)}`;
      splits.push({ periodStart, periodEnd, cutoff, payday, periodLabel, days });

      if (finishReached && carryDays <= 0) break;
      periodStart = addDays(cutoff, 1);
      i++;
    }

    return { splits, error: null };
  } catch {
    return { splits: [], error: 'Calculation failed.' };
  }
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

  const writeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setValue = useCallback((value: T | ((val: T) => T)) => {
    setStoredValue(prev => {
      const valueToStore = value instanceof Function ? value(prev) : value;
      if (writeTimer.current) clearTimeout(writeTimer.current);
      writeTimer.current = setTimeout(() => {
        try {
          if (typeof window !== 'undefined') window.localStorage.setItem(key, JSON.stringify(valueToStore));
        } catch (error) {
          console.warn(`Error setting localStorage key "${key}":`, error);
        }
      }, 300);
      return valueToStore;
    });
  }, [key]);

  return [storedValue, setValue] as const;
}

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

interface ToastMessage { id: number; message: string; actionLabel?: string; onAction?: () => void; }

function useToast() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((message: string) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  }, []);

  const showUndoToast = useCallback((message: string, onUndo: () => void) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, actionLabel: 'Undo', onAction: onUndo }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 6000);
  }, []);

  const ToastContainer = () => (
    <div className="fixed bottom-20 md:bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none print:hidden" role="status" aria-live="polite">
      {toasts.map(t => (
        <div key={t.id} className="animate-in slide-in-from-bottom-2 fade-in duration-300 bg-foreground text-background px-4 py-3 rounded-xl shadow-xl flex items-center gap-2.5 font-medium text-sm pointer-events-auto">
          <div className="p-1 bg-background/20 rounded-full"><Check className="h-3.5 w-3.5 text-background" /></div>
          {t.message}
          {t.onAction && (
            <button onClick={() => { t.onAction?.(); setToasts(prev => prev.filter(x => x.id !== t.id)); }} className="ml-1 underline font-bold text-chart-1 hover:text-white transition-colors">
              {t.actionLabel}
            </button>
          )}
        </div>
      ))}
    </div>
  );
  return { showToast, showUndoToast, ToastContainer };
}

const HOLIDAYS_CACHE_KEY = 'calc_bank_holidays_cache';
const HOLIDAYS_TTL_MS = 24 * 60 * 60 * 1000;

function useBankHolidays() {
  const [holidays, setHolidays] = useState<Set<string>>(() => {
    try {
      const cached = JSON.parse(localStorage.getItem(HOLIDAYS_CACHE_KEY) || 'null');
      if (cached && Date.now() - cached.fetchedAt < HOLIDAYS_TTL_MS) {
        return new Set([...FALLBACK_BANK_HOLIDAYS, ...cached.dates]);
      }
    } catch { /* ignore */ }
    return FALLBACK_BANK_HOLIDAYS;
  });

  useEffect(() => {
    const controller = new AbortController();
    fetch('https://www.gov.uk/bank-holidays.json', { signal: controller.signal })
      .then(res => res.json())
      .then(data => {
        const ew = data['england-and-wales'].events.map((e: any) => e.date);
        setHolidays(new Set([...FALLBACK_BANK_HOLIDAYS, ...ew]));
        try { localStorage.setItem(HOLIDAYS_CACHE_KEY, JSON.stringify({ dates: ew, fetchedAt: Date.now() })); } catch {}
      })
      .catch(err => { if (err.name !== 'AbortError') console.warn('Failed to fetch bank holidays, using fallback.'); });
    return () => controller.abort();
  }, []);
  return holidays;
}

function useFxRate(currency: CurrencyCode, baseDate: string) {
  const [rate, setRate] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (currency === 'GBP') { setRate(null); setError(null); setLoading(false); return; }
    let cancelled = false;
    setLoading(true); setError(null);
    const datePart = baseDate > new Date().toISOString().slice(0, 10) ? 'latest' : baseDate;

    fetch(`https://api.frankfurter.dev/v1/${datePart}?base=${currency}&symbols=GBP`)
      .then(res => res.json())
      .then(data => {
        if (!cancelled && data?.rates?.GBP) {
          setRate(data.rates.GBP);
          if (datePart === 'latest' && baseDate > new Date().toISOString().slice(0, 10)) setError('future-date-fallback');
        }
      })
      .catch(() => { if (!cancelled) setError('Exchange rate service offline.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [currency, baseDate, refreshKey]);

  return { rate, loading, error, refresh: () => setRefreshKey(k => k + 1) };
}

// ─── 4. Reusable Sub-components ───────────────────────────────────────────────

const NumInput = ({ id, value, onChange, prefix, suffix, placeholder = '0.00', 'aria-label': ariaLabel }: any) => (
  <div className="relative group flex-1">
    {prefix && <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-mono pointer-events-none transition-colors group-focus-within:text-primary">{prefix}</span>}
    <input
      id={id}
      type="number" value={value} onChange={e => onChange(e.target.value)} aria-label={ariaLabel} placeholder={placeholder}
      className={cn('w-full py-3 bg-input/40 border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all duration-200 tabular-nums text-base font-medium',
        prefix ? (prefix.length > 1 ? 'pl-16 pr-4' : 'pl-10 pr-4') : suffix ? 'pl-4 pr-10' : 'px-4')}
    />
    {suffix && <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground font-mono transition-colors group-focus-within:text-primary">{suffix}</span>}
  </div>
);

const SegmentedControl = ({ value, onChange, options, ariaLabel }: { value: string, onChange: (v: any) => void, options: {label: string, value: string}[], ariaLabel: string }) => (
  <div className="flex items-center gap-1 p-1 bg-input/40 border border-input rounded-xl w-full" role="radiogroup" aria-label={ariaLabel}>
    {options.map(opt => (
      <label key={opt.value} className={cn('flex-1 text-center cursor-pointer px-3 py-1.5 rounded-lg text-sm font-bold transition-all duration-300 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary',
        value === opt.value ? 'bg-primary text-primary-foreground shadow scale-100' : 'text-muted-foreground hover:text-foreground scale-95')}
      >
        <input type="radio" className="sr-only" value={opt.value} checked={value === opt.value} onChange={(e) => onChange(e.target.value)} />
        {opt.label}
      </label>
    ))}
  </div>
);

const ActionButton = ({ onClick, icon: Icon, label }: any) => (
  <button onClick={onClick} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary-foreground/10 hover:bg-primary-foreground/20 text-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white print:hidden" title={label} aria-label={label}>
    <Icon className="h-3.5 w-3.5" /><span className="hidden sm:inline">{label}</span>
  </button>
);

function AnimatedSection({ show, children, className }: { show: boolean, children: React.ReactNode, className?: string }) {
  return (
    <div className={cn("grid transition-all duration-400 ease-in-out", show ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0 pointer-events-none")}>
      <div className={cn("overflow-hidden", className)}>
        {children}
      </div>
    </div>
  );
}

function CollapsibleCard({ title, icon: Icon, children, defaultOpen = true }: any) {
  return (
    <details className="group [&_summary::-webkit-details-marker]:hidden bg-card border border-card-border rounded-2xl shadow-sm transition-all overflow-hidden" open={defaultOpen}>
      <summary className="flex items-center gap-3 cursor-pointer p-6 hover:bg-input/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary border-b border-transparent group-open:border-border">
        <div className="p-2 bg-primary/10 rounded-lg text-primary"><Icon className="h-5 w-5" /></div>
        <div className="flex-1 font-bold text-lg">{title}</div>
        <ChevronDown className="h-5 w-5 text-muted-foreground group-open:rotate-180 transition-transform duration-300" />
      </summary>
      <div className="p-6 pt-2 animate-in fade-in duration-300">
        {children}
      </div>
    </details>
  );
}

const Tooltip = ({ text }: { text: string }) => (
  <div className="group/tooltip relative inline-flex ml-1.5 align-middle cursor-help print:hidden">
    <button
      type="button"
      aria-label={text}
      className="text-muted-foreground hover:text-primary focus-visible:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-full"
    >
      <Info className="h-3.5 w-3.5" />
    </button>
    <div
      role="tooltip"
      className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/tooltip:block group-focus-within/tooltip:block w-48 p-2.5 bg-foreground text-background text-xs font-medium rounded-lg shadow-xl z-50 text-center pointer-events-none animate-in fade-in zoom-in-95 duration-200"
    >
      {text}
      <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-foreground" />
    </div>
  </div>
);

// ─── 5. Main Application Component ────────────────────────────────────────────

export default function CalculatorPage() {
  const { showToast, showUndoToast, ToastContainer } = useToast();
  const bankHolidays = useBankHolidays();
  const [mode, setMode] = useState<'contract' | 'perm' | 'paydays'>('contract');

  // Shared Global State
  const [taxYear, setTaxYear] = useLocalStorage<TaxProfile>('calc_tax_profile', '2025/2026');
  const activeFiscalRates = FISCAL_PROFILES[taxYear];

  const [clientName, setClientName] = useState('');
  const [candidateName, setCandidateName] = useState('');

  // Core Contract State
  const [cCurrency, setCCurrency] = useLocalStorage<CurrencyCode>('calc_c_currency', 'GBP');
  const [cFxDate, setCFxDate] = useState(() => new Date().toISOString().slice(0, 10));
  const cFx = useFxRate(cCurrency, cFxDate);

  const [consolidatedRate, setConsolidatedRate] = useState('');
  const [feeType, setFeeType] = useLocalStorage<'percentage' | 'fixed'>('calc_fee_type', 'percentage');
  const [margin, setMargin] = useLocalStorage('calc_margin', '15');

  // Tax & Additions
  const [includePension, setIncludePension] = useLocalStorage('calc_inc_pension', false);
  const [includeAppyLevy, setIncludeAppyLevy] = useLocalStorage('calc_inc_appy_levy', false);
  const [includeContingency, setIncludeContingency] = useLocalStorage('calc_inc_contingency', false);
  const [contingencyType, setContingencyType] = useLocalStorage<'percentage' | 'fixed'>('calc_contingency_type', 'percentage');
  const [contingencyValue, setContingencyValue] = useLocalStorage('calc_contingency_val', '');

  const [includeNI, setIncludeNI] = useLocalStorage('calc_inc_ni', true);
  const [niMode, setNiMode] = useLocalStorage<'base' | 'total'>('calc_ni_mode', 'base');
  const [seafarerExempt, setSeafarerExempt] = useLocalStorage('calc_sea_exempt', false);

  // Maritime Subsistence State
  const [includeSubsistence, setIncludeSubsistence] = useLocalStorage('calc_inc_sub', false);
  const [subsistenceTravel, setSubsistenceTravel] = useLocalStorage('calc_sub_transit', '50');
  const [subsistenceOnboard, setSubsistenceOnboard] = useLocalStorage('calc_sub_onboard', '0');
  const [subsistenceInFee, setSubsistenceInFee] = useLocalStorage('calc_sub_in_fee', true);

  // Hitch & Travel State
  const [includeTrip, setIncludeTrip] = useLocalStorage('calc_inc_trip', false);
  const [workingDays, setWorkingDays] = useState('28'); 
  const [travelDays, setTravelDays] = useState('2');
  const [travelDayFull, setTravelDayFull] = useLocalStorage('calc_travel_full', false);

  // Separate Travel Fee State
  const [travelFeeType, setTravelFeeType] = useLocalStorage<'percentage' | 'fixed'>('calc_travel_fee_type', 'percentage');
  const [travelFee, setTravelFee] = useLocalStorage('calc_travel_fee', '15');

  // Travel & Logistics Costs
  const [mobTravel, setMobTravel] = useState('');
  const [mobVisas, setMobVisas] = useState('');
  const [mobAgent, setMobAgent] = useState('');
  const [logisticsInFee, setLogisticsInFee] = useLocalStorage('calc_logistics_fee', false);

  // Perm State
  const [salary, setSalary] = useState('50000');
  const [placementFee, setPlacementFee] = useLocalStorage('calc_perm_fee', '20');
  const [includePermNI, setIncludePermNI] = useLocalStorage('calc_perm_ni', false);
  const [pCurrency, setPCurrency] = useLocalStorage<CurrencyCode>('calc_currency', 'GBP');
  const [invoiceInOrigin, setInvoiceInOrigin] = useLocalStorage('calc_perm_inv_origin', false);
  const [pFxDate, setPFxDate] = useState(() => new Date().toISOString().slice(0, 10));
  const pFx = useFxRate(pCurrency, pFxDate);

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
  const [subDaysOverrides, setSubDaysOverrides] = useState<Record<number, string>>({});

  const [pdIncludePay, setPdIncludePay] = useLocalStorage('calc_pd_inc_pay', false);
  const [pdDayRate, setPdDayRate] = useLocalStorage('calc_pd_day_rate', '');
  const [pdAdvance, setPdAdvance] = useLocalStorage('calc_pd_advance', '');

  // Presets State
  const [savedPresets, setSavedPresets] = useLocalStorage<Record<string, any>>('calc_presets', {});
  const [newPresetName, setNewPresetName] = useState('');

  // Apply Debounce Hook for heavy typing performance
  const dbConsolidatedRate = useDebounce(consolidatedRate, 300);
  const dbMargin = useDebounce(margin, 300);
  const dbContingencyValue = useDebounce(contingencyValue, 300);
  const dbSubTravel = useDebounce(subsistenceTravel, 300);
  const dbSubOnboard = useDebounce(subsistenceOnboard, 300);
  const dbTravelFee = useDebounce(travelFee, 300);
  const dbWorkingDays = useDebounce(workingDays, 300);
  const dbTravelDays = useDebounce(travelDays, 300);
  const dbMobTravel = useDebounce(mobTravel, 300);
  const dbMobVisas = useDebounce(mobVisas, 300);
  const dbMobAgent = useDebounce(mobAgent, 300);
  const dbSalary = useDebounce(salary, 300);
  const dbPlacementFee = useDebounce(placementFee, 300);

  useEffect(() => {
    setSubDaysOverrides({});
  }, [pdStartDate, pdFinishDate, pdPayrollType, pdStartMode, pdStartCustomVal, pdFinishMode, pdFinishCustomVal]);

  const reset = () => {
    const snapshot = { 
      consolidatedRate, workingDays, travelDays, mobTravel, mobVisas, mobAgent, 
      salary, contingencyValue, clientName, candidateName, pdStartDate, pdFinishDate, 
      pdDayRate, pdAdvance, subDaysOverrides 
    };

    setConsolidatedRate(''); setWorkingDays('28'); setTravelDays('2');
    setMobTravel(''); setMobVisas(''); setMobAgent(''); setSalary('50000');
    setContingencyValue(''); setClientName(''); setCandidateName('');
    setPdStartDate(''); setPdFinishDate(''); setPdDayRate(''); setPdAdvance('');
    setSubDaysOverrides({});

    showUndoToast('Session values reset. Settings preserved.', () => {
      setConsolidatedRate(snapshot.consolidatedRate); setWorkingDays(snapshot.workingDays); setTravelDays(snapshot.travelDays);
      setMobTravel(snapshot.mobTravel); setMobVisas(snapshot.mobVisas); setMobAgent(snapshot.mobAgent); setSalary(snapshot.salary);
      setContingencyValue(snapshot.contingencyValue); setClientName(snapshot.clientName); setCandidateName(snapshot.candidateName);
      setPdStartDate(snapshot.pdStartDate); setPdFinishDate(snapshot.pdFinishDate); setPdDayRate(snapshot.pdDayRate); setPdAdvance(snapshot.pdAdvance);
      setSubDaysOverrides(snapshot.subDaysOverrides);
    });
  };

  const savePreset = () => {
    if (!newPresetName.trim()) return showToast('Please enter a preset name');
    const snapshot = {
      consolidatedRate, margin, cCurrency, feeType, 
      includePension, includeAppyLevy, includeContingency, contingencyType, contingencyValue,
      includeNI, niMode, seafarerExempt, taxYear,
      includeSubsistence, subsistenceTravel, subsistenceOnboard, subsistenceInFee,
      includeTrip, workingDays, travelDays, travelDayFull, travelFeeType, travelFee, logisticsInFee,
      invoiceInOrigin
    };
    setSavedPresets(prev => ({ ...prev, [newPresetName]: snapshot }));
    setNewPresetName('');
    showToast(`Preset "${newPresetName}" saved!`);
  };

  const loadPreset = (name: string) => {
    const data = savedPresets[name];
    if (!data) return;
    if (data.consolidatedRate !== undefined) setConsolidatedRate(data.consolidatedRate);
    if (data.margin !== undefined) setMargin(data.margin);
    if (data.cCurrency !== undefined) setCCurrency(data.cCurrency);
    if (data.feeType !== undefined) setFeeType(data.feeType);
    if (data.includePension !== undefined) setIncludePension(data.includePension);
    if (data.includeAppyLevy !== undefined) setIncludeAppyLevy(data.includeAppyLevy);
    if (data.includeContingency !== undefined) setIncludeContingency(data.includeContingency);
    if (data.contingencyType !== undefined) setContingencyType(data.contingencyType);
    if (data.contingencyValue !== undefined) setContingencyValue(data.contingencyValue);
    if (data.includeNI !== undefined) setIncludeNI(data.includeNI);
    if (data.niMode !== undefined) setNiMode(data.niMode);
    if (data.seafarerExempt !== undefined) setSeafarerExempt(data.seafarerExempt);
    if (data.taxYear !== undefined) setTaxYear(data.taxYear);
    if (data.includeSubsistence !== undefined) setIncludeSubsistence(data.includeSubsistence);
    if (data.subsistenceTravel !== undefined) setSubsistenceTravel(data.subsistenceTravel);
    if (data.subsistenceOnboard !== undefined) setSubsistenceOnboard(data.subsistenceOnboard);
    if (data.subsistenceInFee !== undefined) setSubsistenceInFee(data.subsistenceInFee);
    if (data.includeTrip !== undefined) setIncludeTrip(data.includeTrip);
    if (data.workingDays !== undefined) setWorkingDays(data.workingDays);
    if (data.travelDays !== undefined) setTravelDays(data.travelDays);
    if (data.travelDayFull !== undefined) setTravelDayFull(data.travelDayFull);
    if (data.travelFeeType !== undefined) setTravelFeeType(data.travelFeeType);
    if (data.travelFee !== undefined) setTravelFee(data.travelFee);
    if (data.logisticsInFee !== undefined) setLogisticsInFee(data.logisticsInFee);
    if (data.invoiceInOrigin !== undefined) setInvoiceInOrigin(data.invoiceInOrigin);
    showToast(`Preset "${name}" loaded!`);
  };

  // ─── Memoized Render Drivers ───
  // These pass state parameters to the pure utility functions

  const contract = useMemo(() => calculateContract({
    dbConsolidatedRate, dbMargin, dbTravelFee, dbContingencyValue, 
    includePension, includeAppyLevy, includeContingency, contingencyType, 
    includeSubsistence, dbSubTravel, dbSubOnboard, includeNI, seafarerExempt, 
    niMode, subsistenceInFee, feeType, dbWorkingDays, dbTravelDays, travelDayFull, 
    dbMobTravel, dbMobVisas, dbMobAgent, logisticsInFee, travelFeeType
  }, activeFiscalRates), [
    dbConsolidatedRate, dbMargin, dbTravelFee, dbContingencyValue, 
    includePension, includeAppyLevy, includeContingency, contingencyType, 
    includeSubsistence, dbSubTravel, dbSubOnboard, includeNI, seafarerExempt, 
    niMode, subsistenceInFee, feeType, dbWorkingDays, dbTravelDays, travelDayFull, 
    dbMobTravel, dbMobVisas, dbMobAgent, logisticsInFee, travelFeeType, activeFiscalRates
  ]);

  const perm = useMemo(() => calculatePerm({
    dbSalary, dbPlacementFee, includePermNI, pCurrency, invoiceInOrigin
  }, activeFiscalRates, pFx.rate), [
    dbSalary, dbPlacementFee, includePermNI, pCurrency, invoiceInOrigin, activeFiscalRates, pFx.rate
  ]);

  const rawPaydays = useMemo(() => calculateRawPaydays({
    pdStartDate, pdFinishDate, pdPayrollType, pdStartMode, pdStartCustomVal, pdFinishMode, pdFinishCustomVal
  }, bankHolidays), [
    pdStartDate, pdFinishDate, pdPayrollType, pdStartMode, pdStartCustomVal, pdFinishMode, pdFinishCustomVal, bankHolidays
  ]);

  const paydays = useMemo(() => {
    if (rawPaydays.error || !rawPaydays.splits.length) {
      return { splits: [], error: rawPaydays.error, totalDays: null, totalSubDays: null, totalSub: null };
    }
    const subAmt = pdIncludeSubsistence ? parseFloat(pdSubsistenceRate) || 0 : 0;
    const finalSplits = rawPaydays.splits.map((s, idx) => {
      const override = subDaysOverrides[idx];
      const subDays = (override !== undefined && override !== '') ? (parseFloat(override) || 0) : s.days;
      return { ...s, subDays };
    });
    return {
      splits: finalSplits,
      error: null,
      totalDays: finalSplits.reduce((sum, s) => sum + s.days, 0),
      totalSubDays: finalSplits.reduce((sum, s) => sum + s.subDays, 0),
      totalSub: pdIncludeSubsistence ? finalSplits.reduce((sum, s) => sum + s.subDays * subAmt, 0) : null,
    };
  }, [rawPaydays, subDaysOverrides, pdIncludeSubsistence, pdSubsistenceRate]);

  const pdDayRateVal = parseFloat(pdDayRate) || 0;
  const pdAdvanceVal = parseFloat(pdAdvance) || 0;
  const pdTotalGross = (paydays.totalDays || 0) * pdDayRateVal;
  const pdTotalNet = pdTotalGross + (paydays.totalSub || 0) - pdAdvanceVal;

  // ─── Export Functions ───
  const copyContractBreakdown = () => {
    let text = `Maritime Contract Charge Breakdown (Per Day)\n-----------------------------------\n`;
    text += `Consolidated Rate: ${formatCurrencyIn(contract.cRate, cCurrency)}\n`;
    if (includePension) text += `Pension (${activeFiscalRates.pension * 100}%): ${formatCurrencyIn(contract.cPension, cCurrency)}\n`;
    if (includeAppyLevy) text += `Apprenticeship Levy (${activeFiscalRates.apprenticeshipLevy * 100}%): ${formatCurrencyIn(contract.cAppyLevy, cCurrency)}\n`;
    if (includeContingency) text += `Contingency: ${formatCurrencyIn(contract.cContingency, cCurrency)}\n`;

    if (includeNI && !seafarerExempt) {
      text += `Employer's NIC: ${formatCurrencyIn(contract.cEmployerNI, cCurrency)}\n`;
    } else if (seafarerExempt) {
      text += `Employer's NIC: Exempt (Seafarer/Non-UKCS)\n`;
    }

    if (includeSubsistence && contract.cSubOnboardAmt > 0) {
      text += `Victualling/Onboard Subsistence: ${formatCurrencyIn(contract.cSubOnboardAmt, cCurrency)}\n`;
    }

    text += `Management Fee (${contract.feeType === 'percentage' ? `${contract.cMarginVal}%` : 'Fixed'}): ${formatCurrencyIn(contract.cManagementFee, cCurrency)}\n`;
    text += `-----------------------------------\n`;
    text += `Total Charge Rate (Onboard): ${formatCurrencyIn(contract.cTotalCharge, cCurrency)}`;

    if (cCurrency !== 'GBP' && cFx.rate) {
       text += `\nConverted Equivalent (GBP): ${formatCurrencyIn(contract.cTotalCharge * cFx.rate, 'GBP')} (@ 1 ${cCurrency} = ${cFx.rate.toFixed(4)} GBP)`;
    }

    copyText(text).then(ok => showToast(ok ? 'Charge breakdown copied' : 'Clipboard access denied. Please select and copy manually.'));
  };

  const copyTripSummary = () => {
    let text = `Hitch & Crew Change Invoice Summary\n-----------------------------------\n`;
    text += `Hitch Days (${contract.nWorkingDays}): ${formatCurrencyIn(contract.tripWorkingTotal, cCurrency)}\n`;
    text += `Travel Days (${contract.nTravelDays}): ${formatCurrencyIn(contract.tripTravelTotal, cCurrency)}\n`;
    if (contract.logisticsTotal > 0) text += `Travel & Logistics Costs: ${formatCurrencyIn(contract.logisticsTotal, cCurrency)}\n`;
    text += `-----------------------------------\n`;
    text += `Total Hitch Invoice: ${formatCurrencyIn(contract.tripGrandTotal, cCurrency)}`;

    if (cCurrency !== 'GBP' && cFx.rate) {
       text += `\nConverted Equivalent (GBP): ${formatCurrencyIn(contract.tripGrandTotal * cFx.rate, 'GBP')} (@ 1 ${cCurrency} = ${cFx.rate.toFixed(4)} GBP)`;
    }

    copyText(text).then(ok => showToast(ok ? 'Hitch summary copied' : 'Clipboard access denied. Please select and copy manually.'));
  };

  const copyPermSummary = () => {
    let text = `Permanent Placement Summary\n-----------------------------------\n`;
    text += `Annual Salary: ${formatCurrencyIn(perm.pSalaryInput, pCurrency)}\n`;
    if (pCurrency !== 'GBP') text += `Converted Salary (GBP): ${formatCurrencyIn(perm.pSalary, 'GBP')} (@ 1 ${pCurrency} = ${pFx.rate?.toFixed(4) || '...'} GBP)\n`;

    text += `Placement Fee (${perm.pFeePct}%): ${formatCurrencyIn(perm.pPlacementFee, invoiceInOrigin ? pCurrency : 'GBP')}\n`;
    if (includePermNI) text += `Employer's NI: ${formatCurrencyIn(perm.pEmployerNI, 'GBP')} (UK Tax)\n`;
    text += `-----------------------------------\n`;
    text += `Total ${includePermNI ? 'Cost' : 'Invoice'}: ${formatCurrencyIn(includePermNI ? perm.pTotalCost : perm.pPlacementFee, invoiceInOrigin ? pCurrency : 'GBP')}`;

    copyText(text).then(ok => showToast(ok ? 'Permanent summary copied' : 'Clipboard access denied. Please select and copy manually.'));
  };

  const copyPaydaysSummary = () => {
    if (!paydays.splits.length) return;
    const subAmt = pdIncludeSubsistence ? (parseFloat(pdSubsistenceRate) || 0) : 0;

    let text = `Payment Days Schedule\n-----------------------------------\n`;
    text += `Payroll Type: ${pdPayrollType === 'monthly' ? 'Monthly' : 'Fortnightly'}\n`;
    text += `Total Payable Days: ${paydays.totalDays}\n`;

    if (pdIncludePay) {
      text += `Day Rate: ${formatCurrencyIn(pdDayRateVal, 'GBP')}\n`;
      text += `Total Gross Pay: ${formatCurrencyIn(pdTotalGross, 'GBP')}\n`;
      if (pdIncludeSubsistence && paydays.totalSub !== null && paydays.totalSub > 0) {
         text += `Total Subsistence (${paydays.totalSubDays}d): ${formatCurrencyIn(paydays.totalSub, 'GBP')}\n`;
      }
      if (pdAdvanceVal > 0) text += `Advance Deduction: -${formatCurrencyIn(pdAdvanceVal, 'GBP')}\n`;
      text += `Total Net Pay: ${formatCurrencyIn(pdTotalNet, 'GBP')}\n`;
    } else if (pdIncludeSubsistence && paydays.totalSub !== null) {
      text += `Total Subsistence (${paydays.totalSubDays}d): ${formatCurrencyIn(paydays.totalSub, 'GBP')}\n`;
    }

    text += `-----------------------------------\n\n`;

    paydays.splits.forEach(s => {
      text += `${pdPayrollType === 'fortnightly' ? s.periodLabel : `${formatUK(s.periodStart)} – ${formatUK(s.periodEnd)}`}\n`;
      text += `Cut-off: ${formatUK(s.cutoff)} | Payday: ${formatUK(s.payday)}\n`;
      text += `Payable Days: ${s.days % 1 === 0 ? s.days.toFixed(0) : formatNumber(s.days)}`;

      if (pdIncludePay && pdDayRateVal > 0) {
         text += ` | Gross Pay: ${formatCurrencyIn(s.days * pdDayRateVal, 'GBP')}`;
      }
      if (pdIncludeSubsistence && subAmt > 0) {
         text += ` | Subsistence (${s.subDays}d): ${formatCurrencyIn(s.subDays * subAmt, 'GBP')}`;
      }
      text += `\n\n`;
    });

    copyText(text.trim()).then(ok => showToast(ok ? 'Payment schedule copied' : 'Clipboard access denied. Please select and copy manually.'));
  };

  const exportScheduleCSV = () => {
    if (!paydays.splits.length) return;
    const subAmt = pdIncludeSubsistence ? (parseFloat(pdSubsistenceRate) || 0) : 0;

    let headers = "Period,Cut-off,Payday,Payable Days";
    if (pdIncludePay) headers += ",Gross Pay";
    if (pdIncludeSubsistence) headers += ",Subsistence Days,Subsistence Amount";
    headers += "\n";

    const rows = paydays.splits.map(s => {
      let row = `"${s.periodLabel}","${formatUK(s.cutoff)}","${formatUK(s.payday)}",${s.days}`;
      if (pdIncludePay) row += `,${s.days * pdDayRateVal}`;
      if (pdIncludeSubsistence) row += `,${s.subDays},${s.subDays * subAmt}`;
      return row;
    }).join("\n");

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

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-[100dvh] bg-background py-10 px-4 sm:px-6 md:px-8 flex flex-col items-center pb-28 md:pb-10">
      <ToastContainer />
      <div className="w-full max-w-5xl">
        <header className="mb-10 flex flex-col md:flex-row md:items-start justify-between gap-4 print:hidden">
          <div>
            <Logo />
            <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">Maritime Fee Calculator</h1>
            <p className="mt-2 text-muted-foreground font-medium">Specialised breakdown for seafarer hitch rotations, logistics, and margins.</p>
          </div>

          <div className="flex flex-col sm:items-end gap-3">
             <div className="flex items-center gap-2">
               <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Tax Year</label>
               <select 
                 className="px-3 py-1.5 bg-input/20 border border-input rounded-lg text-sm font-bold focus:ring-2 focus:ring-primary focus:outline-none"
                 value={taxYear}
                 onChange={(e) => setTaxYear(e.target.value as TaxProfile)}
                 aria-label="Select Tax Year"
               >
                 {Object.keys(FISCAL_PROFILES).map(year => (
                   <option key={year} value={year}>{year}</option>
                 ))}
               </select>
             </div>
            <div className="flex flex-wrap items-center gap-2 bg-input/20 p-2 rounded-xl border border-input/40">
               <select 
                 className="px-3 py-2 bg-background border border-input rounded-lg text-sm font-medium focus:ring-2 focus:ring-primary focus:outline-none"
                 onChange={(e) => { if (e.target.value) loadPreset(e.target.value); e.target.value = ""; }}
                 aria-label="Load Preset"
               >
                 <option value="">Load Preset...</option>
                 {Object.keys(savedPresets).map(p => <option key={p} value={p}>{p}</option>)}
               </select>
               <div className="flex gap-1 items-center">
                 <input 
                   type="text" 
                   placeholder="Preset name" 
                   value={newPresetName} 
                   onChange={e=>setNewPresetName(e.target.value)} 
                   className="px-3 py-2 bg-background border border-input rounded-lg text-sm font-medium focus:ring-2 focus:ring-primary focus:outline-none w-32"
                 />
                 <button onClick={savePreset} className="p-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity" title="Save Preset" aria-label="Save Preset">
                   <Save className="h-4 w-4" />
                 </button>
               </div>
            </div>
            <button onClick={reset} className="flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors px-4 py-2 rounded-lg hover:bg-input/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
              <RotateCcw className="h-4 w-4" />Reset Values
            </button>
          </div>
        </header>

        <Tabs value={mode} onValueChange={(v) => setMode(v as typeof mode)} className="w-full">
          <TabsList className="grid w-full max-w-2xl grid-cols-3 mb-8 bg-input/40 p-1 rounded-xl print:hidden">
            <TabsTrigger value="contract" className="flex gap-2 text-xs sm:text-sm rounded-lg data-[state=active]:shadow-sm transition-all duration-300 focus-visible:ring-2 focus-visible:ring-primary"><Ship className="h-4 w-4" />Contract <span className="hidden sm:inline">& Hitch</span></TabsTrigger>
            <TabsTrigger value="perm" className="flex gap-2 text-xs sm:text-sm rounded-lg data-[state=active]:shadow-sm transition-all duration-300 focus-visible:ring-2 focus-visible:ring-primary"><Briefcase className="h-4 w-4" />Permanent</TabsTrigger>
            <TabsTrigger value="paydays" className="flex gap-2 text-xs sm:text-sm rounded-lg data-[state=active]:shadow-sm transition-all duration-300 focus-visible:ring-2 focus-visible:ring-primary"><CalendarDays className="h-4 w-4" />Payment Days</TabsTrigger>
          </TabsList>

          {/* ─────────────── MARITIME CONTRACT TAB ─────────────── */}
          <TabsContent value="contract" className="m-0 animate-in fade-in slide-in-from-bottom-2 duration-400">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-5 flex flex-col gap-6 print:hidden">

                <CollapsibleCard title="Day Rate & Tax" icon={FileText} defaultOpen>
                  <div className="space-y-4 mb-4">
                    <label className="block text-sm font-bold text-foreground">Currency</label>
                    <SegmentedControl 
                      value={cCurrency} 
                      onChange={setCCurrency} 
                      options={CURRENCIES.map(c => ({label: c, value: c}))} 
                      ariaLabel="Contract Currency"
                    />
                  </div>

                  <AnimatedSection show={cCurrency !== 'GBP'}>
                    <div className="space-y-3 p-4 bg-input/30 border border-input rounded-xl mb-6">
                      <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                        <Globe className="h-4 w-4" />Exchange Rate
                      </div>
                      <div className="space-y-1">
                        <label htmlFor="c-fx-date" className="block text-xs font-bold text-muted-foreground uppercase tracking-wide">Placement / Start Date</label>
                        <input
                          id="c-fx-date"
                          type="date"
                          value={cFxDate}
                          onChange={e => setCFxDate(e.target.value)}
                          className="w-full px-4 py-2.5 bg-input/40 border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all text-sm font-medium"
                        />
                      </div>
                      <div className="flex items-center justify-between rounded-lg bg-card/60 px-3 py-2.5">
                        <div className="text-sm font-medium">
                          {cFx.loading ? (
                            <span className="text-muted-foreground">Fetching rate…</span>
                          ) : cFx.rate !== null ? (
                            <span className="font-mono font-bold animate-in fade-in duration-300">
                              1 {cCurrency} = {cFx.rate.toFixed(4)} GBP
                            </span>
                          ) : (
                            <span className="text-muted-foreground">No rate yet</span>
                          )}
                        </div>
                        <button onClick={cFx.refresh} aria-label="Refresh exchange rate" className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-input/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                          <RefreshCw className={cn('h-3.5 w-3.5', cFx.loading && 'animate-spin')} />
                        </button>
                      </div>
                      {cFx.error === 'future-date-fallback' && (
                        <div className="flex items-start gap-2 text-xs text-amber-500/90 font-medium">
                          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                          <span>Future date selected. Showing today's latest rate instead.</span>
                        </div>
                      )}
                    </div>
                  </AnimatedSection>

                  <div className="space-y-2">
                    <label htmlFor="consolidated-rate" className="block text-sm font-bold">Consolidated Rate — Seafarer Pay</label>
                    <NumInput id="consolidated-rate" value={consolidatedRate} onChange={setConsolidatedRate} prefix={curSym(cCurrency)} aria-label="Consolidated Rate" />
                  </div>

                  <div className="space-y-3 pt-2">
                    <div className="flex justify-between group">
                      <div className="space-y-1 pr-4">
                        <label className="text-sm font-bold cursor-pointer group-hover:text-primary transition-colors" onClick={() => setIncludePension(!includePension)}>Include Pension</label>
                        <p className="text-xs text-muted-foreground font-medium">Standard {activeFiscalRates.pension * 100}% addition</p>
                      </div>
                      <Switch checked={includePension} onCheckedChange={setIncludePension} />
                    </div>

                    <div className="flex justify-between group">
                      <div className="space-y-1 pr-4">
                        <label className="text-sm font-bold flex items-center cursor-pointer group-hover:text-primary transition-colors" onClick={() => setIncludeAppyLevy(!includeAppyLevy)}>
                          Include Apprenticeship Levy
                          <Tooltip text="A 0.5% tax on large employers to fund apprenticeship training." />
                        </label>
                        <p className="text-xs text-muted-foreground font-medium">Standard {activeFiscalRates.apprenticeshipLevy * 100}% addition</p>
                      </div>
                      <Switch checked={includeAppyLevy} onCheckedChange={setIncludeAppyLevy} />
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between group">
                        <div className="space-y-1 pr-4">
                          <label className="text-sm font-bold cursor-pointer group-hover:text-primary transition-colors" onClick={() => setIncludeContingency(!includeContingency)}>Add Contingency</label>
                        </div>
                        <Switch checked={includeContingency} onCheckedChange={setIncludeContingency} />
                      </div>
                      <AnimatedSection show={includeContingency}>
                        <div className="flex items-center gap-2 pt-1">
                           <div className="w-24">
                              <SegmentedControl 
                                value={contingencyType} 
                                onChange={setContingencyType} 
                                options={[{label: '%', value: 'percentage'}, {label: curSym(cCurrency), value: 'fixed'}]} 
                                ariaLabel="Contingency Type"
                              />
                            </div>
                            <NumInput 
                              id="contingency-val"
                              value={contingencyValue} 
                              onChange={setContingencyValue} 
                              prefix={contingencyType === 'fixed' ? curSym(cCurrency) : undefined} 
                              suffix={contingencyType === 'percentage' ? '%' : undefined} 
                              placeholder="0.0" 
                            />
                        </div>
                      </AnimatedSection>
                    </div>
                  </div>

                  <div className="space-y-2 pt-4 border-t border-border/60 mt-4">
                    <div className="flex items-center justify-between">
                      <label htmlFor="management-margin" className="block text-sm font-bold">Management Fee</label>
                      <div className="w-32">
                        <SegmentedControl 
                          value={feeType} 
                          onChange={setFeeType} 
                          options={[{label: '%', value: 'percentage'}, {label: curSym(cCurrency), value: 'fixed'}]} 
                          ariaLabel="Management Fee Type"
                        />
                      </div>
                    </div>
                    <NumInput 
                      id="management-margin"
                      value={margin} 
                      onChange={setMargin} 
                      prefix={feeType === 'fixed' ? curSym(cCurrency) : undefined} 
                      suffix={feeType === 'percentage' ? '%' : undefined} 
                      placeholder="0.0" 
                    />
                  </div>

                  <div className="pt-4 space-y-4 border-t border-border/60 mt-4">
                    <div className="flex justify-between group">
                      <div className="space-y-1 pr-4">
                        <label className="text-sm font-bold cursor-pointer group-hover:text-primary transition-colors" onClick={() => setIncludeNI(!includeNI)}>Include Employer's NI</label>
                      </div>
                      <Switch checked={includeNI} onCheckedChange={setIncludeNI} />
                    </div>

                    <AnimatedSection show={includeNI}>
                      <div className="space-y-3 bg-amber-500/5 p-4 rounded-xl border border-amber-500/20 mt-2">
                        <div className="space-y-2">
                          <label className="block text-xs font-bold text-amber-600/90 dark:text-amber-400/90 uppercase tracking-wide">NI Calculated On</label>
                          <SegmentedControl 
                            value={niMode} 
                            onChange={setNiMode} 
                            options={[
                              {label: 'Base Rate', value: 'base'}, 
                              {label: 'Total Amount', value: 'total'}
                            ]} 
                            ariaLabel="NI Calculation Basis"
                          />
                        </div>
                        <div className="flex justify-between items-center pt-2 border-t border-amber-500/20">
                          <div className="space-y-0.5 pr-4">
                            <label className="text-sm font-bold text-amber-600 dark:text-amber-400 flex items-center cursor-pointer" onClick={() => setSeafarerExempt(!seafarerExempt)}>
                              Seafarer Exemption
                              <Tooltip text="UK Continental Shelf. Vessels operating wholly outside this may be exempt from Employer's NI." />
                            </label>
                            <p className="text-xs text-amber-600/80 dark:text-amber-400/80 font-medium">Non-UK flagged / outside UKCS.</p>
                          </div>
                          <Switch checked={seafarerExempt} onCheckedChange={setSeafarerExempt} className="data-[state=checked]:bg-amber-500" />
                        </div>
                      </div>
                    </AnimatedSection>
                  </div>
                </CollapsibleCard>

                <CollapsibleCard title="Subsistence & Victualling" icon={UtensilsCrossed} defaultOpen={false}>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-bold cursor-pointer flex items-center" onClick={() => setIncludeSubsistence(!includeSubsistence)}>
                      Enable Subsistence
                      <Tooltip text="Food and provisions provided onboard. Typically £0 as covered by the vessel." />
                    </label>
                    <Switch checked={includeSubsistence} onCheckedChange={(v) => { setIncludeSubsistence(v); if (!v) setSubsistenceInFee(false); }} />
                  </div>
                  <AnimatedSection show={includeSubsistence} className="pt-3 space-y-5 border-t border-border/40 mt-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label htmlFor="sub-travel" className="block text-xs font-bold text-muted-foreground uppercase tracking-wide">Travel</label>
                        <NumInput id="sub-travel" value={subsistenceTravel} onChange={setSubsistenceTravel} prefix={curSym(cCurrency)} />
                      </div>
                      <div className="space-y-2">
                        <label htmlFor="sub-onboard" className="block text-xs font-bold text-muted-foreground uppercase tracking-wide">Onboard</label>
                        <NumInput id="sub-onboard" value={subsistenceOnboard} onChange={setSubsistenceOnboard} prefix={curSym(cCurrency)} />
                      </div>
                    </div>
                    <div className="flex justify-between group">
                      <div className="space-y-1 pr-4">
                        <label className="text-sm font-bold cursor-pointer group-hover:text-primary transition-colors" onClick={() => includeSubsistence && setSubsistenceInFee(!subsistenceInFee)}>Apply margin to subsistence</label>
                      </div>
                      <Switch checked={subsistenceInFee} onCheckedChange={setSubsistenceInFee} disabled={!includeSubsistence} />
                    </div>
                  </AnimatedSection>
                </CollapsibleCard>

                <CollapsibleCard title="Hitch & Mob/Demob Scheduler" icon={Anchor} defaultOpen={false}>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-bold cursor-pointer" onClick={() => setIncludeTrip(!includeTrip)}>
                      Enable Hitch Scheduler
                    </label>
                    <Switch checked={includeTrip} onCheckedChange={setIncludeTrip} />
                  </div>

                  <AnimatedSection show={includeTrip} className="pt-3 space-y-5 border-t border-border/40 mt-3">
                    <div className="space-y-2">
                      <label htmlFor="working-days" className="block text-xs font-bold text-muted-foreground uppercase tracking-wide">Days Onboard</label>
                      <NumInput id="working-days" value={workingDays} onChange={setWorkingDays} placeholder="28" />
                    </div>

                    <div className="space-y-4 pt-4 border-t border-border/50">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label htmlFor="travel-days" className="block text-xs font-bold text-muted-foreground uppercase tracking-wide">Travel Days</label>
                          <NumInput id="travel-days" value={travelDays} onChange={setTravelDays} placeholder="2" />
                        </div>
                        <div className="space-y-2">
                          <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wide">Charge Rate</label>
                          <SegmentedControl 
                            value={travelDayFull ? 'full' : 'half'} 
                            onChange={(v) => setTravelDayFull(v === 'full')} 
                            options={[{label: '0.5 rate', value: 'half'}, {label: 'Full rate', value: 'full'}]} 
                            ariaLabel="Travel Day Rate"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3 pt-4 border-t border-border/50">
                      <div className="flex items-center justify-between">
                        <label className="block text-sm font-bold">Travel & Logistics Costs</label>
                        <div className="flex items-center gap-2">
                          <label className="text-xs font-bold text-muted-foreground cursor-pointer" onClick={() => setLogisticsInFee(!logisticsInFee)}>
                            Add Travel Fee
                          </label>
                          <Switch checked={logisticsInFee} onCheckedChange={setLogisticsInFee} className="scale-75 origin-right" />
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <NumInput id="mob-travel" value={mobTravel} onChange={setMobTravel} placeholder="Travel" prefix={curSym(cCurrency)} aria-label="Mobilization Travel Cost" />
                        <NumInput id="mob-visas" value={mobVisas} onChange={setMobVisas} placeholder="VISA / Cert." prefix={curSym(cCurrency)} aria-label="Visas Cost" />
                        <NumInput id="mob-agent" value={mobAgent} onChange={setMobAgent} placeholder="Agent" prefix={curSym(cCurrency)} aria-label="Agent Cost" />
                      </div>

                      <AnimatedSection show={logisticsInFee} className="space-y-2 pt-3">
                        <div className="flex items-center justify-between">
                          <label htmlFor="travel-fee-amount" className="block text-xs font-bold text-muted-foreground uppercase tracking-wide">Travel Fee</label>
                          <div className="w-28">
                            <SegmentedControl 
                              value={travelFeeType} 
                              onChange={setTravelFeeType} 
                              options={[{label: '%', value: 'percentage'}, {label: curSym(cCurrency), value: 'fixed'}]} 
                              ariaLabel="Travel Fee Type"
                            />
                          </div>
                        </div>
                        <NumInput 
                          id="travel-fee-amount"
                          value={travelFee} 
                          onChange={setTravelFee} 
                          prefix={travelFeeType === 'fixed' ? curSym(cCurrency) : undefined} 
                          suffix={travelFeeType === 'percentage' ? '%' : undefined} 
                          placeholder="0.0" 
                        />
                      </AnimatedSection>
                    </div>
                  </AnimatedSection>
                </CollapsibleCard>
              </div>

              {/* Right panel */}
              <div className="lg:col-span-7 bg-primary text-primary-foreground rounded-2xl shadow-xl overflow-hidden flex flex-col relative transition-all duration-500 print:col-span-12 print:shadow-none print:w-full print:bg-white print:text-black print:border-2">
                {contract.cRate === 0 && !consolidatedRate ? (
                  <div className="absolute inset-0 z-10 bg-primary/95 flex flex-col items-center justify-center text-center p-10 animate-in fade-in duration-500 print:hidden">
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
                  <div className="mb-8 grid grid-cols-1 sm:grid-cols-2 gap-4 print:mb-6">
                    <input type="text" placeholder="Client Name (Optional)" aria-label="Client Name" value={clientName} onChange={e=>setClientName(e.target.value)} className="bg-transparent border-b border-primary-foreground/20 text-white placeholder:text-primary-foreground/40 px-1 py-1 focus:outline-none focus:border-primary-foreground/50 transition-colors print:text-black print:border-none print:p-0 print:font-bold print:text-2xl" />
                    <input type="text" placeholder="Candidate Name (Optional)" aria-label="Candidate Name" value={candidateName} onChange={e=>setCandidateName(e.target.value)} className="bg-transparent border-b border-primary-foreground/20 text-white placeholder:text-primary-foreground/40 px-1 py-1 focus:outline-none focus:border-primary-foreground/50 transition-colors print:text-black print:border-none print:p-0 print:text-gray-600 sm:text-right print:text-lg print:sm:mt-2" />
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                    <h2 className="text-xl font-bold">Charge Rate Breakdown</h2>
                    <div className="flex items-center gap-3">
                      <ActionButton onClick={copyContractBreakdown} icon={Copy} label="Copy" />
                      <ActionButton onClick={printSchedule} icon={Printer} label="Print PDF" />
                      <span className="text-xs uppercase tracking-widest font-bold px-3 py-1.5 bg-primary-foreground/10 rounded-full print:bg-gray-200">Per Day Onboard</span>
                    </div>
                  </div>

                  {/* Decorative allocation bar */}
                  <div aria-hidden="true" className="w-full h-3 bg-primary-foreground/10 rounded-full mb-6 overflow-hidden flex transition-all duration-500 print:hidden">
                    <div className="bg-white h-full transition-all duration-500" style={{ width: `${(contract.cRate / contract.totalBarVal) * 100}%` }} title="Worker Pay" />
                    <div className="bg-white/80 h-full transition-all duration-500 border-l border-primary/20" style={{ width: `${(contract.cTotalAdditions / contract.totalBarVal) * 100}%` }} title="Additions" />
                    <div className="bg-white/60 h-full transition-all duration-500 border-l border-primary/20" style={{ width: `${(contract.cEmployerNI / contract.totalBarVal) * 100}%` }} title="Employer NI" />
                    <div className="bg-white/40 h-full transition-all duration-500 border-l border-primary/20" style={{ width: `${(contract.cSubOnboardAmt / contract.totalBarVal) * 100}%` }} title="Subsistence" />
                    <div className="bg-white/20 h-full transition-all duration-500 border-l border-primary/20" style={{ width: `${(contract.cManagementFee / contract.totalBarVal) * 100}%` }} title="Management Fee" />
                  </div>

                  <div className="space-y-3 relative z-0">
                    <LineItem label="Consolidated Day Rate" value={contract.cRate} isBold currency={cCurrency} />

                    {includePension && <LineItem label={`Pension (${activeFiscalRates.pension * 100}%)`} value={contract.cPension} currency={cCurrency} />}
                    {includeAppyLevy && <LineItem label={`Apprenticeship Levy (${activeFiscalRates.apprenticeshipLevy * 100}%)`} value={contract.cAppyLevy} currency={cCurrency} />}
                    {includeContingency && <LineItem label={`Contingency (${contingencyType === 'percentage' && contract.cContingency > 0 ? dbContingencyValue + '%' : 'Fixed'})`} value={contract.cContingency} currency={cCurrency} />}

                    {includeNI && (
                      <LineItem 
                        label={seafarerExempt ? "Employers NIC (Exempt)" : `Employers NIC (${activeFiscalRates.employerNI * 100}%)`} 
                        value={contract.cEmployerNI} 
                        currency={cCurrency}
                      />
                    )}
                    {includeSubsistence && contract.cSubOnboardAmt > 0 && <LineItem label="Onboard Victualling/Sub" value={contract.cSubOnboardAmt} currency={cCurrency} />}
                    <LineItem label={`Management Fee (${contract.feeType === 'percentage' && contract.cMarginVal > 0 ? `${contract.cMarginVal}%` : 'Fixed'})`} value={contract.cManagementFee} currency={cCurrency} />

                    {contract.cMarginVal > 0 && contract.cTotalCharge > 0 && (
                      <div className="text-xs text-primary-foreground/60 print:text-gray-500 font-medium bg-primary-foreground/5 p-2.5 rounded-lg mt-1 flex items-center gap-2 print:bg-gray-50 print:border print:border-gray-200">
                        <Info className="h-3.5 w-3.5 shrink-0" />
                        <span>
                          Fee = {contract.feeType === 'percentage' 
                            ? `${contract.cMarginVal}% × (${formatCurrencyIn(contract.cRate, cCurrency)} 
                              ${contract.cTotalAdditions > 0 ? ` + Additions` : ''} 
                              ${includeNI && !seafarerExempt ? ` + NI` : ''} 
                              ${subsistenceInFee && contract.cSubOnboardAmt > 0 ? ` + Sub` : ''})` 
                            : `${formatCurrencyIn(contract.cMarginVal, cCurrency)} Flat`}
                        </span>
                      </div>
                    )}

                    <div className="mt-4 pt-5 border-t-2 border-primary-foreground/30 print:border-gray-300 flex items-center justify-between">
                      <span className="text-lg font-bold">Total Charge (Onboard)</span>
                      <span className="text-3xl font-mono font-bold tracking-tight text-chart-1 animate-in zoom-in-95 duration-200 tabular-nums" key={contract.cTotalCharge}>{formatCurrencyIn(contract.cTotalCharge, cCurrency)}</span>
                    </div>

                    <div aria-live="polite" className="sr-only">
                      Total charge is {formatCurrencyIn(contract.cTotalCharge, cCurrency)} per day
                    </div>

                    {cCurrency !== 'GBP' && cFx.rate !== null && (
                      <div className="flex items-center justify-between pt-2 text-sm text-primary-foreground/60 print:text-gray-500 border-t border-primary-foreground/10 print:border-gray-200">
                         <span>Converted Equivalency (@ {cFx.rate.toFixed(4)})</span>
                         <span className="font-mono font-bold tabular-nums text-white print:text-black">{formatCurrencyIn(contract.cTotalCharge * cFx.rate, 'GBP')}</span>
                      </div>
                    )}
                  </div>

                  <AnimatedSection show={includeTrip} className="mt-8 pt-6 border-t border-primary-foreground/20 print:border-gray-300">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-bold uppercase tracking-widest text-primary-foreground/60 print:text-gray-500">Single Travel Day Reference</h3>
                      <span className="text-xs font-bold px-2.5 py-1 bg-primary-foreground/10 rounded-full print:bg-gray-200">{travelDayFull ? 'Full' : '0.5'} day rate</span>
                    </div>
                    <div className="space-y-2.5">
                      <LineItem label={`Consolidated Rate (×${travelDayFull ? '1' : '0.5'})`} value={contract.cTravelRate} currency={cCurrency} />
                      {includePension && <LineItem label="Pension" value={contract.cTravelRate * activeFiscalRates.pension} currency={cCurrency} />}
                      {includeAppyLevy && <LineItem label="Apprenticeship Levy" value={contract.cTravelRate * activeFiscalRates.apprenticeshipLevy} currency={cCurrency} />}
                      {includeContingency && <LineItem label="Contingency" value={contract.cTravelContingency} currency={cCurrency} />}
                      {includeNI && !seafarerExempt && <LineItem label="Employers NIC" value={contract.cTravelNI} currency={cCurrency} />}
                      {includeSubsistence && contract.cSubTravelAmt > 0 && <LineItem label="Travel Subsistence (Always 100%)" value={contract.cSubTravelAmt} currency={cCurrency} />}
                      <LineItem label={`Management Fee (Main)`} value={contract.cTravelManagementFee} currency={cCurrency} />
                      <div className="pt-3 border-t border-primary-foreground/20 print:border-gray-300 flex items-center justify-between">
                        <span className="text-sm font-bold">Travel Day Total</span>
                        <span className="font-mono font-bold text-base text-chart-1 tabular-nums transition-all">{formatCurrencyIn(contract.cTravelDayCharge, cCurrency)}</span>
                      </div>
                    </div>
                  </AnimatedSection>
                </div>

                <div className="bg-primary-foreground/5 print:bg-gray-50 p-8 md:p-10 border-t border-primary-foreground/10 print:border-gray-200 relative z-0">
                  {includeTrip ? (
                    <div className="animate-in fade-in duration-300">
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-primary-foreground/60 print:text-gray-500">Hitch Crew-Change Invoice</h3>
                        <div className="flex gap-2">
                           <ActionButton onClick={copyTripSummary} icon={Copy} label="Copy" />
                           <ActionButton onClick={printSchedule} icon={Printer} label="Print" />
                        </div>
                      </div>
                      <div className="space-y-4">

                        <div className="bg-primary-foreground/5 p-4 rounded-xl space-y-2 hover:bg-primary-foreground/10 transition-colors print:border print:border-gray-200 print:bg-white">
                          <div className="flex items-center justify-between text-sm font-bold text-primary-foreground/80 print:text-black">
                            <span>Days Onboard</span>
                            <span className="font-mono font-bold tabular-nums transition-all">{formatCurrencyIn(contract.tripWorkingTotal, cCurrency)}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-primary-foreground/50 print:text-gray-500 font-medium">{contract.nWorkingDays} days × {formatCurrencyIn(contract.cTotalCharge, cCurrency)}</span>
                          </div>
                        </div>

                        <div className="bg-primary-foreground/5 p-4 rounded-xl space-y-2 hover:bg-primary-foreground/10 transition-colors print:border print:border-gray-200 print:bg-white">
                          <div className="flex items-center justify-between text-sm font-bold text-primary-foreground/80 print:text-black">
                            <span>Travel Days ({contract.nTravelDays} occurrences)</span>
                            <span className="font-mono font-bold tabular-nums transition-all">{formatCurrencyIn(contract.tripTravelTotal, cCurrency)}</span>
                          </div>
                          <div className="flex flex-col text-xs text-primary-foreground/50 print:text-gray-500 font-medium">
                            <span>{contract.travelPayableDays} days pay + {contract.travelSubDays} full days sub</span>
                          </div>
                        </div>

                        {contract.logisticsTotal > 0 && (
                          <div className="bg-primary-foreground/5 p-4 rounded-xl flex flex-col gap-2 hover:bg-primary-foreground/10 transition-colors animate-in slide-in-from-top-2 fade-in print:border print:border-gray-200 print:bg-white">
                            <div className="flex items-center justify-between text-sm font-bold text-primary-foreground/80 print:text-black">
                              <span>Travel & Logistics Costs</span>
                              <span className="font-mono font-bold tabular-nums transition-all">{formatCurrencyIn(contract.logisticsTotal, cCurrency)}</span>
                            </div>
                            <span className="text-xs text-primary-foreground/50 print:text-gray-500 font-medium leading-relaxed">
                              Travel: {curSym(cCurrency)}{dbMobTravel || '0'} | VISA / Cert.: {curSym(cCurrency)}{dbMobVisas || '0'} | Agent: {curSym(cCurrency)}{dbMobAgent || '0'} <br />
                              {logisticsInFee && contract.logisticsFee > 0 && `${contract.travelFeeType === 'percentage' ? contract.cTravelFeeVal + '%' : 'Fixed'} Travel Fee: ${formatCurrencyIn(contract.logisticsFee, cCurrency)}`}
                            </span>
                          </div>
                        )}

                        <div className="pt-2 border-t-2 border-primary-foreground/30 print:border-gray-300 flex flex-col gap-2">
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="text-lg font-bold block">Total Hitch Invoice</span>
                              <span className="text-xs text-primary-foreground/50 print:text-gray-500 font-medium">{contract.nWorkingDays + contract.nTravelDays} days total</span>
                            </div>
                            <span className="text-3xl font-mono font-bold tracking-tight text-chart-1 animate-in zoom-in-95 duration-200 tabular-nums" key={contract.tripGrandTotal}>{formatCurrencyIn(contract.tripGrandTotal, cCurrency)}</span>
                          </div>

                          {cCurrency !== 'GBP' && cFx.rate !== null && (
                            <div className="flex items-center justify-between pt-2 mt-2 text-sm text-primary-foreground/60 print:text-gray-500 border-t border-primary-foreground/10 print:border-gray-200">
                               <span>Converted Equivalency (@ 1 {cCurrency} = {cFx.rate.toFixed(4)} GBP)</span>
                               <span className="font-mono font-bold tabular-nums text-white print:text-black">{formatCurrencyIn(contract.tripGrandTotal * cFx.rate, 'GBP')}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="animate-in fade-in duration-300 print:hidden">
                      <h3 className="text-xs font-bold uppercase tracking-widest text-primary-foreground/60 mb-6">Standard Revenue Projections</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <ProjectionCard label="Weekly" days={5} charge={contract.cTotalCharge} fee={contract.cManagementFee} currency={cCurrency} />
                        <ProjectionCard label="Monthly" days={21} charge={contract.cTotalCharge} fee={contract.cManagementFee} currency={cCurrency} />
                        <ProjectionCard label="Annual" days={230} charge={contract.cTotalCharge} fee={contract.cManagementFee} currency={cCurrency} />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* ─────────────── PERMANENT TAB ─────────────── */}
          <TabsContent value="perm" className="m-0 animate-in fade-in slide-in-from-bottom-2 duration-400">
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
                      <label htmlFor="perm-salary" className="block text-sm font-bold text-foreground">Candidate Annual Salary ({pCurrency})</label>
                      <NumInput id="perm-salary" value={salary} onChange={setSalary} prefix={curSym(pCurrency)} aria-label="Annual Salary" />
                    </div>

                    <AnimatedSection show={pCurrency !== 'GBP'}>
                      <div className="space-y-3 p-4 bg-input/30 border border-input rounded-xl mt-2">
                        <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                          <Globe className="h-4 w-4" />Exchange Rate
                        </div>
                        <div className="space-y-1">
                          <label htmlFor="p-fx-date" className="block text-xs font-bold text-muted-foreground uppercase tracking-wide">Placement / Start Date</label>
                          <input
                            id="p-fx-date"
                            type="date"
                            value={pFxDate}
                            onChange={e => setPFxDate(e.target.value)}
                            className="w-full px-4 py-2.5 bg-input/40 border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all text-sm font-medium"
                          />
                        </div>
                        <div className="flex items-center justify-between rounded-lg bg-card/60 px-3 py-2.5">
                          <div className="text-sm font-medium">
                            {pFx.loading ? (
                              <span className="text-muted-foreground">Fetching rate…</span>
                            ) : pFx.rate !== null ? (
                              <span className="font-mono font-bold animate-in fade-in duration-300">
                                1 {pCurrency} = {pFx.rate.toFixed(4)} GBP
                              </span>
                            ) : (
                              <span className="text-muted-foreground">No rate yet</span>
                            )}
                          </div>
                          <button onClick={pFx.refresh} aria-label="Refresh exchange rate" className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-input/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                            <RefreshCw className={cn('h-3.5 w-3.5', pFx.loading && 'animate-spin')} />
                          </button>
                        </div>
                        {pFx.error === 'future-date-fallback' && (
                          <div className="flex items-start gap-2 text-xs text-amber-500/90 font-medium">
                            <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                            <span>Future date selected. Showing today's latest rate instead.</span>
                          </div>
                        )}
                      </div>
                    </AnimatedSection>

                    <div className="space-y-2">
                      <label htmlFor="placement-fee" className="block text-sm font-bold text-foreground">Placement Fee (%)</label>
                      <NumInput id="placement-fee" value={placementFee} onChange={setPlacementFee} suffix="%" placeholder="0.0" />
                    </div>

                    <AnimatedSection show={pCurrency !== 'GBP'}>
                       <div className="flex justify-between group border-t border-border/60 pt-4">
                         <div className="space-y-1 pr-4">
                           <label className="text-sm font-bold text-foreground cursor-pointer group-hover:text-primary transition-colors" onClick={() => setInvoiceInOrigin(!invoiceInOrigin)}>Invoice in Origin Currency</label>
                           <p className="text-xs text-muted-foreground font-medium">Calculate placement fee in {pCurrency} instead of GBP</p>
                         </div>
                         <Switch checked={invoiceInOrigin} onCheckedChange={setInvoiceInOrigin} />
                       </div>
                    </AnimatedSection>

                    <div className="pt-4 flex justify-between border-t border-border/60 group">
                      <div className="space-y-1 pr-4">
                        <label className="text-sm font-bold text-foreground cursor-pointer group-hover:text-primary transition-colors" onClick={() => setIncludePermNI(!includePermNI)}>Include Employer's NI</label>
                        <p className="text-xs text-muted-foreground font-medium">Informational UK tax. ({activeFiscalRates.permNI * 100}% over £{activeFiscalRates.permNIThreshold})</p>
                      </div>
                      <Switch checked={includePermNI} onCheckedChange={setIncludePermNI} />
                    </div>
                  </div>
                </div>
                <AssumptionsAccordion fiscalRates={activeFiscalRates} />
              </div>

              <div className="lg:col-span-7 bg-primary text-primary-foreground rounded-2xl shadow-xl overflow-hidden flex flex-col relative print:col-span-12 print:shadow-none print:w-full print:bg-white print:text-black print:border-2">
                {perm.pSalaryInput === 0 && !salary ? (
                  <div className="absolute inset-0 z-10 bg-primary/95 flex flex-col items-center justify-center text-center p-10 animate-in fade-in duration-500 print:hidden">
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
                  <div className="mb-8 grid grid-cols-1 sm:grid-cols-2 gap-4 print:mb-6">
                    <input type="text" placeholder="Client Name (Optional)" aria-label="Client Name" value={clientName} onChange={e=>setClientName(e.target.value)} className="bg-transparent border-b border-primary-foreground/20 text-white placeholder:text-primary-foreground/40 px-1 py-1 focus:outline-none focus:border-primary-foreground/50 transition-colors print:text-black print:border-none print:p-0 print:font-bold print:text-2xl" />
                    <input type="text" placeholder="Candidate Name (Optional)" aria-label="Candidate Name" value={candidateName} onChange={e=>setCandidateName(e.target.value)} className="bg-transparent border-b border-primary-foreground/20 text-white placeholder:text-primary-foreground/40 px-1 py-1 focus:outline-none focus:border-primary-foreground/50 transition-colors print:text-black print:border-none print:p-0 print:text-gray-600 sm:text-right print:text-lg print:sm:mt-2" />
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                    <h2 className="text-xl font-bold">Invoice Breakdown</h2>
                    <div className="flex items-center gap-3">
                      <ActionButton onClick={copyPermSummary} icon={Copy} label="Copy" />
                      <ActionButton onClick={printSchedule} icon={Printer} label="Print PDF" />
                      <span className="text-xs uppercase tracking-widest font-bold px-3 py-1.5 bg-primary-foreground/10 rounded-full print:bg-gray-200">Permanent</span>
                    </div>
                  </div>
                  <div className="space-y-5">
                    <LineItem label={`Annual Salary (${pCurrency})`} value={perm.pSalaryInput} currency={pCurrency} />
                    {pCurrency !== 'GBP' && (
                      <LineItem
                        label={pFx.rate !== null ? `Converted @ 1 ${pCurrency} = ${pFx.rate.toFixed(4)} GBP` : 'Converted (awaiting rate…)'}
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
                        <LineItem label={`Placement Fee (${perm.pFeePct.toFixed(1)}%)`} value={perm.pPlacementFee} isBold currency={invoiceInOrigin ? pCurrency : 'GBP'} />
                        <div className="text-xs text-primary-foreground/60 print:text-gray-500 font-medium bg-primary-foreground/5 print:bg-gray-50 print:border print:border-gray-200 p-2.5 rounded-lg flex items-center gap-2">
                          <Info className="h-3.5 w-3.5 shrink-0" />
                          <span>Fee = {perm.pFeePct}% × {formatCurrencyIn(invoiceInOrigin ? perm.pSalaryInput : perm.pSalary, invoiceInOrigin ? pCurrency : 'GBP')}</span>
                        </div>
                      </>
                    )}
                    {includePermNI && perm.pFxReady && (<><div className="h-px bg-primary-foreground/20 my-4 print:bg-gray-300" /><LineItem label="Employer's NI on Salary (UK Tax)" value={perm.pEmployerNI} currency="GBP" /></>)}

                    <div className="mt-4 pt-5 border-t-2 border-primary-foreground/30 print:border-gray-300">
                      <div className="flex items-center justify-between">
                        <span className="text-lg font-bold">Total Invoice to Client</span>
                        <span className="text-3xl font-mono font-bold tracking-tight text-chart-1 animate-in zoom-in-95 duration-200 tabular-nums" key={perm.pTotalCost}>{formatCurrencyIn(includePermNI ? perm.pTotalCost : perm.pPlacementFee, invoiceInOrigin ? pCurrency : 'GBP')}</span>
                      </div>
                      <div aria-live="polite" className="sr-only">
                        Placement Fee Invoice is {formatCurrencyIn(includePermNI ? perm.pTotalCost : perm.pPlacementFee, invoiceInOrigin ? pCurrency : 'GBP')}
                      </div>
                      <p className="text-xs text-primary-foreground/50 print:text-gray-500 font-medium mt-1">
                        {invoiceInOrigin && pCurrency !== 'GBP' && includePermNI 
                          ? "Notice: Cost blends multiple currencies." 
                          : invoiceInOrigin 
                            ? `Invoiced strictly in ${pCurrency}.`
                            : "Invoiced in GBP regardless of origin salary currency."}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* ─────────────── PAYMENT DAYS TAB ─────────────── */}
          <TabsContent value="paydays" className="m-0 animate-in fade-in slide-in-from-bottom-2 duration-400">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-5 flex flex-col gap-6 print:hidden">
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
                    <label htmlFor="pd-start" className="block text-sm font-bold">Start Date</label>
                    <input id="pd-start" type="date" value={pdStartDate} onChange={e => setPdStartDate(e.target.value)} className="w-full px-4 py-3 bg-input/40 border border-input rounded-xl font-medium tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all duration-200" />
                    <SegmentedControl value={pdStartMode} onChange={setPdStartMode} options={[{label: '0.5 rate', value: 'half'}, {label: 'Full', value: 'full'}, {label: 'Custom', value: 'custom'}]} ariaLabel="Start Mode" />
                    <AnimatedSection show={pdStartMode === 'custom'} className="pt-2">
                       <NumInput id="pd-start-custom" value={pdStartCustomVal} onChange={setPdStartCustomVal} placeholder="0.5" suffix="days" />
                    </AnimatedSection>
                  </div>

                  <div className="space-y-3 pt-4 border-t border-border/60">
                    <label htmlFor="pd-finish" className="block text-sm font-bold">Finish Date</label>
                    <input id="pd-finish" type="date" value={pdFinishDate} onChange={e => setPdFinishDate(e.target.value)} className="w-full px-4 py-3 bg-input/40 border border-input rounded-xl font-medium tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all duration-200" />
                    <SegmentedControl value={pdFinishMode} onChange={setPdFinishMode} options={[{label: '0.5 rate', value: 'half'}, {label: 'Full', value: 'full'}, {label: 'Custom', value: 'custom'}]} ariaLabel="Finish Mode" />
                    <AnimatedSection show={pdFinishMode === 'custom'} className="pt-2">
                       <NumInput id="pd-finish-custom" value={pdFinishCustomVal} onChange={setPdFinishCustomVal} placeholder="0.5" suffix="days" />
                    </AnimatedSection>
                  </div>

                  <div className="space-y-3 pt-4 border-t border-border/60 group">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-bold cursor-pointer group-hover:text-primary transition-colors" onClick={() => setPdIncludeSubsistence(!pdIncludeSubsistence)}>Include Subsistence</label>
                      <Switch checked={pdIncludeSubsistence} onCheckedChange={setPdIncludeSubsistence} />
                    </div>
                    <AnimatedSection show={pdIncludeSubsistence} className="pt-2">
                      <label htmlFor="pd-sub-rate" className="block text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">Subsistence Rate (£ per day)</label>
                      <NumInput id="pd-sub-rate" value={pdSubsistenceRate} onChange={setPdSubsistenceRate} prefix="£" />
                    </AnimatedSection>
                  </div>

                  <div className="space-y-3 pt-4 border-t border-border/60 group">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-bold cursor-pointer group-hover:text-primary transition-colors" onClick={() => setPdIncludePay(!pdIncludePay)}>Calculate Period Pay & Advances</label>
                      <Switch checked={pdIncludePay} onCheckedChange={setPdIncludePay} />
                    </div>
                    <AnimatedSection show={pdIncludePay} className="pt-2">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label htmlFor="pd-day-rate" className="block text-xs font-bold text-muted-foreground uppercase tracking-wide">Day Rate (£)</label>
                          <NumInput id="pd-day-rate" value={pdDayRate} onChange={setPdDayRate} prefix="£" />
                        </div>
                        <div className="space-y-2">
                          <label htmlFor="pd-advance" className="block text-xs font-bold text-muted-foreground uppercase tracking-wide">Advance Deduction (£)</label>
                          <NumInput id="pd-advance" value={pdAdvance} onChange={setPdAdvance} prefix="£" />
                        </div>
                      </div>
                    </AnimatedSection>
                  </div>
                </div>
                <AssumptionsAccordion fiscalRates={activeFiscalRates} />
              </div>

              <div className="lg:col-span-7 bg-primary text-primary-foreground rounded-2xl shadow-xl overflow-hidden flex flex-col relative print:col-span-12 print:shadow-none print:w-full print:text-black print:bg-white print:border-2">
                <div className="p-8 md:p-10 flex-grow relative z-0">

                  <div className="hidden print:block text-xs text-gray-500 mb-4 uppercase tracking-widest font-bold">
                    Generated on {new Date().toLocaleDateString('en-GB')}
                  </div>

                  <div className="mb-8 grid grid-cols-1 sm:grid-cols-2 gap-4 print:mb-6">
                    <input type="text" placeholder="Client Name (Optional)" aria-label="Client Name" value={clientName} onChange={e=>setClientName(e.target.value)} className="bg-transparent border-b border-primary-foreground/20 text-white placeholder:text-primary-foreground/40 px-1 py-1 focus:outline-none focus:border-primary-foreground/50 transition-colors print:text-black print:border-none print:p-0 print:font-bold print:text-2xl" />
                    <input type="text" placeholder="Candidate Name (Optional)" aria-label="Candidate Name" value={candidateName} onChange={e=>setCandidateName(e.target.value)} className="bg-transparent border-b border-primary-foreground/20 text-white placeholder:text-primary-foreground/40 px-1 py-1 focus:outline-none focus:border-primary-foreground/50 transition-colors print:text-black print:border-none print:p-0 print:text-gray-600 sm:text-right print:text-lg print:sm:mt-2" />
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                    <div className="flex items-center gap-3">
                      <h2 className="text-xl font-bold">Payroll Summary</h2>
                      <span className="text-xs uppercase tracking-widest font-bold px-3 py-1.5 bg-primary-foreground/10 rounded-full print:bg-gray-200">
                        {pdPayrollType === 'monthly' ? 'Monthly' : 'Fortnightly'}
                      </span>
                    </div>
                    {paydays.splits.length > 0 && (
                      <div className="flex items-center gap-2 print:hidden">
                        <ActionButton onClick={copyPaydaysSummary} icon={Copy} label="Copy" />
                        <ActionButton onClick={printSchedule} icon={Printer} label="Print PDF" />
                        <ActionButton onClick={exportScheduleCSV} icon={Download} label="CSV" />
                      </div>
                    )}
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
                        <p className="text-6xl font-mono font-bold text-chart-1 animate-in zoom-in-95 duration-200 tabular-nums" key={paydays.totalDays}>{paydays.totalDays}</p>
                        {pdStartDate === pdFinishDate ? (
                          <p className="text-xs text-primary-foreground/50 font-medium mt-2 print:text-gray-500">
                            Single day
                          </p>
                        ) : (
                          <p className="text-xs text-primary-foreground/50 font-medium mt-2 print:text-gray-500">
                            {formatUK(parseDate(pdStartDate))} → {formatUK(parseDate(pdFinishDate))}
                          </p>
                        )}

                        {(pdIncludeSubsistence || pdIncludePay) && (
                          <div className="mt-6 pt-5 border-t border-primary-foreground/10 text-left space-y-2 print:border-gray-300">
                            {pdIncludePay && (
                              <div className="flex justify-between items-center text-sm">
                                <span className="text-primary-foreground/60 font-medium print:text-gray-600">Gross Pay ({paydays.totalDays} × {formatCurrencyIn(pdDayRateVal, 'GBP')})</span>
                                <span className="font-mono font-bold text-white print:text-black tabular-nums">{formatCurrencyIn(pdTotalGross, 'GBP')}</span>
                              </div>
                            )}
                            {pdIncludeSubsistence && pdSubsistenceRate && (
                              <div className="flex justify-between items-center text-sm">
                                <span className="text-primary-foreground/60 font-medium print:text-gray-600">Subsistence ({paydays.totalSubDays}d)</span>
                                <span className="font-mono font-bold text-white print:text-black tabular-nums">{formatCurrencyIn(paydays.totalSub || 0, 'GBP')}</span>
                              </div>
                            )}
                            {pdIncludePay && pdAdvanceVal > 0 && (
                              <div className="flex justify-between items-center text-sm">
                                <span className="text-red-400 font-medium">Less Advance</span>
                                <span className="font-mono font-bold text-red-400 tabular-nums">-{formatCurrencyIn(pdAdvanceVal, 'GBP')}</span>
                              </div>
                            )}
                            {pdIncludePay && (
                              <div className="flex justify-between items-center pt-2 mt-2 border-t border-primary-foreground/10 text-base print:border-gray-300">
                                <span className="font-bold text-white print:text-black">Total Net Pay</span>
                                <span className="font-mono font-bold text-chart-1 animate-in zoom-in-95 duration-200 tabular-nums" key={pdTotalNet}>{formatCurrencyIn(pdTotalNet, 'GBP')}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <div aria-live="polite" className="sr-only">
                        {pdIncludePay ? `Total Net Pay is ${formatCurrencyIn(pdTotalNet, 'GBP')}` : `Total Payable Days: ${paydays.totalDays}`}
                      </div>

                      <div className="space-y-3">
                        <p className="text-xs font-bold uppercase tracking-widest text-primary-foreground/50 px-1 print:text-gray-600">
                          Payment Schedule
                        </p>
                        {paydays.splits.map((split, idx) => (
                          <div key={idx} className="bg-primary-foreground/10 rounded-xl overflow-hidden hover:bg-primary-foreground/20 transition-colors print:border print:border-gray-300 print:bg-white print:text-black print:break-inside-avoid">
                            <div className="flex items-center justify-between px-4 py-3 border-b border-primary-foreground/10 print:border-gray-200">
                              <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-2">
                                {pdPayrollType === 'fortnightly' ? (
                                  <span className="text-sm font-bold text-white print:text-black">{split.periodLabel}</span>
                                ) : (
                                  <span className="text-xs font-medium text-primary-foreground/50 print:text-gray-500">
                                    {formatUK(split.periodStart)} – {formatUK(split.periodEnd)}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-3">
                                {pdPayrollType === 'monthly' && (
                                  <span className="text-sm font-bold text-blue-400 print:text-blue-600">{split.periodLabel}</span>
                                )}
                                <span className="font-mono font-bold text-chart-1 text-base tabular-nums">
                                  {split.days % 1 === 0 ? split.days.toFixed(0) : formatNumber(split.days)} days
                                </span>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 divide-x divide-primary-foreground/10 print:divide-gray-200">
                              <div className="px-4 py-2.5">
                                <p className="text-xs text-primary-foreground/50 font-medium mb-0.5 print:text-gray-500">Cut-off</p>
                                <p className="font-mono font-bold text-sm text-white print:text-black tabular-nums">{formatUK(split.cutoff)}</p>
                              </div>
                              <div className="px-4 py-2.5">
                                <p className="text-xs text-primary-foreground/50 font-medium mb-0.5 print:text-gray-500">Payday</p>
                                <p className="font-mono font-bold text-sm text-chart-1 print:text-black tabular-nums">{formatUK(split.payday)}</p>
                              </div>
                            </div>
                            {(pdIncludePay || pdIncludeSubsistence) && (
                              <div className="px-4 py-2.5 border-t border-primary-foreground/10 bg-primary-foreground/5 flex flex-col gap-1.5 print:border-gray-200 print:bg-gray-50">
                                {pdIncludePay && (
                                  <div className="flex justify-between items-center text-xs">
                                    <span className="text-primary-foreground/60 print:text-gray-600">Period Gross Pay</span>
                                    <span className="font-mono font-bold text-white print:text-black tabular-nums">{formatCurrencyIn(split.days * pdDayRateVal, 'GBP')}</span>
                                  </div>
                                )}
                                {pdIncludeSubsistence && pdSubsistenceRate && (
                                  <div className="flex justify-between items-center text-xs">
                                    <div className="flex items-center gap-1.5 text-primary-foreground/60 print:text-gray-600">
                                      <span>Sub. Days:</span>
                                      <div className="relative flex items-center gap-1">
                                        <input 
                                          type="number"
                                          value={subDaysOverrides[idx] ?? ''}
                                          onChange={e => setSubDaysOverrides(prev => ({...prev, [idx]: e.target.value}))}
                                          placeholder={split.days.toString()}
                                          title="Override subsistence days"
                                          aria-label="Override subsistence days"
                                          className="w-12 bg-background/30 border border-primary-foreground/20 rounded px-1 py-0.5 text-white print:text-black print:border-gray-300 text-center focus:outline-none focus:border-primary-foreground/50 transition-colors font-mono tabular-nums placeholder:text-primary-foreground/40 print:placeholder:text-gray-400"
                                        />
                                        {subDaysOverrides[idx] !== undefined && (
                                          <button 
                                            onClick={() => setSubDaysOverrides(prev => { const newObj = {...prev}; delete newObj[idx]; return newObj; })}
                                            className="text-primary-foreground/40 hover:text-red-400 print:hidden transition-colors"
                                            title="Reset to default days"
                                            aria-label="Reset default days"
                                          >
                                            <RotateCcw className="h-3 w-3" />
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                    <span className="font-mono font-bold text-white print:text-black tabular-nums">{formatCurrencyIn(split.subDays * (parseFloat(pdSubsistenceRate) || 0), 'GBP')}</span>
                                  </div>
                                )}
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

const LineItem = React.memo(function LineItem({ label, value, isBold = false, currency = 'GBP' }: any) {
  return (
    <div className={cn('flex items-center justify-between py-1 group', isBold ? 'text-white font-bold' : 'text-primary-foreground/80 hover:text-white transition-colors')}>
      <span className="text-sm font-medium">{label}</span>
      <span className={cn('font-mono tracking-tight tabular-nums transition-all', isBold ? 'text-base font-bold' : 'text-sm font-semibold')}>
        {formatCurrencyIn(value, currency)}
      </span>
    </div>
  );
});

const ProjectionCard = React.memo(function ProjectionCard({ label, days, charge, fee, currency = 'GBP' }: { label: string; days: number; charge: number; fee: number; currency?: string }) {
  return (
    <div className="bg-primary-foreground/5 p-5 rounded-xl hover:bg-primary-foreground/10 transition-colors print:border print:border-gray-200 print:bg-white">
      <div className="text-sm font-bold text-white mb-4 flex items-center justify-between border-b border-primary-foreground/10 pb-2 print:text-black">
        {label}
        <span className="text-xs font-medium text-primary-foreground/60 bg-primary-foreground/10 px-2 py-0.5 rounded-md print:bg-gray-100 print:text-gray-600">{days} Days</span>
      </div>
      <div className="space-y-2.5">
        <div className="flex justify-between text-sm">
          <span className="text-primary-foreground/70 font-medium print:text-gray-600">Charge</span>
          <span className="font-mono font-bold text-chart-1 tabular-nums transition-all">{formatCurrencyIn(charge * days, currency)}</span>
        </div>
        <div className="flex justify-between text-sm pt-2 border-t border-primary-foreground/10 print:border-gray-200">
          <span className="text-primary-foreground/70 font-medium print:text-gray-600">Fee Margin</span>
          <span className="font-mono font-bold text-white print:text-black tabular-nums transition-all">{formatCurrencyIn(fee * days, currency)}</span>
        </div>
      </div>
    </div>
  );
});

function AssumptionsAccordion({ maritime = false, fiscalRates }: { maritime?: boolean, fiscalRates: any }) {
  return (
    <details className="group [&_summary::-webkit-details-marker]:hidden bg-card border border-card-border rounded-2xl shadow-sm transition-all overflow-hidden print:hidden">
      <summary className="flex items-center justify-between cursor-pointer font-bold text-sm p-6 hover:bg-input/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
        Calculation Assumptions
        <ChevronDown className="h-4 w-4 text-muted-foreground group-open:rotate-180 transition-transform duration-300" />
      </summary>
      <div className="px-6 pb-6 pt-0 space-y-4 text-xs text-muted-foreground font-medium border-t border-border/40 mt-2">
        {maritime ? (
          <>
            <div className="space-y-1">
              <strong className="text-foreground block">Seafarer NI Exemption</strong>
              <p>Standard NI is calculated at {fiscalRates.employerNI * 100}%. When "Seafarer Exemption" is toggled, Employer NI evaluates to 0, assuming the vessel operates fully outside the UK Continental Shelf (UKCS) or is a non-UK flagged vessel avoiding UK NIC obligations.</p>
            </div>
            <div className="space-y-1">
              <strong className="text-foreground block">Subsistence Rules (Travel vs Victualling)</strong>
              <p>Travel day subsistence is always paid at full rate, so for a 0.5 day, it is still a full subsistence payment (e.g. two 0.5 travel days = 2 full days of subsistence). Onboard subsistence is applied to working days.</p>
            </div>
          </>
        ) : (
          <div className="space-y-1">
            <strong className="text-foreground block">Employer NI Calculation</strong>
            <p>Perm NI informational calculation assumes {fiscalRates.permNI * 100}% over the £{fiscalRates.permNIThreshold} secondary threshold.</p>
          </div>
        )}
        <div className="space-y-1">
          <strong className="text-foreground block">Payment Days & Payroll</strong>
          <p>Monthly payday lands on the 28th, moving backward to the previous working day if falling on a weekend/bank holiday. Subsistence days per period automatically match the payable days, but can be manually overridden in the summary breakdown (e.g., deducting 1 day for unpaid travel).</p>
        </div>
      </div>
    </details>
  );
}