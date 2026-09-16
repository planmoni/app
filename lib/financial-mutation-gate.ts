/**
 * While a money mutation (create payout, etc.) is in flight, pause background
 * wallet/account polling so they don't starve the mutation on weak networks.
 */

type Listener = () => void;

let depth = 0;
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((l) => {
    try {
      l();
    } catch {
      // ignore
    }
  });
}

export function beginFinancialMutation(): void {
  depth += 1;
  notify();
}

export function endFinancialMutation(): void {
  depth = Math.max(0, depth - 1);
  notify();
}

export function isFinancialMutationActive(): boolean {
  return depth > 0;
}

export function subscribeFinancialMutation(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
