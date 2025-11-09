// Thin re-export shim: the canonical Toast provider and hook live in contexts/ToastContext.tsx
export { ToastProvider, useToast } from '@/contexts/ToastContext';

// Keep default export compatibility if any code imports the file directly
export default undefined as unknown as { ToastProvider: any; useToast: any };