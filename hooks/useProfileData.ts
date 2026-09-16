// =============================================================================
// UNUSED — intentionally commented out (kept for reference, not deleted).
// To restore: uncomment the block below.
// =============================================================================
export {}; // keep module valid while unused code is commented out

// import { useAuth } from '@/contexts/AuthContext';
// import { useProfile } from '@/contexts/ProfileContext';
// import { ProfileSnapshot, UserMetadataSnapshot } from '@/lib/profileSnapshot';
// 
// export interface ProfileData {
//   firstName: string;
//   lastName: string;
//   fullName: string;
//   email: string;
//   initials: string;
//   isLoaded: boolean;
// }
// 
// /**
//  * Hook to get user profile data with instant fallback to snapshots
//  * Provides a consistent interface for accessing user data across the app
//  */
// export function useProfileData(): ProfileData {
//   const { session } = useAuth();
//   const { profile, metadata, isLoading } = useProfile();
// 
//   // Get data from profile context first, then fall back to session metadata
//   const getFirstName = (): string => {
//     if (profile?.first_name) return profile.first_name;
//     if (metadata?.first_name) return metadata.first_name;
//     if (session?.user?.user_metadata?.first_name) return session.user.user_metadata.first_name;
//     return '';
//   };
// 
//   const getLastName = (): string => {
//     if (profile?.last_name) return profile.last_name;
//     if (metadata?.last_name) return metadata.last_name;
//     if (session?.user?.user_metadata?.last_name) return session.user.user_metadata.last_name;
//     return '';
//   };
// 
//   const getEmail = (): string => {
//     if (profile?.email) return profile.email;
//     if (session?.user?.email) return session.user.email;
//     return '';
//   };
// 
//   const firstName = getFirstName();
//   const lastName = getLastName();
//   const email = getEmail();
//   const fullName = `${firstName} ${lastName}`.trim() || 'User';
//   const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || 'U';
//   const isLoaded = !isLoading && (!!profile || !!session?.user);
// 
//   return {
//     firstName,
//     lastName,
//     fullName,
//     email,
//     initials,
//     isLoaded,
//   };
// } 
