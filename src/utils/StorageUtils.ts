import { supabase } from './supabaseClient';
import type { DrugProfile, DrugTracker } from './InventoryEngine';

export class CloudStorageUtils {
  static async loadProfiles(userId: string): Promise<DrugProfile[]> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId);
      
    if (error) {
      console.error('Error loading profiles:', error);
      return [];
    }
    
    return data.map(row => ({
      id: row.id,
      name: row.name,
      frequency: row.frequency,
      dosePerTime: Number(row.dose_per_time) || undefined,
      dailyDosage: Number(row.daily_dosage),
      packagingSize: Number(row.packaging_size) || undefined,
      packagingUnit: row.packaging_unit || undefined,
      pillUnit: row.pill_unit || undefined,
      alertThresholdDays: Number(row.alert_threshold_days)
    }));
  }

  static async saveProfile(profile: DrugProfile, userId: string): Promise<boolean> {
    const { error } = await supabase
      .from('profiles')
      .upsert({
        id: profile.id,
        user_id: userId,
        name: profile.name,
        frequency: profile.frequency,
        dose_per_time: profile.dosePerTime,
        daily_dosage: profile.dailyDosage,
        packaging_size: profile.packagingSize,
        packaging_unit: profile.packagingUnit,
        pill_unit: profile.pillUnit,
        alert_threshold_days: profile.alertThresholdDays
      }, { onConflict: 'id' });
    
    if (error) {
      console.error('Error saving profile:', error);
      return false;
    }
    return true;
  }

  static async deleteProfile(profileId: string): Promise<boolean> {
    const { error } = await supabase.from('profiles').delete().eq('id', profileId);
    return !error;
  }

  static async loadTrackers(userId: string): Promise<DrugTracker[]> {
    const { data, error } = await supabase
      .from('trackers')
      .select('*')
      .eq('user_id', userId);
      
    if (error) {
      console.error('Error loading trackers:', error);
      return [];
    }
    
    return data.map(row => ({
      drugId: row.drug_id,
      baseInventory: Number(row.base_inventory),
      baseDate: row.base_date
    }));
  }

  static async saveTracker(tracker: DrugTracker, userId: string): Promise<boolean> {
    const { error } = await supabase
      .from('trackers')
      .upsert({
        drug_id: tracker.drugId,
        user_id: userId,
        base_inventory: tracker.baseInventory,
        base_date: tracker.baseDate
      }, { onConflict: 'drug_id' });
      
    if (error) {
      console.error('Error saving tracker:', error);
      return false;
    }
    return true;
  }
  
  static async deleteTracker(drugId: string): Promise<boolean> {
    const { error } = await supabase.from('trackers').delete().eq('drug_id', drugId);
    return !error;
  }
}
