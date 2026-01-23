import React from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../constants/Colors';
import { Activity } from '../../types/activity.types';
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
        <Text style={styles.sectionHeader}>YOUR ITINERARY</Text>

        {sortedDayNumbers.length > 0 ? (
          <View style={styles.daysContainer}>
            {sortedDayNumbers.map((dayNumber, index) => (
              <React.Fragment key={dayNumber}>
                <DaySummaryCard
                  dayNumber={dayNumber}
                  activities={dayActivities[dayNumber]?.activities || []}
                  date={calculateDayDate(startDate, dayNumber)}
                  onPress={() => onDayPress(dayNumber)}
                />
                {index < sortedDayNumbers.length - 1 && <View style={styles.dayDivider} />}
              </React.Fragment>
            ))}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <Ionicons name="calendar-outline" size={40} color="#F36406" />
            </View>
            <Text style={styles.emptyTitle}>No days planned yet</Text>
            <Text style={styles.emptySubtext}>
              Switch to the Itinerary tab to start planning your trip days
            </Text>
          </View>
        )}
      </View>

      <View style={styles.bottomPadding} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  contentContainer: {
    paddingBottom: 24,
  },
  headerSection: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
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
    marginTop: 16,
    marginBottom: 20,
  },
  sectionHeader: {
    fontSize: 11,
    fontFamily: 'outfit-bold',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  daysContainer: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  dayDivider: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginLeft: 16,
  },
  emptyState: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    padding: 48,
    borderRadius: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F0F0F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  emptyIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FEF3F2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: 'outfit-bold',
    color: '#111827',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  emptySubtext: {
    fontSize: 14,
    fontFamily: 'outfit',
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 21,
  },
  bottomPadding: {
    height: 30,
  },
});
