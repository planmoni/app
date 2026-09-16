// =============================================================================
// UNUSED — intentionally commented out (kept for reference, not deleted).
// To restore: uncomment the block below.
// =============================================================================
export {}; // keep module valid while unused code is commented out

// /**
//  * Background session warm — disabled until a native rebuild includes ExpoTaskManager.
//  *
//  * Do not add expo-background-task / expo-task-manager to package.json until an EAS
//  * native build with a bumped runtimeVersion ships those modules. Re-implement
//  * register/unregister against those packages after that build is live.
//  */
// import { Platform } from 'react-native';
// 
// /** Flip only after a native rebuild that links expo-task-manager / expo-background-task. */
// const ENABLE_SESSION_WARM_BACKGROUND_TASK = false;
// 
// export const SESSION_WARM_TASK = 'planmoni-session-warm';
// 
// export async function registerSessionWarmBackgroundTask(): Promise<boolean> {
//   if (!ENABLE_SESSION_WARM_BACKGROUND_TASK) return false;
//   if (Platform.OS === 'web') return false;
//   if (__DEV__) {
//     console.warn(
//       '[background-task] native modules not packaged — ship an EAS build with expo-task-manager first'
//     );
//   }
//   return false;
// }
// 
// export async function unregisterSessionWarmBackgroundTask(): Promise<void> {
//   // no-op until native modules are linked in a store binary
// }
// 
