import Card from '@/components/Card';
import PlanmoniLoader from '@/components/PlanmoniLoader';
import { router } from 'expo-router';
import { TriangleAlert as AlertTriangle, Check, ChevronLeft, ChevronRight, Clock, Plus } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions , Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { useCalendarEvents, CalendarEvent } from '@/hooks/useCalendarEvents';
import { useTextSize } from '@/contexts/TextSizeContext';
import { getScaledFontSize } from '@/lib/textSize';
import { useAuth } from '@/contexts/AuthContext';
import { useRequireAuth } from '@/hooks/useRequireAuth';

type ViewType = 'month' | 'week' | 'list';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function CalendarScreen() {
  const { width } = useWindowDimensions();
  const { colors, isDark } = useTheme();
  const { textSizeMultiplier } = useTextSize();
  const { session } = useAuth();
  const { requireAuth, isAuthenticated } = useRequireAuth();
  const { events, isLoading, error, refreshEvents } = useCalendarEvents();
  const [activeView, setActiveView] = useState<ViewType>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());

  const cellSize = useMemo(() => {
    const padding = 32;
    const gap = 4;
    const numCells = 7;
    const availableWidth = width - padding;
    const cellWidth = (availableWidth - (gap * (numCells - 1))) / numCells;
    return Math.max(Platform.OS === 'ios' ? 42 : 42, Math.min(cellWidth, Platform.OS === 'ios' ? 56 : 56));
  }, [width]);

  const weekCellSize = useMemo(() => {
    const padding = 32;
    const gap = 8;
    const numCells = 7;
    const availableWidth = width - padding;
    const cellWidth = (availableWidth - (gap * (numCells - 1))) / numCells;
    return Math.max(Platform.OS === 'ios' ? 50 : 40, Math.min(cellWidth, Platform.OS === 'ios' ? 70 : 60));
  }, [width]); 

  const handleCreatePayout = () => {
    if (!requireAuth(() => {}, '/create-payout/amount')) {
      return;
    }
    router.push('/create-payout/amount');
  };

  const getEventIcon = (type: CalendarEvent['type']) => {
    switch (type) {
      case 'completed':
        return <Check size={16} color="#FFFFFF" />;
      case 'pending':
      case 'scheduled':
        return <Clock size={16} color="#FFFFFF" />;
      case 'failed':
        return <AlertTriangle size={16} color="#FFFFFF" />;
    }
  };

  const getEventColors = (type: CalendarEvent['type']) => {
    const baseColors = {
      completed: {
        primary: '#22C55E',
        light: isDark ? '#166534' : '#F0FDF4',
        border: isDark ? '#22C55E' : '#BBF7D0',
        text: isDark ? '#DCFCE7' : '#166534',
        icon: '#FFFFFF'
      },
      pending: {
        primary: '#1E3A8A',
        light: isDark ? '#1E3A8A' : '#F0F9FF',
        border: isDark ? '#1E3A8A' : '#BFDBFE',
        text: isDark ? '#DBEAFE' : '#1E3A8A',
        icon: '#FFFFFF'
      },
      scheduled: {
        primary: '#EAB308',
        light: isDark ? '#92400E' : '#FEFCE8',
        border: isDark ? '#EAB308' : '#FEF08A',
        text: isDark ? '#FEF3C7' : '#92400E',
        icon: '#FFFFFF'
      },
      failed: {
        primary: '#EF4444',
        light: isDark ? '#991B1B' : '#FEF2F2',
        border: isDark ? '#EF4444' : '#FECACA',
        text: isDark ? '#FEE2E2' : '#991B1B',
        icon: '#FFFFFF'
      }
    };

    return baseColors[type];
  };

  // Updated function with clearer color mapping
  const getEventDotColor = (type: CalendarEvent['type']) => {
    switch (type) {
      case 'completed':
        return '#22C55E'; // Green for completed payouts
      case 'pending':
        return '#1E3A8A'; // Blue for payout created/pending
      case 'scheduled':
        return '#EAB308'; // Yellow for scheduled payouts
      case 'failed':
        return '#EF4444'; // Red for failed payouts
      default:
        return '#6B7280'; // Gray fallback
    }
  };

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const formatDate = (date: Date) => {
    return `${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  };

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  };

  const handlePrevWeek = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() - 7);
    setCurrentDate(newDate);
  };

  const handleNextWeek = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() + 7);
    setCurrentDate(newDate);
  };

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear();
  };

  const isSelected = (date: Date) => {
    return date.getDate() === selectedDate.getDate() &&
      date.getMonth() === selectedDate.getMonth() &&
      date.getFullYear() === selectedDate.getFullYear();
  };

  const getEventsForDate = (date: Date) => {
    const dateString = formatDate(date);
    return events.filter(event => event.date === dateString);
  };

  // Get the most important event for a date (for single dot display)
  const getPrimaryEventForDate = (date: Date) => {
    const dateEvents = getEventsForDate(date);
    if (dateEvents.length === 0) return null;
    
    // Priority order: failed > scheduled > completed > pending
    const priorityOrder: CalendarEvent['type'][] = ['failed', 'scheduled', 'completed', 'pending'];
    
    for (const priority of priorityOrder) {
      const event = dateEvents.find(e => e.type === priority);
      if (event) return event;
    }
    
    return dateEvents[0];
  };

  const getWeekDates = (date: Date) => {
    const startOfWeek = new Date(date);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day;
    startOfWeek.setDate(diff);
    
    const weekDates = [];
    for (let i = 0; i < 7; i++) {
      const weekDate = new Date(startOfWeek);
      weekDate.setDate(startOfWeek.getDate() + i);
      weekDates.push(weekDate);
    }
    return weekDates;
  };

  const styles = createStyles(colors, isDark, cellSize, weekCellSize, textSizeMultiplier);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Calendar</Text>
          <View style={styles.headerActions}>
            <Pressable 
              style={styles.todayButton}
              onPress={() => {
                const today = new Date();
                setCurrentDate(today);
                setSelectedDate(today);
              }}
            >
              <Text style={styles.todayButtonText}>Today</Text>
            </Pressable>
            <Pressable style={styles.createButton} onPress={handleCreatePayout}>
              <Plus size={20} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>
        <View style={styles.loadingContainer}>
          <PlanmoniLoader size="medium" description="Loading calendar events..." />
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Calendar</Text>
          <View style={styles.headerActions}>
            <Pressable 
              style={styles.todayButton}
              onPress={() => {
                const today = new Date();
                setCurrentDate(today);
                setSelectedDate(today);
              }}
            >
              <Text style={styles.todayButtonText}>Today</Text>
            </Pressable>
            <Pressable style={styles.createButton} onPress={handleCreatePayout}>
              <Plus size={20} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={refreshEvents}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const renderMonthView = () => {
    const daysInMonth = getDaysInMonth(currentDate);
    const firstDayOffset = getFirstDayOfMonth(currentDate);
    const days = Array.from({ length: daysInMonth }, (_, i) => new Date(currentDate.getFullYear(), currentDate.getMonth(), i + 1));

    return (
      <View>
        <View style={styles.monthHeader}>
          <Text style={styles.monthTitle} numberOfLines={1} adjustsFontSizeToFit>
            {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
          </Text>
          <View style={styles.monthNavigation}>
            <Pressable style={styles.navigationButton} onPress={handlePrevMonth}>
              <ChevronLeft size={20} color={colors.textSecondary} />
            </Pressable>
            <Pressable style={styles.navigationButton} onPress={handleNextMonth}>
              <ChevronRight size={20} color={colors.textSecondary} />
            </Pressable>
          </View>
        </View>

        <View style={styles.calendar}>
          <View style={styles.weekDays}>
            {DAYS.map(day => (
              <View key={day} style={styles.weekDayCell}>
                <Text style={styles.weekDay} numberOfLines={1}>{day}</Text>
              </View>
            ))}
          </View>

          <View style={styles.daysGrid}>
            {Array.from({ length: firstDayOffset }).map((_, index) => (
              <View key={`empty-${index}`} style={styles.dayCell} />
            ))}
            
            {days.map(date => {
              const primaryEvent = getPrimaryEventForDate(date);
              const isSelectedDay = isSelected(date);
              const isTodayDate = isToday(date);

              return (
                <Pressable
                  key={date.getTime()}
                  style={[
                    styles.dayCell,
                    isSelectedDay && styles.selectedDay,
                    isTodayDate && styles.todayDay,
                  ]}
                  onPress={() => handleDateSelect(date)}>
                  <Text style={[
                    styles.dayNumber,
                    isSelectedDay && styles.selectedDayText,
                    isTodayDate && styles.todayDayText,
                  ]} numberOfLines={1}>{date.getDate()}</Text>
                  {primaryEvent && (
                    <View style={[
                      styles.eventDot,
                      { backgroundColor: getEventDotColor(primaryEvent.type) }
                    ]} />
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.selectedDateEvents}>
          <View style={styles.selectedDateHeader}>
            <Text style={styles.selectedDateTitle} numberOfLines={1} adjustsFontSizeToFit>
              {formatDate(selectedDate)}
            </Text>
            <View style={styles.eventCount}>
              <Text style={styles.eventCountText}>
                {getEventsForDate(selectedDate).length} events
              </Text>
            </View>
          </View>

          {getEventsForDate(selectedDate).map(event => {
            const eventColors = getEventColors(event.type);
            return (
              <Pressable
                key={event.id}
                onPress={() => {
                  if (event.payout_plan_id) {
                    router.push({
                      pathname: '/view-payout',
                      params: { id: event.payout_plan_id }
                    });
                  }
                }}
              >
                <Card style={[styles.eventCard, { 
                  backgroundColor: eventColors.light,
                  borderColor: eventColors.border,
                  borderWidth: 1,
                }]}>
                  <View style={styles.eventContent}>
                    <View style={[styles.eventIcon, { backgroundColor: eventColors.primary }]}>
                      {getEventIcon(event.type)}
                    </View>
                    <View style={styles.eventDetails}>
                      <Text style={[styles.eventTitle, { color: eventColors.text }]} numberOfLines={1}>
                        {event.title}
                      </Text>
                      <Text style={[styles.eventDescription, { color: colors.textSecondary }]} numberOfLines={2}>
                        {event.description} • {event.time}
                      </Text>
                    </View>
                  </View>
                </Card>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.legend}>
          <Text style={styles.legendTitle}>Event Types</Text>
          <View style={styles.legendItems}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#22C55E' }]} />
              <Text style={styles.legendText} numberOfLines={1}>Payout received</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#1E3A8A' }]} />
              <Text style={styles.legendText} numberOfLines={1}>Payout created</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#EAB308' }]} />
              <Text style={styles.legendText} numberOfLines={1}>Scheduled payout</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#EF4444' }]} />
              <Text style={styles.legendText} numberOfLines={1}>Payout failed</Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  const renderWeekView = () => {
    const weekDates = getWeekDates(currentDate);
    
    return (
      <View>
        <View style={styles.weekHeader}>
          <Text style={styles.weekTitle} numberOfLines={1} adjustsFontSizeToFit>
            {formatDate(weekDates[0])} - {formatDate(weekDates[6])}
          </Text>
          <View style={styles.monthNavigation}>
            <Pressable style={styles.navigationButton} onPress={handlePrevWeek}>
              <ChevronLeft size={20} color={colors.textSecondary} />
            </Pressable>
            <Pressable style={styles.navigationButton} onPress={handleNextWeek}>
              <ChevronRight size={20} color={colors.textSecondary} />
            </Pressable>
          </View>
        </View>

        <View style={styles.weekDaysGrid}>
          {weekDates.map(date => {
            const primaryEvent = getPrimaryEventForDate(date);
            const isSelectedDay = isSelected(date);
            const isTodayDate = isToday(date);

            return (
              <Pressable
                key={date.getTime()}
                style={[
                  styles.weekDayCell,
                  isSelectedDay && styles.selectedWeekDay,
                  isTodayDate && styles.todayDay,
                ]}
                onPress={() => handleDateSelect(date)}>
                <Text style={[
                  styles.weekDayName,
                  isSelectedDay && styles.selectedWeekDayText,
                  isTodayDate && styles.todayDayText,
                ]} numberOfLines={1}>{DAYS[date.getDay()]}</Text>
                <Text style={[
                  styles.weekDayNumber,
                  isSelectedDay && styles.selectedWeekDayText,
                  isTodayDate && styles.todayDayText,
                ]} numberOfLines={1}>{date.getDate()}</Text>
                {primaryEvent && (
                  <View style={[
                    styles.eventDot,
                    { backgroundColor: getEventDotColor(primaryEvent.type) }
                  ]} />
                )}
              </Pressable>
            );
          })}
        </View>

        <View style={styles.selectedDateEvents}>
          <View style={styles.selectedDateHeader}>
            <Text style={styles.selectedDateTitle} numberOfLines={1} adjustsFontSizeToFit>
              {DAYS[selectedDate.getDay()]}, {formatDate(selectedDate)}
            </Text>
            <View style={styles.eventCount}>
              <Text style={styles.eventCountText}>
                {getEventsForDate(selectedDate).length} events
              </Text>
            </View>
          </View>

          {getEventsForDate(selectedDate).map(event => {
            const eventColors = getEventColors(event.type);
            return (
              <Pressable
                key={event.id}
                onPress={() => {
                  if (event.payout_plan_id) {
                    router.push({
                      pathname: '/view-payout',
                      params: { id: event.payout_plan_id }
                    });
                  }
                }}
              >
                <Card style={[styles.eventCard, { 
                  backgroundColor: eventColors.light,
                  borderColor: eventColors.border,
                  borderWidth: 1,
                }]}>
                  <View style={styles.eventContent}>
                    <View style={[styles.eventIcon, { backgroundColor: eventColors.primary }]}>
                      {getEventIcon(event.type)}
                    </View>
                    <View style={styles.eventDetails}>
                      <Text style={[styles.eventTitle, { color: eventColors.text }]} numberOfLines={1}>
                        {event.title}
                      </Text>
                      <Text style={[styles.eventDescription, { color: colors.textSecondary }]} numberOfLines={2}>
                        {event.description} • {event.time}
                      </Text>
                    </View>
                  </View>
                </Card>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.legend}>
          <Text style={styles.legendTitle}>Event Types</Text>
          <View style={styles.legendItems}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#22C55E' }]} />
              <Text style={styles.legendText} numberOfLines={1}>Payout received</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#1E3A8A' }]} />
              <Text style={styles.legendText} numberOfLines={1}>Payout created</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#EAB308' }]} />
              <Text style={styles.legendText} numberOfLines={1}>Scheduled payout</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#EF4444' }]} />
              <Text style={styles.legendText} numberOfLines={1}>Payout failed</Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  const renderListView = () => {
    // Sort events chronologically (earliest to latest) for list view
    const sortedEvents = [...events].sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      return dateA.getTime() - dateB.getTime();
    });

    // Group events by date while maintaining chronological order
    const groupedEvents = sortedEvents.reduce((acc, event) => {
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      
      const eventDate = new Date(event.date);
      
      let displayDate = event.date;
      
      // Check if it's today
      if (eventDate.toDateString() === today.toDateString()) {
        displayDate = 'Today';
      }
      // Check if it's tomorrow
      else if (eventDate.toDateString() === tomorrow.toDateString()) {
        displayDate = 'Tomorrow';
      }
      
      if (!acc[displayDate]) {
        acc[displayDate] = [];
      }
      acc[displayDate].push(event);
      return acc;
    }, {} as Record<string, CalendarEvent[]>);

    // Get ordered date keys to maintain chronological order
    const orderedDateKeys = Object.keys(groupedEvents).sort((a, b) => {
      // Handle special cases for Today and Tomorrow
      if (a === 'Today') return -1;
      if (b === 'Today') return 1;
      if (a === 'Tomorrow') return -1;
      if (b === 'Tomorrow') return 1;
      
      // For regular dates, sort chronologically
      const dateA = new Date(a);
      const dateB = new Date(b);
      return dateA.getTime() - dateB.getTime();
    });

    return (
      <View style={styles.listViewContainer}>
        {orderedDateKeys.map((date) => {
          const dateEvents = groupedEvents[date];
          
          return (
            <View key={date} style={styles.dateGroup}>
              <View style={styles.dateHeader}>
                <Text style={styles.dateTitle} numberOfLines={1} adjustsFontSizeToFit>{date}</Text>
                <View style={styles.eventCount}>
                  <Text style={styles.eventCountText}>{dateEvents.length} events</Text>
                </View>
              </View>
              <View style={styles.eventsContainer}>
                {dateEvents.map((event) => {
                  const eventColors = getEventColors(event.type);
                  return (
                    <Card key={event.id} style={[styles.eventCard, { 
                      backgroundColor: eventColors.light,
                      borderColor: eventColors.border,
                      borderWidth: 1,
                    }]}>
                      <Pressable 
                        style={styles.eventContent}
                        onPress={() => {
                          if (event.payout_plan_id) {
                            router.push({
                              pathname: '/view-payout',
                              params: { id: event.payout_plan_id }
                            });
                          }
                        }}
                      >
                        <View style={[styles.eventIcon, { backgroundColor: eventColors.primary }]}>
                          {getEventIcon(event.type)}
                        </View>
                        <View style={styles.eventDetails}>
                          <Text style={[styles.eventTitle, { color: eventColors.text }]} numberOfLines={1}>
                            {event.title}
                          </Text>
                          <Text style={[styles.eventDescription, { color: colors.textSecondary }]} numberOfLines={2}>
                            {event.description} • {event.time}
                          </Text>
                        </View>
                        <ChevronRight size={20} color={colors.textTertiary} />
                      </Pressable>
                    </Card>
                  );
                })}
              </View>
            </View>
          );
        })}

        <View style={styles.legend}>
          <Text style={styles.legendTitle}>Event Types</Text>
          <View style={styles.legendItems}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#22C55E' }]} />
              <Text style={styles.legendText} numberOfLines={1}>Payout received</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#1E3A8A' }]} />
              <Text style={styles.legendText} numberOfLines={1}>Payout created</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#EAB308' }]} />
              <Text style={styles.legendText} numberOfLines={1}>Scheduled payout</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#EF4444' }]} />
              <Text style={styles.legendText} numberOfLines={1}>Payout failed</Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Calendar</Text>
        <View style={styles.headerActions}>
          <Pressable 
            style={styles.todayButton}
            onPress={() => {
              const today = new Date();
              setCurrentDate(today);
              setSelectedDate(today);
            }}
          >
            <Text style={styles.todayButtonText}>Today</Text>
          </Pressable>
          <Pressable style={styles.createButton} onPress={handleCreatePayout}>
            <Plus size={20} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>

      <View style={styles.viewSelector}>
        {(['month', 'week', 'list'] as ViewType[]).map((view) => (
          <Pressable
            key={view}
            style={[
              styles.viewOption,
              activeView === view && styles.viewOptionActive,
            ]}
            onPress={() => setActiveView(view)}>
            <Text
              style={[
                styles.viewOptionText,
                activeView === view && styles.viewOptionTextActive,
              ]}
              numberOfLines={1}>
              {view.charAt(0).toUpperCase() + view.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {activeView === 'month' && renderMonthView()}
        {activeView === 'week' && renderWeekView()}
        {activeView === 'list' && renderListView()}
      </ScrollView>
      
    </SafeAreaView>
  );
}

const createStyles = (colors: any, isDark: boolean, cellSize: number, weekCellSize: number, textSizeMultiplier: number) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 24 : 20, textSizeMultiplier),
    fontWeight: '700',
    color: colors.text,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  todayButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: colors.backgroundTertiary,
  },
  todayButtonText: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 14 : 12, textSizeMultiplier),
    fontWeight: '500',
    color: colors.text,
  },
  createButton: {
    width: Platform.OS === 'ios' ? 32 : 24,
    height: Platform.OS === 'ios' ? 32 : 24,
    borderRadius: 16,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 16 : 14, textSizeMultiplier),
    color: colors.textSecondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    padding: 24,
  },
  errorText: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 16 : 14, textSizeMultiplier),
    color: colors.error,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: Platform.OS === 'ios' ? 20 : 16,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 14 : 12, textSizeMultiplier),
    fontWeight: '600',
  },
  viewSelector: {
    flexDirection: 'row',
    backgroundColor: colors.backgroundTertiary,
    borderRadius: 8,
    padding: Platform.OS === 'ios' ? 4 : 2,
    marginHorizontal: Platform.OS === 'ios' ? 16 : 10,
    marginVertical: Platform.OS === 'ios' ? 12 : 10,
  },
  viewOption: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  viewOptionActive: {
    backgroundColor: colors.primary,
  },
  viewOptionText: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 14 : 12, textSizeMultiplier),
    fontWeight: '500',
    color: colors.textSecondary,
  },
  viewOptionTextActive: {
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
  },
  contentContainer: {
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
  },
  calendar: {
    paddingHorizontal: Platform.OS === 'ios' ? 16 : 10,
  },
  weekDays: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  weekDay: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 12 : 10, textSizeMultiplier),
    fontWeight: '500',
    color: colors.textSecondary,
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Platform.OS === 'ios' ? 4 : 6,
    justifyContent: 'flex-start',
  },
  dayCell: {
    width: cellSize,
    height: cellSize,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    position: 'relative',
  },
  selectedDay: {
    backgroundColor: colors.primary,
  },
  todayDay: {
    backgroundColor: colors.backgroundTertiary,
  },
  dayNumber: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 14 : 12, textSizeMultiplier),
    color: colors.text,
    fontWeight: '500',
  },
  selectedDayText: {
    color: '#FFFFFF',
  },
  todayDayText: {
    color: colors.primary,
  },
  eventDot: {
    position: 'absolute',
    bottom: 4,
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  monthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  monthTitle: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 18 : 16, textSizeMultiplier),
    fontWeight: '600',
    color: colors.text,
    flex: 1,
  },
  monthNavigation: {
    flexDirection: 'row',
    gap: 8,
  },
  navigationButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: colors.backgroundTertiary,
  },
  weekHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  weekTitle: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 16 : 14, textSizeMultiplier),
    fontWeight: '600',
    color: colors.text,
    flex: 1,
  },
  weekDaysGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    gap: 4,
    marginBottom: 16,
  },
  weekDayCell: {
    width: weekCellSize,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    borderRadius: 12,
    minHeight: 70,
    position: 'relative',
  },
  weekDayName: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 12 : 10, textSizeMultiplier),
    color: colors.textSecondary,
    marginBottom: 4,
  },
  weekDayNumber: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 16 : 14, textSizeMultiplier),
    fontWeight: '500',
    color: colors.text,
  },
  selectedWeekDay: {
    backgroundColor: colors.primary,
  },
  selectedWeekDayText: {
    color: '#FFFFFF',
  },
  selectedDateEvents: {
    padding: 16,
  },
  selectedDateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    flexWrap: 'wrap',
    gap: 8,
  },
  selectedDateTitle: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 16 : 14, textSizeMultiplier),
    fontWeight: '600',
    color: colors.text,
    flex: 1,
    minWidth: 200,
  },
  eventCount: {
    backgroundColor: isDark ? colors.backgroundTertiary : '#E0F2FE',
    paddingHorizontal: Platform.OS === 'ios' ? 8 : 6,
    paddingVertical: 4,
    borderRadius: 12,
  },
  eventCountText: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 12 : 10, textSizeMultiplier),
    color: isDark ? colors.textSecondary : '#0284C7',
    fontWeight: '500',
  },
  dateGroup: {
    marginBottom: Platform.OS === 'ios' ? 24 : 16,
  },
  dateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: Platform.OS === 'ios' ? 16 : 10,
    flexWrap: 'wrap',
    gap: 8,
  },
  dateTitle: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 16 : 14, textSizeMultiplier),
    fontWeight: '600',
    color: colors.text,
    flex: 1,
    minWidth: 150,
  },
  eventsContainer: {
    paddingHorizontal: Platform.OS === 'ios' ? 16 : 10,
  },
  eventCard: {
    marginBottom: Platform.OS === 'ios' ? 12 : 10,
    borderRadius: 12,
    overflow: 'hidden',
  },
  eventContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  eventIcon: {
    width: Platform.OS === 'ios' ? 32 : 24,
    height: Platform.OS === 'ios' ? 32 : 24,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Platform.OS === 'ios' ? 12 : 10,
  },
  eventDetails: {
    flex: 1,
    marginRight: 12,
  },
  eventTitle: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 14 : 12, textSizeMultiplier),
    fontWeight: '600',
    marginBottom: 4,
  },
  eventDescription: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 12 : 10, textSizeMultiplier),
    lineHeight: getScaledFontSize(16, textSizeMultiplier),
  },
  legend: {
    padding: Platform.OS === 'ios' ? 16 : 10,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: 16,
  },
  legendTitle: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 14 : 12, textSizeMultiplier),
    fontWeight: '500',
    color: colors.textSecondary,
    marginBottom: 12,
  },
  legendItems: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Platform.OS === 'ios' ? 16 : 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: Platform.OS === 'ios' ? 120 : 100,
  },
  legendDot: {
    width: Platform.OS === 'ios' ? 8 : 6,
    height: Platform.OS === 'ios' ? 8 : 6,
    borderRadius: 4,
  },
  legendText: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 12 : 10, textSizeMultiplier),
    color: colors.textSecondary,
    flex: 1,
  },
  listViewContainer: {
    flex: 1,
    paddingTop: 16,
  },
  loginPromptContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loginPromptCard: {
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    maxWidth: 400,
  },
  loginPromptTitle: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 20 : 18, textSizeMultiplier),
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  loginPromptText: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 14 : 12, textSizeMultiplier),
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  loginPromptButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  loginPromptButtonText: {
    color: '#FFFFFF',
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 16 : 14, textSizeMultiplier),
    fontWeight: '600',
  },
});