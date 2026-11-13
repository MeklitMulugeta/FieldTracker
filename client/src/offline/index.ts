/**
 * Offline Storage Module Boundary
 *
 * Dexie.js / IndexedDB local persistence and deterministic background
 * synchronization queues will be implemented here in a later milestone.
 */
export interface OfflineStorageStatus {
  initialized: boolean;
  driver: 'indexeddb-planned';
  pendingQueueCount: number;
}

export const OFFLINE_FOUNDATION_NOTE =
  'Offline storage and synchronization queue are scheduled for a subsequent milestone.';
