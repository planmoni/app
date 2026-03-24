import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import FeedbackModal, { FeedbackSource } from '@/components/FeedbackModal';

const FEEDBACK_MODAL_USER_RATED_KEY = 'feedback_modal_user_rated';

interface FeedbackContextValue {
  showFeedback: (source: FeedbackSource) => void;
  hideFeedback: () => void;
}

const FeedbackContext = createContext<FeedbackContextValue | null>(null);

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [source, setSource] = useState<FeedbackSource | undefined>(undefined);

  const showFeedback = useCallback((s: FeedbackSource) => {
    AsyncStorage.getItem(FEEDBACK_MODAL_USER_RATED_KEY).then((value) => {
      if (value === 'true') return;
      setSource(s);
      setVisible(true);
    });
  }, []);

  const hideFeedback = useCallback(() => {
    setVisible(false);
    setSource(undefined);
  }, []);

  const handleRated = useCallback(() => {
    AsyncStorage.setItem(FEEDBACK_MODAL_USER_RATED_KEY, 'true').catch(() => {});
    hideFeedback();
  }, [hideFeedback]);

  return (
    <FeedbackContext.Provider value={{ showFeedback, hideFeedback }}>
      {children}
      <FeedbackModal visible={visible} onClose={hideFeedback} onRate={handleRated} source={source} />
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
