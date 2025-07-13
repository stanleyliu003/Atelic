import { Colors } from '@/constants/Colors';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { RouteLeg } from '../../services/getRoute_graphQL_call';
import { Activity } from '../../types/activity.types';
import { ActivityList } from './activity/activity_list';

interface DayScheduleProps {
  dayNumber: number;
  activities: Activity[];
  selectedActivities?: string[];
  onActivitySelect?: (activityId: string) => void;
  onActivityDeselect?: (activityId: string) => void;
  onTransferToWishlist?: (activityIds: string[]) => void;
  onOptimizeRoute?: (dayNumber: number) => void;
  showSelectionIndicator?: boolean;
  disabled?: boolean;
  routeLegs?: RouteLeg[]; // Add route legs prop
}

export function DaySchedule({ 
  dayNumber,
  activities,
  selectedActivities = [],
  onActivitySelect,
  onActivityDeselect,
  onTransferToWishlist,
  onOptimizeRoute,
  showSelectionIndicator = false,
  disabled = false,
  routeLegs = [] // Add route legs with default empty array
}: DayScheduleProps) {
  const selectedCount = selectedActivities.length;

  const handleOptimizeRoute = () => {
    if (onOptimizeRoute) {
      onOptimizeRoute(dayNumber);
    }
  };

  const handleTransferToWishlist = () => {
    if (onTransferToWishlist && selectedCount > 0) {
      onTransferToWishlist(selectedActivities);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header with Day Number and Actions */}
      <View style={styles.header}>
        <View style={styles.dayInfo}>
          <Text style={styles.dayTitle}>Day {dayNumber}</Text>
          <Text style={styles.activityCount}>
            {activities.length} {activities.length === 1 ? 'activity' : 'activities'}
          </Text>
        </View>
        
        <View style={styles.actionButtons}>
          {/* Optimize Route Button */}
          <TouchableOpacity 
            style={[styles.actionButton, styles.optimizeButton]}
            onPress={handleOptimizeRoute}
            disabled={activities.length < 2 || disabled}
          >
            <Text style={styles.optimizeButtonText}>Optimize Route</Text>
          </TouchableOpacity>

        </View>
      </View>

      {/* Activities List */}
      <ActivityList
        activities={activities}
        selectedActivities={selectedActivities}
        onActivitySelect={onActivitySelect}
        onActivityDeselect={onActivityDeselect}
        showSelectionIndicator={showSelectionIndicator}
        variant="selectable"
        disabled={disabled}
        emptyStateTitle={`No activities for Day ${dayNumber}`}
        emptyStateSubtitle="Add activities from your wishlist to get started"
        routeLegs={routeLegs}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 15,
    paddingHorizontal: 5,
  },
  dayInfo: {
    flex: 1,
  },
  dayTitle: {
    fontFamily: 'outfit-bold',
    fontSize: 24,
    color: Colors.PRIMARY,
    marginBottom: 4,
  },
  activityCount: {
    fontFamily: 'outfit',
    fontSize: 14,
    color: Colors.GRAY,
  },
  actionButtons: {
    alignItems: 'flex-end',
    gap: 8,
  },
  actionButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    minWidth: 120,
    alignItems: 'center',
  },
  optimizeButton: {
    backgroundColor: '#E6E6FA', // Lavender
  },
  optimizeButtonText: {
    fontFamily: 'outfit',
    fontSize: 12,
    color: '#4B0082', // Deep purple
    fontWeight: '600',
  },
  transferButton: {
    backgroundColor: '#FFE6E6', // Light red
  },
  transferButtonText: {
    fontFamily: 'outfit',
    fontSize: 12,
    color: '#D32F2F', // Red
    fontWeight: '600',
  },
});
