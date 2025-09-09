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

  constructor(userId: string) {
    this.userStorage = createUserScopedStorage(userId);
  }

  /**
   * Save the last active route for the current user
   */
  async saveLastRoute(route: string): Promise<void> {
    try {
      await this.userStorage.setItem(LAST_ROUTE_KEY, route);
      
      // Also save to route history for analytics
      const historyEntry: RouteHistoryEntry = {
        route,
        timestamp: Date.now(),
        userId: this.userStorage.userId
      };
      
      const history = await this.getRouteHistory();
      history.push(historyEntry);
      
      // Keep only last 50 routes
      if (history.length > 50) {
        history.splice(0, history.length - 50);
      }
      
      await this.userStorage.setItem(ROUTE_HISTORY_KEY, JSON.stringify(history));
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
      const historyStr = await this.userStorage.getItem(ROUTE_HISTORY_KEY);
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
      await this.userStorage.removeItem(LAST_ROUTE_KEY);
      await this.userStorage.removeItem(ROUTE_HISTORY_KEY);
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