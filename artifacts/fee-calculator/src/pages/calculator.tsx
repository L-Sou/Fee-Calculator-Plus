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
  periodStart: Date; periodEnd: Date; cutoff: Date; payday: Date; periodLabel: string; days: number; subDays: number;
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
  <div className="relative group flex-1">
    {prefix && <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-mono pointer-events-none transition-colors group-focus-within:text-primary">{prefix}</span>}
    <input
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
      <label key={opt.value} className={cn('flex-1 text-center cursor-pointer px-3 py-1.5 rounded-lg text-sm font-bold transition-all duration-300 focus-within:ring-2 focus-within:ring-primary',
        value === opt.value ? 'bg-primary text-primary-foreground shadow scale-100' : 'text-muted-foreground hover:text-foreground scale-95')}
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

// Smooth expandable container for toggled sections
function AnimatedSection({ show, children, className }: { show: boolean, children: React.ReactNode, className?: string }) {
  return (
    <div className={cn("grid transition-all duration-400 ease-in-out", show ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0 pointer-events-none")}>
      <div className={cn("overflow-hidden", className)}>
        {children}
      </div>
    </div>
  );
}

// ─── 5. Main Application Component ────────────────────────────────────────────

export default function CalculatorPage() {
  const { showToast, ToastContainer } = useToast();
  const bankHolidays = useBankHolidays();
  const [mode, setMode] = useState<'contract' | 'perm' | 'paydays'>('contract');

  // Core Contract State
  const [consolidatedRate, setConsolidatedRate] = useState('');
  const [feeType, setFeeType] = useLocalStorage<'percentage' | 'fixed'>('calc_fee_type', 'percentage');
  const [margin, setMargin] = useLocalStorage('calc_margin', '15');
  const [includeNI, setIncludeNI] = useLocalStorage('calc_inc_ni', true);
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

  // Separate Travel Fee State (Applied only to Logistics/Costs)
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
  const [subDaysOverrides, setSubDaysOverrides] = useState<Record<number, string>>({});

  const [pdIncludePay, setPdIncludePay] = useLocalStorage('calc_pd_inc_pay', false);
  const [pdDayRate, setPdDayRate] = useLocalStorage('calc_pd_day_rate', '');
  const [pdAdvance, setPdAdvance] = useLocalStorage('calc_pd_advance', '');

  // FX Rate State
  const [pFxRate, setPFxRate] = useState<number | null>(null);
  const [pFxLoading, setPFxLoading] = useState(false);
  const [pFxError, setPFxError] = useState<string | null>(null);
  const [pFxRefreshKey, setPFxRefreshKey] = useState(0);

  // Reset Overrides if dates or modes change
  useEffect(() => {
    setSubDaysOverrides({});
  }, [pdStartDate, pdFinishDate, pdPayrollType, pdStartMode, pdStartCustomVal, pdFinishMode, pdFinishCustomVal]);

  const reset = () => {
    setConsolidatedRate(''); setWorkingDays('28'); setTravelDays('2');
    setMobTravel(''); setMobVisas(''); setMobAgent(''); setSalary('50000');
    setPdStartDate(''); setPdFinishDate(''); setPdDayRate(''); setPdAdvance('');
    setSubDaysOverrides({});
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
    const cMarginVal = parseFloat(margin) || 0;
    const cTravelFeeVal = parseFloat(travelFee) || 0;
    const cNiMultiplier = (includeNI && !seafarerExempt) ? 0.155 : 0;

    // Subsistence values
    const cSubTravelAmt = includeSubsistence ? (parseFloat(subsistenceTravel) || 0) : 0;
    const cSubOnboardAmt = includeSubsistence ? (parseFloat(subsistenceOnboard) || 0) : 0;

    // Daily Onboard Charge 
    const cEmployerNI = cRate * cNiMultiplier;
    const cFeeBase = cRate + cEmployerNI + (subsistenceInFee ? cSubOnboardAmt : 0);
    const cManagementFee = feeType === 'percentage' ? cFeeBase * (cMarginVal / 100) : cMarginVal;
    const cTotalCharge = cRate + cEmployerNI + cSubOnboardAmt + cManagementFee;

    // Travel Days Math (Decoupled to ensure 100% subsistence)
    const nWorkingDays = Math.max(0, parseFloat(workingDays) || 0);
    const nTravelDays = Math.max(0, parseFloat(travelDays) || 0);

    const travelRateMultiplier = travelDayFull ? 1 : 0.5;
    const travelPayableDays = nTravelDays * travelRateMultiplier; 
    const travelSubDays = Math.ceil(nTravelDays); 

    const totalTravelPay = travelPayableDays * cRate;
    const totalTravelNI = travelPayableDays * (cRate * cNiMultiplier);
    const totalTravelSub = travelSubDays * cSubTravelAmt;

    const totalTravelFeeBase = totalTravelPay + totalTravelNI + (subsistenceInFee ? totalTravelSub : 0);
    const totalTravelManagementFee = feeType === 'percentage' 
      ? totalTravelFeeBase * (cMarginVal / 100) 
      : cMarginVal * travelSubDays;

    const tripTravelTotal = totalTravelPay + totalTravelNI + totalTravelSub + totalTravelManagementFee;

    // Single reference day for the UI Breakdown block
    const cTravelRate = cRate * travelRateMultiplier;
    const cTravelNI = cTravelRate * cNiMultiplier;
    const cTravelFeeBase = cTravelRate + cTravelNI + (subsistenceInFee ? cSubTravelAmt : 0);
    const cTravelManagementFee = feeType === 'percentage' ? cTravelFeeBase * (cMarginVal / 100) : cMarginVal;
    const cTravelDayCharge = cTravelRate + cTravelNI + cSubTravelAmt + cTravelManagementFee;

    // Logistics & Travel Costs (Where the separate Travel Fee is applied)
    const fTravel = parseFloat(mobTravel) || 0;
    const fVisas = parseFloat(mobVisas) || 0;
    const fAgent = parseFloat(mobAgent) || 0;
    const logisticsBase = fTravel + fVisas + fAgent;

    const logisticsFee = logisticsInFee 
      ? (travelFeeType === 'percentage' ? logisticsBase * (cTravelFeeVal / 100) : cTravelFeeVal) 
      : 0;
    const logisticsTotal = logisticsBase + logisticsFee;

    // Grand Totals
    const tripWorkingTotal = nWorkingDays * cTotalCharge;
    const tripGrandTotal = tripWorkingTotal + tripTravelTotal + logisticsTotal;

    return {
      cRate, cMarginVal, feeType, cEmployerNI, cTotalCharge, cManagementFee,
      cSubTravelAmt, cSubOnboardAmt,
      cTravelRate, cTravelNI, cTravelFeeVal, travelFeeType, cTravelManagementFee, cTravelDayCharge,
      nWorkingDays, nTravelDays, travelPayableDays, travelSubDays,
      logisticsBase, logisticsFee, logisticsTotal,
      tripWorkingTotal, tripTravelTotal, tripGrandTotal,
      totalBarVal: Math.max(cTotalCharge, 1)
    };
  }, [consolidatedRate, feeType, margin, includeNI, seafarerExempt, subsistenceTravel, subsistenceOnboard, includeSubsistence, subsistenceInFee, travelDayFull, travelFeeType, travelFee, workingDays, travelDays, mobTravel, mobVisas, mobAgent, logisticsInFee]);

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
    if (!pdStartDate || !pdFinishDate) return { splits: [], error: null, totalDays: null, totalSubDays: null, totalSub: null };
    const start = parseDate(pdStartDate);
    const finish = parseDate(pdFinishDate);
    if (finish < start) return { splits: [], error: 'Finish date must be on or after start date.', totalDays: null, totalSubDays: null, totalSub: null };

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

      const splits: any[] = [];
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

      // Final Map applying any manual Sub Days overrides
      const finalSplits = splits.map((s, idx) => {
        const override = subDaysOverrides[idx];
        const subDays = (override !== undefined && override !== '') ? (parseFloat(override) || 0) : s.days;
        return { ...s, subDays };
      });

      return { 
        splits: finalSplits, 
        error: null, 
        totalDays: finalSplits.reduce((sum, s) => sum + s.days, 0), 
        totalSubDays: finalSplits.reduce((sum, s) => sum + s.subDays, 0),
        totalSub: pdIncludeSubsistence ? finalSplits.reduce((sum, s) => sum + s.subDays * subAmt, 0) : null 
      };
    } catch {
      return { splits: [], error: 'Calculation failed.', totalDays: null, totalSubDays: null, totalSub: null };
    }
  }, [pdStartDate, pdFinishDate, pdPayrollType, pdStartMode, pdStartCustomVal, pdFinishMode, pdFinishCustomVal, pdIncludeSubsistence, pdSubsistenceRate, bankHolidays, subDaysOverrides]);

  // Payment Days derived math
  const pdDayRateVal = parseFloat(pdDayRate) || 0;
  const pdAdvanceVal = parseFloat(pdAdvance) || 0;
  const pdTotalGross = (paydays.totalDays || 0) * pdDayRateVal;
  const pdTotalNet = pdTotalGross + (paydays.totalSub || 0) - pdAdvanceVal;

  // ─── Export Functions ───
  const copyContractBreakdown = () => {
    const text = `Maritime Contract Charge Breakdown (Per Day)
-----------------------------------
Consolidated Rate: ${formatCurrency(contract.cRate)}
${includeNI && !seafarerExempt ? `Employer's NIC: ${formatCurrency(contract.cEmployerNI)}\n` : ''}${seafarerExempt ? `Employer's NIC: Exempt (Seafarer/Non-UKCS)\n` : ''}${includeSubsistence && contract.cSubOnboardAmt > 0 ? `Victualling/Onboard Subsistence: ${formatCurrency(contract.cSubOnboardAmt)}\n` : ''}Management Fee (${contract.feeType === 'percentage' ? `${contract.cMarginVal}%` : 'Fixed'}): ${formatCurrency(contract.cManagementFee)}
-----------------------------------
Total Charge Rate (Onboard): ${formatCurrency(contract.cTotalCharge)}`;
    navigator.clipboard.writeText(text);
    showToast('Charge breakdown copied');
  };

  const copyTripSummary = () => {
    const text = `Hitch & Crew Change Invoice Summary
-----------------------------------
Hitch Days (${contract.nWorkingDays}): ${formatCurrency(contract.tripWorkingTotal)}
Travel Days (${contract.nTravelDays}): ${formatCurrency(contract.tripTravelTotal)}
${contract.logisticsTotal > 0 ? `Travel & Logistics Costs: ${formatCurrency(contract.logisticsTotal)}\n` : ''}-----------------------------------
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

  const copyPaydaysSummary = () => {
    if (!paydays.splits.length) return;
    const subAmt = pdIncludeSubsistence ? (parseFloat(pdSubsistenceRate) || 0) : 0;

    let text = `Payment Days Schedule\n-----------------------------------\n`;
    text += `Payroll Type: ${pdPayrollType === 'monthly' ? 'Monthly' : 'Fortnightly'}\n`;
    text += `Total Payable Days: ${paydays.totalDays}\n`;

    if (pdIncludePay) {
      text += `Day Rate: ${formatCurrency(pdDayRateVal)}\n`;
      text += `Total Gross Pay: ${formatCurrency(pdTotalGross)}\n`;
      if (pdIncludeSubsistence && paydays.totalSub !== null && paydays.totalSub > 0) {
         text += `Total Subsistence (${paydays.totalSubDays}d): ${formatCurrency(paydays.totalSub)}\n`;
      }
      if (pdAdvanceVal > 0) text += `Advance Deduction: -${formatCurrency(pdAdvanceVal)}\n`;
      text += `Total Net Pay: ${formatCurrency(pdTotalNet)}\n`;
    } else if (pdIncludeSubsistence && paydays.totalSub !== null) {
      text += `Total Subsistence (${paydays.totalSubDays}d): ${formatCurrency(paydays.totalSub)}\n`;
    }

    text += `-----------------------------------\n\n`;

    paydays.splits.forEach(s => {
      text += `${pdPayrollType === 'fortnightly' ? s.periodLabel : `${formatUK(s.periodStart)} – ${formatUK(s.periodEnd)}`}\n`;
      text += `Cut-off: ${formatUK(s.cutoff)} | Payday: ${formatUK(s.payday)}\n`;
      text += `Payable Days: ${s.days % 1 === 0 ? s.days.toFixed(0) : formatNumber(s.days)}`;

      if (pdIncludePay && pdDayRateVal > 0) {
         text += ` | Gross Pay: ${formatCurrency(s.days * pdDayRateVal)}`;
      }
      if (pdIncludeSubsistence && subAmt > 0) {
         text += ` | Subsistence (${s.subDays}d): ${formatCurrency(s.subDays * subAmt)}`;
      }
      text += `\n\n`;
    });

    navigator.clipboard.writeText(text.trim());
    showToast('Payment schedule copied');
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
            <TabsTrigger value="contract" className="flex gap-2 text-xs sm:text-sm rounded-lg data-[state=active]:shadow-sm transition-all duration-300"><Ship className="h-4 w-4" />Contract <span className="hidden sm:inline">& Hitch</span></TabsTrigger>
            <TabsTrigger value="perm" className="flex gap-2 text-xs sm:text-sm rounded-lg data-[state=active]:shadow-sm transition-all duration-300"><Briefcase className="h-4 w-4" />Permanent</TabsTrigger>
            <TabsTrigger value="paydays" className="flex gap-2 text-xs sm:text-sm rounded-lg data-[state=active]:shadow-sm transition-all duration-300"><CalendarDays className="h-4 w-4" />Payment Days</TabsTrigger>
          </TabsList>

          {/* ─────────────── MARITIME CONTRACT TAB ─────────────── */}
          <TabsContent value="contract" className="m-0 animate-in fade-in slide-in-from-bottom-2 duration-400">
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
                    <div className="flex items-center justify-between">
                      <label className="block text-sm font-bold">Management Fee</label>
                      <div className="w-32">
                        <SegmentedControl 
                          value={feeType} 
                          onChange={setFeeType} 
                          options={[{label: '%', value: 'percentage'}, {label: '£', value: 'fixed'}]} 
                          ariaLabel="Management Fee Type"
                        />
                      </div>
                    </div>
                    <NumInput 
                      value={margin} 
                      onChange={setMargin} 
                      prefix={feeType === 'fixed' ? '£' : undefined} 
                      suffix={feeType === 'percentage' ? '%' : undefined} 
                      placeholder="0.0" 
                    />
                  </div>

                  <div className="pt-4 space-y-4 border-t border-border/60">
                    <div className="flex justify-between group">
                      <div className="space-y-1 pr-4">
                        <label className="text-sm font-bold cursor-pointer group-hover:text-primary transition-colors" onClick={() => setIncludeNI(!includeNI)}>Include Employer's NI</label>
                      </div>
                      <Switch checked={includeNI} onCheckedChange={setIncludeNI} />
                    </div>

                    <AnimatedSection show={includeNI}>
                      <div className="flex justify-between group bg-amber-500/10 p-3 rounded-lg border border-amber-500/20 mt-4">
                        <div className="space-y-1 pr-4">
                          <label className="text-sm font-bold text-amber-600 dark:text-amber-400 cursor-pointer" onClick={() => setSeafarerExempt(!seafarerExempt)}>Seafarer Exemption</label>
                          <p className="text-xs text-amber-600/80 dark:text-amber-400/80 font-medium">Vessel non-UK flagged / outside UKCS. NI evaluates to £0.</p>
                        </div>
                        <Switch checked={seafarerExempt} onCheckedChange={setSeafarerExempt} className="data-[state=checked]:bg-amber-500" />
                      </div>
                    </AnimatedSection>
                  </div>
                </div>

                {/* Split Subsistence */}
                <div className="bg-card border border-card-border p-7 rounded-2xl shadow-sm">
                  <div className="flex items-center gap-3 border-b border-border pb-4">
                    <div className="p-2 bg-primary/10 rounded-lg text-primary"><UtensilsCrossed className="h-4 w-4" /></div>
                    <div className="flex-1">
                      <h2 className="text-base font-bold">Subsistence & Victualling</h2>
                    </div>
                    <Switch checked={includeSubsistence} onCheckedChange={(v) => { setIncludeSubsistence(v); if (!v) setSubsistenceInFee(false); }} />
                  </div>
                  <AnimatedSection show={includeSubsistence} className="pt-4 space-y-5">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wide">Travel (£/day)</label>
                        <NumInput value={subsistenceTravel} onChange={setSubsistenceTravel} prefix="£" />
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
                  </AnimatedSection>
                </div>

                {/* Hitch Calculator */}
                <div className="bg-card border border-card-border p-7 rounded-2xl shadow-sm">
                  <div className="flex items-center gap-3 border-b border-border pb-4">
                    <div className="p-2 bg-primary/10 rounded-lg text-primary"><Anchor className="h-4 w-4" /></div>
                    <div className="flex-1">
                      <h2 className="text-base font-bold">Hitch & Mob/Demob Scheduler</h2>
                    </div>
                    <Switch checked={includeTrip} onCheckedChange={setIncludeTrip} />
                  </div>

                  <AnimatedSection show={includeTrip} className="pt-4 space-y-5">
                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wide">Days Onboard</label>
                      <NumInput value={workingDays} onChange={setWorkingDays} placeholder="28" />
                    </div>

                    <div className="space-y-4 pt-4 border-t border-border/50">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wide">Travel Days</label>
                          <NumInput value={travelDays} onChange={setTravelDays} placeholder="2" />
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
                        <NumInput value={mobTravel} onChange={setMobTravel} placeholder="Travel" prefix="£" />
                        <NumInput value={mobVisas} onChange={setMobVisas} placeholder="VISA / Cert." prefix="£" />
                        <NumInput value={mobAgent} onChange={setMobAgent} placeholder="Agent" prefix="£" />
                      </div>

                      <AnimatedSection show={logisticsInFee} className="space-y-2 pt-3">
                        <div className="flex items-center justify-between">
                          <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wide">Travel Fee</label>
                          <div className="w-28">
                            <SegmentedControl 
                              value={travelFeeType} 
                              onChange={setTravelFeeType} 
                              options={[{label: '%', value: 'percentage'}, {label: '£', value: 'fixed'}]} 
                              ariaLabel="Travel Fee Type"
                            />
                          </div>
                        </div>
                        <NumInput 
                          value={travelFee} 
                          onChange={setTravelFee} 
                          prefix={travelFeeType === 'fixed' ? '£' : undefined} 
                          suffix={travelFeeType === 'percentage' ? '%' : undefined} 
                          placeholder="0.0" 
                        />
                      </AnimatedSection>
                    </div>
                  </AnimatedSection>
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

                  <div className="w-full h-3 bg-primary-foreground/10 rounded-full mb-6 overflow-hidden flex transition-all duration-500">
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
                    <LineItem label={`Management Fee (${contract.feeType === 'percentage' && contract.cMarginVal > 0 ? `${contract.cMarginVal}%` : 'Fixed'})`} value={contract.cManagementFee} />

                    {contract.cMarginVal > 0 && contract.cTotalCharge > 0 && (
                      <div className="text-xs text-primary-foreground/60 font-medium bg-primary-foreground/5 p-2.5 rounded-lg mt-1 flex items-center gap-2">
                        <Info className="h-3.5 w-3.5 shrink-0" />
                        <span>
                          Fee = {contract.feeType === 'percentage' 
                            ? `${contract.cMarginVal}% × (${formatCurrency(contract.cRate)} ${includeNI && !seafarerExempt ? ` + NI` : ''} ${subsistenceInFee && contract.cSubOnboardAmt > 0 ? ` + Sub` : ''})` 
                            : `${formatCurrency(contract.cMarginVal)} Flat`}
                        </span>
                      </div>
                    )}

                    <div className="mt-4 pt-5 border-t-2 border-primary-foreground/30 flex items-center justify-between">
                      <span className="text-lg font-bold">Total Charge (Onboard)</span>
                      <span className="text-3xl font-mono font-bold tracking-tight text-chart-1 animate-in zoom-in-95 duration-200 tabular-nums" key={contract.cTotalCharge}>{formatCurrency(contract.cTotalCharge)}</span>
                    </div>
                  </div>

                  <AnimatedSection show={includeTrip} className="mt-8 pt-6 border-t border-primary-foreground/20">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-bold uppercase tracking-widest text-primary-foreground/60">Single Travel Day Reference</h3>
                      <span className="text-xs font-bold px-2.5 py-1 bg-primary-foreground/10 rounded-full">{travelDayFull ? 'Full' : '0.5'} day rate</span>
                    </div>
                    <div className="space-y-2.5">
                      <LineItem label={`Consolidated Rate (×${travelDayFull ? '1' : '0.5'})`} value={contract.cTravelRate} />
                      {includeNI && !seafarerExempt && <LineItem label="Employers NIC on travel rate" value={contract.cTravelNI} />}
                      {includeSubsistence && contract.cSubTravelAmt > 0 && <LineItem label="Travel Subsistence (Always 100%)" value={contract.cSubTravelAmt} />}
                      <LineItem label={`Management Fee (Main)`} value={contract.cTravelManagementFee} />
                      <div className="pt-3 border-t border-primary-foreground/20 flex items-center justify-between">
                        <span className="text-sm font-bold">Travel Day Total</span>
                        <span className="font-mono font-bold text-base text-chart-1 tabular-nums transition-all">{formatCurrency(contract.cTravelDayCharge)}</span>
                      </div>
                    </div>
                  </AnimatedSection>
                </div>

                <div className="bg-primary-foreground/5 p-8 md:p-10 border-t border-primary-foreground/10 relative z-0">
                  {includeTrip ? (
                    <div className="animate-in fade-in duration-300">
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-primary-foreground/60">Hitch Crew-Change Invoice</h3>
                        <ActionButton onClick={copyTripSummary} icon={Copy} label="Copy" />
                      </div>
                      <div className="space-y-4">

                        {/* Working Days Total */}
                        <div className="bg-primary-foreground/5 p-4 rounded-xl space-y-2 hover:bg-primary-foreground/10 transition-colors">
                          <div className="flex items-center justify-between text-sm font-bold text-primary-foreground/80">
                            <span>Days Onboard</span>
                            <span className="font-mono font-bold tabular-nums transition-all">{formatCurrency(contract.tripWorkingTotal)}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-primary-foreground/50 font-medium">{contract.nWorkingDays} days × {formatCurrency(contract.cTotalCharge)}</span>
                          </div>
                        </div>

                        {/* Travel Days Total */}
                        <div className="bg-primary-foreground/5 p-4 rounded-xl space-y-2 hover:bg-primary-foreground/10 transition-colors">
                          <div className="flex items-center justify-between text-sm font-bold text-primary-foreground/80">
                            <span>Travel Days ({contract.nTravelDays} occurrences)</span>
                            <span className="font-mono font-bold tabular-nums transition-all">{formatCurrency(contract.tripTravelTotal)}</span>
                          </div>
                          <div className="flex flex-col text-xs text-primary-foreground/50 font-medium">
                            <span>{contract.travelPayableDays} days pay + {contract.travelSubDays} full days sub</span>
                          </div>
                        </div>

                        {/* Logistics Total */}
                        {contract.logisticsTotal > 0 && (
                          <div className="bg-primary-foreground/5 p-4 rounded-xl flex flex-col gap-2 hover:bg-primary-foreground/10 transition-colors animate-in slide-in-from-top-2 fade-in">
                            <div className="flex items-center justify-between text-sm font-bold text-primary-foreground/80">
                              <span>Travel & Logistics Costs</span>
                              <span className="font-mono font-bold tabular-nums transition-all">{formatCurrency(contract.logisticsTotal)}</span>
                            </div>
                            <span className="text-xs text-primary-foreground/50 font-medium leading-relaxed">
                              Travel: £{mobTravel || '0'} | VISA / Cert.: £{mobVisas || '0'} | Agent: £{mobAgent || '0'} <br />
                              {logisticsInFee && contract.logisticsFee > 0 && `${contract.travelFeeType === 'percentage' ? contract.cTravelFeeVal + '%' : 'Fixed'} Travel Fee: ${formatCurrency(contract.logisticsFee)}`}
                            </span>
                          </div>
                        )}

                        {/* Grand Total */}
                        <div className="pt-2 border-t-2 border-primary-foreground/30 flex items-center justify-between">
                          <div>
                            <span className="text-lg font-bold block">Total Hitch Invoice</span>
                            <span className="text-xs text-primary-foreground/50 font-medium">{contract.nWorkingDays + contract.nTravelDays} days total</span>
                          </div>
                          <span className="text-3xl font-mono font-bold tracking-tight text-chart-1 animate-in zoom-in-95 duration-200 tabular-nums" key={contract.tripGrandTotal}>{formatCurrency(contract.tripGrandTotal)}</span>
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
                      <label className="block text-sm font-bold text-foreground">Candidate Annual Salary ({pCurrency})</label>
                      <NumInput value={salary} onChange={setSalary} prefix={pCurrency} aria-label="Annual Salary" />
                    </div>

                    <AnimatedSection show={pCurrency !== 'GBP'}>
                      <div className="space-y-3 p-4 bg-input/30 border border-input rounded-xl mt-2">
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
                    </AnimatedSection>

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
                        <div className="text-xs text-primary-foreground/60 font-medium bg-primary-foreground/5 p-2.5 rounded-lg flex items-center gap-2">
                          <Info className="h-3.5 w-3.5 shrink-0" />
                          <span>Fee = {perm.pFeePct}% × {formatCurrency(perm.pSalary)}</span>
                        </div>
                      </>
                    )}
                    {includePermNI && perm.pFxReady && (<><div className="h-px bg-primary-foreground/20 my-4" /><LineItem label="Employer's NI on Salary" value={perm.pEmployerNI} /></>)}

                    <div className="mt-4 pt-5 border-t-2 border-primary-foreground/30">
                      <div className="flex items-center justify-between">
                        <span className="text-lg font-bold">Total Invoice to Client</span>
                        <span className="text-3xl font-mono font-bold tracking-tight text-chart-1 animate-in zoom-in-95 duration-200 tabular-nums" key={perm.pPlacementFee}>{formatCurrency(perm.pPlacementFee)}</span>
                      </div>
                      <p className="text-xs text-primary-foreground/50 font-medium mt-1">Invoiced in GBP regardless of salary currency.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* ─────────────── PAYMENT DAYS TAB ─────────────── */}
          <TabsContent value="paydays" className="m-0 animate-in fade-in slide-in-from-bottom-2 duration-400">
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
                    <input type="date" value={pdStartDate} onChange={e => setPdStartDate(e.target.value)} className="w-full px-4 py-3 bg-input/40 border border-input rounded-xl font-medium tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all duration-200" />
                    <SegmentedControl value={pdStartMode} onChange={setPdStartMode} options={[{label: '0.5 rate', value: 'half'}, {label: 'Full', value: 'full'}, {label: 'Custom', value: 'custom'}]} ariaLabel="Start Mode" />
                    <AnimatedSection show={pdStartMode === 'custom'} className="pt-2">
                       <NumInput value={pdStartCustomVal} onChange={setPdStartCustomVal} placeholder="0.5" suffix="days" />
                    </AnimatedSection>
                  </div>

                  <div className="space-y-3 pt-4 border-t border-border/60">
                    <label className="block text-sm font-bold">Finish Date</label>
                    <input type="date" value={pdFinishDate} onChange={e => setPdFinishDate(e.target.value)} className="w-full px-4 py-3 bg-input/40 border border-input rounded-xl font-medium tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all duration-200" />
                    <SegmentedControl value={pdFinishMode} onChange={setPdFinishMode} options={[{label: '0.5 rate', value: 'half'}, {label: 'Full', value: 'full'}, {label: 'Custom', value: 'custom'}]} ariaLabel="Finish Mode" />
                    <AnimatedSection show={pdFinishMode === 'custom'} className="pt-2">
                       <NumInput value={pdFinishCustomVal} onChange={setPdFinishCustomVal} placeholder="0.5" suffix="days" />
                    </AnimatedSection>
                  </div>

                  <div className="space-y-3 pt-4 border-t border-border/60 group">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-bold cursor-pointer group-hover:text-primary transition-colors" onClick={() => setPdIncludeSubsistence(!pdIncludeSubsistence)}>Include Subsistence</label>
                      <Switch checked={pdIncludeSubsistence} onCheckedChange={setPdIncludeSubsistence} />
                    </div>
                    <AnimatedSection show={pdIncludeSubsistence} className="pt-2">
                      <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">Subsistence Rate (£ per day)</label>
                      <NumInput value={pdSubsistenceRate} onChange={setPdSubsistenceRate} prefix="£" />
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
                          <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wide">Day Rate (£)</label>
                          <NumInput value={pdDayRate} onChange={setPdDayRate} prefix="£" />
                        </div>
                        <div className="space-y-2">
                          <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wide">Advance Deduction (£)</label>
                          <NumInput value={pdAdvance} onChange={setPdAdvance} prefix="£" />
                        </div>
                      </div>
                    </AnimatedSection>
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
                    {paydays.splits.length > 0 && (
                      <div className="flex items-center gap-2 print:hidden">
                        <ActionButton onClick={copyPaydaysSummary} icon={Copy} label="Copy" />
                        <ActionButton onClick={printSchedule} icon={Printer} label="Print" />
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
                                <span className="text-primary-foreground/60 font-medium print:text-gray-600">Gross Pay ({paydays.totalDays} × {formatCurrency(pdDayRateVal)})</span>
                                <span className="font-mono font-bold text-white print:text-black tabular-nums">{formatCurrency(pdTotalGross)}</span>
                              </div>
                            )}
                            {pdIncludeSubsistence && pdSubsistenceRate && (
                              <div className="flex justify-between items-center text-sm">
                                <span className="text-primary-foreground/60 font-medium print:text-gray-600">Subsistence ({paydays.totalSubDays}d)</span>
                                <span className="font-mono font-bold text-white print:text-black tabular-nums">{formatCurrency(paydays.totalSub || 0)}</span>
                              </div>
                            )}
                            {pdIncludePay && pdAdvanceVal > 0 && (
                              <div className="flex justify-between items-center text-sm">
                                <span className="text-red-400 font-medium">Less Advance</span>
                                <span className="font-mono font-bold text-red-400 tabular-nums">-{formatCurrency(pdAdvanceVal)}</span>
                              </div>
                            )}
                            {pdIncludePay && (
                              <div className="flex justify-between items-center pt-2 mt-2 border-t border-primary-foreground/10 text-base print:border-gray-300">
                                <span className="font-bold text-white print:text-black">Total Net Pay</span>
                                <span className="font-mono font-bold text-chart-1 animate-in zoom-in-95 duration-200 tabular-nums" key={pdTotalNet}>{formatCurrency(pdTotalNet)}</span>
                              </div>
                            )}
                          </div>
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
                              <span className="font-mono font-bold text-chart-1 text-base tabular-nums">
                                {split.days % 1 === 0 ? split.days.toFixed(0) : formatNumber(split.days)} days
                              </span>
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
                                    <span className="font-mono font-bold text-white print:text-black tabular-nums">{formatCurrency(split.days * pdDayRateVal)}</span>
                                  </div>
                                )}
                                {pdIncludeSubsistence && pdSubsistenceRate && (
                                  <div className="flex justify-between items-center text-xs">
                                    <div className="flex items-center gap-1.5 text-primary-foreground/60 print:text-gray-600">
                                      <span>Sub. Days:</span>
                                      <input 
                                        type="number"
                                        value={subDaysOverrides[idx] ?? ''}
                                        onChange={e => setSubDaysOverrides(prev => ({...prev, [idx]: e.target.value}))}
                                        placeholder={split.days.toString()}
                                        title="Override subsistence days"
                                        className="w-12 bg-background/30 border border-primary-foreground/20 rounded px-1 py-0.5 text-white print:text-black print:border-gray-300 text-center focus:outline-none focus:border-primary-foreground/50 transition-colors font-mono tabular-nums placeholder:text-primary-foreground/40 print:placeholder:text-gray-400"
                                      />
                                    </div>
                                    <span className="font-mono font-bold text-white print:text-black tabular-nums">{formatCurrency(split.subDays * (parseFloat(pdSubsistenceRate) || 0))}</span>
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

      {/* Feature 7: Sticky Mobile Summary */}
      <div className="fixed bottom-0 left-0 right-0 bg-primary border-t border-primary-foreground/10 text-primary-foreground p-4 md:hidden z-40 shadow-[0_-10px_40px_rgba(0,0,0,0.15)] animate-in slide-in-from-bottom-full duration-500">
        <div className="flex items-center justify-between max-w-5xl mx-auto">
          <div className="text-xs font-bold uppercase tracking-widest text-primary-foreground/70">
            {mode === 'contract' ? (includeTrip ? 'Total Hitch' : 'Charge Rate') : mode === 'perm' ? 'Placement Fee' : (mode === 'paydays' && pdIncludePay ? 'Total Net Pay' : 'Total Days')}
          </div>
          <div className="text-xl font-mono font-bold text-chart-1 animate-in zoom-in-95 duration-200 tabular-nums" key={mode}>
            {mode === 'contract' ? (includeTrip ? formatCurrency(contract.tripGrandTotal) : formatCurrency(contract.cTotalCharge)) 
              : mode === 'perm' ? formatCurrency(perm.pPlacementFee) 
              : (mode === 'paydays' && pdIncludePay ? formatCurrency(pdTotalNet) : (paydays.totalDays ?? 0))}
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
      <span className={cn('font-mono tracking-tight tabular-nums transition-all', isBold ? 'text-base font-bold' : 'text-sm font-semibold')}>
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
          <span className="font-mono font-bold text-chart-1 tabular-nums transition-all">{formatCurrency(charge * days)}</span>
        </div>
        <div className="flex justify-between text-sm pt-2 border-t border-primary-foreground/10">
          <span className="text-primary-foreground/70 font-medium">Fee Margin</span>
          <span className="font-mono font-bold text-white tabular-nums transition-all">{formatCurrency(fee * days)}</span>
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
              <strong className="text-foreground block">Subsistence Rules (Travel vs Victualling)</strong>
              <p>Travel day subsistence is always paid at full rate, so for a 0.5 day, it is still a full subsistence payment (e.g. two 0.5 travel days = 2 full days of subsistence). Onboard subsistence is applied to working days.</p>
            </div>
          </>
        ) : (
          <div className="space-y-1">
            <strong className="text-foreground block">Employer NI Calculation</strong>
            <p>Perm NI informational calculation assumes 15% over the £9,100 secondary threshold.</p>
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