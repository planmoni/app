import AsyncStorage from '@react-native-async-storage/async-storage';
import { createUserScopedStorage } from './user-scoped-storage';

const LAST_ROUTE_KEY = 'last_active_route';
const ROUTE_HISTORY_KEY = 'route_history';

export interface RouteHistoryEntry {
  route: string;
  timestamp: number;
  userId: string;
}

export class RoutePersistence {
  private userStorage: ReturnType<typeof createUserScopedStorage>;
  private userId: string;

  constructor(userId: string) {
    this.userStorage = createUserScopedStorage(userId);
    this.userId = userId;
  }

  /**
   * Save the last active route for the current user
   */
  async saveLastRoute(route: string): Promise<void> {
    try {
      // Save last route in secure storage (small data)
      await this.userStorage.setItem(LAST_ROUTE_KEY, route);
      
      // Save route history in AsyncStorage (large data, not sensitive)
      const historyEntry: RouteHistoryEntry = {
        route,
        timestamp: Date.now(),
        userId: this.userId
      };
      
      const history = await this.getRouteHistory();
      history.push(historyEntry);
      
      // Keep only last 50 routes
      if (history.length > 50) {
        history.splice(0, history.length - 50);
      }
      
      // Use AsyncStorage for route history since it's large and not sensitive
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
      // Use AsyncStorage for route history since it's large and not sensitive
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
      // Clear last route from secure storage
      await this.userStorage.deleteItem(LAST_ROUTE_KEY);
      
      // Clear route history from AsyncStorage
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