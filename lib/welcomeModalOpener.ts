/**
 * Lets any tab screen open the Welcome modal while the Home tab is mounted
 * (registered from `app/(tabs)/index.tsx`).
 */
type Opener = () => void;

let opener: Opener | null = null;

export function setWelcomeModalOpener(fn: Opener | null) {
  opener = fn;
}

export function requestWelcomeModal() {
  opener?.();
}
