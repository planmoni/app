import AsyncStorage from '@react-native-async-storage/async-storage';
import { createUserScopedStorage } from './user-scoped-storage';

const LAST_ROUTE_KEY = 'last_active_route';

export interface RouteHistoryEntry {
  route: string;
  timestamp: number;
  userId: string;
}

function lastRouteStorageKey(userId: string): string {
  const sanitizedUserId = userId.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `planmoni_${sanitizedUserId}_${LAST_ROUTE_KEY}`;
}

export class RoutePersistence {
  private userStorage: ReturnType<typeof createUserScopedStorage>;
  private userId: string;

  constructor(userId: string) {
    this.userStorage = createUserScopedStorage(userId);
    this.userId = userId;
  }

  /**
   * Save the last active route for the current user.
   * Routes are not secrets — AsyncStorage only (avoids SecureStore entitlement spam).
   */
  async saveLastRoute(route: string): Promise<void> {
    try {
      await AsyncStorage.setItem(lastRouteStorageKey(this.userId), route);

      const historyEntry: RouteHistoryEntry = {
        route,
        timestamp: Date.now(),
        userId: this.userId,
      };

      const history = await this.getRouteHistory();
      history.push(historyEntry);

      if (history.length > 50) {
        history.splice(0, history.length - 50);
      }

      const historyKey = `route_history_${this.userId}`;
      await AsyncStorage.setItem(historyKey, JSON.stringify(history));
    } catch (error) {
      console.warn('[RoutePersistence] Failed to save last route:', error);
    }
  }

  /**
   * Get the last active route for the current user
   */
  async getLastRoute(): Promise<string | null> {
    try {
      const fromAsync = await AsyncStorage.getItem(lastRouteStorageKey(this.userId));
      if (fromAsync) return fromAsync;
      // Legacy: previously stored via user-scoped SecureStore
      return await this.userStorage.getItem(LAST_ROUTE_KEY);
    } catch (error) {
      console.warn('[RoutePersistence] Failed to get last route:', error);
      return null;
    }
  }

  /**
   * Get route history for analytics
   */
  async getRouteHistory(): Promise<RouteHistoryEntry[]> {
    try {
      const historyKey = `route_history_${this.userId}`;
      const historyStr = await AsyncStorage.getItem(historyKey);
      return historyStr ? JSON.parse(historyStr) : [];
    } catch (error) {
      console.warn('[RoutePersistence] Failed to get route history:', error);
      return [];
    }
  }

  /**
   * Clear route data for the current user
   */
  async clearRouteData(): Promise<void> {
    try {
      await AsyncStorage.removeItem(lastRouteStorageKey(this.userId));
      try {
        await this.userStorage.deleteItem(LAST_ROUTE_KEY);
      } catch (_) {}

      const historyKey = `route_history_${this.userId}`;
      await AsyncStorage.removeItem(historyKey);
    } catch (error) {
      console.warn('[RoutePersistence] Failed to clear route data:', error);
    }
  }
}

/**
 * Create route persistence instance for a user
 */
export function createRoutePersistence(userId: string): RoutePersistence {
  return new RoutePersistence(userId);
}
