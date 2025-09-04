import { Colors } from '../../../constants/Colors';
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { RouteLeg } from '../../services/getRoute_graphQL_call';
import { Activity } from '../../types/activity.types';
import { ActivityList, AddPlacesButton } from './index';

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
  onAddPlace?: () => void; // Add places modal trigger
  isAddingPlace?: boolean; // Loading state for adding places
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
  routeLegs = [], // Add route legs with default empty array
  onAddPlace,
  isAddingPlace = false
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

      {/* Scrollable Content */}
      <ScrollView 
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
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
          emptyStateSubtitle={"Go to your wishlist to select and add activities"}
          routeLegs={routeLegs}
        />

        {/* Add additional places button - only visible when scrolling down and there are activities */}
        {onAddPlace && activities.length > 0 && (
          <AddPlacesButton
            onPress={onAddPlace}
            isAddingPlace={isAddingPlace}
          />
        )}
      </ScrollView>
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
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
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
    marginRight: -25,
  },
  actionButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    minWidth: 120,
    alignItems: 'center',
  },
  optimizeButton: {
    backgroundColor: '#FF9800', // Orange
  },
  optimizeButtonText: {
    fontFamily: 'outfit-bold',
    fontSize: 13,
    color: '#FFFFFF', // White text for better contrast on orange
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
