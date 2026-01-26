/**
 * Time Evaluator
 * 
 * Evaluates time-based restrictions and conditions.
 */

import { PolicyCondition, RestrictionCheck, RestrictionType, RestrictionValue } from '../types';

export interface TimeContext {
  current_time: Date;
  transaction_time?: Date;
}

export function evaluateTimeCondition(
  condition: PolicyCondition,
  context: TimeContext
): boolean {
  const { type, operator, value } = condition;

  if (type !== 'time') {
    return false;
  }

  const now = context.transaction_time || context.current_time;
  const currentHour = now.getHours();
  const currentDay = now.getDay(); // 0 = Sunday, 6 = Saturday

  // Handle time-based restrictions
  if (condition.field === 'hour') {
    const hourValue = typeof value === 'number' ? value : currentHour;
    
    switch (operator) {
      case 'gt':
        return currentHour > hourValue;
      case 'gte':
        return currentHour >= hourValue;
      case 'lt':
        return currentHour < hourValue;
      case 'lte':
        return currentHour <= hourValue;
      case 'eq':
        return currentHour === hourValue;
      case 'between':
        if (typeof value === 'object' && 'min' in value && 'max' in value) {
          return currentHour >= value.min && currentHour <= value.max;
        }
        return false;
      default:
        return false;
    }
  }

  // Handle day-of-week restrictions
  if (condition.field === 'day') {
    const allowedDays = Array.isArray(value) ? value.map(v => Number(v)) : [Number(value)];
    
    switch (operator) {
      case 'in':
        return allowedDays.includes(currentDay);
      case 'not_in':
        return !allowedDays.includes(currentDay);
      default:
        return false;
    }
  }

  return false;
}

export function checkTimeRestriction(
  restriction: { type: RestrictionType; value: RestrictionValue },
  context: TimeContext
): RestrictionCheck {
  let passed = true;
  let message: string | undefined;

  if (restriction.type === 'time_restriction') {
    const now = context.transaction_time || context.current_time;
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTimeMinutes = currentHour * 60 + currentMinute;
    const currentDay = now.getDay();

    // Check allowed hours
    if (restriction.value.allowed_hours && restriction.value.allowed_hours.length > 0) {
      const isInAllowedHours = restriction.value.allowed_hours.some(range => {
        const [startHour, startMin] = range.start.split(':').map(Number);
        const [endHour, endMin] = range.end.split(':').map(Number);
        const startMinutes = startHour * 60 + startMin;
        const endMinutes = endHour * 60 + endMin;
        
        // Handle overnight ranges (e.g., 22:00 - 02:00)
        if (startMinutes > endMinutes) {
          return currentTimeMinutes >= startMinutes || currentTimeMinutes <= endMinutes;
        }
        return currentTimeMinutes >= startMinutes && currentTimeMinutes <= endMinutes;
      });

      if (!isInAllowedHours) {
        passed = false;
        message = `Transaction not allowed at current time: ${now.toLocaleTimeString()}`;
      }
    }

    // Check allowed days
    if (passed && restriction.value.allowed_days && restriction.value.allowed_days.length > 0) {
      if (!restriction.value.allowed_days.includes(currentDay)) {
        passed = false;
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        message = `Transaction not allowed on ${dayNames[currentDay]}`;
      }
    }
  }

  return {
    restriction_id: '',
    restriction_type: restriction.type,
    passed,
    message,
  };
}
