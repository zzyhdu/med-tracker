import type { DrugProfile, DrugTracker } from './InventoryEngine';
import { ApiClient } from './apiClient';

export class CloudStorageUtils {
  static async loadProfiles(): Promise<DrugProfile[]> {
    try {
      return await ApiClient.listProfiles();
    } catch (error) {
      console.error('Error loading profiles:', error);
      return [];
    }
  }

  static async saveProfile(profile: DrugProfile): Promise<boolean> {
    try {
      await ApiClient.saveProfile(profile);
    } catch (error) {
      console.error('Error saving profile:', error);
      return false;
    }
    return true;
  }

  static async deleteProfile(profileId: string): Promise<boolean> {
    try {
      return await ApiClient.deleteProfile(profileId);
    } catch (error) {
      console.error('Error deleting profile:', error);
      return false;
    }
  }

  static async loadTrackers(): Promise<DrugTracker[]> {
    try {
      return await ApiClient.listTrackers();
    } catch (error) {
      console.error('Error loading trackers:', error);
      return [];
    }
  }

  static async saveTracker(tracker: DrugTracker): Promise<boolean> {
    try {
      await ApiClient.saveTracker(tracker);
    } catch (error) {
      console.error('Error saving tracker:', error);
      return false;
    }
    return true;
  }
  
  static async deleteTracker(drugId: string): Promise<boolean> {
    try {
      return await ApiClient.deleteTracker(drugId);
    } catch (error) {
      console.error('Error deleting tracker:', error);
      return false;
    }
  }
}
