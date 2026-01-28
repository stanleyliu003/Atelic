import React from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../constants/Colors';
import { Activity, EnhancedRouteLeg } from '../../types/activity.types';
import EditableTripTitle from './EditableTripTitle';
import DaySummaryCard from './DaySummaryCard';

interface Collaborator {
  userID: string;
  email: string;
  role: string;
  userName?: string;
}

interface OverviewContentProps {
  tripTitle: string | null;
  onTitleChange: (newTitle: string) => void;
  startDate: string | null;
  endDate: string | null;
  tripLength: number;
  selectedCity: string;
  dayActivities: { [dayNumber: number]: { activities: Activity[] } };
  activities: Activity[];
  onDayPress: (dayNumber: number) => void;
  onDatePress: () => void;
  currentUserRole: string;
  collaborators?: Collaborator[];
  dayRouteLegs?: { [dayNumber: number]: EnhancedRouteLeg[] };
}

export default function OverviewContent({
  tripTitle,
  onTitleChange,
  startDate,
  endDate,
  tripLength,
  selectedCity,
  dayActivities,
  activities,
  onDayPress,
  onDatePress,
  currentUserRole,
  collaborators,
  dayRouteLegs,
}: OverviewContentProps) {
  const isViewer = currentUserRole === 'viewer';

  const calculateDayDate = (startDate: string | null, dayNumber: number): Date | null => {
    if (!startDate) return null;
    const start = new Date(startDate);
    const dayDate = new Date(start);
    dayDate.setDate(start.getDate() + (dayNumber - 1));
    return dayDate;
  };

  const sortedDayNumbers = Object.keys(dayActivities)
    .map(Number)
    .sort((a, b) => a - b);

  // Calculate cumulative non-hotel activity counts for sequential numbering across days
  const activityNumberOffsets: { [dayNumber: number]: number } = {};
  let cumulativeCount = 0;
  sortedDayNumbers.forEach(dayNum => {
    activityNumberOffsets[dayNum] = cumulativeCount;
    const dayActs = dayActivities[dayNum]?.activities || [];
    const nonHotelCount = dayActs.filter(
      a => !(a.isLodging === true || a.primaryType === 'lodging')
    ).length;
    cumulativeCount += nonHotelCount;
  });

  // Calculate day date helper

  const formatDateRange = (): string => {
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const startMonth = months[start.getMonth()];
      const endMonth = months[end.getMonth()];
      const startDay = start.getDate();
      const endDay = end.getDate();

      if (startMonth === endMonth && start.getFullYear() === end.getFullYear()) {
        return `${startMonth} ${startDay}-${endDay}`;
      }
      return `${startMonth} ${startDay} - ${endMonth} ${endDay}`;
    }
    return `${tripLength} ${tripLength === 1 ? 'day' : 'days'}`;
  };

  // Calculate stats
  const totalLocations = sortedDayNumbers.reduce(
    (sum, dayNum) => sum + (dayActivities[dayNum]?.activities?.length || 0),
    0
  );
  const plannedDays = sortedDayNumbers.filter(
    dayNum => dayActivities[dayNum]?.activities?.length > 0
  ).length;
  const totalCollaborators = (collaborators?.length || 1) - 1; // Exclude owner

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      {/* Trip Header */}
      <View style={styles.headerSection}>
        <EditableTripTitle
          title={tripTitle}
          defaultTitle={selectedCity}
          onSave={onTitleChange}
          editable={!isViewer}
        />

        <View style={styles.metaRow}>
          <Pressable
            onPress={!isViewer ? onDatePress : undefined}
            disabled={isViewer}
            style={styles.dateContainer}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="calendar-outline" size={14} color="#9CA3AF" />
            <Text style={styles.dateText}>{formatDateRange()}</Text>
          </Pressable>

          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Ionicons name="location" size={12} color="#9CA3AF" />
              <Text style={styles.statText}>{totalLocations}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Ionicons name="people" size={12} color="#9CA3AF" />
              <Text style={styles.statText}>{totalCollaborators + 1}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Days Section */}
      <View style={styles.daysSection}>
        <View style={styles.sectionHeaderContainer}>
          <Text style={styles.sectionHeader}>MY ITINERARY</Text>
        </View>

        {sortedDayNumbers.length > 0 ? (
          <View style={styles.daysContainer}>
            {sortedDayNumbers.map((dayNumber, index) => (
              <View key={dayNumber} style={[
                styles.dayCardWrapper,
                index === 0 && styles.firstDayCard
              ]}>
                <DaySummaryCard
                  dayNumber={dayNumber}
                  activities={dayActivities[dayNumber]?.activities || []}
                  date={calculateDayDate(startDate, dayNumber)}
                  onPress={() => onDayPress(dayNumber)}
                  routeLegs={dayRouteLegs?.[dayNumber]}
                  activityNumberOffset={activityNumberOffsets[dayNumber]}
                />
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <Ionicons name="calendar-outline" size={32} color="#F36406" />
            </View>
            <Text style={styles.emptyTitle}>No days planned yet</Text>
            <Text style={styles.emptySubtext}>
              Switch to the Itinerary tab to start planning your trip days
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  contentContainer: {
    paddingBottom: 0,
  },
  headerSection: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: '#FFFFFF',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dateText: {
    fontSize: 13,
    fontFamily: 'outfit',
    color: '#6B7280',
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 12,
    fontFamily: 'outfit-semibold',
    color: '#6B7280',
  },
  statDivider: {
    width: 1,
    height: 12,
    backgroundColor: '#E5E7EB',
  },
  daysSection: {
    marginTop: 0,
    marginBottom: 0,
  },
  sectionHeaderContainer: {
    backgroundColor: '#FFFFFF',
    paddingBottom: 0,
  },
  sectionHeader: {
    fontSize: 11,
    fontFamily: 'outfit-bold',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 0,
  },
  daysContainer: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  dayCardWrapper: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E8EAED',
    overflow: 'hidden',
  },
  firstDayCard: {
    // No special styling needed
  },
  emptyState: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 8,
    paddingHorizontal: 32,
    paddingVertical: 48,
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E8EAED',
  },
  emptyIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FEF3F2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 17,
    fontFamily: 'outfit-bold',
    color: '#111827',
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  emptySubtext: {
    fontSize: 14,
    fontFamily: 'outfit',
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
});
