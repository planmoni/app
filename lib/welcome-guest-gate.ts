/**
 * Survives Home remounts during logout → logging-out → `/`.
 * Ensures the guest Welcome slides open at most once per signed-out stretch.
 */
let guestWelcomeShown = false;

export function wasGuestWelcomeShown(): boolean {
  return guestWelcomeShown;
}

export function markGuestWelcomeShown(): void {
  guestWelcomeShown = true;
}

export function resetGuestWelcomeGate(): void {
  guestWelcomeShown = false;
}
