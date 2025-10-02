import React, { useCallback, useState } from 'react';
import { ScrollView, View, StyleSheet, TouchableOpacity, Text, Linking } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  runOnJS,
  withTiming,
} from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { RouteLeg } from '../../../services/getRoute_graphQL_call';
import { Activity, ActivityListProps } from '../../../types/activity.types';
import { ActivityCard } from './activity_card';
import { NoActivities } from './no_activities';
import { Colors } from '../../../../constants/Colors';
import { formatDistance, formatDuration } from '../../../utils/routeUtils';
import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

// Helper function to get the appropriate icon based on travel mode
const getTravelModeIcon = (travelMode?: string) => {
  switch (travelMode) {
    case 'WALK':
      return <MaterialIcons name="directions-walk" size={17} color={Colors.PRIMARY} />;
    case 'TRANSIT':
      return <MaterialIcons name="directions-transit" size={17} color={Colors.PRIMARY} />;
    case 'DRIVE':
    default:
      return <MaterialCommunityIcons name="car-outline" size={17} color={Colors.PRIMARY} />;
  }
};

// Helper function to convert our travel modes to Google Maps travel modes
const getGoogleMapsTravelMode = (travelMode?: string): string => {
  switch (travelMode) {
    case 'DRIVE':
      return 'driving';
    case 'TRANSIT':
      return 'transit';
    case 'WALK':
      return 'walking';
    default:
      return 'driving'; // Default fallback
  }
};

// Route Info Card Component - Separate from draggable activity card
interface RouteInfoCardProps {
  nextActivityDistance: number;
  nextActivityDuration: string;
  nextActivity?: Activity;
  currentActivity?: Activity;
  travelMode?: string;
  isLoading?: boolean;
}

function RouteInfoCard({
  nextActivityDistance,
  nextActivityDuration,
  nextActivity,
  currentActivity,
  travelMode,
  isLoading = false,
}: RouteInfoCardProps) {
  const handleRoutePress = () => {
    if (!nextActivity || !currentActivity) return;

    const googleMapsTravelMode = getGoogleMapsTravelMode(travelMode);

    const createCoordinateUrl = () => {
      if (currentActivity.lat && currentActivity.lng && nextActivity.lat && nextActivity.lng) {
        const origin = `${currentActivity.lat},${currentActivity.lng}`;
        const destination = `${nextActivity.lat},${nextActivity.lng}`;
        return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=${googleMapsTravelMode}`;
      }
      return null;
    };

    if (currentActivity.name && nextActivity.name) {
      // Use activity names for better user experience
      const origin = encodeURIComponent(currentActivity.name);
      const destination = encodeURIComponent(nextActivity.name);
      const url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=${googleMapsTravelMode}`;

      Linking.openURL(url).catch(err => {
        console.error('Error opening Google Maps:', err);
        // Fallback to coordinates if name-based URL fails
        const fallbackUrl = createCoordinateUrl();
        if (fallbackUrl) {
          Linking.openURL(fallbackUrl);
        }
      });
    } else {
      // Use coordinates if names aren't available
      const url = createCoordinateUrl();
      if (url) {
        Linking.openURL(url).catch(err => {
          console.error('Error opening Google Maps:', err);
        });
      }
    }
  };

  return (
    <TouchableOpacity
      style={styles.routeInfo}
      onPress={handleRoutePress}
      activeOpacity={0.7}
      disabled={isLoading}
    >
      {isLoading ? (
        <Text style={styles.loadingText}>Loading...</Text>
      ) : (
        <>
          <View style={styles.routeInfoItem}>
            {getTravelModeIcon(travelMode)}
            <Text style={styles.routeInfoValue}>  {formatDuration(nextActivityDuration)}</Text>
          </View>
          <View style={styles.routeInfoItem}>
            <Text style={styles.routeMidDotLabel}>· </Text>
            <Text style={styles.routeInfoValue}>{formatDistance(nextActivityDistance)}</Text>
          </View>
          <FontAwesome5 name="chevron-right" size={18} color={Colors.PRIMARY} style={styles.chevronIcon} />
        </>
      )}
    </TouchableOpacity>
  );
}

interface EnhancedActivityListProps extends ActivityListProps {
  onActivityPress?: (activity: Activity) => void;
  onActivityLongPress?: (activity: Activity) => void;
  onDescriptionCardPress?: (activity: Activity) => void;
  showSelectionIndicator?: boolean;
  emptyStateTitle?: string;
  emptyStateSubtitle?: string;
  routeLegs?: RouteLeg[];
  scrollable?: boolean;
  travelMode?: string;
  enableDragDrop?: boolean; // New prop to enable drag and drop
  onReorder?: (newOrder: Activity[]) => void; // Callback for when activities are reordered
  routeLoading?: boolean; // Loading state for route recalculation
  hideRouteInfo?: boolean; // Hide route info cards
  wishlistActivities?: Activity[]; // Activities already in the wishlist for "On list" tag
}

export function ActivityList({
  activities,
  selectedActivities = [],
  onActivitySelect,
  onActivityDeselect,
  onActivityPress,
  onActivityLongPress,
  onDescriptionCardPress,
  variant = 'default',
  disabled = false,
  showSelectionIndicator = false,
  emptyStateTitle,
  emptyStateSubtitle,
  routeLegs = [],
  scrollable = true,
  travelMode,
  enableDragDrop = false,
  onReorder,
  routeLoading = false,
  hideRouteInfo = false,
  wishlistActivities = []
}: EnhancedActivityListProps) {
  // Always initialize state and callbacks (fix for hooks rule violation)
  const [currentActivities, setCurrentActivities] = useState(activities);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  

  // Route info cards are now always visible - no hide/show logic needed

  // Update local state when activities prop changes
  React.useEffect(() => {
    setCurrentActivities(activities);
  }, [activities]);

  // No cleanup needed - simplified without timers and state management

  // Drag and drop handlers - always define these
  const moveItem = useCallback((fromIndex: number, toIndex: number) => {
    const newActivities = [...currentActivities];
    const [movedItem] = newActivities.splice(fromIndex, 1);
    newActivities.splice(toIndex, 0, movedItem);
    setCurrentActivities(newActivities);
    if (onReorder) {
      onReorder(newActivities);
    }
  }, [currentActivities, onReorder]);

  // Simplified - no longPress handlers needed for route info management

  // Since we always have recommendations, we don't need empty state handling
  if (!activities || activities.length === 0) {
    // Only show empty state if title or subtitle is provided
    if (emptyStateTitle || emptyStateSubtitle) {
      return (
        <NoActivities
          title={emptyStateTitle}
          subtitle={emptyStateSubtitle}
        />
      );
    }
    // Return empty view if no empty state props provided
    return <View />;
  }

  const handleActivityPress = (activity: Activity) => {
    if (variant === 'selectable' && activity.place_id) {
      const isSelected = selectedActivities.includes(activity.place_id);
      if (isSelected && onActivityDeselect) {
        onActivityDeselect(activity.place_id);
      } else if (!isSelected && onActivitySelect) {
        onActivitySelect(activity.place_id);
      }
    } else if (onActivityPress) {
      onActivityPress(activity);
    }
  };

  const handleActivityLongPress = (activity: Activity) => {
    if (onActivityLongPress) {
      onActivityLongPress(activity);
    }
  };

  const shouldShowSelectionIndicator = showSelectionIndicator || variant === 'selectable';

  // Render activities with conditional wrapper based on drag & drop requirement
  const renderActivities = () => {
    return currentActivities.map((activity: Activity, index: number) => {
      const isSelected = activity.place_id ? selectedActivities.includes(activity.place_id) : false;
      const isLastActivity = index === currentActivities.length - 1;
      const routeLeg = routeLegs[index];
      const nextActivityDistance = routeLeg?.distance;
      const nextActivityDuration = routeLeg?.duration;
      const nextActivity = currentActivities[index + 1];

      // Check if this activity is already in the wishlist
      const isInWishlist = wishlistActivities.some(
        (wishlistActivity) => wishlistActivity.place_id === activity.place_id
      );

      // Common props for both draggable and regular cards
      const commonProps = {
        key: `activity-${index}-${activity.place_id || 'no-place-id'}`,
        activity,
        isSelected,
        onPress: handleActivityPress,
        onLongPress: handleActivityLongPress,
        onDescriptionCardPress,
        showSelectionIndicator: shouldShowSelectionIndicator,
        disabled,
        nextActivityDistance,
        nextActivityDuration,
        isLastActivity,
        nextActivity,
        travelMode,
        index,
        hideRouteInfo,
        duplicateActivityIndicator: isInWishlist,
      };

      if (enableDragDrop && scrollable) {
        return (
          <DraggableActivityCard
            {...commonProps}
            currentActivity={activity}
            onMove={moveItem}
            totalItems={currentActivities.length}
            isLoadingRoute={routeLoading}
            onDragStart={() => setDraggingIndex(index)}
            onDragEnd={() => setDraggingIndex(null)}
            isDraggingThisItem={draggingIndex === index}

          />
        );
      }

      return (
        <ActivityCard
          {...commonProps}
          style={styles.activityCard}
        />
      );
    });
  };

  

  // Choose container based on requirements
  if (enableDragDrop && scrollable) {
    return (
      <GestureHandlerRootView style={styles.container}>
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          {renderActivities()}
        </ScrollView>
      </GestureHandlerRootView>
    );
  }

  // Fallback to normal list
  const Container = scrollable ? ScrollView : View;
  const containerProps = scrollable
    ? { style: styles.container, contentContainerStyle: styles.contentContainer, showsVerticalScrollIndicator: false }
    : { style: styles.container };

  return (
    <Container {...containerProps}>
      {renderActivities()}
    </Container>
  );
}

// Draggable Activity Card Component
interface DraggableActivityCardProps {
  activity: Activity;
  index: number;
  isSelected: boolean;
  onPress: (activity: Activity) => void;
  onLongPress: (activity: Activity) => void;
  onDescriptionCardPress?: (activity: Activity) => void;
  showSelectionIndicator: boolean;
  disabled: boolean;
  nextActivityDistance?: number;
  nextActivityDuration?: string;
  isLastActivity: boolean;
  nextActivity?: Activity;
  currentActivity: Activity;
  travelMode?: string;
  onMove: (fromIndex: number, toIndex: number) => void;
  totalItems: number;
  isLoadingRoute?: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  isDraggingThisItem: boolean;
  hideRouteInfo?: boolean;
  duplicateActivityIndicator?: boolean;
}

function DraggableActivityCard({
  activity,
  index,
  isSelected,
  onPress,
  onLongPress,
  onDescriptionCardPress,
  showSelectionIndicator,
  disabled,
  nextActivityDistance,
  nextActivityDuration,
  isLastActivity,
  nextActivity,
  currentActivity,
  travelMode,
  onMove,
  totalItems,
  isLoadingRoute = false,
  onDragStart,
  onDragEnd,
  isDraggingThisItem,
  hideRouteInfo = false,
  duplicateActivityIndicator = false,
}: DraggableActivityCardProps) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const isDragging = useSharedValue(false);
  const scale = useSharedValue(1);
  const zIndex = useSharedValue(0);

  // Track the original position and target position
  const originalIndex = useSharedValue(index);
  const targetIndex = useSharedValue(index);

  const ITEM_HEIGHT = 169; // Total height: activity card (110px) + route info card (~54px) + margins (5px)
  const MOVEMENT_THRESHOLD = 1; // Card must be dragged at least 100% of ITEM_HEIGHT to trigger reorder

  // Update original index when component re-renders with new index
  React.useEffect(() => {
    if (!isDragging.value) {
      originalIndex.value = index;
      targetIndex.value = index;
    }
  }, [index]);

  

  const panGesture = Gesture.Pan()
    .minDistance(10) // Require 10px movement before pan gesture activates
    .onStart(() => {
      isDragging.value = true;
      scale.value = withSpring(1.05);
      zIndex.value = 1000;
      originalIndex.value = index;
      targetIndex.value = index;
      runOnJS(onDragStart)();
    })
    .onUpdate((event) => {
      translateY.value = event.translationY;

      // Calculate target index based on drag distance
      const dragDistance = event.translationY;
      const positionChange = Math.round(dragDistance / ITEM_HEIGHT);
      const newTargetIndex = Math.max(0, Math.min(totalItems - 1, originalIndex.value + positionChange));

      // Update target index for visual feedback (but don't reorder yet)
      targetIndex.value = newTargetIndex;
    })
    .onEnd((event) => {

      // Calculate the drag distance and check if it exceeds the threshold
      const dragDistance = Math.abs(event.translationY);
      const hasExceededThreshold = dragDistance >= (ITEM_HEIGHT * MOVEMENT_THRESHOLD);

      // Only trigger reorder if:
      // 1. The target position is different from original position
      // 2. The drag distance exceeds the movement threshold
      if (targetIndex.value !== originalIndex.value && hasExceededThreshold) {
        runOnJS(onMove)(originalIndex.value, targetIndex.value);

        // Animate back to default position after reordering
        translateY.value = withSpring(0, {
          damping: 15,
          stiffness: 150,
        });
        translateX.value = withSpring(0);
        scale.value = withSpring(1);
        isDragging.value = false;
        zIndex.value = 0;
        runOnJS(onDragEnd)();
      } else {

        // Reset target index since we're not reordering
        targetIndex.value = originalIndex.value;

        // IMPORTANT: Cancel any ongoing animations and reset immediately
        // This prevents the card from staying in a moved position
        translateY.value = 0;
        translateX.value = 0;
        scale.value = 1;
        isDragging.value = false;
        zIndex.value = 0;
        runOnJS(onDragEnd)();
      }
    });

  const animatedStyle = useAnimatedStyle(() => {
    const currentZIndex = isDragging.value ? 9999 : index;
    const currentElevation = isDragging.value ? 9999 : index;

    // Log z-index and elevation when dragging state changes
    if (isDragging.value) {

    }

    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: scale.value },
      ],
      zIndex: isDragging.value ? 9999 : index,
      elevation: isDragging.value ? 9999 : index,
    } as any;
  });

  return (
    <View style={[styles.draggableContainer, isDraggingThisItem && styles.draggingContainer]}>
      <GestureDetector gesture={panGesture}>
        <Animated.View style={[animatedStyle, styles.draggableCard]}>
          <ActivityCard
            activity={activity}
            isSelected={isSelected}
            onPress={onPress}
            onLongPress={onLongPress}
            onDescriptionCardPress={onDescriptionCardPress}
            showSelectionIndicator={showSelectionIndicator}
            disabled={disabled}
            style={styles.activityCard}
            index={index}
            nextActivityDistance={nextActivityDistance}
            nextActivityDuration={nextActivityDuration}
            isLastActivity={isLastActivity}
            nextActivity={nextActivity}
            travelMode={travelMode}
            hideRouteInfo={true} // Hide route info in draggable card - rendered separately below
            duplicateActivityIndicator={duplicateActivityIndicator}
          />
        </Animated.View>
      </GestureDetector>

      {/* Route info card - rendered separately, not draggable - Always render to prevent disappearing */}
      {!hideRouteInfo && !isLastActivity && (
        <RouteInfoCard
          nextActivityDistance={nextActivityDistance || 0}
          nextActivityDuration={nextActivityDuration || ''}
          nextActivity={nextActivity}
          currentActivity={currentActivity}
          travelMode={travelMode}
          isLoading={isLoadingRoute}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  contentContainer: {
    paddingBottom: 20,
  },
  activityCard: {
    marginBottom: 12,
  },
  draggableContainer: {
    marginBottom: 12,
  },
  draggingContainer: {
    zIndex: 9999,
    elevation: 9999,
  },
  draggableCard: {
    marginBottom: -10, // negative margin between activity card and route info
  },
  routeInfo: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 6,
    marginTop: 4,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e9ecef',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  routeInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 9,
  },
  routeMidDotLabel: {
    fontFamily: 'outfit',
    fontSize: 24,
    color: Colors.PRIMARY,
    marginLeft: -2,
  },
  routeInfoValue: {
    fontFamily: 'outfit-medium',
    fontSize: 13,
    color: Colors.PRIMARY,
  },
  chevronIcon: {
    marginLeft: 8,
  },
  loadingText: {
    fontFamily: 'outfit',
    fontSize: 22,
    color: Colors.GRAY,
  },
});