import { createContext, ReactNode, useContext, useState } from "react";


interface BottomNavContextType {
    isBottomNavVisible: boolean;
    hideBottomNav: () => void;
    showBottomNav: () => void;
    setBottomNavVisible: (visible: boolean) => void;
  }
  
  const BottomNavContext = createContext<BottomNavContextType | undefined>(undefined);
  
  export const useBottomNav = () => {
    const context = useContext(BottomNavContext);
    if (context === undefined) {
      throw new Error('useBottomNav must be used within a BottomNavProvider');
    }
    return context;
  };
  
  export const BottomNavProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [isBottomNavVisible, setIsBottomNavVisible] = useState(true);
  
    const hideBottomNav = () => {
      setIsBottomNavVisible(false);
    };
  
    const showBottomNav = () => {
      setIsBottomNavVisible(true);
    };
  
    const setBottomNavVisible = (visible: boolean) => {
      setIsBottomNavVisible(visible);
    };
  
    const value: BottomNavContextType = {
      isBottomNavVisible,
      hideBottomNav,
      showBottomNav,
      setBottomNavVisible,
    };
  
    return (
      <BottomNavContext.Provider value={value}>
        {children}
      </BottomNavContext.Provider>
    );
  };