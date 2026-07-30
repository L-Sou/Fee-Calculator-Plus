import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { PieChart, Pie, Cell, Tooltip as ChartTooltip, ResponsiveContainer } from 'recharts';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import {
  RotateCcw, Briefcase, FileText, UtensilsCrossed, 
  CalendarDays, Globe, RefreshCw, AlertCircle, Copy, Download, Printer, 
  ChevronDown, Check, Info, Ship, Anchor, Save, Users, FileCheck, Sun, Moon, Trash2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Logo from './Logo';

// ─── 1. Strict TypeScript Interfaces & Constants ──────────────────────────────

export type CurrencyCode = 'EUR' | 'USD' | 'GBP' | 'CHF' | 'AUD' | 'CAD';
export type TaxProfile = '2024/2025' | '2025/2026' | '2026/2027' | '2027/2028';

export interface FiscalRates {
  pension: number;
  apprenticeshipLevy: number;
  employerNI: number;
  permNI: number;
  permNIThreshold: number;
}

export interface ContractParams {
  dbConsolidatedRate: string;
  dbMargin: string;
  dbTravelFee: string;
  dbContingencyValue: string;
  includePension: boolean;
  includeAppyLevy: boolean;
  includeContingency: boolean;
  contingencyType: 'percentage' | 'fixed';
  includeSubsistence: boolean;
  dbSubTravel: string;
  dbSubOnboard: string;
  includeNI: boolean;
  seafarerExempt: boolean;
  niMode: 'base' | 'total';
  subsistenceInFee: boolean;
  feeType: 'percentage' | 'fixed';
  dbWorkingDays: string;
  dbTravelDays: string;
  travelDayFull: boolean;
  dbMobTravel: string;
  dbMobVisas: string;
  dbMobAgent: string;
  logisticsInFee: boolean;
  travelFeeType: 'percentage' | 'fixed';
  crewSize: string;
}

export interface PermParams {
  dbSalary: string;
  dbPlacementFee: string;
  includePermNI: boolean;
  pCurrency: CurrencyCode;
  invoiceInOrigin: boolean;
}

export interface PaydayParams {
  pdStartDate: string;
  pdFinishDate: string;
  pdPayrollType: 'monthly' | 'fortnightly';
  pdStartMode: 'half' | 'full' | 'custom';
  pdStartCustomVal: string;
  pdFinishMode: 'half' | 'full' | 'custom';
  pdFinishCustomVal: string;
}

const CURRENCIES: CurrencyCode[] = ['EUR', 'USD', 'GBP', 'CHF', 'AUD', 'CAD'];
const curSym = (c: CurrencyCode) => ({ GBP: '£', EUR: '€', USD: '$', CHF: 'CHF', AUD: 'A$', CAD: 'C$' }[c] || '£');

const FISCAL_PROFILES: Record<TaxProfile, FiscalRates> = {
  '2024/2025': { pension: 0.04, apprenticeshipLevy: 0.005, employerNI: 0.138, permNI: 0.138, permNIThreshold: 9100 },
  '2025/2026': { pension: 0.04, apprenticeshipLevy: 0.005, employerNI: 0.155, permNI: 0.15,  permNIThreshold: 9100 },
  '2026/2027': { pension: 0.04, apprenticeshipLevy: 0.005, employerNI: 0.155, permNI: 0.15,  permNIThreshold: 9100 },
  '2027/2028': { pension: 0.04, apprenticeshipLevy: 0.005, employerNI: 0.155, permNI: 0.15,  permNIThreshold: 9100 },
};

const FALLBACK_BANK_HOLIDAYS = new Set([
  '2024-01-01','2024-03-29','2024-04-01','2024-05-06','2024-05-27','2024-08-26','2024-12-25','2024-12-26',
  '2025-01-01','2025-04-18','2025-04-21','2025-05-05','2025-05-26','2025-08-25','2025-12-25','2025-12-26',
  '2026-01-01','2026-04-03','2026-04-06','2026-05-04','2026-05-25','2026-08-31','2026-12-25','2026-12-28'
]);

const RATING_OPTIONS = [
  { label: 'Select...', value: '' },
  { label: 'Excellent', value: 'Excellent' },
  { label: 'Very Good', value: 'Very Good' },
  { label: 'Good', value: 'Good' },
  { label: 'Fair', value: 'Fair' },
  { label: 'Poor', value: 'Poor' },
  { label: 'N/A', value: 'N/A' },
];

const RATING_FIELDS = [
  { key: 'refCompetence', label: 'Competence / Ability' },
  { key: 'refFlexibility', label: 'Flexibility' },
  { key: 'refInitiative', label: 'Interest & Initiative' },
  { key: 'refSafety', label: 'Health and Safety Awareness' },
  { key: 'refSecurity', label: 'Security Awareness' },
  { key: 'refTimeKeeping', label: 'Time Keeping' },
  { key: 'refCommunication', label: 'Communication' },
  { key: 'refRelationships', label: 'Relationships with Colleagues' },
  { key: 'refOverall', label: 'Overall Performance' },
];

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

const parseDate = (s: string): Date => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0); 
};
const isoDate = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);
const isWeekend = (d: Date) => d.getDay() === 0 || d.getDay() === 6;
const sundayBefore = (date: Date) => addDays(date, -(date.getDay() === 0 ? 7 : date.getDay()));

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const FN_ANCHOR = new Date(2026, 0, 9, 12, 0, 0, 0);

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { return false; }
  return false;
}

// ─── 2. Pure Mathematical Calculation Engines ──────────────────────────────────

function calculateContract(params: ContractParams, fiscalRates: FiscalRates) {
  const crewSize = Math.max(1, parseInt(params.crewSize) || 1);
  const cRate = Math.max(0, parseFloat(params.dbConsolidatedRate) || 0);
  const cMarginVal = Math.max(0, parseFloat(params.dbMargin) || 0);
  const cTravelFeeVal = Math.max(0, parseFloat(params.dbTravelFee) || 0);
  const cContingencyInputVal = Math.max(0, parseFloat(params.dbContingencyValue) || 0);

  const cPension = params.includePension ? cRate * fiscalRates.pension : 0;
  const cAppyLevy = params.includeAppyLevy ? cRate * fiscalRates.apprenticeshipLevy : 0;
  const cContingency = params.includeContingency 
    ? (params.contingencyType === 'percentage' ? cRate * (cContingencyInputVal / 100) : cContingencyInputVal) 
    : 0;

  const cTotalAdditions = cPension + cAppyLevy + cContingency;
  const cSubTravelAmt = params.includeSubsistence ? Math.max(0, parseFloat(params.dbSubTravel) || 0) : 0;
  const cSubOnboardAmt = params.includeSubsistence ? Math.max(0, parseFloat(params.dbSubOnboard) || 0) : 0;

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
  const totalTravelNI = (params.niMode === 'total' ? (totalTravelPay + totalTravelAdditions) : totalTravelPay) * cNiMultiplier;
  const totalTravelSub = travelSubDays * cSubTravelAmt;
  const totalTravelManagementFee = params.feeType === 'percentage' 
    ? (totalTravelPay + totalTravelAdditions + totalTravelNI + (params.subsistenceInFee ? totalTravelSub : 0)) * (cMarginVal / 100) 
    : cMarginVal * travelSubDays;

  const tripTravelTotal = totalTravelPay + totalTravelAdditions + totalTravelNI + totalTravelSub + totalTravelManagementFee;

  const logisticsBase = Math.max(0, parseFloat(params.dbMobTravel) || 0) + Math.max(0, parseFloat(params.dbMobVisas) || 0) + Math.max(0, parseFloat(params.dbMobAgent) || 0);
  const logisticsFee = params.logisticsInFee ? (params.travelFeeType === 'percentage' ? logisticsBase * (cTravelFeeVal / 100) : cTravelFeeVal) : 0;
  const logisticsTotal = logisticsBase + logisticsFee;

  const tripWorkingTotal = nWorkingDays * cTotalCharge;
  const tripGrandTotal = tripWorkingTotal + tripTravelTotal + logisticsTotal;

  return {
    cRate, cMarginVal, feeType: params.feeType, cEmployerNI, cTotalCharge, cManagementFee,
    cPension, cAppyLevy, cContingency, cTotalAdditions, cSubTravelAmt, cSubOnboardAmt,
    cTravelRate, cTravelPension, cTravelAppyLevy, cTravelContingency, cTravelNI, cTravelFeeVal, travelFeeType: params.travelFeeType, cTravelManagementFee, cTravelDayCharge,
    nWorkingDays, nTravelDays, travelPayableDays, travelSubDays,
    logisticsBase, logisticsFee, logisticsTotal,
    tripWorkingTotal, tripTravelTotal, tripGrandTotal,
    crewSize,
    crewTripWorkingTotal: tripWorkingTotal * crewSize,
    crewTripTravelTotal: tripTravelTotal * crewSize,
    crewLogisticsTotal: logisticsTotal * crewSize,
    crewTripGrandTotal: tripGrandTotal * crewSize,
    totalBarVal: Math.max(cTotalCharge, 1)
  };
}

function calculatePerm(params: PermParams, fiscalRates: FiscalRates, fxRate: number | null) {
  const pSalaryInput = Math.max(0, parseFloat(params.dbSalary) || 0);
  const pFxReady = params.pCurrency === 'GBP' || fxRate !== null;
  const pSalary = params.pCurrency === 'GBP' ? pSalaryInput : (fxRate !== null ? pSalaryInput * fxRate : 0);
  const pFeePct = Math.max(0, parseFloat(params.dbPlacementFee) || 0);

  const pPlacementFee = params.invoiceInOrigin 
    ? pSalaryInput * (pFeePct / 100) 
    : (pFxReady ? pSalary * (pFeePct / 100) : 0);

  const pEmployerNI = params.includePermNI ? Math.max(0, (pSalary - fiscalRates.permNIThreshold) * fiscalRates.permNI) : 0;

  return { pSalaryInput, pFxReady, pSalary, pFeePct, pPlacementFee, pEmployerNI, pTotalCost: pPlacementFee + (params.invoiceInOrigin ? 0 : pEmployerNI) };
}

function calculateRawPaydays(params: PaydayParams, bankHolidays: Set<string>) {
  if (!params.pdStartDate || !params.pdFinishDate) return { splits: [], error: null };
  const start = parseDate(params.pdStartDate);
  const finish = parseDate(params.pdFinishDate);
  if (finish < start) return { splits: [], error: 'Finish date must be on or after start date.' };

  const startVal = params.pdStartMode === 'full' ? 1 : params.pdStartMode === 'half' ? 0.5 : Math.max(0, parseFloat(params.pdStartCustomVal) || 0);
  const finishVal = params.pdFinishMode === 'full' ? 1 : params.pdFinishMode === 'half' ? 0.5 : Math.max(0, parseFloat(params.pdFinishCustomVal) || 0);

  const isWorkingDay = (d: Date) => !isWeekend(d) && !bankHolidays.has(isoDate(d));

  // Monthly payday: 28th, walking back to previous working day over weekends & bank holidays
  const monthlyPayday = (y: number, m: number) => {
    let d = new Date(y, m, 28, 12, 0, 0, 0);
    while (!isWorkingDay(d)) d = addDays(d, -1);
    return d;
  };

  // Fortnightly payday: raw anchor + n×14 days, walked back if it lands on a weekend or bank holiday
  const fnPayday = (idx: number) => {
    let d = addDays(FN_ANCHOR, idx * 14);
    while (!isWorkingDay(d)) d = addDays(d, -1);
    return d;
  };

  try {
    const cutoffs: Array<{ payday: Date; cutoff: Date }> = [];

    if (params.pdPayrollType === 'fortnightly') {
      let idx = Math.floor(Math.round((start.getTime() - FN_ANCHOR.getTime()) / 86400000) / 14);
      // Walk back if needed so we don't miss the first relevant cut-off
      while (sundayBefore(fnPayday(idx - 1)).getTime() >= start.getTime()) idx--;
      // Advance until cut-off >= start
      while (sundayBefore(fnPayday(idx)).getTime() < start.getTime()) idx++;
      for (;;) {
        const payday = fnPayday(idx);
        const cutoff = sundayBefore(payday);
        cutoffs.push({ payday, cutoff });
        if (cutoff.getTime() >= finish.getTime()) break;
        idx++;
      }
    } else {
      // Monthly: cut-off is Sunday before the bank-holiday-adjusted 28th payday
      let year = start.getFullYear(), month = start.getMonth();
      for (let i = 0; i < 25; i++) {
        const payday = monthlyPayday(year, month);
        const cutoff = sundayBefore(payday);
        if (cutoff.getTime() >= start.getTime()) {
          cutoffs.push({ payday, cutoff });
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
          const nextPayday = monthlyPayday(y, m);
          cutoffs.push({ payday: nextPayday, cutoff: sundayBefore(nextPayday) });
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

      const periodLabel = params.pdPayrollType === 'monthly'
        ? `${MONTH_NAMES[payday.getMonth()]} ${payday.getFullYear()}`
        : `${formatUK(periodStart)} – ${formatUK(periodEnd)}`;
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

// ─── 3. Global Zustand Store ──────────────────────────────────────────────────

interface AppState {
  theme: 'light' | 'dark';
  taxYear: TaxProfile;
  clientName: string;
  candidateName: string;
  cCurrency: CurrencyCode;
  cFxDate: string;
  consolidatedRate: string;
  feeType: 'percentage' | 'fixed';
  margin: string;
  crewSize: string;
  includePension: boolean;
  includeAppyLevy: boolean;
  includeContingency: boolean;
  contingencyType: 'percentage' | 'fixed';
  contingencyValue: string;
  includeNI: boolean;
  niMode: 'base' | 'total';
  seafarerExempt: boolean;
  includeSubsistence: boolean;
  subsistenceTravel: string;
  subsistenceTravelDays: string;
  subsistenceOnboard: string;
  subsistenceInFee: boolean;
  includeTrip: boolean;
  workingDays: string;
  travelDays: string;
  travelDayFull: boolean;
  travelFeeType: 'percentage' | 'fixed';
  travelFee: string;
  mobTravel: string;
  mobVisas: string;
  mobAgent: string;
  logisticsInFee: boolean;
  salary: string;
  placementFee: string;
  includePermNI: boolean;
  pCurrency: CurrencyCode;
  invoiceInOrigin: boolean;
  pFxDate: string;
  pdPayrollType: 'monthly' | 'fortnightly';
  pdStartDate: string;
  pdStartMode: 'half' | 'full' | 'custom';
  pdStartCustomVal: string;
  pdFinishDate: string;
  pdFinishMode: 'half' | 'full' | 'custom';
  pdFinishCustomVal: string;
  pdIncludeSubsistence: boolean;
  pdSubsistenceRate: string;
  pdIncludePay: boolean;
  pdDayRate: string;
  pdAdvance: string;
  refSeafarerName: string;
  refDiscipline: string;
  refCompany: string;
  refVessel: string;
  refDates: string;
  refCompetence: string;
  refFlexibility: string;
  refInitiative: string;
  refSafety: string;
  refSecurity: string;
  refTimeKeeping: string;
  refCommunication: string;
  refRelationships: string;
  refOverall: string;
  refDrugsPolicy: string;
  refReHire: string;
  refComments: string;
  displayCurrency: 'original' | 'gbp';

  savedPresets: Record<string, Partial<AppState>>;
  updateField: <K extends keyof AppState>(field: K, value: AppState[K]) => void;
  resetToDefaults: () => void;
  deletePreset: (name: string) => void;
}

const defaultState: Omit<AppState, 'updateField' | 'resetToDefaults' | 'savedPresets' | 'deletePreset'> = {
  theme: 'light', taxYear: '2025/2026', clientName: '', candidateName: '', cCurrency: 'GBP', cFxDate: new Date().toISOString().slice(0, 10),
  consolidatedRate: '', feeType: 'percentage', margin: '15', crewSize: '1', includePension: false, includeAppyLevy: false,
  includeContingency: false, contingencyType: 'percentage', contingencyValue: '', includeNI: true, niMode: 'base',
  seafarerExempt: false, includeSubsistence: false, subsistenceTravel: '50', subsistenceTravelDays: '1', subsistenceOnboard: '0', subsistenceInFee: true,
  includeTrip: false, workingDays: '28', travelDays: '2', travelDayFull: false, travelFeeType: 'percentage', travelFee: '15',
  mobTravel: '', mobVisas: '', mobAgent: '', logisticsInFee: false, salary: '', placementFee: '', includePermNI: false,
  pCurrency: 'GBP', invoiceInOrigin: false, pFxDate: new Date().toISOString().slice(0, 10), pdPayrollType: 'monthly',
  pdStartDate: '', pdStartMode: 'full', pdStartCustomVal: '0.5', pdFinishDate: '', pdFinishMode: 'full', pdFinishCustomVal: '0.5',
  pdIncludeSubsistence: false, pdSubsistenceRate: '', pdIncludePay: false, pdDayRate: '', pdAdvance: '',
  refSeafarerName: '', refDiscipline: '', refCompany: '', refVessel: '', refDates: '', refCompetence: '',
  refFlexibility: '', refInitiative: '', refSafety: '', refSecurity: '', refTimeKeeping: '',
  refCommunication: '', refRelationships: '', refOverall: '', refDrugsPolicy: '', refReHire: '', refComments: '', displayCurrency: 'original'
};

const useStore = create<AppState>()(
  persist(
    (set) => ({
      ...defaultState,
      savedPresets: {},
      updateField: (field, value) => set({ [field]: value }),
      resetToDefaults: () => set((state) => ({ ...defaultState, savedPresets: state.savedPresets || {}, theme: state.theme || 'light' })),
      deletePreset: (name) => set((state) => {
        const newPresets = { ...(state.savedPresets || {}) };
        delete newPresets[name];
        return { savedPresets: newPresets };
      })
    }),
    { 
      name: 'maritime-hq-v6', 
      merge: (persistedState: any, currentState) => {
        return { ...currentState, ...persistedState, savedPresets: persistedState?.savedPresets || {} };
      }
    }
  )
);

// ─── Custom Hooks ────────────────────────────────────────────────────────────

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

function useToast() {
  const [toasts, setToasts] = useState<{id: number; message: string; actionLabel?: string; onAction?: () => void}[]>([]);
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
    <div className="fixed bottom-20 md:bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none print:hidden">
      {toasts.map(t => (
        <div key={t.id} className="animate-in slide-in-from-bottom-2 fade-in duration-300 bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-4 py-3 rounded-xl shadow-xl flex items-center gap-2.5 font-medium text-sm pointer-events-auto">
          <div className="p-1 bg-white/20 dark:bg-black/10 rounded-full"><Check className="h-3.5 w-3.5 text-current" /></div>
          {t.message}
          {t.onAction && (
            <button onClick={() => { t.onAction?.(); setToasts(prev => prev.filter(x => x.id !== t.id)); }} className="ml-1 underline font-bold text-slate-300 dark:text-slate-600 hover:opacity-85 transition-opacity">
              {t.actionLabel}
            </button>
          )}
        </div>
      ))}
    </div>
  );
  return { showToast, showUndoToast, ToastContainer };
}

function useBankHolidays() {
  const [holidays, setHolidays] = useState<Set<string>>(FALLBACK_BANK_HOLIDAYS);
  useEffect(() => {
    const controller = new AbortController();
    fetch('https://www.gov.uk/bank-holidays.json', { signal: controller.signal })
      .then(res => res.json())
      .then(data => setHolidays(new Set([...FALLBACK_BANK_HOLIDAYS, ...data['england-and-wales'].events.map((e: any) => e.date)])))
      .catch(() => {});
    return () => controller.abort();
  }, []);
  return holidays;
}

function useFxRate(currency: CurrencyCode, baseDate: string) {
  const [rate, setRate] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // New state for manual overrides
  const [isManual, setIsManual] = useState(false);
  const [manualRate, setManualRate] = useState<string>('');

  useEffect(() => {
    if (currency === 'GBP' || isManual) { 
      if (currency === 'GBP') { setRate(null); setError(null); setLoading(false); }
      return; 
    }

    let cancelled = false;
    setLoading(true); setError(null);
    const datePart = baseDate > new Date().toISOString().slice(0, 10) ? 'latest' : baseDate;

    fetch(`https://api.frankfurter.dev/v1/${datePart}?base=${currency}&symbols=GBP`)
      .then(res => res.json())
      .then(data => {
        if (!cancelled && data?.rates?.GBP) {
          setRate(data.rates.GBP);
          setManualRate(data.rates.GBP.toString()); // Pre-fill manual input just in case
          if (datePart === 'latest' && baseDate > new Date().toISOString().slice(0, 10)) setError('future-date-fallback');
        }
      })
      .catch(() => { 
        if (!cancelled) {
          setError('Exchange rate service offline.');
          setIsManual(true); // Force manual mode if API dies
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [currency, baseDate, refreshKey, isManual]);

  // Return the active rate based on mode
  const activeRate = isManual ? (parseFloat(manualRate) || null) : rate;

  return { 
    rate: activeRate, 
    loading: loading && !isManual, 
    error, 
    refresh: () => setRefreshKey(k => k + 1),
    isManual,
    setIsManual,
    manualRate,
    setManualRate
  };
}

// ─── 4. Reusable Sub-components ───────────────────────────────────────────────

interface TextInputProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  ariaLabel?: string;
}
const TextInput = ({ value, onChange, placeholder, ariaLabel }: TextInputProps) => (
  <input type="text" value={value} onChange={(e) => onChange(e.target.value)} aria-label={ariaLabel} placeholder={placeholder} className="w-full px-4 py-2.5 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-slate-900 dark:text-slate-50 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/20 dark:focus:ring-white/20 transition-all text-sm font-medium placeholder:text-slate-500 dark:placeholder:text-slate-400" />
);

interface NumInputProps {
  id?: string;
  value: string | number;
  onChange: (v: string) => void;
  prefix?: string;
  suffix?: string;
  placeholder?: string;
  'aria-label'?: string;
}
const NumInput = ({ id, value, onChange, prefix, suffix, placeholder = '0.00', 'aria-label': ariaLabel }: NumInputProps) => {
  const numericValue = parseFloat(String(value));
  const isInvalid = String(value).trim() !== '' && (isNaN(numericValue) || numericValue < 0);

  return (
    <div className="relative group flex-1">
      {prefix && <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 font-mono pointer-events-none transition-colors group-focus-within:text-slate-900 dark:group-focus-within:text-white">{prefix}</span>}
      <input 
        id={id} 
        type="number" 
        value={value} 
        onChange={(e) => onChange(e.target.value)} 
        aria-label={ariaLabel} 
        placeholder={placeholder} 
        min="0" 
        className={cn(
          'w-full py-3 bg-black/5 dark:bg-white/5 border text-slate-900 dark:text-slate-50 rounded-xl focus:outline-none focus:ring-2 transition-all duration-200 tabular-nums text-base font-medium placeholder:text-slate-500 dark:placeholder:text-slate-400', 
          prefix ? (prefix.length > 1 ? 'pl-16 pr-4' : 'pl-10 pr-4') : suffix ? 'pl-4 pr-10' : 'px-4',
          isInvalid 
            ? 'border-red-500 focus:ring-red-500/50 dark:border-red-500 dark:focus:ring-red-500/50' 
            : 'border-black/10 dark:border-white/10 focus:ring-slate-900/20 dark:focus:ring-white/20'
        )} 
      />
      {suffix && <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 font-mono transition-colors group-focus-within:text-slate-900 dark:group-focus-within:text-white">{suffix}</span>}
    </div>
  );
};

interface SegmentedControlProps {
  value: string;
  onChange: (v: string) => void;
  options: {label: string, value: string}[];
  ariaLabel: string;
}
const SegmentedControl = ({ value, onChange, options, ariaLabel }: SegmentedControlProps) => (
  <div className="flex items-center gap-1 p-1 bg-black/5 dark:bg-white/5 rounded-xl w-full" role="radiogroup" aria-label={ariaLabel}>
    {options.map(opt => (
      <label key={opt.value} className={cn('flex-1 text-center cursor-pointer px-3 py-1.5 rounded-lg text-sm font-bold transition-all duration-300 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-slate-900 dark:has-[:focus-visible]:ring-white', value === opt.value ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-50 shadow-sm ring-1 ring-black/5 dark:ring-white/10 scale-100' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 scale-95')}>
        <input type="radio" className="sr-only" value={opt.value} checked={value === opt.value} onChange={(e) => onChange(e.target.value)} />
        {opt.label}
      </label>
    ))}
  </div>
);

interface ActionButtonProps {
  onClick: () => void;
  icon: React.ElementType;
  label: string;
  }
const ActionButton = ({ onClick, icon: Icon, label }: ActionButtonProps) => (
  <button onClick={onClick} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 dark:focus-visible:ring-white print:hidden" title={label} aria-label={label}>
    <Icon className="h-3.5 w-3.5" /><span className="hidden sm:inline">{label}</span>
  </button>
);

interface AnimatedSectionProps {
  show: boolean;
  children: React.ReactNode;
  className?: string;
}
function AnimatedSection({ show, children, className }: AnimatedSectionProps) {
  return (
    <div className={cn("grid transition-all duration-400 ease-in-out", show ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0 pointer-events-none")}>
      <div className={cn("overflow-hidden", className)}>{children}</div>
    </div>
  );
}

interface CollapsibleCardProps {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  defaultOpen?: boolean;
}
function CollapsibleCard({ title, icon: Icon, children, defaultOpen = true }: CollapsibleCardProps) {
  return (
    <details className="group [&_summary::-webkit-details-marker]:hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm transition-all overflow-hidden" open={defaultOpen}>
      <summary className="flex items-center gap-3 cursor-pointer p-6 hover:bg-black/5 dark:hover:bg-white/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 dark:focus-visible:ring-white border-b border-transparent group-open:border-slate-100 dark:group-open:border-slate-800">
        <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-900 dark:text-slate-50"><Icon className="h-5 w-5" /></div>
        <div className="flex-1 font-bold text-lg text-slate-900 dark:text-slate-50">{title}</div>
        <ChevronDown className="h-5 w-5 text-slate-400 group-open:rotate-180 transition-transform duration-300" />
      </summary>
      <div className="p-6 pt-2 animate-in fade-in duration-300 text-slate-700 dark:text-slate-300">{children}</div>
    </details>
  );
}

interface TooltipProps {
  text: string;
}
const Tooltip = ({ text }: TooltipProps) => (
  <div className="group/tooltip relative inline-flex ml-1.5 align-middle cursor-help print:hidden">
    <button type="button" aria-label={text} className="text-slate-400 hover:text-slate-900 dark:hover:text-white focus-visible:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 rounded-full"><Info className="h-3.5 w-3.5" /></button>
    <div role="tooltip" className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/tooltip:block group-focus-within/tooltip:block w-48 p-2.5 bg-slate-900 dark:bg-slate-800 text-white dark:text-slate-50 text-xs font-medium rounded-lg shadow-xl z-50 text-center pointer-events-none animate-in fade-in zoom-in-95 duration-200">
      {text}<div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-900 dark:border-t-slate-800" />
    </div>
  </div>
);

// ─── 5. Main Application Component ────────────────────────────────────────────

export default function CalculatorPage() {
  const s = useStore();

  // 🚨 EMERGENCY FAILSAFE: If browser cache is corrupted, forcefully reset it
  useEffect(() => {
    if (!s || !s.updateField || !s.taxYear || !FISCAL_PROFILES[s.taxYear]) {
      console.error("Corrupted state detected. Resetting to defaults.");
      localStorage.removeItem('maritime-hq-v6');
      window.location.reload();
    }
  }, [s]);

  // Prevent render crash while reloading
  if (!s || !s.updateField || !s.taxYear || !FISCAL_PROFILES[s.taxYear]) return null;

  const { showToast, showUndoToast, ToastContainer } = useToast();
  const bankHolidays = useBankHolidays();
  const [mode, setMode] = useState<'contract' | 'perm' | 'paydays' | 'reference'>('contract');
  const [newPresetName, setNewPresetName] = useState('');
  const [selectedPreset, setSelectedPreset] = useState('');
  const [subDaysOverrides, setSubDaysOverrides] = useState<Record<number, string>>({});

  const activeFiscalRates = FISCAL_PROFILES[s.taxYear];
  const cFx = useFxRate(s.cCurrency, s.cFxDate);
  const pFx = useFxRate(s.pCurrency, s.pFxDate);

  // Sync Theme to HTML Document
  useEffect(() => {
    const root = window.document.documentElement;
    if (s.theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [s.theme]);

  const toggleTheme = () => s.updateField('theme', s.theme === 'light' ? 'dark' : 'light');

  // Debounced inputs for mathematical performance
  const dbConsolidatedRate = useDebounce(s.consolidatedRate, 300);
  const dbMargin = useDebounce(s.margin, 300);
  const dbContingencyValue = useDebounce(s.contingencyValue, 300);
  const dbSubTravel = useDebounce(s.subsistenceTravel, 300);
  const dbSubTravelDays = useDebounce(s.subsistenceTravelDays, 300);
  const dbSubOnboard = useDebounce(s.subsistenceOnboard, 300);
  const dbTravelFee = useDebounce(s.travelFee, 300);
  const dbWorkingDays = useDebounce(s.workingDays, 300);
  const dbTravelDays = useDebounce(s.travelDays, 300);
  const dbMobTravel = useDebounce(s.mobTravel, 300);
  const dbMobVisas = useDebounce(s.mobVisas, 300);
  const dbMobAgent = useDebounce(s.mobAgent, 300);
  const dbSalary = useDebounce(s.salary, 300);
  const dbPlacementFee = useDebounce(s.placementFee, 300);

  // URL State Syncing
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    params.set('mode', mode);
    if (mode === 'contract' && dbConsolidatedRate) params.set('crate', dbConsolidatedRate);
    if (mode === 'perm' && dbSalary) params.set('psalary', dbSalary);
    window.history.replaceState(null, '', `?${params.toString()}`);
  }, [mode, dbConsolidatedRate, dbSalary]);

  useEffect(() => { setSubDaysOverrides({}); }, [s.pdStartDate, s.pdFinishDate, s.pdPayrollType, s.pdStartMode, s.pdStartCustomVal, s.pdFinishMode, s.pdFinishCustomVal]);

  const reset = () => {
    const snapshot = useStore.getState();
    s.resetToDefaults();
    showUndoToast('All fields reset.', () => useStore.setState(snapshot));
  };

  const savePreset = () => {
    if (!newPresetName.trim()) return showToast('Please enter a preset name');

    // Safely exclude functions when saving state to prevent overwriting them later
    const stateToSave = Object.fromEntries(
      Object.entries(useStore.getState()).filter(([_, value]) => typeof value !== 'function')
    ) as Partial<AppState>;

    s.updateField('savedPresets', { ...(s.savedPresets || {}), [newPresetName]: stateToSave });
    setNewPresetName('');
    showToast(`Preset "${newPresetName}" saved!`);
  };

  const loadPreset = (val: string) => {
    setSelectedPreset(val);
    if (val && s.savedPresets && s.savedPresets[val]) {
       useStore.setState(s.savedPresets[val] as Partial<AppState>);
    }
  };

  const deleteSelectedPreset = () => {
    if (!selectedPreset) return;
    s.deletePreset(selectedPreset);
    setSelectedPreset('');
    showToast(`Preset "${selectedPreset}" deleted`);
  };

  const contract = useMemo(() => calculateContract({ ...s, dbConsolidatedRate, dbMargin, dbTravelFee, dbContingencyValue, dbSubTravel, dbSubOnboard, dbWorkingDays, dbTravelDays, dbMobTravel, dbMobVisas, dbMobAgent }, activeFiscalRates), 
    [s, dbConsolidatedRate, dbMargin, dbTravelFee, dbContingencyValue, dbSubTravel, dbSubOnboard, dbWorkingDays, dbTravelDays, dbMobTravel, dbMobVisas, dbMobAgent, activeFiscalRates]);

  const perm = useMemo(() => calculatePerm({ ...s, dbSalary, dbPlacementFee }, activeFiscalRates, pFx.rate), 
    [s, dbSalary, dbPlacementFee, activeFiscalRates, pFx.rate]);

  const rawPaydays = useMemo(() => calculateRawPaydays(s, bankHolidays), [s, bankHolidays]);

  const paydays = useMemo(() => {
    if (rawPaydays.error || !rawPaydays.splits.length) return { splits: [], error: rawPaydays.error, totalDays: null, totalSubDays: null, totalSub: null };
    const subAmt = s.pdIncludeSubsistence ? parseFloat(s.pdSubsistenceRate) || 0 : 0;
    const finalSplits = rawPaydays.splits.map((split, idx) => {
      const override = subDaysOverrides[idx];
      return { ...split, subDays: (override !== undefined && override !== '') ? (parseFloat(override) || 0) : split.days };
    });
    return {
      splits: finalSplits, error: null,
      totalDays: finalSplits.reduce((sum, sp) => sum + sp.days, 0),
      totalSubDays: finalSplits.reduce((sum, sp) => sum + sp.subDays, 0),
      totalSub: s.pdIncludeSubsistence ? finalSplits.reduce((sum, sp) => sum + sp.subDays * subAmt, 0) : null,
    };
  }, [rawPaydays, subDaysOverrides, s.pdIncludeSubsistence, s.pdSubsistenceRate]);

  const pdTotalGross = (paydays.totalDays || 0) * (parseFloat(s.pdDayRate) || 0);
  const pdTotalNet = pdTotalGross + (paydays.totalSub || 0) - (parseFloat(s.pdAdvance) || 0);

  // ─── Export Functions ───
  const downloadCSV = (filename: string, headers: string, rows: string) => {
    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`${filename} exported`);
  };

  const exportContractCSV = () => {
    const headers = "Component,Amount\n";
    let rows = `"Consolidated Rate",${contract.cRate}\n`;
    if (s.includePension) rows += `"Pension",${contract.cPension}\n`;
    if (s.includeAppyLevy) rows += `"Apprenticeship Levy",${contract.cAppyLevy}\n`;
    if (s.includeContingency) rows += `"Contingency",${contract.cContingency}\n`;
    if (s.includeNI && !s.seafarerExempt) rows += `"Employer NI",${contract.cEmployerNI}\n`;
    if (s.includeSubsistence) rows += `"Subsistence Onboard",${contract.cSubOnboardAmt}\n`;
    rows += `"Management Fee",${contract.cManagementFee}\n`;
    rows += `"Total Charge Per Day",${contract.cTotalCharge}\n`;
    downloadCSV('contract_breakdown.csv', headers, rows);
  };

  const exportPermCSV = () => {
    const headers = "Component,Amount\n";
    let rows = `"Annual Salary (${s.pCurrency})",${perm.pSalaryInput}\n`;
    rows += `"Placement Fee",${perm.pPlacementFee}\n`;
    if (s.includePermNI) rows += `"Employer NI",${perm.pEmployerNI}\n`;
    rows += `"Total Cost",${s.includePermNI ? perm.pTotalCost : perm.pPlacementFee}\n`;
    downloadCSV('perm_breakdown.csv', headers, rows);
  };

  const exportReferenceCSV = () => {
    const headers = "Field,Value\n";
    let rows = `"Seafarer Name","${s.refSeafarerName}"\n`;
    rows += `"Discipline","${s.refDiscipline}"\n`;
    rows += `"Company","${s.refCompany}"\n`;
    rows += `"Vessel","${s.refVessel}"\n`;
    rows += `"Dates of Assignment","${s.refDates}"\n`;
    RATING_FIELDS.forEach(f => {
       rows += `"${f.label}","${(s[f.key as keyof AppState] as string) || ''}"\n`;
    });
    rows += `"Adhere to Alcohol & Drugs Policy","${s.refDrugsPolicy}"\n`;
    rows += `"Recommended for Re-Hire","${s.refReHire}"\n`;
    rows += `"Additional Comments","${s.refComments.replace(/"/g, '""')}"\n`;
    downloadCSV('seafarer_appraisal.csv', headers, rows);
  };

  const copyContractBreakdown = () => {
    let text = `Maritime Contract Charge Breakdown (Per Day)\n-----------------------------------\n`;
    text += `Consolidated Rate: ${formatCurrencyIn(contract.cRate, s.cCurrency)}\n`;
    if (s.includePension) text += `Pension (${activeFiscalRates.pension * 100}%): ${formatCurrencyIn(contract.cPension, s.cCurrency)}\n`;
    if (s.includeAppyLevy) text += `Apprenticeship Levy (${activeFiscalRates.apprenticeshipLevy * 100}%): ${formatCurrencyIn(contract.cAppyLevy, s.cCurrency)}\n`;
    if (s.includeContingency) text += `Contingency: ${formatCurrencyIn(contract.cContingency, s.cCurrency)}\n`;

    if (s.includeNI && !s.seafarerExempt) {
      text += `Employer's NIC: ${formatCurrencyIn(contract.cEmployerNI, s.cCurrency)}\n`;
    } else if (s.seafarerExempt) {
      text += `Employer's NIC: Exempt (Seafarer/Non-UKCS)\n`;
    }

    if (s.includeSubsistence && contract.cSubOnboardAmt > 0) {
      text += `Victualling/Onboard Subsistence: ${formatCurrencyIn(contract.cSubOnboardAmt, s.cCurrency)}\n`;
    }

    text += `Management Fee (${contract.feeType === 'percentage' ? `${contract.cMarginVal}%` : 'Fixed'}): ${formatCurrencyIn(contract.cManagementFee, s.cCurrency)}\n`;
    text += `-----------------------------------\n`;

    if (s.displayCurrency === 'gbp' && s.cCurrency !== 'GBP' && cFx.rate) {
      text += `Total Charge Rate (GBP Equivalent): ${formatCurrencyIn(contract.cTotalCharge * contract.crewSize * cFx.rate!, 'GBP')}`;
    } else {
      text += `Total Charge Rate (Onboard): ${formatCurrencyIn(contract.cTotalCharge * contract.crewSize, s.cCurrency)}`;
    }

    copyText(text).then(ok => showToast(ok ? 'Charge breakdown copied' : 'Clipboard access denied. Please select and copy manually.'));
  };

  const copyTripSummary = () => {
    let text = `Hitch & Crew Change Invoice Summary\n-----------------------------------\n`;
    text += `Hitch Days (${contract.nWorkingDays}): ${formatCurrencyIn(contract.tripWorkingTotal * contract.crewSize, s.cCurrency)}\n`;
    text += `Travel Days (${contract.nTravelDays}): ${formatCurrencyIn(contract.tripTravelTotal * contract.crewSize, s.cCurrency)}\n`;
    if (contract.crewLogisticsTotal > 0) text += `Travel & Logistics Costs: ${formatCurrencyIn(contract.crewLogisticsTotal, s.cCurrency)}\n`;
    text += `-----------------------------------\n`;

    if (s.displayCurrency === 'gbp' && s.cCurrency !== 'GBP' && cFx.rate) {
      text += `Total Hitch Invoice (GBP Equivalent): ${formatCurrencyIn(contract.crewTripGrandTotal * cFx.rate, 'GBP')}`;
    } else {
      text += `Total Hitch Invoice: ${formatCurrencyIn(contract.crewTripGrandTotal, s.cCurrency)}`;
    }

    copyText(text).then(ok => showToast(ok ? 'Hitch summary copied' : 'Clipboard access denied. Please select and copy manually.'));
  };

  const copyPermSummary = () => {
    let text = `Permanent Placement Summary\n-----------------------------------\n`;
    text += `Annual Salary: ${formatCurrencyIn(perm.pSalaryInput, s.pCurrency)}\n`;
    if (s.pCurrency !== 'GBP') text += `Converted Salary (GBP): ${formatCurrencyIn(perm.pSalary, 'GBP')} (@ 1 ${s.pCurrency} = ${pFx.rate?.toFixed(4) || '...'} GBP)\n`;

    text += `Placement Fee (${perm.pFeePct}%): ${formatCurrencyIn(perm.pPlacementFee, s.invoiceInOrigin ? s.pCurrency : 'GBP')}\n`;
    if (s.includePermNI) text += `Employer's NI: ${formatCurrencyIn(perm.pEmployerNI, 'GBP')} (UK Tax)\n`;
    text += `-----------------------------------\n`;
    text += `Total ${s.includePermNI ? 'Cost' : 'Invoice'}: ${formatCurrencyIn(s.includePermNI ? perm.pTotalCost : perm.pPlacementFee, s.invoiceInOrigin ? s.pCurrency : 'GBP')}`;

    copyText(text).then(ok => showToast(ok ? 'Permanent summary copied' : 'Clipboard access denied. Please select and copy manually.'));
  };

  const copyPaydaysSummary = () => {
    if (!paydays.splits.length) return;
    const subAmt = s.pdIncludeSubsistence ? (parseFloat(s.pdSubsistenceRate) || 0) : 0;

    let text = `Payment Days Schedule\n-----------------------------------\n`;
    text += `Payroll Type: ${s.pdPayrollType === 'monthly' ? 'Monthly' : 'Fortnightly'}\n`;
    text += `Total Payable Days: ${paydays.totalDays}\n`;

    if (s.pdIncludePay) {
      text += `Day Rate: ${formatCurrencyIn(parseFloat(s.pdDayRate) || 0, 'GBP')}\n`;
      text += `Total Gross Pay: ${formatCurrencyIn(pdTotalGross, 'GBP')}\n`;
      if (s.pdIncludeSubsistence && paydays.totalSub !== null && paydays.totalSub > 0) {
         text += `Total Subsistence (${paydays.totalSubDays}d): ${formatCurrencyIn(paydays.totalSub, 'GBP')}\n`;
      }
      if ((parseFloat(s.pdAdvance) || 0) > 0) text += `Advance Deduction: -${formatCurrencyIn((parseFloat(s.pdAdvance) || 0), 'GBP')}\n`;
      text += `Total Net Pay: ${formatCurrencyIn(pdTotalNet, 'GBP')}\n`;
    } else if (s.pdIncludeSubsistence && paydays.totalSub !== null) {
      text += `Total Subsistence (${paydays.totalSubDays}d): ${formatCurrencyIn(paydays.totalSub, 'GBP')}\n`;
    }

    text += `-----------------------------------\n\n`;

    paydays.splits.forEach(sp => {
      text += `${s.pdPayrollType === 'fortnightly' ? sp.periodLabel : `${formatUK(sp.periodStart)} – ${formatUK(sp.periodEnd)}`}\n`;
      text += `Cut-off: ${formatUK(sp.cutoff)} | Payday: ${formatUK(sp.payday)}\n`;
      text += `Payable Days: ${sp.days % 1 === 0 ? sp.days.toFixed(0) : formatNumber(sp.days)}`;

      if (s.pdIncludePay && (parseFloat(s.pdDayRate) || 0) > 0) {
         text += ` | Gross Pay: ${formatCurrencyIn(sp.days * (parseFloat(s.pdDayRate) || 0), 'GBP')}`;
      }
      if (s.pdIncludeSubsistence && subAmt > 0) {
         text += ` | Subsistence (${sp.subDays}d): ${formatCurrencyIn(sp.subDays * subAmt, 'GBP')}`;
      }
      text += `\n\n`;
    });

    copyText(text.trim()).then(ok => showToast(ok ? 'Payment schedule copied' : 'Clipboard access denied. Please select and copy manually.'));
  };

  const copyReferenceSummary = () => {
    let text = `Seafarer Feedback Form\n-----------------------------------\n`;
    text += `Seafarer Name: ${s.refSeafarerName || '-'}\n`;
    text += `Discipline: ${s.refDiscipline || '-'}\n`;
    text += `Company: ${s.refCompany || '-'}\n`;
    text += `Vessel: ${s.refVessel || '-'}\n`;
    text += `Dates of Assignment: ${s.refDates || '-'}\n\n`;

    text += `Performance Assessment:\n`;
    RATING_FIELDS.forEach(f => {
       text += `- ${f.label}: ${(s[f.key as keyof AppState] as string) || '-'}\n`;
    });

    text += `\nCompliance & Re-Hire:\n`;
    text += `- Adhere to Alcohol & Drugs Policy: ${s.refDrugsPolicy || '-'}\n`;
    text += `- Recommended for Re-Hire: ${s.refReHire || '-'}\n`;

    if (s.refComments) {
      text += `\nAdditional Comments:\n${s.refComments}\n`;
    }

    copyText(text.trim()).then(ok => showToast(ok ? 'Appraisal copied' : 'Clipboard access denied. Please select and copy manually.'));
  };

  const exportScheduleCSV = () => {
    if (!paydays.splits.length) return;
    const subAmt = s.pdIncludeSubsistence ? (parseFloat(s.pdSubsistenceRate) || 0) : 0;

    let headers = "Period,Cut-off,Payday,Payable Days";
    if (s.pdIncludePay) headers += ",Gross Pay";
    if (s.pdIncludeSubsistence) headers += ",Subsistence Days,Subsistence Amount";
    headers += "\n";

    const rows = paydays.splits.map(sp => {
      let row = `"${sp.periodLabel}","${formatUK(sp.cutoff)}","${formatUK(sp.payday)}",${sp.days}`;
      if (s.pdIncludePay) row += `,${sp.days * (parseFloat(s.pdDayRate) || 0)}`;
      if (s.pdIncludeSubsistence) row += `,${sp.subDays},${sp.subDays * subAmt}`;
      return row;
    }).join("\n");

    downloadCSV(`payment_schedule_${s.pdStartDate}_to_${s.pdFinishDate}.csv`, headers, rows);
  };

  const chartData = s.theme === 'dark' ? [
    { name: 'Worker Pay', value: contract.cRate, color: '#38bdf8' },
    { name: 'Additions', value: contract.cTotalAdditions, color: '#60a5fa' },
    { name: 'Employer NI', value: contract.cEmployerNI, color: '#818cf8' },
    { name: 'Subsistence', value: contract.cSubOnboardAmt, color: '#2dd4bf' },
    { name: 'Management Fee', value: contract.cManagementFee, color: '#67e8f9' }
  ].filter(d => d.value > 0) : [
    { name: 'Worker Pay', value: contract.cRate, color: '#0f172a' },
    { name: 'Additions', value: contract.cTotalAdditions, color: '#334155' },
    { name: 'Employer NI', value: contract.cEmployerNI, color: '#475569' },
    { name: 'Subsistence', value: contract.cSubOnboardAmt, color: '#94a3b8' },
    { name: 'Management Fee', value: contract.cManagementFee, color: '#cbd5e1' }
  ].filter(d => d.value > 0);

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-[100dvh] bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 py-10 px-4 sm:px-6 md:px-8 flex flex-col items-center pb-28 md:pb-10 transition-colors duration-300 font-sans antialiased tracking-tight print:py-0 print:px-0">
      <ToastContainer />
      <div className="w-full max-w-5xl">
        {/* ── Print-only document header ── */}
        <div className="hidden print:flex print:items-start print:justify-between print:mb-8 print:pb-6 print:border-b-2 print:border-gray-300">
          <div>
            <img src="/Seamariner_Primary_Logo_Full_Color_Rgb_900px_w_72ppi - No Background.png" alt="Seamariner" className="h-10 w-auto mb-2" />
            <p className="text-sm font-bold text-gray-500 uppercase tracking-widest">
              {mode === 'contract' && 'Contract / Day Rate Breakdown'}
              {mode === 'perm' && 'Permanent Placement Summary'}
              {mode === 'paydays' && 'Payroll Schedule'}
              {mode === 'reference' && 'Seafarer Feedback Form'}
            </p>
          </div>
          <div className="text-right text-sm text-gray-600 space-y-0.5">
            <p>{new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
            {s.clientName && <p className="font-bold text-black">Client: {s.clientName}</p>}
            {s.candidateName && <p className="font-bold text-black">Candidate: {s.candidateName}</p>}
          </div>
        </div>

        <header className="mb-8 flex flex-col md:flex-row md:items-start justify-between gap-4 print:hidden">
          <div>
            <Logo />
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50 flex items-center gap-3">Maritime Fee Calculator</h1>
            <p className="mt-2 text-slate-500 dark:text-slate-400 font-medium">Specialised toolkit for maritime quoting and scheduling.</p>
          </div>

          <div className="flex flex-col sm:items-end gap-3">
             <div className="flex items-center gap-2">
               <button onClick={toggleTheme} className="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-slate-700 dark:text-slate-300 flex items-center justify-center h-9 w-9 mr-2 shadow-sm" title="Toggle Theme" aria-label="Toggle Theme">
                 {s.theme === 'dark' ? <Sun className="h-4 w-4 text-cyan-400" /> : <Moon className="h-4 w-4 text-slate-700" />}
               </button>
               <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Tax Year</label>
               <select className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-50 rounded-lg text-sm font-bold focus:ring-2 focus:ring-slate-900 dark:focus:ring-white focus:outline-none shadow-sm" value={s.taxYear} onChange={(e) => s.updateField('taxYear', e.target.value as TaxProfile)} aria-label="Select Tax Year">
                 {Object.keys(FISCAL_PROFILES).map(year => <option key={year} value={year} className="bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-50">{year}</option>)}
               </select>
             </div>
            <div className="flex flex-wrap items-center gap-2 bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
               <div className="flex items-center gap-1">
                 <select className="px-3 py-2 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-slate-900 dark:text-slate-50 rounded-lg text-sm font-medium focus:ring-2 focus:ring-slate-900 dark:focus:ring-white focus:outline-none" value={selectedPreset} onChange={(e) => loadPreset(e.target.value)} aria-label="Load Preset">
                   <option value="" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-50">Load Preset...</option>
                   {Object.keys(s.savedPresets).map(p => <option key={p} value={p} className="bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-50">{p}</option>)}
                 </select>
                 {selectedPreset && (
                   <button onClick={deleteSelectedPreset} className="p-2 text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors" title="Delete Active Preset">
                     <Trash2 className="h-4 w-4" />
                   </button>
                 )}
               </div>
               <div className="flex gap-1 items-center border-l border-slate-200 dark:border-slate-700 pl-2 ml-1">
                 <input type="text" placeholder="Save as..." value={newPresetName} onChange={(e)=>setNewPresetName(e.target.value)} className="px-3 py-2 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-slate-900 dark:text-slate-50 rounded-lg text-sm font-medium focus:ring-2 focus:ring-slate-900 dark:focus:ring-white focus:outline-none w-28 sm:w-32 placeholder:text-slate-500 dark:placeholder:text-slate-400" />
                 <button onClick={savePreset} className="p-2 bg-slate-900 dark:bg-blue-600 text-white rounded-lg hover:bg-slate-800 dark:hover:bg-blue-500 transition-colors shadow-sm" title="Save Preset"><Save className="h-4 w-4" /></button>
               </div>
            </div>
            <button onClick={reset} className="flex items-center gap-2 text-sm font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-50 px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"><RotateCcw className="h-4 w-4" />Reset Values</button>
          </div>
        </header>

        {/* Global Details Header */}
        {(mode === 'contract' || mode === 'perm') && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-sm print:shadow-none print:border-none print:p-0">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider pl-1 print:hidden">Client Name</label>
              <input type="text" placeholder="Client Name (Optional)" value={s.clientName} onChange={(e) => s.updateField('clientName', e.target.value)} className="w-full bg-transparent border-b border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-50 px-1 py-1 focus:outline-none focus:border-slate-900 dark:focus:border-white transition-colors placeholder:text-slate-400 dark:placeholder:text-slate-500 print:text-black print:border-none print:p-0 print:font-bold print:text-2xl" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider pl-1 sm:text-right block print:hidden">Candidate Name</label>
              <input type="text" placeholder="Candidate Name (Optional)" value={s.candidateName} onChange={(e) => s.updateField('candidateName', e.target.value)} className="w-full bg-transparent border-b border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-50 px-1 py-1 focus:outline-none focus:border-slate-900 dark:focus:border-white transition-colors placeholder:text-slate-400 dark:placeholder:text-slate-500 print:text-black print:border-none print:p-0 print:text-gray-600 sm:text-right print:text-lg" />
            </div>
          </div>
        )}

        <Tabs value={mode} onValueChange={(v) => setMode(v as typeof mode)} className="w-full">
          <TabsList className="grid w-full max-w-3xl grid-cols-4 mb-8 bg-black/5 dark:bg-white/5 p-1 rounded-xl print:hidden">
            <TabsTrigger value="contract" className="flex gap-2 rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:text-slate-900 dark:data-[state=active]:text-slate-50 data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-black/5 dark:data-[state=active]:ring-white/10 text-slate-500 dark:text-slate-400 font-semibold transition-all"><Ship className="h-4 w-4" />Contract</TabsTrigger>
            <TabsTrigger value="perm" className="flex gap-2 rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:text-slate-900 dark:data-[state=active]:text-slate-50 data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-black/5 dark:data-[state=active]:ring-white/10 text-slate-500 dark:text-slate-400 font-semibold transition-all"><Briefcase className="h-4 w-4" />Perm</TabsTrigger>
            <TabsTrigger value="paydays" className="flex gap-2 rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:text-slate-900 dark:data-[state=active]:text-slate-50 data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-black/5 dark:data-[state=active]:ring-white/10 text-slate-500 dark:text-slate-400 font-semibold transition-all"><CalendarDays className="h-4 w-4" />Paydays</TabsTrigger>
            <TabsTrigger value="reference" className="flex gap-2 rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:text-slate-900 dark:data-[state=active]:text-slate-50 data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-black/5 dark:data-[state=active]:ring-white/10 text-slate-500 dark:text-slate-400 font-semibold transition-all"><FileCheck className="h-4 w-4" />Reference</TabsTrigger>
          </TabsList>

          {/* ─────────────── CONTRACT TAB ─────────────── */}
          <TabsContent value="contract" className="m-0 animate-in fade-in duration-400">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-5 flex flex-col gap-6 print:hidden">
                <CollapsibleCard title="Day Rate & Tax" icon={FileText} defaultOpen>
                  <div className="space-y-4 mb-4">
                    <label className="block text-sm font-bold text-slate-900 dark:text-slate-50">Currency & Crew</label>
                    <div className="flex gap-2">
                      <SegmentedControl value={s.cCurrency} onChange={(v: string) => s.updateField('cCurrency', v as CurrencyCode)} options={CURRENCIES.map(c => ({label: c, value: c}))} ariaLabel="Currency" />
                    </div>
                    <AnimatedSection show={s.cCurrency !== 'GBP'}>
                      <div className="space-y-3 p-4 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl mb-6">
                        <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-50">
                          <Globe className="h-4 w-4" />Exchange Rate
                        </div>
                        <div className="space-y-1">
                          <label htmlFor="c-fx-date" className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Placement / Start Date</label>
                          <input id="c-fx-date" type="date" value={s.cFxDate} onChange={(e) => s.updateField('cFxDate', e.target.value)} className="w-full px-4 py-2.5 bg-white dark:bg-[#172033] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-50 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/20 dark:focus:ring-white/20 transition-all text-sm font-medium" />
                        </div>
                        <div className="flex items-center justify-between rounded-lg bg-white/50 dark:bg-black/20 border border-slate-200 dark:border-slate-800 px-3 py-2.5">
                          {cFx.isManual ? (
                            <div className="flex items-center gap-2 w-full">
                              <span className="text-sm font-bold text-slate-900 dark:text-slate-50 whitespace-nowrap">1 {s.cCurrency} = </span>
                              <input type="number" value={cFx.manualRate} onChange={(e) => cFx.setManualRate(e.target.value)} placeholder="0.0000" className="w-full px-2 py-1 bg-white dark:bg-[#172033] border border-slate-200 dark:border-slate-700 rounded text-sm font-mono focus:outline-none focus:ring-2 focus:ring-slate-900/20 dark:focus:ring-white/20" />
                              <span className="text-sm font-bold text-slate-900 dark:text-slate-50">GBP</span>
                            </div>
                          ) : (
                             <div className="text-sm font-medium">
                               {cFx.loading ? (
                                 <span className="text-slate-500 dark:text-slate-400">Fetching rate…</span>
                               ) : cFx.rate !== null ? (
                                 <span className="font-mono font-bold animate-in fade-in duration-300 text-slate-900 dark:text-slate-50">1 {s.cCurrency} = {cFx.rate.toFixed(4)} GBP</span>
                               ) : (
                                 <span className="text-slate-500 dark:text-slate-400">No rate yet</span>
                               )}
                             </div>
                          )}
                          {!cFx.isManual && (
                             <button onClick={cFx.refresh} aria-label="Refresh exchange rate" className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-slate-50 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 dark:focus-visible:ring-white">
                               <RefreshCw className={cn('h-3.5 w-3.5', cFx.loading && 'animate-spin')} />
                             </button>
                          )}
                        </div>
                        <div className="flex items-center justify-between pt-1 px-1">
                          <label className="text-xs font-bold cursor-pointer text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-50 transition-colors" onClick={() => cFx.setIsManual(!cFx.isManual)}>Manual Override</label>
                          <Switch checked={cFx.isManual} onCheckedChange={(v: boolean) => cFx.setIsManual(v)} className="scale-75 origin-right" />
                        </div>
                        {cFx.error === 'future-date-fallback' && !cFx.isManual && (
                          <div className="flex items-start gap-2 text-xs text-amber-600 dark:text-amber-500 font-medium mt-2">
                            <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                            <span>Future date selected. Showing today's latest rate instead.</span>
                          </div>
                        )}
                      </div>
                    </AnimatedSection>
                    <div className="flex items-center justify-between gap-4 p-3 bg-black/5 dark:bg-white/5 rounded-xl border border-black/10 dark:border-white/10">
                      <label className="text-sm font-bold flex items-center gap-2 text-slate-900 dark:text-slate-50"><Users className="h-4 w-4"/> Crew Size (Multiplier)</label>
                      <input type="number" min="1" value={s.crewSize} onChange={(e) => s.updateField('crewSize', e.target.value)} className="w-20 px-3 py-1.5 bg-white dark:bg-[#172033] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-50 rounded-lg font-mono text-center focus:ring-2 focus:ring-slate-900 dark:focus:ring-white outline-none" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-bold text-slate-900 dark:text-slate-50">Consolidated Rate — Seafarer Pay</label>
                    <NumInput value={s.consolidatedRate} onChange={(v: string) => s.updateField('consolidatedRate', v)} prefix={curSym(s.cCurrency)} />
                  </div>

                  <div className="space-y-3 pt-2">
                    <div className="flex justify-between group">
                      <div className="space-y-1 pr-4">
                        <label className="text-sm font-bold cursor-pointer text-slate-900 dark:text-slate-50" onClick={() => s.updateField('includePension', !s.includePension)}>Include Pension</label>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Standard {activeFiscalRates.pension * 100}% addition</p>
                      </div>
                      <Switch checked={s.includePension} onCheckedChange={(v: boolean) => s.updateField('includePension', v)} />
                    </div>
                    <div className="flex justify-between group">
                      <div className="space-y-1 pr-4">
                        <label className="text-sm font-bold flex items-center cursor-pointer text-slate-900 dark:text-slate-50" onClick={() => s.updateField('includeAppyLevy', !s.includeAppyLevy)}>Include Apprenticeship Levy <Tooltip text="A 0.5% tax on large employers to fund apprenticeship training." /></label>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Standard {activeFiscalRates.apprenticeshipLevy * 100}% addition</p>
                      </div>
                      <Switch checked={s.includeAppyLevy} onCheckedChange={(v: boolean) => s.updateField('includeAppyLevy', v)} />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between group"><label className="text-sm font-bold cursor-pointer text-slate-900 dark:text-slate-50" onClick={() => s.updateField('includeContingency', !s.includeContingency)}>Add Contingency</label><Switch checked={s.includeContingency} onCheckedChange={(v: boolean) => s.updateField('includeContingency', v)} /></div>
                      <AnimatedSection show={s.includeContingency}>
                        <div className="flex items-center gap-2 pt-1">
                           <div className="w-24"><SegmentedControl value={s.contingencyType} onChange={(v: string) => s.updateField('contingencyType', v as 'percentage' | 'fixed')} options={[{label: '%', value: 'percentage'}, {label: curSym(s.cCurrency), value: 'fixed'}]} ariaLabel="Contingency Type" /></div>
                           <NumInput value={s.contingencyValue} onChange={(v: string) => s.updateField('contingencyValue', v)} prefix={s.contingencyType === 'fixed' ? curSym(s.cCurrency) : undefined} suffix={s.contingencyType === 'percentage' ? '%' : undefined} />
                        </div>
                      </AnimatedSection>
                    </div>
                  </div>

                  <div className="space-y-2 pt-4 border-t border-slate-100 dark:border-slate-800 mt-4">
                    <div className="flex items-center justify-between">
                      <label className="block text-sm font-bold text-slate-900 dark:text-slate-50">Management Fee</label>
                      <div className="w-32"><SegmentedControl value={s.feeType} onChange={(v: string) => s.updateField('feeType', v as 'percentage' | 'fixed')} options={[{label: '%', value: 'percentage'}, {label: curSym(s.cCurrency), value: 'fixed'}]} ariaLabel="Fee Type" /></div>
                    </div>
                    <NumInput value={s.margin} onChange={(v: string) => s.updateField('margin', v)} prefix={s.feeType === 'fixed' ? curSym(s.cCurrency) : undefined} suffix={s.feeType === 'percentage' ? '%' : undefined} />
                  </div>

                  <div className="pt-4 space-y-4 border-t border-slate-100 dark:border-slate-800 mt-4">
                    <div className="flex justify-between group"><label className="text-sm font-bold cursor-pointer text-slate-900 dark:text-slate-50" onClick={() => s.updateField('includeNI', !s.includeNI)}>Include Employer's NI</label><Switch checked={s.includeNI} onCheckedChange={(v: boolean) => s.updateField('includeNI', v)} /></div>
                    <AnimatedSection show={s.includeNI}>
                      <div className="space-y-3 bg-amber-500/5 dark:bg-cyan-500/5 p-4 rounded-xl border border-amber-500/20 dark:border-cyan-500/20">
                        <SegmentedControl value={s.niMode} onChange={(v: string) => s.updateField('niMode', v as 'base' | 'total')} options={[{label: 'Base Rate', value: 'base'}, {label: 'Total Amount', value: 'total'}]} ariaLabel="NI Mode" />
                        <div className="flex justify-between items-center pt-2"><label className="text-sm font-bold text-amber-700 dark:text-cyan-400">Seafarer Exemption <Tooltip text="UK Continental Shelf. Vessels operating wholly outside this may be exempt from Employer's NI." /></label><Switch checked={s.seafarerExempt} onCheckedChange={(v: boolean) => s.updateField('seafarerExempt', v)} /></div>
                      </div>
                    </AnimatedSection>
                  </div>
                </CollapsibleCard>

                <CollapsibleCard title="Subsistence & Victualling" icon={UtensilsCrossed} defaultOpen={false}>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-bold cursor-pointer flex items-center text-slate-900 dark:text-slate-50" onClick={() => s.updateField('includeSubsistence', !s.includeSubsistence)}>
                      Enable Subsistence
                      <Tooltip text="Food and provisions provided onboard. Typically £0 as covered by the vessel." />
                    </label>
                    <Switch checked={s.includeSubsistence} onCheckedChange={(v: boolean) => { s.updateField('includeSubsistence', v); if (!v) s.updateField('subsistenceInFee', false); }} />
                  </div>
                  <AnimatedSection show={s.includeSubsistence} className="pt-3 space-y-5 border-t border-slate-100 dark:border-slate-800 mt-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2"><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Travel (per day)</label><NumInput value={s.subsistenceTravel} onChange={(v: string) => s.updateField('subsistenceTravel', v)} prefix={curSym(s.cCurrency)} /></div>
                      <div className="space-y-2"><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Travel Days</label><NumInput value={s.subsistenceTravelDays} onChange={(v: string) => s.updateField('subsistenceTravelDays', v)} placeholder="1" /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2"><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Onboard (per day)</label><NumInput value={s.subsistenceOnboard} onChange={(v: string) => s.updateField('subsistenceOnboard', v)} prefix={curSym(s.cCurrency)} /></div>
                    </div>
                    <div className="flex justify-between group"><label className="text-sm font-bold cursor-pointer text-slate-900 dark:text-slate-50" onClick={() => s.includeSubsistence && s.updateField('subsistenceInFee', !s.subsistenceInFee)}>Apply margin to subsistence</label><Switch checked={s.subsistenceInFee} onCheckedChange={(v: boolean) => s.updateField('subsistenceInFee', v)} disabled={!s.includeSubsistence} /></div>
                  </AnimatedSection>
                </CollapsibleCard>

                <CollapsibleCard title="Hitch & Logistics Scheduler" icon={Anchor} defaultOpen={false}>
                   <div className="flex justify-between"><label className="text-sm font-bold text-slate-900 dark:text-slate-50">Enable Hitch Scheduler</label><Switch checked={s.includeTrip} onCheckedChange={(v: boolean) => s.updateField('includeTrip', v)} /></div>
                   <AnimatedSection show={s.includeTrip} className="pt-4 space-y-4 border-t border-slate-100 dark:border-slate-800 mt-3">
                     <div className="space-y-2"><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Days Onboard</label><NumInput value={s.workingDays} onChange={(v: string) => s.updateField('workingDays', v)} placeholder="Working Days" /></div>
                     <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                       <div className="space-y-2"><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Travel Days</label><NumInput value={s.travelDays} onChange={(v: string) => s.updateField('travelDays', v)} placeholder="Travel Days" /></div>
                       <div className="space-y-2"><label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Charge Rate</label><SegmentedControl value={s.travelDayFull ? 'full' : 'half'} onChange={(v: string) => s.updateField('travelDayFull', v === 'full')} options={[{label: '0.5 rate', value: 'half'}, {label: 'Full rate', value: 'full'}]} ariaLabel="Travel Rate" /></div>
                     </div>
                     <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                       <div className="flex items-center justify-between"><label className="block text-sm font-bold text-slate-900 dark:text-slate-50">Travel & Logistics Costs</label><div className="flex items-center gap-2"><label className="text-xs font-bold text-slate-500 dark:text-slate-400 cursor-pointer" onClick={() => s.updateField('logisticsInFee', !s.logisticsInFee)}>Add Travel Fee</label><Switch checked={s.logisticsInFee} onCheckedChange={(v: boolean) => s.updateField('logisticsInFee', v)} className="scale-75 origin-right" /></div></div>
                       <div className="grid grid-cols-3 gap-2">
                         <NumInput value={s.mobTravel} onChange={(v: string) => s.updateField('mobTravel', v)} placeholder="Travel" prefix={curSym(s.cCurrency)} />
                         <NumInput value={s.mobVisas} onChange={(v: string) => s.updateField('mobVisas', v)} placeholder="Visas" prefix={curSym(s.cCurrency)} />
                         <NumInput value={s.mobAgent} onChange={(v: string) => s.updateField('mobAgent', v)} placeholder="Agent" prefix={curSym(s.cCurrency)} />
                       </div>
                       <AnimatedSection show={s.logisticsInFee} className="space-y-2 pt-3">
                         <div className="flex items-center justify-between">
                           <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Travel Fee</label>
                           <div className="w-28"><SegmentedControl value={s.travelFeeType} onChange={(v: string) => s.updateField('travelFeeType', v as 'percentage' | 'fixed')} options={[{label: '%', value: 'percentage'}, {label: curSym(s.cCurrency), value: 'fixed'}]} ariaLabel="Travel Fee Type" /></div>
                         </div>
                         <NumInput value={s.travelFee} onChange={(v: string) => s.updateField('travelFee', v)} prefix={s.travelFeeType === 'fixed' ? curSym(s.cCurrency) : undefined} suffix={s.travelFeeType === 'percentage' ? '%' : undefined} />
                       </AnimatedSection>
                     </div>
                   </AnimatedSection>
                </CollapsibleCard>
              </div>

              <div className="lg:col-span-7 sticky top-4 self-start bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-lg overflow-hidden flex flex-col relative print:bg-white print:border-none print:shadow-none print:static">
                {contract.cRate === 0 && !dbConsolidatedRate ? (
                  <div className="absolute inset-0 z-10 bg-white/95 dark:bg-slate-900/95 flex flex-col items-center justify-center text-center p-10 animate-in fade-in duration-500 print:hidden">
                    <div className="p-4 bg-black/5 dark:bg-white/10 rounded-full mb-4">
                      <Ship className="h-8 w-8 text-slate-900 dark:text-cyan-400" />
                    </div>
                    <h3 className="text-xl font-bold mb-2 text-slate-900 dark:text-slate-50">Awaiting Parameters</h3>
                    <p className="text-slate-500 dark:text-slate-400 font-medium max-w-sm">
                      Enter a consolidated day rate and management fee to generate the maritime charge breakdown.
                    </p>
                  </div>
                ) : null}

                <div className="p-8 md:p-10 flex-grow relative z-0 print:p-0">
                  <div className="flex items-center justify-between gap-4 mb-8">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50">{s.crewSize !== '1' ? `Crew Charge Breakdown (${s.crewSize} Members)` : 'Charge Rate Breakdown'}</h2>
                    <div className="flex items-center gap-2">
                      <ActionButton onClick={copyContractBreakdown} icon={Copy} label="Copy" />
                      <ActionButton onClick={() => window.print()} icon={Printer} label="Print" />
                      <ActionButton onClick={exportContractCSV} icon={Download} label="CSV" />
                    </div>
                  </div>

                  {/* Recharts Visualization */}
                  <div className="h-24 w-full mb-6 print:hidden">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={chartData} cx="50%" cy="50%" innerRadius={30} outerRadius={45} paddingAngle={2} dataKey="value" stroke="none">
                          {chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                        </Pie>
                        <ChartTooltip formatter={(value: number) => formatCurrencyIn(value, s.cCurrency)} contentStyle={{ borderRadius: '8px', border: 'none', backgroundColor: s.theme === 'dark' ? '#1E293B' : '#FFFFFF', color: s.theme === 'dark' ? '#F8FAFC' : '#0F172A', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} itemStyle={{ color: s.theme === 'dark' ? '#F8FAFC' : '#0F172A' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="space-y-3">
                    <LineItem label={`Consolidated Day Rate ${s.crewSize !== '1' ? '(Total Crew)' : ''}`} value={contract.cRate * contract.crewSize} isBold currency={s.cCurrency} />
                    {s.includePension && <LineItem label={`Pension (${activeFiscalRates.pension * 100}%)`} value={contract.cPension * contract.crewSize} currency={s.cCurrency} />}
                    {s.includeAppyLevy && <LineItem label={`Apprenticeship Levy (${activeFiscalRates.apprenticeshipLevy * 100}%)`} value={contract.cAppyLevy * contract.crewSize} currency={s.cCurrency} />}
                    {s.includeContingency && <LineItem label={`Contingency (${s.contingencyType === 'percentage' && contract.cContingency > 0 ? dbContingencyValue + '%' : 'Fixed'})`} value={contract.cContingency * contract.crewSize} currency={s.cCurrency} />}

                    {s.includeNI && (
                      <LineItem label={s.seafarerExempt ? "Employers NIC (Exempt)" : `Employers NIC (${activeFiscalRates.employerNI * 100}%)`} value={contract.cEmployerNI * contract.crewSize} currency={s.cCurrency} />
                    )}
                    {s.includeSubsistence && !s.includeTrip && contract.cSubTravelAmt > 0 && (() => { const tDays = Math.max(1, parseFloat(dbSubTravelDays) || 1); return <LineItem label={`Travel Subsistence (×${tDays} day${tDays !== 1 ? 's' : ''})`} value={contract.cSubTravelAmt * contract.crewSize * tDays} currency={s.cCurrency} />; })()}
                    {s.includeSubsistence && contract.cSubOnboardAmt > 0 && <LineItem label="Onboard Victualling/Sub" value={contract.cSubOnboardAmt * contract.crewSize} currency={s.cCurrency} />}
                    <LineItem label={`Management Fee (${contract.feeType === 'percentage' && contract.cMarginVal > 0 ? `${contract.cMarginVal}%` : 'Fixed'})`} value={contract.cManagementFee * contract.crewSize} currency={s.cCurrency} />

                    {s.feeType === 'percentage' && contract.cMarginVal > 0 && contract.cMarginVal < 10 && (
                      <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-lg px-3 py-2 text-xs font-semibold text-amber-600 dark:text-amber-400 print:hidden">
                        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                        Low margin — {contract.cMarginVal}% is below the 10% threshold.
                      </div>
                    )}

                    <div className="mt-4 pt-5 border-t-2 border-black/10 dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <span className="text-lg font-bold text-slate-900 dark:text-slate-50 block">Total Charge Per Day</span>
                        {s.cCurrency !== 'GBP' && (
                          <div className="flex items-center gap-2 mt-1.5 print:hidden">
                            <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">Display Currency:</span>
                            <div className="w-36">
                              <SegmentedControl 
                                value={s.displayCurrency} 
                                onChange={(v: string) => s.updateField('displayCurrency', v as 'original' | 'gbp')} 
                                options={[{label: s.cCurrency, value: 'original'}, {label: 'GBP (£)', value: 'gbp'}]} 
                                ariaLabel="Display Currency Toggle"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                      <span className="text-3xl font-mono font-bold text-emerald-600 dark:text-emerald-400 animate-in zoom-in-95 duration-200">
                        {s.displayCurrency === 'gbp' && s.cCurrency !== 'GBP' && cFx.rate !== null
                          ? formatCurrencyIn(contract.cTotalCharge * contract.crewSize * cFx.rate, 'GBP')
                          : formatCurrencyIn(contract.cTotalCharge * contract.crewSize, s.cCurrency)}
                      </span>
                    </div>

                    {s.cCurrency !== 'GBP' && cFx.rate !== null && s.displayCurrency === 'original' && (
                      <div className="flex items-center justify-between pt-2 text-sm text-slate-500 dark:text-slate-400 border-t border-black/5 dark:border-white/5">
                         <span>Converted Equivalency (@ {cFx.rate.toFixed(4)})</span>
                         <span className="font-mono font-bold tabular-nums text-slate-900 dark:text-slate-50">{formatCurrencyIn(contract.cTotalCharge * contract.crewSize * cFx.rate, 'GBP')}</span>
                      </div>
                    )}
                  </div>

                  <AnimatedSection show={s.includeTrip} className="mt-8 pt-6 border-t border-black/10 dark:border-white/10">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-4">Single Travel Day Reference {s.crewSize !== '1' ? '(Total Crew)' : ''}</h3>
                    <div className="space-y-2.5">
                      <LineItem label={`Consolidated Rate (×${s.travelDayFull ? '1' : '0.5'})`} value={contract.cTravelRate * contract.crewSize} currency={s.cCurrency} />
                      {s.includePension && <LineItem label="Pension" value={contract.cTravelPension * contract.crewSize} currency={s.cCurrency} />}
                      {s.includeAppyLevy && <LineItem label="Apprenticeship Levy" value={contract.cTravelAppyLevy * contract.crewSize} currency={s.cCurrency} />}
                      {s.includeContingency && <LineItem label="Contingency" value={contract.cTravelContingency * contract.crewSize} currency={s.cCurrency} />}
                      {s.includeNI && !s.seafarerExempt && <LineItem label="Employers NIC" value={contract.cTravelNI * contract.crewSize} currency={s.cCurrency} />}
                      {s.includeSubsistence && contract.cSubTravelAmt > 0 && <LineItem label="Travel Subsistence (100%)" value={contract.cSubTravelAmt * contract.crewSize} currency={s.cCurrency} />}
                      <LineItem label={`Management Fee`} value={contract.cTravelManagementFee * contract.crewSize} currency={s.cCurrency} />
                      <div className="pt-3 border-t border-black/10 dark:border-white/10 flex items-center justify-between">
                        <span className="text-sm font-bold text-slate-900 dark:text-slate-50">Travel Day Total</span>
                        <span className="font-mono font-bold text-base text-emerald-600 dark:text-emerald-400">{formatCurrencyIn(contract.cTravelDayCharge * contract.crewSize, s.cCurrency)}</span>
                      </div>
                    </div>
                  </AnimatedSection>
                </div>

                <div className="bg-slate-50 dark:bg-black/20 p-8 md:p-10 border-t border-slate-200 dark:border-slate-800 relative z-0 print:bg-transparent">
                  {s.includeTrip ? (
                    <div className="animate-in fade-in duration-300">
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Hitch Crew-Change Invoice {s.crewSize !== '1' ? '(Full Crew)' : ''}</h3>
                        <div className="flex gap-2">
                           <ActionButton onClick={copyTripSummary} icon={Copy} label="Copy" />
                           <ActionButton onClick={() => window.print()} icon={Printer} label="Print" />
                        </div>
                      </div>
                      <div className="space-y-4">

                        <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 p-4 rounded-xl space-y-2">
                          <div className="flex items-center justify-between font-bold text-slate-900 dark:text-slate-50">
                            <span>Days Onboard</span>
                            <span className="font-mono">{formatCurrencyIn(contract.crewTripWorkingTotal, s.cCurrency)}</span>
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">{contract.nWorkingDays} days × {formatCurrencyIn(contract.cTotalCharge * contract.crewSize, s.cCurrency)}</div>
                        </div>

                        <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 p-4 rounded-xl space-y-2">
                          <div className="flex items-center justify-between font-bold text-slate-900 dark:text-slate-50">
                            <span>Travel Days ({contract.nTravelDays})</span>
                            <span className="font-mono">{formatCurrencyIn(contract.crewTripTravelTotal, s.cCurrency)}</span>
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">{contract.travelPayableDays} days pay + {contract.travelSubDays} full days sub</div>
                        </div>

                        {contract.crewLogisticsTotal > 0 && (
                          <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 p-4 rounded-xl flex flex-col gap-2">
                            <div className="flex items-center justify-between font-bold text-slate-900 dark:text-slate-50">
                              <span>Travel & Logistics Costs</span>
                              <span className="font-mono">{formatCurrencyIn(contract.crewLogisticsTotal, s.cCurrency)}</span>
                            </div>
                            <span className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                              Travel: {curSym(s.cCurrency)}{dbMobTravel || '0'} | VISA / Cert.: {curSym(s.cCurrency)}{dbMobVisas || '0'} | Agent: {curSym(s.cCurrency)}{dbMobAgent || '0'} <br />
                              {s.logisticsInFee && contract.logisticsFee > 0 && `${contract.travelFeeType === 'percentage' ? contract.cTravelFeeVal + '%' : 'Fixed'} Travel Fee: ${formatCurrencyIn(contract.logisticsFee * contract.crewSize, s.cCurrency)}`}
                            </span>
                          </div>
                        )}

                        <div className="pt-2 border-t-2 border-black/10 dark:border-white/10 flex flex-col gap-2">
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="text-lg font-bold text-slate-900 dark:text-slate-50 block">Total Hitch Invoice</span>
                              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">{contract.nWorkingDays + contract.nTravelDays} days total</span>
                            </div>
                            <span className="text-3xl font-mono font-bold text-emerald-600 dark:text-emerald-400 animate-in zoom-in-95 duration-200" key={contract.crewTripGrandTotal}>
                              {s.displayCurrency === 'gbp' && s.cCurrency !== 'GBP' && cFx.rate !== null
                                ? formatCurrencyIn(contract.crewTripGrandTotal * cFx.rate, 'GBP')
                                : formatCurrencyIn(contract.crewTripGrandTotal, s.cCurrency)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="animate-in fade-in duration-300 print:hidden">
                      <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-6">Standard Revenue Projections {s.crewSize !== '1' ? `(×${s.crewSize})` : ''}</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <ProjectionCard label="Weekly" days={5} charge={contract.cTotalCharge * contract.crewSize} fee={contract.cManagementFee * contract.crewSize} currency={s.cCurrency} />
                        <ProjectionCard label="Monthly" days={21} charge={contract.cTotalCharge * contract.crewSize} fee={contract.cManagementFee * contract.crewSize} currency={s.cCurrency} />
                        <ProjectionCard label="Annual" days={230} charge={contract.cTotalCharge * contract.crewSize} fee={contract.cManagementFee * contract.crewSize} currency={s.cCurrency} />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* ─────────────── PERMANENT TAB ─────────────── */}
          <TabsContent value="perm" className="m-0 animate-in fade-in duration-400">
             <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
               <div className="lg:col-span-5 space-y-6 print:hidden">
                 <CollapsibleCard title="Perm Settings" icon={Briefcase} defaultOpen>
                    <div className="space-y-4 mb-4">
                      <label className="block text-sm font-bold text-slate-900 dark:text-slate-50">Salary Currency</label>
                      <SegmentedControl value={s.pCurrency} onChange={(v: string) => s.updateField('pCurrency', v as CurrencyCode)} options={CURRENCIES.map(c => ({label: c, value: c}))} ariaLabel="Perm Currency" />
                    </div>

                    <AnimatedSection show={s.pCurrency !== 'GBP'}>
                      <div className="space-y-3 p-4 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl mt-2 mb-4">
                        <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-50"><Globe className="h-4 w-4" />Exchange Rate</div>
                        <div className="space-y-1">
                          <label htmlFor="p-fx-date" className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Placement / Start Date</label>
                          <input id="p-fx-date" type="date" value={s.pFxDate} onChange={(e) => s.updateField('pFxDate', e.target.value)} className="w-full px-4 py-2.5 bg-white dark:bg-[#172033] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-50 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/20 dark:focus:ring-white/20 transition-all text-sm font-medium" />
                        </div>
                        <div className="flex items-center justify-between rounded-lg bg-white/50 dark:bg-black/20 border border-slate-200 dark:border-slate-800 px-3 py-2.5">
                          {pFx.isManual ? (
                            <div className="flex items-center gap-2 w-full">
                              <span className="text-sm font-bold text-slate-900 dark:text-slate-50 whitespace-nowrap">1 {s.pCurrency} = </span>
                              <input type="number" value={pFx.manualRate} onChange={(e) => pFx.setManualRate(e.target.value)} placeholder="0.0000" className="w-full px-2 py-1 bg-white dark:bg-[#172033] border border-slate-200 dark:border-slate-700 rounded text-sm font-mono focus:outline-none focus:ring-2 focus:ring-slate-900/20 dark:focus:ring-white/20" />
                              <span className="text-sm font-bold text-slate-900 dark:text-slate-50">GBP</span>
                            </div>
                          ) : (
                             <div className="text-sm font-medium">
                               {pFx.loading ? <span className="text-slate-500 dark:text-slate-400">Fetching rate…</span> : pFx.rate !== null ? <span className="font-mono font-bold text-slate-900 dark:text-slate-50">1 {s.pCurrency} = {pFx.rate.toFixed(4)} GBP</span> : <span className="text-slate-500 dark:text-slate-400">No rate yet</span>}
                             </div>
                          )}
                          {!pFx.isManual && (
                             <button onClick={pFx.refresh} aria-label="Refresh exchange rate" className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-slate-50 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 dark:focus-visible:ring-white"><RefreshCw className={cn('h-3.5 w-3.5', pFx.loading && 'animate-spin')} /></button>
                          )}
                        </div>
                        <div className="flex items-center justify-between pt-1 px-1">
                          <label className="text-xs font-bold cursor-pointer text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-50 transition-colors" onClick={() => pFx.setIsManual(!pFx.isManual)}>Manual Override</label>
                          <Switch checked={pFx.isManual} onCheckedChange={(v: boolean) => pFx.setIsManual(v)} className="scale-75 origin-right" />
                        </div>
                      </div>
                    </AnimatedSection>

                    <div className="space-y-2">
                      <label className="block text-sm font-bold text-slate-900 dark:text-slate-50">Candidate Annual Salary ({s.pCurrency})</label>
                      <NumInput value={s.salary} onChange={(v: string) => s.updateField('salary', v)} prefix={curSym(s.pCurrency)} />
                    </div>
                    <div className="space-y-2 mt-4">
                      <label className="block text-sm font-bold text-slate-900 dark:text-slate-50">Placement Fee (%)</label>
                      <NumInput value={s.placementFee} onChange={(v: string) => s.updateField('placementFee', v)} suffix="%" />
                    </div>

                    <AnimatedSection show={s.pCurrency !== 'GBP'}>
                       <div className="flex justify-between group border-t border-slate-100 dark:border-slate-800 pt-4 mt-4">
                         <div className="space-y-1 pr-4">
                           <label className="text-sm font-bold cursor-pointer text-slate-900 dark:text-slate-50" onClick={() => s.updateField('invoiceInOrigin', !s.invoiceInOrigin)}>Invoice in Origin Currency</label>
                           <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Calculate placement fee in {s.pCurrency} instead of GBP</p>
                         </div>
                         <Switch checked={s.invoiceInOrigin} onCheckedChange={(v: boolean) => s.updateField('invoiceInOrigin', v)} />
                       </div>
                    </AnimatedSection>

                    <div className="flex justify-between border-t border-slate-100 dark:border-slate-800 mt-4 pt-4"><label className="text-sm font-bold cursor-pointer text-slate-900 dark:text-slate-50" onClick={() => s.updateField('includePermNI', !s.includePermNI)}>Include Employer's NI</label><Switch checked={s.includePermNI} onCheckedChange={(v: boolean) => s.updateField('includePermNI', v)} /></div>
                 </CollapsibleCard>
               </div>

               <div className="lg:col-span-7 sticky top-4 self-start bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-lg overflow-hidden flex flex-col relative print:bg-white print:border-none print:shadow-none print:static">
                  {perm.pSalaryInput === 0 && !dbSalary ? (
                    <div className="absolute inset-0 z-10 bg-white/95 dark:bg-slate-900/95 flex flex-col items-center justify-center text-center p-10 animate-in fade-in duration-500 print:hidden">
                      <div className="p-4 bg-black/5 dark:bg-white/10 rounded-full mb-4">
                        <Briefcase className="h-8 w-8 text-slate-900 dark:text-cyan-400" />
                      </div>
                      <h3 className="text-xl font-bold mb-2 text-slate-900 dark:text-slate-50">Awaiting Parameters</h3>
                      <p className="text-slate-500 dark:text-slate-400 font-medium max-w-sm">
                        Enter a candidate salary and placement fee to generate the invoice breakdown.
                      </p>
                    </div>
                  ) : null}

                  <div className="p-8 md:p-10 flex-grow relative z-0 print:p-0">
                    <div className="flex items-center justify-between gap-4 mb-8">
                      <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50">Permanent Invoice Breakdown</h2>
                      <div className="flex gap-2">
                         <ActionButton onClick={copyPermSummary} icon={Copy} label="Copy" />
                         <ActionButton onClick={() => window.print()} icon={Printer} label="Print" />
                         <ActionButton onClick={exportPermCSV} icon={Download} label="CSV" />
                      </div>
                    </div>
                    <div className="space-y-4">
                      <LineItem label={`Annual Salary (${s.pCurrency})`} value={perm.pSalaryInput} currency={s.pCurrency} />
                      {s.pCurrency !== 'GBP' && (
                        <LineItem label={pFx.rate !== null ? `Converted @ 1 ${s.pCurrency} = ${pFx.rate.toFixed(4)} GBP` : 'Converted (awaiting rate…)'} value={perm.pSalary} />
                      )}

                      {!perm.pFxReady ? (
                        <div className="flex items-center gap-2 bg-amber-50 dark:bg-cyan-500/10 border border-amber-200 dark:border-cyan-500/20 rounded-xl px-4 py-3 text-sm font-semibold text-amber-600 dark:text-cyan-400">
                          <AlertCircle className="h-4 w-4 shrink-0" /> Waiting on exchange rate...
                        </div>
                      ) : (
                        <>
                          <LineItem label={`Placement Fee (${perm.pFeePct}%)`} value={perm.pPlacementFee} isBold currency={s.invoiceInOrigin ? s.pCurrency : 'GBP'} />
                          <div className="text-xs text-slate-600 dark:text-slate-400 font-medium bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 p-2.5 rounded-lg flex items-center gap-2">
                            <Info className="h-3.5 w-3.5 shrink-0" />
                            <span>Fee = {perm.pFeePct}% × {formatCurrencyIn(s.invoiceInOrigin ? perm.pSalaryInput : perm.pSalary, s.invoiceInOrigin ? s.pCurrency : 'GBP')}</span>
                          </div>
                        </>
                      )}

                      {s.includePermNI && perm.pFxReady && (<><div className="h-px bg-black/10 dark:bg-white/10 my-4" /><LineItem label="Employer's NI on Salary (UK Tax)" value={perm.pEmployerNI} currency="GBP" /></>)}

                      <div className="mt-4 pt-5 border-t-2 border-black/10 dark:border-white/10 flex items-center justify-between">
                        <span className="text-lg font-bold text-slate-900 dark:text-slate-50">Total Invoice to Client</span>
                        <span className="text-3xl font-mono font-bold text-emerald-600 dark:text-emerald-400 animate-in zoom-in-95 duration-200">{formatCurrencyIn(s.includePermNI ? perm.pTotalCost : perm.pPlacementFee, s.invoiceInOrigin ? s.pCurrency : 'GBP')}</span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">
                        {s.invoiceInOrigin && s.pCurrency !== 'GBP' && s.includePermNI ? "Notice: Cost blends multiple currencies." : s.invoiceInOrigin ? `Invoiced strictly in ${s.pCurrency}.` : "Invoiced in GBP regardless of origin salary currency."}
                      </p>
                    </div>
                  </div>
               </div>
             </div>
          </TabsContent>

          {/* ─────────────── PAYMENT DAYS TAB ─────────────── */}
          <TabsContent value="paydays" className="m-0 animate-in fade-in duration-400">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-5 flex flex-col gap-6 print:hidden">
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-7 rounded-2xl shadow-sm space-y-6">
                  <h2 className="text-lg font-bold border-b border-slate-100 dark:border-slate-800 pb-4 text-slate-900 dark:text-slate-50">Payment Days Calculator</h2>

                  <div className="space-y-2">
                    <label className="block text-sm font-bold text-slate-900 dark:text-slate-50">Payroll Type</label>
                    <SegmentedControl value={s.pdPayrollType} onChange={(v: string) => s.updateField('pdPayrollType', v as 'monthly' | 'fortnightly')} options={[{label: 'Monthly', value: 'monthly'}, {label: 'Fortnightly', value: 'fortnightly'}]} ariaLabel="Payroll Type" />
                  </div>

                  <div className="space-y-3">
                    <label htmlFor="pd-start" className="block text-sm font-bold text-slate-900 dark:text-slate-50">Start Date</label>
                    <input id="pd-start" type="date" value={s.pdStartDate} onChange={(e) => s.updateField('pdStartDate', e.target.value)} className="w-full px-4 py-3 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-slate-900 dark:text-slate-50 rounded-xl font-medium tabular-nums focus:outline-none focus:ring-2 focus:ring-slate-900/20 dark:focus:ring-white/20 transition-all duration-200" />
                    <SegmentedControl value={s.pdStartMode} onChange={(v: string) => s.updateField('pdStartMode', v as 'half' | 'full' | 'custom')} options={[{label: '0.5 rate', value: 'half'}, {label: 'Full', value: 'full'}, {label: 'Custom', value: 'custom'}]} ariaLabel="Start Mode" />
                    <AnimatedSection show={s.pdStartMode === 'custom'} className="pt-2">
                       <NumInput value={s.pdStartCustomVal} onChange={(v: string) => s.updateField('pdStartCustomVal', v)} placeholder="0.5" suffix="days" />
                    </AnimatedSection>
                  </div>

                  <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <label htmlFor="pd-finish" className="block text-sm font-bold text-slate-900 dark:text-slate-50">Finish Date</label>
                    <input id="pd-finish" type="date" value={s.pdFinishDate} onChange={(e) => s.updateField('pdFinishDate', e.target.value)} className="w-full px-4 py-3 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-slate-900 dark:text-slate-50 rounded-xl font-medium tabular-nums focus:outline-none focus:ring-2 focus:ring-slate-900/20 dark:focus:ring-white/20 transition-all duration-200" />
                    <SegmentedControl value={s.pdFinishMode} onChange={(v: string) => s.updateField('pdFinishMode', v as 'half' | 'full' | 'custom')} options={[{label: '0.5 rate', value: 'half'}, {label: 'Full', value: 'full'}, {label: 'Custom', value: 'custom'}]} ariaLabel="Finish Mode" />
                    <AnimatedSection show={s.pdFinishMode === 'custom'} className="pt-2">
                       <NumInput value={s.pdFinishCustomVal} onChange={(v: string) => s.updateField('pdFinishCustomVal', v)} placeholder="0.5" suffix="days" />
                    </AnimatedSection>
                  </div>

                  <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800 group">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-bold cursor-pointer text-slate-900 dark:text-slate-50" onClick={() => s.updateField('pdIncludeSubsistence', !s.pdIncludeSubsistence)}>Include Subsistence</label>
                      <Switch checked={s.pdIncludeSubsistence} onCheckedChange={(v: boolean) => s.updateField('pdIncludeSubsistence', v)} />
                    </div>
                    <AnimatedSection show={s.pdIncludeSubsistence} className="pt-2">
                      <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">Subsistence Rate (£ per day)</label>
                      <NumInput value={s.pdSubsistenceRate} onChange={(v: string) => s.updateField('pdSubsistenceRate', v)} prefix="£" />
                    </AnimatedSection>
                  </div>

                  <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800 group">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-bold cursor-pointer text-slate-900 dark:text-slate-50" onClick={() => s.updateField('pdIncludePay', !s.pdIncludePay)}>Calculate Period Pay & Advances</label>
                      <Switch checked={s.pdIncludePay} onCheckedChange={(v: boolean) => s.updateField('pdIncludePay', v)} />
                    </div>
                    <AnimatedSection show={s.pdIncludePay} className="pt-2">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Day Rate (£)</label>
                          <NumInput value={s.pdDayRate} onChange={(v: string) => s.updateField('pdDayRate', v)} prefix="£" />
                        </div>
                        <div className="space-y-2">
                          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Advance Deduction (£)</label>
                          <NumInput value={s.pdAdvance} onChange={(v: string) => s.updateField('pdAdvance', v)} prefix="£" />
                        </div>
                      </div>
                    </AnimatedSection>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-7 sticky top-4 self-start bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-lg overflow-hidden flex flex-col relative print:bg-white print:border-none print:shadow-none print:static">
                <div className="p-8 md:p-10 flex-grow relative z-0 print:p-0">

                  <div className="flex items-center justify-between gap-4 mb-8">
                    <div className="flex items-center gap-3">
                      <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50">Payroll Summary</h2>
                      <span className="text-xs uppercase tracking-widest font-bold px-3 py-1.5 bg-black/5 dark:bg-white/10 text-slate-700 dark:text-slate-300 rounded-full print:bg-gray-200 print:text-gray-700">
                        {s.pdPayrollType === 'monthly' ? 'Monthly' : 'Fortnightly'}
                      </span>
                    </div>
                    {paydays.splits.length > 0 && (
                      <div className="flex items-center gap-2 print:hidden">
                        <ActionButton onClick={copyPaydaysSummary} icon={Copy} label="Copy" />
                        <ActionButton onClick={() => window.print()} icon={Printer} label="Print PDF" />
                        <ActionButton onClick={exportScheduleCSV} icon={Download} label="CSV" />
                      </div>
                    )}
                  </div>

                  {!s.pdStartDate || !s.pdFinishDate ? (
                    <div className="flex flex-col items-center justify-center text-center py-16 px-6 animate-in fade-in duration-500 print:hidden">
                      <div className="p-4 bg-black/5 dark:bg-white/10 rounded-full mb-4">
                        <CalendarDays className="h-8 w-8 text-slate-900 dark:text-cyan-400" />
                      </div>
                      <h3 className="text-xl font-bold mb-2 text-slate-900 dark:text-slate-50">Select Dates</h3>
                      <p className="text-slate-500 dark:text-slate-400 font-medium max-w-sm">
                        Choose a start and finish date to automatically generate the payment schedule.
                      </p>
                    </div>
                  ) : paydays.error ? (
                    <div className="flex items-center gap-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl p-4 animate-in fade-in">
                      <span className="text-sm font-semibold text-red-600 dark:text-red-400">{paydays.error}</span>
                    </div>
                  ) : (
                    <div className="space-y-5 animate-in fade-in duration-500">
                      <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-2xl p-6 text-center print:bg-transparent print:border-2 print:border-slate-300">
                        <p className="text-sm font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-1 print:text-gray-600">Total Payable Days</p>
                        <p className="text-6xl font-mono font-bold text-slate-900 dark:text-cyan-400 animate-in zoom-in-95 duration-200 tabular-nums" key={paydays.totalDays}>{paydays.totalDays}</p>
                        {s.pdStartDate === s.pdFinishDate ? (
                          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-2 print:text-gray-500">Single day</p>
                        ) : (
                          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-2 print:text-gray-500">{formatUK(parseDate(s.pdStartDate))} → {formatUK(parseDate(s.pdFinishDate))}</p>
                        )}

                        {(s.pdIncludeSubsistence || s.pdIncludePay) && (
                          <div className="mt-6 pt-5 border-t border-slate-200 dark:border-slate-700 text-left space-y-2 print:border-gray-300">
                            {s.pdIncludePay && (
                              <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-600 dark:text-slate-300 font-medium print:text-gray-600">Gross Pay ({paydays.totalDays} × {formatCurrencyIn(parseFloat(s.pdDayRate) || 0, 'GBP')})</span>
                                <span className="font-mono font-bold text-slate-900 dark:text-slate-50 print:text-black tabular-nums">{formatCurrencyIn(pdTotalGross, 'GBP')}</span>
                              </div>
                            )}
                            {s.pdIncludeSubsistence && s.pdSubsistenceRate && (
                              <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-600 dark:text-slate-300 font-medium print:text-gray-600">Subsistence ({paydays.totalSubDays}d)</span>
                                <span className="font-mono font-bold text-slate-900 dark:text-slate-50 print:text-black tabular-nums">{formatCurrencyIn(paydays.totalSub || 0, 'GBP')}</span>
                              </div>
                            )}
                            {s.pdIncludePay && (parseFloat(s.pdAdvance) || 0) > 0 && (
                              <div className="flex justify-between items-center text-sm">
                                <span className="text-red-500 dark:text-red-400 font-medium">Less Advance</span>
                                <span className="font-mono font-bold text-red-500 dark:text-red-400 tabular-nums">-{formatCurrencyIn((parseFloat(s.pdAdvance) || 0), 'GBP')}</span>
                              </div>
                            )}
                            {s.pdIncludePay && (
                              <div className="flex justify-between items-center pt-2 mt-2 border-t-2 border-slate-200 dark:border-slate-700 text-base print:border-slate-300">
                                <span className="font-bold text-slate-900 dark:text-slate-50 print:text-black">Total Net Pay</span>
                                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 animate-in zoom-in-95 duration-200 tabular-nums" key={pdTotalNet}>{formatCurrencyIn(pdTotalNet, 'GBP')}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="space-y-3">
                        <p className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 px-1 print:text-gray-600">Payment Schedule</p>
                        {paydays.splits.map((split, idx) => (
                          <div key={idx} className="bg-slate-50 dark:bg-slate-800/50 rounded-xl overflow-hidden hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/50 transition-colors print:border print:border-gray-300 print:bg-white print:text-black print:break-inside-avoid">
                            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700/50 print:border-gray-200">
                              <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-2">
                                {s.pdPayrollType === 'fortnightly' ? (
                                  <span className="text-sm font-bold text-slate-900 dark:text-slate-50 print:text-black">{split.periodLabel}</span>
                                ) : (
                                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400 print:text-gray-500">{formatUK(split.periodStart)} – {formatUK(split.periodEnd)}</span>
                                )}
                              </div>
                              <div className="flex items-center gap-3">
                                {s.pdPayrollType === 'monthly' && <span className="text-sm font-bold text-slate-900 dark:text-cyan-400 print:text-blue-600">{split.periodLabel}</span>}
                                <span className="font-mono font-bold text-slate-900 dark:text-cyan-400 text-base tabular-nums">{split.days % 1 === 0 ? split.days.toFixed(0) : formatNumber(split.days)} days</span>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 divide-x divide-slate-200 dark:divide-slate-700/50 print:divide-gray-200">
                              <div className="px-4 py-2.5">
                                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-0.5 print:text-gray-500">Cut-off</p>
                                <p className="font-mono font-bold text-sm text-slate-900 dark:text-slate-50 print:text-black tabular-nums">{formatUK(split.cutoff)}</p>
                              </div>
                              <div className="px-4 py-2.5">
                                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-0.5 print:text-gray-500">Payday</p>
                                <p className="font-mono font-bold text-sm text-slate-900 dark:text-cyan-400 print:text-black tabular-nums">{formatUK(split.payday)}</p>
                              </div>
                            </div>
                            {(s.pdIncludePay || s.pdIncludeSubsistence) && (
                              <div className="px-4 py-2.5 border-t border-slate-200 dark:border-slate-700/50 bg-white dark:bg-black/20 flex flex-col gap-1.5 print:border-gray-200 print:bg-gray-50">
                                {s.pdIncludePay && (
                                  <div className="flex justify-between items-center text-xs">
                                    <span className="text-slate-600 dark:text-slate-400 print:text-gray-600">Period Gross Pay</span>
                                    <span className="font-mono font-bold text-slate-900 dark:text-slate-50 print:text-black tabular-nums">{formatCurrencyIn(split.days * (parseFloat(s.pdDayRate) || 0), 'GBP')}</span>
                                  </div>
                                )}
                                {s.pdIncludeSubsistence && s.pdSubsistenceRate && (
                                  <div className="flex justify-between items-center text-xs">
                                    <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 print:text-gray-600">
                                      <span>Sub. Days:</span>
                                      <div className="relative flex items-center gap-1">
                                        <input 
                                          type="number" value={subDaysOverrides[idx] ?? ''} onChange={e => setSubDaysOverrides(prev => ({...prev, [idx]: e.target.value}))}
                                          placeholder={split.days.toString()} title="Override subsistence days" aria-label="Override subsistence days"
                                          className="w-12 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-1 py-0.5 text-slate-900 dark:text-slate-50 print:text-black print:border-gray-300 text-center focus:outline-none focus:border-slate-900 dark:focus:border-white transition-colors font-mono tabular-nums placeholder:text-slate-400 dark:placeholder:text-slate-500 print:placeholder:text-gray-400"
                                        />
                                        {subDaysOverrides[idx] !== undefined && (
                                          <button onClick={() => setSubDaysOverrides(prev => { const newObj = {...prev}; delete newObj[idx]; return newObj; })} className="text-slate-400 hover:text-red-500 dark:hover:text-red-400 print:hidden transition-colors"><RotateCcw className="h-3 w-3" /></button>
                                        )}
                                      </div>
                                    </div>
                                    <span className="font-mono font-bold text-slate-900 dark:text-slate-50 print:text-black tabular-nums">{formatCurrencyIn(split.subDays * (parseFloat(s.pdSubsistenceRate) || 0), 'GBP')}</span>
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

          {/* ─────────────── REFERENCE TAB ─────────────── */}
          <TabsContent value="reference" className="m-0 animate-in fade-in duration-400">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-5 space-y-6 print:hidden">
                <CollapsibleCard title="Assignment Details" icon={FileCheck} defaultOpen>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Seafarer Name</label>
                      <TextInput value={s.refSeafarerName} onChange={(v: string) => s.updateField('refSeafarerName', v)} placeholder="John Doe" />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Discipline</label>
                      <TextInput value={s.refDiscipline} onChange={(v: string) => s.updateField('refDiscipline', v)} placeholder="Chief Engineer" />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Company</label>
                      <TextInput value={s.refCompany} onChange={(v: string) => s.updateField('refCompany', v)} placeholder="Oceanic Shipping Ltd." />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Vessel</label>
                      <TextInput value={s.refVessel} onChange={(v: string) => s.updateField('refVessel', v)} placeholder="MV Navigator" />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Dates of Assignment</label>
                      <TextInput value={s.refDates} onChange={(v: string) => s.updateField('refDates', v)} placeholder="01 Jan 2026 - 28 Jan 2026" />
                    </div>
                  </div>
                </CollapsibleCard>

                <CollapsibleCard title="Performance Ratings" icon={Check} defaultOpen={false}>
                  <div className="space-y-4">
                    {RATING_FIELDS.map((field) => (
                      <div key={field.key} className="space-y-2">
                        <label className="block text-xs font-bold text-slate-900 dark:text-slate-50">{field.label}</label>
                        <select 
                          className="w-full px-4 py-2.5 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-slate-900 dark:text-slate-50 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/20 dark:focus:ring-white/20 transition-all text-sm font-bold"
                          value={s[field.key as keyof AppState] as string} 
                          onChange={(e) => s.updateField(field.key as keyof AppState, e.target.value)}
                        >
                          {RATING_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value} className="bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-50">{opt.label}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </CollapsibleCard>

                <CollapsibleCard title="Policies & Comments" icon={FileText} defaultOpen={false}>
                  <div className="space-y-6">
                    <div className="space-y-3">
                      <label className="block text-xs font-bold text-slate-900 dark:text-slate-50">Adhere to Alcohol & Drugs Policy?</label>
                      <SegmentedControl 
                        value={s.refDrugsPolicy} 
                        onChange={(v: string) => s.updateField('refDrugsPolicy', v)} 
                        options={[{label: 'N/A', value: ''}, {label: 'Yes', value: 'Yes'}, {label: 'No', value: 'No'}]} 
                        ariaLabel="A&D Policy" 
                      />
                    </div>
                    <div className="space-y-3">
                      <label className="block text-xs font-bold text-slate-900 dark:text-slate-50">Recommended for Re-Hire?</label>
                      <SegmentedControl 
                        value={s.refReHire} 
                        onChange={(v: string) => s.updateField('refReHire', v)} 
                        options={[{label: 'N/A', value: ''}, {label: 'Yes', value: 'Yes'}, {label: 'No', value: 'No'}]} 
                        ariaLabel="Re-Hire" 
                      />
                    </div>
                    <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <label className="block text-xs font-bold text-slate-900 dark:text-slate-50">Additional Comments</label>
                      <textarea 
                        className="w-full px-4 py-3 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-slate-900 dark:text-slate-50 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/20 dark:focus:ring-white/20 transition-all text-sm font-medium resize-y min-h-[120px] placeholder:text-slate-500 dark:placeholder:text-slate-400"
                        placeholder="Enter any additional feedback here..."
                        value={s.refComments}
                        onChange={(e) => s.updateField('refComments', e.target.value)}
                      />
                    </div>
                  </div>
                </CollapsibleCard>
              </div>

              <div className="lg:col-span-7 sticky top-4 self-start bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-lg overflow-hidden flex flex-col relative print:bg-white print:border-none print:shadow-none print:static">
                <div className="p-8 md:p-10 flex-grow relative z-0 print:p-0">
                  <div className="flex items-center justify-between gap-4 mb-8 print:hidden">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50">Appraisal Preview</h2>
                    <div className="flex gap-2">
                       <ActionButton onClick={copyReferenceSummary} icon={Copy} label="Copy" />
                       <ActionButton onClick={() => window.print()} icon={Printer} label="Print" />
                       <ActionButton onClick={exportReferenceCSV} icon={Download} label="CSV" />
                    </div>
                  </div>

                  {/* Formal Printable Document Area */}
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-8 rounded-xl print:p-0 print:bg-transparent border border-slate-100 dark:border-slate-700/50 print:border-none">
                     <h1 className="text-2xl font-bold text-center mb-6 uppercase tracking-widest border-b-2 border-slate-200 dark:border-slate-700 pb-4 print:border-slate-300 text-slate-900 dark:text-slate-50 print:text-black">Seafarer Feedback Form</h1>

                     <div className="grid grid-cols-1 sm:grid-cols-[1fr_2fr] gap-y-4 text-sm mb-10 text-slate-900 dark:text-slate-50">
                       <div className="font-bold text-slate-500 dark:text-slate-400 print:text-gray-600">Seafarer Name:</div><div className="font-bold print:text-black">{s.refSeafarerName || '-'}</div>
                       <div className="font-bold text-slate-500 dark:text-slate-400 print:text-gray-600">Discipline:</div><div className="font-bold print:text-black">{s.refDiscipline || '-'}</div>
                       <div className="font-bold text-slate-500 dark:text-slate-400 print:text-gray-600">Company:</div><div className="font-bold print:text-black">{s.refCompany || '-'}</div>
                       <div className="font-bold text-slate-500 dark:text-slate-400 print:text-gray-600">Vessel:</div><div className="font-bold print:text-black">{s.refVessel || '-'}</div>
                       <div className="font-bold text-slate-500 dark:text-slate-400 print:text-gray-600">Assignment Dates:</div><div className="font-bold print:text-black">{s.refDates || '-'}</div>
                     </div>

                     <h3 className="text-lg font-bold border-b border-slate-200 dark:border-slate-700 pb-2 mb-4 print:border-gray-300 text-slate-900 dark:text-slate-50 print:text-black">Performance Assessment</h3>
                     <div className="space-y-2 mb-10">
                        {RATING_FIELDS.map(f => {
                           const fieldValue = s[f.key as keyof AppState] as string;
                           return (
                             <div key={f.key} className="flex justify-between items-center text-sm border-b border-slate-200 dark:border-slate-700/50 pb-2 print:border-gray-200">
                                <span className="font-medium text-slate-600 dark:text-slate-300 print:text-gray-700">{f.label}</span>
                                <span className={cn("font-bold text-right text-slate-900 dark:text-slate-50 print:text-black", !fieldValue && "text-slate-400 dark:text-slate-500 print:text-gray-400")}>
                                  {fieldValue || '-'}
                                </span>
                             </div>
                           );
                        })}
                     </div>

                     <h3 className="text-lg font-bold border-b border-slate-200 dark:border-slate-700 pb-2 mb-4 print:border-gray-300 text-slate-900 dark:text-slate-50 print:text-black">Compliance & Re-Hire</h3>
                     <div className="space-y-2 mb-8">
                         <div className="flex justify-between items-center text-sm border-b border-slate-200 dark:border-slate-700/50 pb-2 print:border-gray-200">
                              <span className="font-medium text-slate-600 dark:text-slate-300 print:text-gray-700">Adhere to Alcohol & Drugs Policy:</span>
                              <span className={cn("font-bold text-slate-900 dark:text-slate-50 print:text-black", !s.refDrugsPolicy && "text-slate-400 dark:text-slate-500 print:text-gray-400")}>{s.refDrugsPolicy || '-'}</span>
                         </div>
                         <div className="flex justify-between items-center text-sm border-b border-slate-200 dark:border-slate-700/50 pb-2 print:border-gray-200">
                              <span className="font-medium text-slate-600 dark:text-slate-300 print:text-gray-700">Recommended for Re-Hire:</span>
                              <span className={cn("font-bold", s.refReHire ? "text-slate-900 dark:text-cyan-400 print:text-black" : "text-slate-400 dark:text-slate-500 print:text-gray-400")}>{s.refReHire || '-'}</span>
                         </div>
                     </div>

                     {s.refComments && (
                       <div className="mt-8">
                         <h3 className="text-lg font-bold border-b border-slate-200 dark:border-slate-700 pb-2 mb-4 print:border-gray-300 text-slate-900 dark:text-slate-50 print:text-black">Additional Comments</h3>
                         <p className="text-sm whitespace-pre-wrap leading-relaxed bg-white dark:bg-[#172033] p-4 rounded-xl print:p-0 print:bg-transparent border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 print:border-none print:text-black">{s.refComments}</p>
                       </div>
                     )}
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Global Assumptions Accordion */}
        <div className="mt-8">
          <AssumptionsAccordion maritime={mode === 'contract'} fiscalRates={activeFiscalRates} />
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface LineItemProps {
  label: string;
  value: number;
  isBold?: boolean;
  currency?: string;
}
const LineItem = React.memo(function LineItem({ label, value, isBold = false, currency = 'GBP' }: LineItemProps) {
  return (
    <div className={cn('flex items-center justify-between py-1 group', isBold ? 'text-slate-900 dark:text-slate-50 font-bold print:text-black' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors print:text-gray-700')}>
      <span className="text-sm font-medium">{label}</span>
      <span className={cn('font-mono tracking-tight tabular-nums transition-all', isBold ? 'text-base font-bold text-slate-900 dark:text-cyan-400' : 'text-sm font-semibold')}>{formatCurrencyIn(value, currency)}</span>
    </div>
  );
});

interface ProjectionCardProps {
  label: string;
  days: number;
  charge: number;
  fee: number;
  currency?: string;
}
const ProjectionCard = React.memo(function ProjectionCard({ label, days, charge, fee, currency = 'GBP' }: ProjectionCardProps) {
  return (
    <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors print:border print:border-gray-200 print:bg-white">
      <div className="text-sm font-bold text-slate-900 dark:text-slate-50 mb-4 flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2 print:text-black">
        {label}
        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded-md print:bg-gray-100 print:text-gray-600">{days} Days</span>
      </div>
      <div className="space-y-2.5">
        <div className="flex justify-between text-sm">
          <span className="text-slate-500 dark:text-slate-400 font-medium print:text-gray-600">Charge</span>
          <span className="font-mono font-bold text-slate-900 dark:text-cyan-400 tabular-nums transition-all">{formatCurrencyIn(charge * days, currency)}</span>
        </div>
        <div className="flex justify-between text-sm pt-2 border-t border-slate-200 dark:border-slate-700 print:border-gray-200">
          <span className="text-slate-500 dark:text-slate-400 font-medium print:text-gray-600">Fee Margin</span>
          <span className="font-mono font-bold text-slate-900 dark:text-slate-50 print:text-black tabular-nums transition-all">{formatCurrencyIn(fee * days, currency)}</span>
        </div>
      </div>
    </div>
  );
});

interface AssumptionsAccordionProps {
  maritime?: boolean;
  fiscalRates: FiscalRates;
}
function AssumptionsAccordion({ maritime = false, fiscalRates }: AssumptionsAccordionProps) {
  return (
    <details className="group [&_summary::-webkit-details-marker]:hidden bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-50 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm transition-all overflow-hidden print:hidden">
      <summary className="flex items-center justify-between cursor-pointer font-bold text-sm p-6 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 dark:focus-visible:ring-white">
        Calculation Assumptions
        <ChevronDown className="h-4 w-4 text-slate-400 group-open:rotate-180 transition-transform duration-300" />
      </summary>
      <div className="px-6 pb-6 pt-0 space-y-4 text-xs text-slate-500 dark:text-slate-400 font-medium border-t border-slate-100 dark:border-slate-800 mt-2">
        {maritime ? (
          <>
            <div className="space-y-1">
              <strong className="text-slate-900 dark:text-slate-50 block">Seafarer NI Exemption</strong>
              <p>Standard NI is calculated at {fiscalRates.employerNI * 100}%. When "Seafarer Exemption" is toggled, Employer NI evaluates to 0, assuming the vessel operates fully outside the UK Continental Shelf (UKCS) or is a non-UK flagged vessel avoiding UK NIC obligations.</p>
            </div>
            <div className="space-y-1">
              <strong className="text-slate-900 dark:text-slate-50 block">Subsistence Rules (Travel vs Victualling)</strong>
              <p>Travel day subsistence is always paid at full rate, so for a 0.5 day, it is still a full subsistence payment (e.g. two 0.5 travel days = 2 full days of subsistence). Onboard subsistence is applied to working days.</p>
            </div>
          </>
        ) : (
          <div className="space-y-1">
            <strong className="text-slate-900 dark:text-slate-50 block">Employer NI Calculation</strong>
            <p>Perm NI informational calculation assumes {fiscalRates.permNI * 100}% over the £{fiscalRates.permNIThreshold} secondary threshold.</p>
          </div>
        )}
        <div className="space-y-1">
          <strong className="text-slate-900 dark:text-slate-50 block">Payment Days & Payroll</strong>
          <p>Monthly payday lands on the 28th, moving backward to the previous working day if falling on a weekend/bank holiday. Subsistence days per period automatically match the payable days, but can be manually overridden in the summary breakdown (e.g., deducting 1 day for unpaid travel).</p>
        </div>
      </div>
    </details>
  );
}