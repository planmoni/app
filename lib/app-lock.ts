import { createUserScopedStorage } from './user-scoped-storage';
import { getItem, deleteItem } from './secure-storage';

// Legacy global key for migration
const LEGACY_APP_LOCK_KEY = 'app_lock_enabled';

/**
 * App Lock utility with user-scoped storage
 */
export class AppLockManager {
  private userStorage: ReturnType<typeof createUserScopedStorage>;

  constructor(userId: string) {
    this.userStorage = createUserScopedStorage(userId);
  }

  /**
   * Set app lock enabled state for the current user
   */
  async setAppLockEnabled(enabled: boolean): Promise<void> {
    await this.userStorage.setItem('app_lock_enabled', enabled.toString());
    // Track when app lock was explicitly set (not migrated)
    if (enabled) {
      await this.userStorage.setItem('app_lock_explicitly_set', 'true');
    }
  }

  /**
   * Check if app lock is enabled for the current user
   */
  async isAppLockEnabled(): Promise<boolean> {
    const value = await this.userStorage.getItem('app_lock_enabled');
    return value === 'true';
  }

  /**
   * Check if app lock was explicitly set by the user (not migrated)
   */
  async isAppLockExplicitlySet(): Promise<boolean> {
    const value = await this.userStorage.getItem('app_lock_explicitly_set');
    return value === 'true';
  }

  /**
   * Clear app lock settings for the current user
   */
  async clearAppLockForUser(): Promise<void> {
    await this.userStorage.deleteItem('app_lock_enabled');
    await this.userStorage.deleteItem('app_lock_pin');
    await this.userStorage.deleteItem('app_lock_explicitly_set');
  }

  /**
   * Migrate legacy global app lock setting to user-scoped storage
   * This should be called once after successful sign-in
   */
  async migrateLegacyAppLock(): Promise<void> {
    try {
      // Check if migration has already been done for this user
      const migrationKey = 'app_lock_migrated';
      const alreadyMigrated = await this.userStorage.getItem(migrationKey);
      
      if (alreadyMigrated === 'true') {
        console.log('App lock migration already completed for user');
        return;
      }

      // Check for legacy global setting
      const legacyValue = await getItem(LEGACY_APP_LOCK_KEY);
      
      if (legacyValue === 'true') {
        console.log('Migrating legacy app lock setting to user-scoped storage');
        await this.setAppLockEnabled(true);
        
        // Clear the legacy global setting
        await deleteItem(LEGACY_APP_LOCK_KEY);
        console.log('Legacy app lock setting cleared');
      }

      // Mark migration as completed
      await this.userStorage.setItem(migrationKey, 'true');
      console.log('App lock migration completed successfully');
      
    } catch (error) {
      console.error('Failed to migrate legacy app lock setting:', error);
      // Don't throw - migration failure shouldn't break the sign-in flow
    }
  }
}

/**
 * Create an app lock manager for a specific user
 */
export function createAppLockManager(userId: string): AppLockManager {
  return new AppLockManager(userId);
}

/**
 * Utility functions for backward compatibility
 */
export async function setAppLockEnabled(userId: string, enabled: boolean): Promise<void> {
  const manager = createAppLockManager(userId);
  await manager.setAppLockEnabled(enabled);
}

export async function isAppLockEnabled(userId: string): Promise<boolean> {
  const manager = createAppLockManager(userId);
  return await manager.isAppLockEnabled();
}

export async function clearAppLockForUser(userId: string): Promise<void> {
  const manager = createAppLockManager(userId);
  await manager.clearAppLockForUser();
}

export async function migrateLegacyAppLock(userId: string): Promise<void> {
  const manager = createAppLockManager(userId);
  await manager.migrateLegacyAppLock();
} 