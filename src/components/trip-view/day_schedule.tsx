import { Colors } from '../../../constants/Colors';
import React, { useEffect, useRef } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { RouteLeg } from '../../services/getRoute_graphQL_call';
import { Activity } from '../../types/activity.types';
import { ActivityList } from './activity/activity_list';
import { SearchBar } from '../explore/SearchBar';

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
  onGoToWishlist
}: DayScheduleProps) {
  const selectedCount = selectedActivities.length;
  const scrollViewRef = useRef<ScrollView>(null);
  const isRestoringRef = useRef(false);

  // Restore scroll position only when explicitly triggered and for this specific tab
  useEffect(() => {
    if (scrollViewRef.current && shouldRestorePosition) {
      isRestoringRef.current = true;
      // Only restore if there's a saved position, otherwise start at 0
      const targetPosition = scrollPosition || 0;
      scrollViewRef.current.scrollTo({ y: targetPosition, animated: false });
      // Reset the flag immediately after scrolling
      isRestoringRef.current = false;
    }
  }, [shouldRestorePosition]);

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
          {/* Optimize Route Button - only show if onOptimizeRoute is provided */}
          {onOptimizeRoute && (
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

      {/* Scrollable Content */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={(event) => {
          // Only update scroll position if we're not currently restoring
          if (!isRestoringRef.current) {
            const currentY = event.nativeEvent.contentOffset.y;
            onScrollPositionChange?.(currentY);
          }
        }}
        scrollEventThrottle={16}
      >
        {/* Activities List */}
        <ActivityList
          activities={activities}
          selectedActivities={selectedActivities}
          onActivitySelect={onActivitySelect}
          onActivityDeselect={onActivityDeselect}
          onDescriptionCardPress={onDescriptionCardPress}
          showSelectionIndicator={showSelectionIndicator}
          variant="selectable"
          disabled={disabled}
          emptyStateActionPress={onGoToWishlist}
          emptyStateActionText="Move Activities from Wishlist"
          routeLegs={routeLegs}
          travelMode={travelMode}
          enableDragDrop={!disabled}
          onReorder={(newOrder) => {
            if (onReorder) {
              onReorder(dayNumber, newOrder);
            }
          }}
          routeLoading={routeLoading}
          useInlineSelectionLayout={true}
        />

        {/* SearchBar - visible after activities */}
        {onAddPlace && activities.length > 0 && (
          <View style={{ marginTop: -30 }}>
            <SearchBar
              value={searchQuery}
              onChangeText={onSearchQueryChange || (() => {})}
              onPress={onAddPlace}
              placeholder="Add more activities"
            />
          </View>
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
