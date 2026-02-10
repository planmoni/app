import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import FeedbackModal, { FeedbackSource } from '@/components/FeedbackModal';

interface FeedbackContextValue {
  showFeedback: (source: FeedbackSource) => void;
  hideFeedback: () => void;
}

const FeedbackContext = createContext<FeedbackContextValue | null>(null);

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [source, setSource] = useState<FeedbackSource | undefined>(undefined);

  const showFeedback = useCallback((s: FeedbackSource) => {
    setSource(s);
    setVisible(true);
  }, []);

  const hideFeedback = useCallback(() => {
    setVisible(false);
    setSource(undefined);
  }, []);

  return (
    <FeedbackContext.Provider value={{ showFeedback, hideFeedback }}>
      {children}
      <FeedbackModal visible={visible} onClose={hideFeedback} source={source} />
    </FeedbackContext.Provider>
  );
}

export function useFeedback(): FeedbackContextValue {
  const ctx = useContext(FeedbackContext);
  if (!ctx) {
    throw new Error('useFeedback must be used within a FeedbackProvider');
  }
  return ctx;
}
