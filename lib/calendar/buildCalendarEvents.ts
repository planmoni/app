import type { PayoutPlan } from '@/hooks/useRealtimePayoutPlans';
import type { Transaction } from '@/hooks/useRealtimeTransactions';

export type CalendarEvent = {
  id: string;
  title: string;
  amount: string;
  time: string;
  type: 'completed' | 'pending' | 'scheduled' | 'failed';
  description: string;
  vault?: string;
  date: string;
  payout_plan_id?: string;
  transaction_id?: string;
};

type CustomDateRow = { payout_date: string; payout_time?: string };

export function buildCalendarEvents(
  payoutPlans: PayoutPlan[],
  transactions: Transaction[],
  customDatesByPlan: Record<string, CustomDateRow[]>
): CalendarEvent[] {
  const calendarEvents: CalendarEvent[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const payoutTransactions = transactions.filter((t) => t.type === 'payout');

  payoutTransactions.forEach((transaction) => {
    const date = new Date(transaction.created_at);
    const formattedDate = date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });

    const planName =
      (transaction as Transaction & { payout_plans?: { name?: string } }).payout_plans?.name ||
      payoutPlans.find((p) => p.id === transaction.payout_plan_id)?.name ||
      'Unknown';

    calendarEvents.push({
      id: transaction.id,
      title: `₦${Number(transaction.amount).toLocaleString()} disbursed`,
      amount: `₦${Number(transaction.amount).toLocaleString()}`,
      time: date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      }),
      type: transaction.status === 'completed' ? 'completed' : 'failed',
      description: `From Vault "${planName}"`,
      vault: planName,
      date: formattedDate,
      payout_plan_id: transaction.payout_plan_id,
      transaction_id: transaction.id,
    });
  });

  for (const plan of payoutPlans) {
    const createdDate = new Date(plan.created_at);
    const formattedCreatedDate = createdDate.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });

    calendarEvents.push({
      id: `plan-created-${plan.id}`,
      title: 'Payout plan created',
      amount: `₦${plan.payout_amount.toLocaleString()}`,
      time: createdDate.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      }),
      type: 'pending',
      description: `Plan "${plan.name}" created`,
      vault: plan.name,
      date: formattedCreatedDate,
      payout_plan_id: plan.id,
    });

    if (plan.status === 'active' && plan.start_date) {
      const startDate = new Date(plan.start_date);
      let payoutTime: { hours: number; minutes: number } = { hours: 9, minutes: 0 };
      if (plan.next_payout_date) {
        const nextPayoutDateTime = new Date(plan.next_payout_date);
        if (!isNaN(nextPayoutDateTime.getTime())) {
          const hours = nextPayoutDateTime.getHours();
          const minutes = nextPayoutDateTime.getMinutes();
          if (hours !== 0 || minutes !== 0) {
            payoutTime = { hours, minutes };
          }
        }
      }

      const scheduledDates: Date[] = [];

      if (plan.frequency === 'custom') {
        const customDates = customDatesByPlan[plan.id] || [];
        for (const customDate of customDates) {
          const dateParts = String(customDate.payout_date).split('T')[0].split('-').map(Number);
          const [y, m, d] = dateParts;
          let hours = payoutTime.hours;
          let minutes = payoutTime.minutes;
          if (customDate.payout_time) {
            const timeParts = String(customDate.payout_time).split(':').map(Number);
            if (!isNaN(timeParts[0])) hours = timeParts[0] % 24;
            if (!isNaN(timeParts[1])) minutes = timeParts[1] % 60;
          }
          scheduledDates.push(new Date(y, m - 1, d, hours, minutes, 0, 0));
        }
      } else {
        const remainingPayouts = plan.duration - plan.completed_payouts;
        for (let i = 0; i < remainingPayouts; i++) {
          const payoutIndex = plan.completed_payouts + i;
          const scheduledDate = new Date(startDate);
          switch (plan.frequency) {
            case 'daily':
              scheduledDate.setDate(startDate.getDate() + payoutIndex);
              break;
            case 'weekly':
              scheduledDate.setDate(startDate.getDate() + payoutIndex * 7);
              break;
            case 'biweekly':
              scheduledDate.setDate(startDate.getDate() + payoutIndex * 14);
              break;
            case 'monthly':
              scheduledDate.setMonth(startDate.getMonth() + payoutIndex);
              break;
          }
          scheduledDate.setHours(payoutTime.hours, payoutTime.minutes, 0, 0);
          const scheduledDateOnly = new Date(scheduledDate);
          scheduledDateOnly.setHours(0, 0, 0, 0);
          if (scheduledDateOnly >= today) {
            scheduledDates.push(scheduledDate);
          }
        }
      }

      for (let index = 0; index < scheduledDates.length; index++) {
        const scheduledDate = scheduledDates[index];
        const formattedDate = scheduledDate.toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        });
        const daysUntilPayout = Math.ceil(
          (scheduledDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        );
        let eventType: 'scheduled' | 'failed' = 'scheduled';
        let eventTitle = 'Scheduled payout';
        let eventDescription = `Payout from "${plan.name}"`;
        if (daysUntilPayout < -1) {
          eventType = 'failed';
          eventTitle = 'Overdue payout';
          eventDescription = `Overdue payout from "${plan.name}" (${Math.abs(daysUntilPayout)} days late)`;
        }
        if (daysUntilPayout >= 0 || (daysUntilPayout < 0 && daysUntilPayout >= -7)) {
          calendarEvents.push({
            id: `plan-scheduled-${plan.id}-${index}`,
            title: eventTitle,
            amount: `₦${plan.payout_amount.toLocaleString()}`,
            time: scheduledDate.toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
              hour12: true,
            }),
            type: eventType,
            description: eventDescription,
            vault: plan.name,
            date: formattedDate,
            payout_plan_id: plan.id,
          });
        }
      }
    }

    if (plan.status === 'paused' && plan.next_payout_date) {
      const pausedDate = new Date(plan.next_payout_date);
      calendarEvents.push({
        id: `plan-paused-${plan.id}`,
        title: 'Payout paused',
        amount: `₦${plan.payout_amount.toLocaleString()}`,
        time: pausedDate.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        }),
        type: 'failed',
        description: `Payout from "${plan.name}" was paused`,
        vault: plan.name,
        date: pausedDate.toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        }),
        payout_plan_id: plan.id,
      });
    }
  }

  calendarEvents.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  return calendarEvents;
}
