/**
 * Background session warm — disabled until a native rebuild includes ExpoTaskManager.
 *
 * Resume harden does not depend on this. After `npx expo prebuild` + rebuilding the
 * dev client, set ENABLE_SESSION_WARM_BACKGROUND_TASK = true and wire register/unregister
 * from app/_layout.tsx again.
 */
import { Platform } from 'react-native';

/** Flip only after a native rebuild that links expo-task-manager / expo-background-task. */
const ENABLE_SESSION_WARM_BACKGROUND_TASK = false;

export const SESSION_WARM_TASK = 'planmoni-session-warm';
const MINIMUM_INTERVAL_MINUTES = 60;

type BackgroundTaskModule = typeof import('expo-background-task');
type TaskManagerModule = typeof import('expo-task-manager');

let nativeReady: boolean | null = null;
let BackgroundTask: BackgroundTaskModule | null = null;
let TaskManager: TaskManagerModule | null = null;
let taskDefined = false;

function loadNativeModules(): boolean {
  if (!ENABLE_SESSION_WARM_BACKGROUND_TASK) return false;
  if (nativeReady !== null) return nativeReady;
  if (Platform.OS === 'web') {
    nativeReady = false;
    return false;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    BackgroundTask = require('expo-background-task') as BackgroundTaskModule;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    TaskManager = require('expo-task-manager') as TaskManagerModule;
    nativeReady = true;
  } catch (error) {
    nativeReady = false;
    if (__DEV__) {
      console.warn(
        '[background-task] native module unavailable — rebuild dev client after prebuild',
        error instanceof Error ? error.message : error
      );
    }
  }
  return nativeReady;
}

function ensureTaskDefined(): boolean {
  if (!loadNativeModules() || !TaskManager || !BackgroundTask) return false;
  if (taskDefined) return true;

  TaskManager.defineTask(SESSION_WARM_TASK, async () => {
    try {
      const { refreshSessionIfNeededForBackground } = await import(
        '@/lib/supabase-reconnect'
      );
      const result = await refreshSessionIfNeededForBackground();
      if (__DEV__) {
        console.log('[background-task] session warm:', result);
      }
      return BackgroundTask!.BackgroundTaskResult.Success;
    } catch (error) {
      if (__DEV__) {
        console.warn('[background-task] session warm failed:', error);
      }
      return BackgroundTask!.BackgroundTaskResult.Failed;
    }
  });

  taskDefined = true;
  return true;
}

export async function registerSessionWarmBackgroundTask(): Promise<boolean> {
  if (!ENABLE_SESSION_WARM_BACKGROUND_TASK) return false;
  if (!ensureTaskDefined() || !BackgroundTask || !TaskManager) return false;

  try {
    const status = await BackgroundTask.getStatusAsync();
    if (status === BackgroundTask.BackgroundTaskStatus.Restricted) {
      return false;
    }

    const already = await TaskManager.isTaskRegisteredAsync(SESSION_WARM_TASK);
    if (already) return true;

    await BackgroundTask.registerTaskAsync(SESSION_WARM_TASK, {
      minimumInterval: MINIMUM_INTERVAL_MINUTES,
    });
    return true;
  } catch (error) {
    if (__DEV__) {
      console.warn('[background-task] register failed:', error);
    }
    return false;
  }
}

export async function unregisterSessionWarmBackgroundTask(): Promise<void> {
  if (!ENABLE_SESSION_WARM_BACKGROUND_TASK) return;
  if (!loadNativeModules() || !BackgroundTask || !TaskManager) return;

  try {
    const already = await TaskManager.isTaskRegisteredAsync(SESSION_WARM_TASK);
    if (!already) return;
    await BackgroundTask.unregisterTaskAsync(SESSION_WARM_TASK);
  } catch (error) {
    if (__DEV__) {
      console.warn('[background-task] unregister failed:', error);
    }
  }
}
