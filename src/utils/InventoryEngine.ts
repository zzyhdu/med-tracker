export const FREQUENCY_MULTIPLIERS: Record<string, number> = {
  'qd': 1,
  'bid': 2,
  'tid': 3,
  'qid': 4,
  'qod': 0.5,
  'qw': 1 / 7,
  'biw': 2 / 7,
  'tiw': 3 / 7,
  'prn': 0,
};

export const FREQUENCY_LABELS: Record<string, string> = {
  'qd': 'qd (每日1次)',
  'bid': 'bid (每日2次)',
  'tid': 'tid (每日3次)',
  'qid': 'qid (每日4次)',
  'qod': 'qod (隔日1次)',
  'qw': 'qw (每周1次)',
  'biw': 'biw (每周2次)',
  'tiw': 'tiw (每周3次)',
  'prn': 'prn (按需服用)',
};

export interface DrugProfile {
  id: string;
  name: string;
  frequency?: string; // e.g., 'bid'
  dosePerTime?: number; // e.g., 2 pills each time
  dailyDosage: number; // Stays active for exactly calculating deductions
  packagingSize?: number;
  packagingUnit?: string;
  pillUnit?: string;
  alertThresholdDays: number;
}

export interface DrugTracker {
  drugId: string;
  baseInventory: number;
  baseDate: string;
}

export interface CalculatedInventory extends DrugProfile, DrugTracker {
  currentInventory: number;
  daysRemaining: number;
  isLowStock: boolean;
}

export class InventoryEngine {
  static calculate(profile: DrugProfile, tracker: DrugTracker, currentDate: Date = new Date()): CalculatedInventory {
    const base = new Date(tracker.baseDate);
    const baseMidnight = new Date(base.getFullYear(), base.getMonth(), base.getDate());
    const currentMidnight = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
    
    const diffTime = currentMidnight.getTime() - baseMidnight.getTime();
    const diffDays = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
    
    const deduction = diffDays * profile.dailyDosage;
    const currentInventory = Math.max(0, tracker.baseInventory - deduction);
    
    const daysRemaining = profile.dailyDosage > 0 
      ? Number((currentInventory / profile.dailyDosage).toFixed(1))
      : Number.POSITIVE_INFINITY;
      
    const isLowStock = daysRemaining <= profile.alertThresholdDays || currentInventory === 0;

    return {
      ...profile,
      ...tracker,
      id: tracker.drugId,
      currentInventory,
      daysRemaining,
      isLowStock
    };
  }

  static recalibrate(tracker: DrugTracker, newCurrentInventory: number, currentDate: Date = new Date()): DrugTracker {
    return {
      ...tracker,
      baseInventory: Math.max(0, newCurrentInventory),
      baseDate: currentDate.toISOString()
    };
  }
}
