import { useState, useEffect } from 'react';

type TimeRemaining = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalSeconds: number;
};

export function useCountdown(targetDate: Date | string | null): TimeRemaining {
  const calculateTimeRemaining = (): TimeRemaining => {
    if (!targetDate) {
      return {
        days: 0,
        hours: 0,
        minutes: 0,
        seconds: 0,
        totalSeconds: 0
      };
    }

    const target = typeof targetDate === 'string' ? new Date(targetDate) : targetDate;
    const now = new Date();
    
    // Calculate the difference in seconds
    const difference = Math.max(0, Math.floor((target.getTime() - now.getTime()) / 1000));
    
    // Calculate days, hours, minutes and seconds
    const days = Math.floor(difference / (60 * 60 * 24));
    const hours = Math.floor((difference % (60 * 60 * 24)) / (60 * 60));
    const minutes = Math.floor((difference % (60 * 60)) / 60);
    const seconds = Math.floor(difference % 60);
    
    return {
      days,
      hours,
      minutes,
      seconds,
      totalSeconds: difference
    };
  };

  const [timeRemaining, setTimeRemaining] = useState<TimeRemaining>(calculateTimeRemaining());

  useEffect(() => {
    // Don't set up the interval if there's no target date
    if (!targetDate) {
      setTimeRemaining({
        days: 0,
        hours: 0,
        minutes: 0,
        seconds: 0,
        totalSeconds: 0
      });
      return;
    }

    // Update the countdown every second
    const interval = setInterval(() => {
      setTimeRemaining(calculateTimeRemaining());
    }, 1000);

    // Clear the interval when the component unmounts
    return () => clearInterval(interval);
  }, [targetDate]);

  return timeRemaining;
}