import type { DrugProfile, DrugTracker } from './InventoryEngine';

export class StorageUtils {
  static loadProfiles(): DrugProfile[] {
    try {
      const data = localStorage.getItem('med-profiles');
      if (data) return JSON.parse(data);
    } catch (e) {
      console.error('Failed to load med profiles', e);
    }
    return [];
  }

  static saveProfiles(profiles: DrugProfile[]): void {
    try {
      localStorage.setItem('med-profiles', JSON.stringify(profiles));
    } catch (e) {
      console.error('Failed to save med profiles', e);
    }
  }

  static loadTrackers(): DrugTracker[] {
    try {
      const data = localStorage.getItem('med-trackers');
      if (data) return JSON.parse(data);
    } catch (e) {
      console.error('Failed to load med trackers', e);
    }
    return [];
  }

  static saveTrackers(trackers: DrugTracker[]): void {
    try {
      localStorage.setItem('med-trackers', JSON.stringify(trackers));
    } catch (e) {
      console.error('Failed to save med trackers', e);
    }
  }
}
