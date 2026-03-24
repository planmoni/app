import Mixpanel from 'mixpanel-react-native';

// Mixpanel token
const MIXPANEL_TOKEN = '00e2d04c0db9b6bfb8436d4963651e23';

// Initialize Mixpanel instance
let mixpanelInstance: Mixpanel | null = null;

/**
 * Initialize Mixpanel with the provided token
 * Should be called once when the app starts
 */
export const initializeMixpanel = async (): Promise<Mixpanel | null> => {
  try {
    if (mixpanelInstance) {
      return mixpanelInstance;
    }

    // Initialize Mixpanel using static init method
    // Parameters: token, trackAutomaticEvents, optOutTrackingDefault
    mixpanelInstance = await Mixpanel.init(
      MIXPANEL_TOKEN,
      true, // trackAutomaticEvents - enable automatic event tracking
      false // optOutTrackingDefault - don't opt out by default (record 100% of sessions)
    );

    console.log('Mixpanel initialized successfully');
    return mixpanelInstance;
  } catch (error) {
    console.error('Error initializing Mixpanel:', error);
    return null;
  }
};

/**
 * Get the Mixpanel instance
 * Returns null if not initialized
 */
export const getMixpanel = (): Mixpanel | null => {
  return mixpanelInstance;
};

/**
 * Track an event
 * @param eventName - Name of the event to track
 * @param properties - Optional properties to attach to the event
 */
export const trackEvent = (eventName: string, properties?: Record<string, any>): void => {
  try {
    if (mixpanelInstance) {
      mixpanelInstance.track(eventName, properties);
      console.log(`Mixpanel event tracked: ${eventName}`, properties);
    } else {
      console.warn('Mixpanel not initialized. Call initializeMixpanel() first.');
    }
  } catch (error) {
    console.error(`Error tracking event ${eventName}:`, error);
  }
};

/**
 * Identify a user
 * @param userId - Unique identifier for the user
 * @param properties - Optional user properties
 */
export const identifyUser = async (userId: string, properties?: Record<string, any>): Promise<void> => {
  try {
    if (mixpanelInstance) {
      await mixpanelInstance.identify(userId);
      if (properties) {
        mixpanelInstance.getPeople().set(properties);
      }
      console.log(`Mixpanel user identified: ${userId}`, properties);
    } else {
      console.warn('Mixpanel not initialized. Call initializeMixpanel() first.');
    }
  } catch (error) {
    console.error(`Error identifying user ${userId}:`, error);
  }
};

/**
 * Set user properties
 * @param properties - Properties to set for the current user
 */
export const setUserProperties = (properties: Record<string, any>): void => {
  try {
    if (mixpanelInstance) {
      mixpanelInstance.getPeople().set(properties);
      console.log('Mixpanel user properties set:', properties);
    } else {
      console.warn('Mixpanel not initialized. Call initializeMixpanel() first.');
    }
  } catch (error) {
    console.error('Error setting user properties:', error);
  }
};

/**
 * Increment a user property
 * @param property - Property name to increment
 * @param value - Value to increment by (default: 1)
 */
export const incrementUserProperty = (property: string, value: number = 1): void => {
  try {
    if (mixpanelInstance) {
      mixpanelInstance.getPeople().increment(property, value);
      console.log(`Mixpanel user property incremented: ${property} by ${value}`);
    } else {
      console.warn('Mixpanel not initialized. Call initializeMixpanel() first.');
    }
  } catch (error) {
    console.error(`Error incrementing user property ${property}:`, error);
  }
};

/**
 * Reset Mixpanel (useful for logout)
 */
export const resetMixpanel = (): void => {
  try {
    if (mixpanelInstance) {
      mixpanelInstance.reset();
      console.log('Mixpanel reset');
    } else {
      console.warn('Mixpanel not initialized. Call initializeMixpanel() first.');
    }
  } catch (error) {
    console.error('Error resetting Mixpanel:', error);
  }
};

/**
 * Set super properties (properties sent with every event)
 * @param properties - Properties to set as super properties
 */
export const setSuperProperties = (properties: Record<string, any>): void => {
  try {
    if (mixpanelInstance) {
      mixpanelInstance.registerSuperProperties(properties);
      console.log('Mixpanel super properties set:', properties);
    } else {
      console.warn('Mixpanel not initialized. Call initializeMixpanel() first.');
    }
  } catch (error) {
    console.error('Error setting super properties:', error);
  }
};

// Export the Mixpanel instance for advanced usage
export { mixpanelInstance };
