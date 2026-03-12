import React, { useEffect, useMemo } from 'react';
import { Colors } from '../../../constants/Colors';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Activity, EnhancedRouteLeg } from '../../types/activity.types';
import { ActivityList } from './activity/activity_list';
import Animated, { useAnimatedRef, runOnUI, scrollTo } from 'react-native-reanimated';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

const format12Hour = (time24?: string): string => {
  if (!time24) return '';
  const [hourStr, minute] = time24.split(':');
  const hour24 = parseInt(hourStr, 10);
  const isPM = hour24 >= 12;
  const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
  return `${hour12}:${minute} ${isPM ? 'PM' : 'AM'}`;
};

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
  routeLegs?: EnhancedRouteLeg[]; // Add route legs prop
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
  currentUserRole?: 'owner' | 'editor' | 'viewer'; // User's role in the trip (owner, editor, viewer)
  onDuplicate?: (activity: Activity, targetDayNumber?: number) => void; // Callback for duplicating an activity
  isAddingPlaceFromAutocomplete?: boolean; // Show inline loading row below last activity
  activeTab?: string; // Current active tab (wishlist or day#)
  onOpenSettings?: (legIndex: number) => void; // Callback for opening transportation settings
  onDelete?: (activity: Activity, dayNumber: number) => void; // Callback for swipe-to-delete
  onAddHotel?: (existingLodging?: Activity) => void; // Callback to open hotel stay modal
  onAddFlight?: () => void; // Callback to open flight modal
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
  activeTab,
  onOpenSettings,
  onDelete,
  onAddHotel,
  onAddFlight,
}: DayScheduleProps) {
  const selectedCount = selectedActivities.length;

  // Create a ref for the scroll view inside ActivityList
  const scrollViewRef = useAnimatedRef<Animated.ScrollView>();

  useEffect(() => {
    if (shouldRestorePosition) {
      runOnUI(() => {
        'worklet';
        scrollTo(scrollViewRef, 0, scrollPosition, false);
      })();
    }
  }, [shouldRestorePosition, scrollPosition]);

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

  // Find lodging activity for hotel banner
  const lodgingActivity = useMemo(() => {
    return activities.find(a => a.isLodging === true || a.primaryType === 'lodging');
  }, [activities]);

  const hotelNights = useMemo(() => {
    if (!lodgingActivity?.lodgingCheckIn || !lodgingActivity?.lodgingCheckOut) return 0;
    const start = new Date(lodgingActivity.lodgingCheckIn);
    const end = new Date(lodgingActivity.lodgingCheckOut);
    return Math.max(0, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
  }, [lodgingActivity]);

  const hotelContextLabel = useMemo(() => {
    if (!lodgingActivity) return '';
    const notesCtx = (lodgingActivity.notes === 'Check-in' || lodgingActivity.notes === 'Check-out' || lodgingActivity.notes === 'Check-in / Check-out') ? lodgingActivity.notes : '';
    const context = (lodgingActivity as any).lodgingContext || notesCtx;
    if (context === 'Check-in / Check-out') return 'Same-day stay';
    if (context.includes('Check-in')) {
      const time = lodgingActivity.lodgingTime?.checkIn;
      return `Check-in${time ? ` · ${format12Hour(time)}` : ''}`;
    }
    if (context.includes('Check-out')) {
      const time = lodgingActivity.lodgingTime?.checkOut;
      return `Check-out${time ? ` · ${format12Hour(time)}` : ''}`;
    }
    return 'Staying here tonight';
  }, [lodgingActivity]);

  return (
    <View style={styles.container}>
      {/* Header with Day Number and Actions */}
      <View style={styles.header}>
        <View style={styles.dayInfo}>
          <View style={styles.dayTitleRow}>
            <Text style={styles.dayTitle}>Day {dayNumber}</Text>
            <View style={styles.activityCountBadge}>
              <Text style={styles.activityCountBadgeText}>
                {activities.length} {activities.length === 1 ? 'place' : 'places'}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.actionButtons}>
          {/* Add Flight Button */}
          {onAddFlight && currentUserRole !== 'viewer' && (
            <TouchableOpacity
              style={styles.addFlightButton}
              onPress={() => onAddFlight?.()}
              activeOpacity={0.7}
            >
              <MaterialIcons name="flight" size={14} color="#F36406" />
              <Text style={styles.addFlightButtonText}>Add Flight</Text>
            </TouchableOpacity>
          )}
          {/* Add Hotel Button - show when no lodging exists and user can edit */}
          {onAddHotel && !lodgingActivity && currentUserRole !== 'viewer' && (
            <TouchableOpacity
              style={styles.addHotelButton}
              onPress={() => onAddHotel?.()}
              activeOpacity={0.7}
            >
              <MaterialIcons name="bed" size={14} color="#6366F1" />
              <Text style={styles.addHotelButtonText}>Add Stay</Text>
            </TouchableOpacity>
          )}
          {/* Optimize Route Button - commented out for now
          {onOptimizeRoute && activities.length > 2 && (
            <TouchableOpacity
              style={[styles.actionButton, styles.optimizeButton]}
              onPress={handleOptimizeRoute}
              disabled={activities.length < 2 || disabled}
            >
              <Text style={styles.optimizeButtonText}>Optimize Route</Text>
            </TouchableOpacity>
          )} */}
        </View>
      </View>

      {/* Hotel Summary Banner */}
      {lodgingActivity && (
        <TouchableOpacity
          style={styles.hotelBanner}
          onPress={() => onAddHotel?.(lodgingActivity)}
          activeOpacity={0.7}
        >
          <View style={styles.hotelBannerLeft}>
            <MaterialIcons name="bed" size={13} color="#6366F1" />
            <Text style={styles.hotelBannerName} numberOfLines={1}>{lodgingActivity.name}</Text>
          </View>
          <View style={styles.hotelBannerRight}>
            <Text style={styles.hotelBannerContext}>{hotelContextLabel}</Text>
            {hotelNights > 0 && (
              <View style={styles.hotelBannerDot} />
            )}
            {hotelNights > 0 && (
              <Text style={styles.hotelBannerNightsText}>{hotelNights} {hotelNights === 1 ? 'night' : 'nights'}</Text>
            )}
          </View>
        </TouchableOpacity>
      )}

      {/* Activities List - handles its own scrolling, SearchBar is inside at top */}
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
        activeTab={activeTab}
        currentUserRole={currentUserRole}
        onOpenSettings={onOpenSettings}
        onDelete={onDelete ? (activity) => onDelete(activity, dayNumber) : undefined}
        parentScrollViewRef={scrollViewRef}
        onScroll={(y) => onScrollPositionChange?.(y)}
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
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  dayInfo: {
    flex: 1,
  },
  dayTitleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  dayTitle: {
    fontFamily: 'outfit-bold',
    fontSize: 18,
    color: '#1A1A1A',
  },
  activityCountBadge: {
    // No background — just text
  },
  activityCountBadgeText: {
    fontFamily: 'outfit',
    fontSize: 13,
    color: '#A1A1AA',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  actionButton: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  optimizeButton: {
    backgroundColor: '#1A1A1A',
  },
  optimizeButtonText: {
    fontFamily: 'outfit-medium',
    fontSize: 12,
    color: '#FFFFFF',
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

  // Add Flight button
  addFlightButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FEDCBA',
  },
  addFlightButtonText: {
    fontFamily: 'outfit-medium',
    fontSize: 12,
    color: '#F36406',
  },

  // Add Hotel button
  addHotelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#F5F3FF',
    borderWidth: 1,
    borderColor: '#E0DBFF',
  },
  addHotelButtonText: {
    fontFamily: 'outfit-medium',
    fontSize: 12,
    color: '#6366F1',
  },

  // Hotel banner
  hotelBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F5F3FF',
    borderRadius: 10,
    paddingVertical: 7,
    paddingHorizontal: 10,
    marginBottom: 10,
    marginHorizontal: 2,
  },
  hotelBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexShrink: 1,
    marginRight: 8,
  },
  hotelBannerName: {
    fontFamily: 'outfit-bold',
    fontSize: 13,
    color: '#1A1A1A',
    flexShrink: 1,
  },
  hotelBannerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  hotelBannerContext: {
    fontFamily: 'outfit',
    fontSize: 11,
    color: '#8B85C1',
  },
  hotelBannerDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#C4B5FD',
  },
  hotelBannerNightsText: {
    fontFamily: 'outfit-medium',
    fontSize: 11,
    color: '#8B85C1',
  },
});
