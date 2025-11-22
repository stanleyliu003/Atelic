import { Colors } from '../../../constants/Colors';
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
  onDescriptionCardPress?: (activity: Activity) => void;
  onTransferToWishlist?: (activityIds: string[]) => void;
  onOptimizeRoute?: (dayNumber: number) => void;
  showSelectionIndicator?: boolean;
  disabled?: boolean;
  routeLegs?: RouteLeg[]; // Add route legs prop
  onAddPlace?: () => void; // Search bar trigger
  searchQuery?: string; // Search query value
  onSearchQueryChange?: (text: string) => void; // Search query change handler
  scrollPosition?: number; // Current scroll position
  onScrollPositionChange?: (position: number) => void; // Callback for scroll position changes
  shouldRestorePosition?: boolean; // Flag to trigger position restore
  travelMode?: string; // Travel mode from route calculation
  onReorder?: (dayNumber: number, newOrder: Activity[]) => void; // New prop for reordering activities
  routeLoading?: boolean; // Loading state for route recalculation
  onGoToWishlist?: () => void; // Navigate to wishlist callback
  currentUserRole?: string; // User's role in the trip (owner, editor, viewer)
  onDuplicate?: (activity: Activity, targetDayNumber?: number) => void; // Callback for duplicating an activity
  isAddingPlaceFromAutocomplete?: boolean; // Show inline loading row below last activity
}

export function DaySchedule({
  dayNumber,
  activities,
  selectedActivities = [],
  onActivitySelect,
  onActivityDeselect,
  onDescriptionCardPress,
  onTransferToWishlist,
  onOptimizeRoute,
  showSelectionIndicator = false,
  disabled = false,
  routeLegs = [], // Add route legs with default empty array
  onAddPlace,
  searchQuery = '',
  onSearchQueryChange,
  scrollPosition = 0,
  onScrollPositionChange,
  shouldRestorePosition = false,
  travelMode,
  onReorder,
  routeLoading = false,
  onGoToWishlist,
  currentUserRole,
  onDuplicate,
  isAddingPlaceFromAutocomplete,
}: DayScheduleProps) {
  const selectedCount = selectedActivities.length;

  // Note: Scroll position tracking removed since ActivityList now handles its own scrolling
  // scrollPosition, onScrollPositionChange, shouldRestorePosition are kept in props for backward compatibility

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
          {/* Optimize Route Button - only show if onOptimizeRoute is provided and there are more than 2 activities */}
          {onOptimizeRoute && activities.length > 2 && (
            <TouchableOpacity
              style={[styles.actionButton, styles.optimizeButton]}
              onPress={handleOptimizeRoute}
              disabled={activities.length < 2 || disabled}
            >
              <Text style={styles.optimizeButtonText}>Optimize Route</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Activities List - handles its own scrolling */}
      <ActivityList
        activities={activities}
        selectedActivities={selectedActivities}
        onActivitySelect={onActivitySelect}
        onActivityDeselect={onActivityDeselect}
        onDescriptionCardPress={onDescriptionCardPress}
        showSelectionIndicator={showSelectionIndicator}
        variant="selectable"
        disabled={disabled}
        routeLegs={routeLegs}
        travelMode={travelMode}
        enableDragDrop={!disabled && currentUserRole !== 'viewer'}
        onReorder={(newOrder) => {
          if (onReorder) {
            onReorder(dayNumber, newOrder);
          }
        }}
        routeLoading={routeLoading}
        useInlineSelectionLayout={true}
        scrollable={true}
        onAddPlace={onAddPlace}
        searchQuery={searchQuery}
        onSearchQueryChange={onSearchQueryChange}
        onDuplicate={onDuplicate ? (activity) => onDuplicate(activity, dayNumber) : undefined}
        isAddingPlaceFromAutocomplete={isAddingPlaceFromAutocomplete}
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
    backgroundColor: '#F36406',
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
