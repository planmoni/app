/**
 * Widget SDK Core
 * 
 * Core widget initialization and communication with parent frame.
 */

import type { WidgetConfig, WidgetEvent } from './types';

export class WidgetSDK {
  private config: WidgetConfig;
  private parentWindow: Window | null = null;
  private initialized: boolean = false;

  constructor(config: WidgetConfig) {
    this.config = config;
    this.parentWindow = window.parent !== window ? window.parent : null;
  }

  /**
   * Initialize the widget
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Verify API key if provided
    if (this.config.api_key) {
      const isValid = await this.verifyApiKey(this.config.api_key);
      if (!isValid) {
        throw new Error('Invalid API key');
      }
    }

    // Send ready event to parent
    this.postMessage({
      type: 'widget_ready',
      data: {
        widget_type: 'planmoni-widget',
        timestamp: new Date().toISOString(),
      },
    });

    this.initialized = true;
  }

  /**
   * Verify API key with Planmoni API
   */
  private async verifyApiKey(apiKey: string): Promise<boolean> {
    try {
      const response = await fetch('/api/v1/auth/verify', {
        method: 'POST',
        headers: {
          'X-API-Key': apiKey,
          'Content-Type': 'application/json',
        },
      });

      return response.ok;
    } catch (error) {
      console.error('API key verification error:', error);
      return false;
    }
  }

  /**
   * Post message to parent window
   */
  postMessage(event: WidgetEvent): void {
    if (this.parentWindow) {
      this.parentWindow.postMessage(
        {
          source: 'planmoni-widget',
          ...event,
        },
        '*' // In production, specify target origin
      );
    }

    // Also call onEvent callback if provided
    if (this.config.onEvent) {
      this.config.onEvent(event);
    }
  }

  /**
   * Listen for messages from parent
   */
  onMessage(handler: (event: MessageEvent) => void): void {
    window.addEventListener('message', (event) => {
      if (event.data && event.data.source === 'planmoni-parent') {
        handler(event);
      }
    });
  }

  /**
   * Make API request
   */
  async apiRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
    const apiKey = this.config.api_key;
    if (!apiKey) {
      throw new Error('API key required for API requests');
    }

    const response = await fetch(`/api/v1${endpoint}`, {
      ...options,
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'API request failed');
    }

    return response.json();
  }
}
