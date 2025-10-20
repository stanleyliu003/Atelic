/**
 * ActivityList Component with Drag & Drop Auto-Scroll
 * 
 * Key Implementation Details:
 * 
 * 🎯 AUTO-SCROLL DURING DRAG:
 * - Uses Reanimated's `scrollTo()` on UI thread instead of React Native's `.scrollTo()` method
 * - This bypasses gesture blocking: active PanGesture blocks RN's JS-thread scrollTo
 * - Solution: RAF loop calls `runOnUI(performScrollWorklet)` which uses Reanimated's scrollTo
 * - Both gesture and scroll run on UI thread, allowing them to co-exist
 * 
 * 📐 ARCHITECTURE:
 * - Edge detection: useAnimatedReaction (UI thread) → detects when drag enters edge zones
 * - Auto-scroll loop: requestAnimationFrame (JS thread) → calculates scroll position
 * - Scroll execution: runOnUI → performScrollWorklet (UI thread) → Reanimated scrollTo
 * 
 * ✅ VERIFIED BY TESTS:
 * - Test 1: Manual button scrolling works (no active gesture)
 * - Test 2: Ref properly attached, RAF loop runs correctly
 * - Test 3: During drag, RN's scrollTo was blocked (no onScroll events)
 * - Solution: Reanimated's scrollTo works during active gesture!
 */
import React, { useCallback, useState } from 'react';
import { ScrollView, View, StyleSheet, TouchableOpacity, Text, Linking, findNodeHandle, UIManager } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  runOnJS,
  withTiming,
  useAnimatedReaction,
  SharedValue,
  useAnimatedRef,
  scrollTo,
  runOnUI,
  AnimatedRef,
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
  emptyStateActionPress?: () => void; // Action button callback for empty state
  emptyStateActionText?: string; // Action button text for empty state
  routeLegs?: RouteLeg[];
  scrollable?: boolean;
  travelMode?: string;
  enableDragDrop?: boolean; // New prop to enable drag and drop
  onReorder?: (newOrder: Activity[]) => void; // Callback for when activities are reordered
  routeLoading?: boolean; // Loading state for route recalculation
  hideRouteInfo?: boolean; // Hide route info cards
  wishlistActivities?: Activity[]; // Activities already in the wishlist for "On list" tag
  useInlineSelectionLayout?: boolean; // Use inline layout for wishlist (not absolute positioned)
  parentScrollViewRef?: React.RefObject<ScrollView> | AnimatedRef<Animated.ScrollView>; // External ScrollView ref for nested scroll control
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
  emptyStateActionPress,
  emptyStateActionText,
  routeLegs = [],
  scrollable = true,
  travelMode,
  enableDragDrop = false,
  onReorder,
  routeLoading = false,
  hideRouteInfo = false,
  wishlistActivities = [],
  useInlineSelectionLayout = false,
  parentScrollViewRef
}: EnhancedActivityListProps) {
  // Always initialize state and callbacks (fix for hooks rule violation)
  const [currentActivities, setCurrentActivities] = useState(activities);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);

  // Shared animated values for coordinated card shifting
  const targetDropIndex = useSharedValue<number>(-1);
  const activeDragIndex = useSharedValue<number>(-1);

  // Auto-scroll infrastructure
  // Use parent ref if provided, otherwise create own ref
  // Using useAnimatedRef for Reanimated's scrollTo compatibility
  const ownScrollViewRef = useAnimatedRef<Animated.ScrollView>();
  // Cast to any to handle both regular and animated refs
  const scrollViewRef = (parentScrollViewRef || ownScrollViewRef) as any;
  const scrollViewLayout = useSharedValue({ y: 0, height: 0 });
  const currentScrollY = useSharedValue(0);
  const dragAbsoluteY = useSharedValue(-1);
  const autoScrollInterval = React.useRef<number | null>(null);
  const lastScrollTime = React.useRef(Date.now());
  

  // Route info cards are now always visible - no hide/show logic needed

  // Update local state when activities prop changes
  React.useEffect(() => {
    setCurrentActivities(activities);
  }, [activities]);

  // Auto-scroll state
  const autoScrollDirection = React.useRef<'up' | 'down' | 'none'>('none');
  const autoScrollSpeed = React.useRef<number>(0);

  // Worklet function to perform scroll on UI thread
  // This bypasses gesture blocking by staying on UI thread
  const performScrollWorklet = useCallback((offset: number) => {
    'worklet';
    // 🎯 This is the key: Reanimated's scrollTo runs on UI thread
    // It can scroll even when a gesture has control, unlike RN's scrollTo
    scrollTo(scrollViewRef, 0, offset, false);
  }, [scrollViewRef]);

  // Auto-scroll functions
  const startAutoScroll = useCallback((direction: 'up' | 'down', speed: number) => {
    // Update speed if already running in same direction
    if (autoScrollInterval.current !== null) {
      if (autoScrollDirection.current === direction) {
        // Just update speed, don't restart
        autoScrollSpeed.current = speed;
        return;
      } else {
        // Direction changed, stop and restart
        console.log('🔄 [AUTO-SCROLL] Direction changed, restarting');
        cancelAnimationFrame(autoScrollInterval.current);
        autoScrollInterval.current = null;
      }
    }

    console.log(`▶️ [AUTO-SCROLL] STARTED - Direction: ${direction}, Speed: ${speed.toFixed(2)}px/frame`);
    autoScrollDirection.current = direction;
    autoScrollSpeed.current = speed;

    const scroll = () => {
      const now = Date.now();
      const deltaTime = (now - lastScrollTime.current) / 16.67; // Normalize to 60fps
      lastScrollTime.current = now;

      const currentOffset = currentScrollY.value;
      const currentSpeed = autoScrollSpeed.current;
      const currentDirection = autoScrollDirection.current;

      // Calculate content bounds
      const ITEM_HEIGHT = 169;
      const contentHeight = currentActivities.length * ITEM_HEIGHT;
      const viewHeight = scrollViewLayout.value.height;
      const maxScroll = Math.max(0, contentHeight - viewHeight);

      const delta = currentSpeed * deltaTime;
      let newOffset = currentDirection === 'up'
        ? currentOffset - delta
        : currentOffset + delta;

      // Clamp to valid scroll range
      newOffset = Math.max(0, Math.min(maxScroll, newOffset));

      // Use Reanimated's scrollTo on UI thread to bypass gesture blocking
      runOnUI(performScrollWorklet)(newOffset);

      // Update shared value for next iteration
      currentScrollY.value = newOffset;

      // Log the boundaries for debugging
      if (newOffset === 0 || newOffset === maxScroll) {
        console.log(`🛑 [AUTO-SCROLL] Reached ${newOffset === 0 ? 'top' : 'bottom'} boundary`);
      }

      autoScrollInterval.current = requestAnimationFrame(scroll);
    };

    lastScrollTime.current = Date.now();
    scroll();
  }, [currentActivities.length, performScrollWorklet]);

  const stopAutoScroll = useCallback(() => {
    if (autoScrollInterval.current !== null) {
      console.log('⏹️ [AUTO-SCROLL] STOPPED - Called from:', new Error().stack?.split('\n')[2]);
      cancelAnimationFrame(autoScrollInterval.current);
      autoScrollInterval.current = null;
      autoScrollDirection.current = 'none';
      autoScrollSpeed.current = 0;
    } else {
      console.log('⏹️ [AUTO-SCROLL] STOPPED called but already stopped');
    }
  }, []);

  // Cleanup on unmount
  React.useEffect(() => {
    return () => stopAutoScroll();
  }, [stopAutoScroll]);

  // ScrollView handlers
  const handleScrollViewLayout = useCallback((event: any) => {
    const { height } = event.nativeEvent.layout;

    // Measure actual screen position using UIManager
    const handle = findNodeHandle(scrollViewRef.current);
    if (handle) {
      UIManager.measureInWindow(handle, (_x: number, y: number, _width: number, _height: number) => {
        scrollViewLayout.value = { y, height };

        // Calculate scrollable content
        const ITEM_HEIGHT = 169;
        const contentHeight = currentActivities.length * ITEM_HEIGHT;
        const maxScroll = Math.max(0, contentHeight - height);

        console.log(`📐 [LAYOUT] ScrollView Y: ${y.toFixed(1)}, Height: ${height.toFixed(1)}`);
        console.log(`📏 [LAYOUT] Content: ${contentHeight.toFixed(1)}px, Max scroll: ${maxScroll.toFixed(1)}px, Activities: ${currentActivities.length}`);
      });
    }
  }, [currentActivities.length]);

  const handleScroll = useCallback((event: any) => {
    const newScrollY = event.nativeEvent.contentOffset.y;

    // Only update if not auto-scrolling (to avoid overwriting RAF loop updates)
    if (autoScrollDirection.current === 'none') {
      currentScrollY.value = newScrollY;
    }
  }, []);

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
    // Only show empty state if action button is provided
    if (emptyStateActionPress) {
      return (
        <NoActivities
          onActionPress={emptyStateActionPress}
          actionButtonText={emptyStateActionText}
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
        useInlineSelectionLayout,
      };

      if (enableDragDrop && scrollable) {
        return (
          <DraggableActivityCard
            {...commonProps}
            currentActivity={activity}
            cardIndex={index}
            onMove={moveItem}
            totalItems={currentActivities.length}
            isLoadingRoute={routeLoading}
            onDragStart={() => setDraggingIndex(index)}
            onDragEnd={() => setDraggingIndex(null)}
            isDraggingThisItem={draggingIndex === index}
            targetDropIndex={targetDropIndex}
            activeDragIndex={activeDragIndex}
            dragAbsoluteY={dragAbsoluteY}
            scrollViewLayout={scrollViewLayout}
            currentScrollY={currentScrollY}
            startAutoScroll={startAutoScroll}
            stopAutoScroll={stopAutoScroll}
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
        <Animated.ScrollView
          ref={scrollViewRef}
          style={[styles.container, { maxHeight: 800 }]} // TEMP: Force scrolling for testing
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
          onLayout={handleScrollViewLayout}
          onScroll={handleScroll}
          scrollEventThrottle={16}
        >
          {renderActivities()}
        </Animated.ScrollView>
      </GestureHandlerRootView>
    );
  }

  // Drag & drop enabled but using parent ScrollView
  if (enableDragDrop && !scrollable && parentScrollViewRef) {
    return (
      <GestureHandlerRootView style={styles.container}>
        <View
          style={styles.container}
          onLayout={handleScrollViewLayout}
        >
          {renderActivities()}
        </View>
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
  cardIndex: number; // Explicit card index for shift calculations
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
  useInlineSelectionLayout?: boolean;
  targetDropIndex: Animated.SharedValue<number>; // Shared state for coordinated shifting
  activeDragIndex: Animated.SharedValue<number>; // Shared state for active drag
  dragAbsoluteY: Animated.SharedValue<number>; // Absolute Y position during drag
  scrollViewLayout: Animated.SharedValue<{ y: number; height: number }>; // ScrollView position and size
  currentScrollY: Animated.SharedValue<number>; // Current scroll offset
  startAutoScroll: (direction: 'up' | 'down', speed: number) => void; // Start auto-scroll
  stopAutoScroll: () => void; // Stop auto-scroll
}

const DraggableActivityCard = React.memo(function DraggableActivityCard({
  activity,
  index,
  cardIndex,
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
  useInlineSelectionLayout = false,
  targetDropIndex,
  activeDragIndex,
  dragAbsoluteY,
  scrollViewLayout,
  currentScrollY,
  startAutoScroll,
  stopAutoScroll,
}: DraggableActivityCardProps) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const isDragging = useSharedValue(false);
  const scale = useSharedValue(1);
  const zIndex = useSharedValue(0);
  const [isGripPressed, setIsGripPressed] = React.useState(false);

  // Shift offset for non-dragged cards to make space
  const shiftOffset = useSharedValue(0);

  // Track the original position
  const originalIndex = useSharedValue(index);

  const ITEM_HEIGHT = 169; // Total height: activity card (110px) + route info card (~54px) + margins (5px)
  const MOVEMENT_THRESHOLD = 0.3; // Card must be dragged at least 30% of ITEM_HEIGHT to trigger reorder (~51px)

  // Update original index when component re-renders with new index
  React.useEffect(() => {
    if (!isDragging.value) {
      originalIndex.value = cardIndex;
    }
  }, [cardIndex]);

  const handleGripPress = () => {
    setIsGripPressed(true);
  };

  // Calculate shift offset for non-dragged cards
  // This function determines if and how much a card should shift to make space
  const calculateShiftOffset = (
    myIndex: number,
    draggedIndex: number,
    targetIndex: number
  ): number => {
    'worklet';

    // Not dragging? No shift
    if (draggedIndex === -1) return 0;

    // I'm the dragged card? Don't shift myself
    if (myIndex === draggedIndex) return 0;

    // Dragging DOWN (e.g., index 0 → 3)
    if (targetIndex > draggedIndex) {
      // Cards between original and target shift UP
      if (myIndex > draggedIndex && myIndex <= targetIndex) {
        return -ITEM_HEIGHT; // Shift up by one slot
      }
    }

    // Dragging UP (e.g., index 3 → 0)
    if (targetIndex < draggedIndex) {
      // Cards between target and original shift DOWN
      if (myIndex < draggedIndex && myIndex >= targetIndex) {
        return ITEM_HEIGHT; // Shift down by one slot
      }
    }

    return 0; // No shift needed
  };

  // React to drag state changes and animate shift offset
  useAnimatedReaction(
    () => ({
      dragging: activeDragIndex.value,
      target: targetDropIndex.value,
    }),
    ({ dragging, target }) => {
      const offset = calculateShiftOffset(cardIndex, dragging, target);
      shiftOffset.value = withSpring(offset, {
        damping: 20,      // Smooth but responsive
        stiffness: 180,   // Slightly snappy
        mass: 0.8,        // Light feel
      });
    }
  );

  // Edge detection and auto-scroll trigger
  useAnimatedReaction(
    () => {
      const isBeingDragged = activeDragIndex.value === cardIndex;
      if (!isBeingDragged) return { direction: 'none' as const, speed: 0, debug: '' };

      const EDGE_ZONE = 120;  // 120px from top/bottom triggers scroll (larger for better UX)
      const MAX_SPEED = 15;  // Maximum scroll speed (px per frame)

      const dragY = dragAbsoluteY.value;
      const svTop = scrollViewLayout.value.y;
      const svBottom = svTop + scrollViewLayout.value.height;

      const distFromTop = dragY - svTop;
      const distFromBottom = svBottom - dragY;

      // Check top zone (scroll up)
      if (distFromTop < EDGE_ZONE && distFromTop > 0) {
        const ratio = 1 - (distFromTop / EDGE_ZONE);
        const speed = Math.max(2, MAX_SPEED * ratio);
        return {
          direction: 'up' as const,
          speed,
          debug: `dragY: ${dragY.toFixed(1)}, svTop: ${svTop.toFixed(1)}, distFromTop: ${distFromTop.toFixed(1)}, ratio: ${ratio.toFixed(2)}`
        };
      }

      // Check bottom zone (scroll down)
      if (distFromBottom < EDGE_ZONE && distFromBottom > 0) {
        const ratio = 1 - (distFromBottom / EDGE_ZONE);
        const speed = Math.max(2, MAX_SPEED * ratio);
        return {
          direction: 'down' as const,
          speed,
          debug: `dragY: ${dragY.toFixed(1)}, svBottom: ${svBottom.toFixed(1)}, distFromBottom: ${distFromBottom.toFixed(1)}, ratio: ${ratio.toFixed(2)}`
        };
      }

      return { direction: 'none' as const, speed: 0, debug: `dragY: ${dragY.toFixed(1)}, svTop: ${svTop.toFixed(1)}, svBottom: ${svBottom.toFixed(1)}, distTop: ${distFromTop.toFixed(1)}, distBottom: ${distFromBottom.toFixed(1)}` };
    },
    (result, previous) => {
      // Only trigger start/stop when direction CHANGES (not every frame!)
      const directionChanged = result.direction !== previous?.direction;

      if (directionChanged) {
        // Log when state changes
        if (result.direction !== 'none') {
          console.log(`🎯 [EDGE-DETECT] Entering ${result.direction} zone | ${result.debug}`);
          // Start auto-scroll
          runOnJS(startAutoScroll)(result.direction, result.speed);
        } else {
          console.log(`🎯 [EDGE-DETECT] Exiting edge zone | ${result.debug}`);
          // Stop auto-scroll
          runOnJS(stopAutoScroll)();
        }
      } else if (result.direction !== 'none') {
        // Direction hasn't changed but we're still in a zone - update speed
        runOnJS(startAutoScroll)(result.direction, result.speed);
      }

      // Log debug info when not in zone (only occasionally to avoid spam)
      if (result.direction === 'none' && previous?.direction === 'none' && result.debug) {
        if (Math.random() < 0.05) { // 5% of the time
          console.log(`🔍 [EDGE-DETECT] Outside zones | ${result.debug}`);
        }
      }
    }
  );

  const longPressGesture = Gesture.LongPress()
    .minDuration(150) // 200ms
    .onStart(() => {
      runOnJS(setIsGripPressed)(true);
    });

  const panGesture = Gesture.Pan()
    .enabled(isGripPressed) // Only enable pan gesture when grip is pressed or long press activated
    .minDistance(5) // Reduced threshold since grip is intentional
    .onStart(() => {
      console.log(`🎬 [DRAG] Started dragging card ${cardIndex}`);
      isDragging.value = true;
      scale.value = withSpring(1.05, {
        damping: 12,
        stiffness: 200,
      });
      zIndex.value = 1000;
      originalIndex.value = cardIndex;
      activeDragIndex.value = cardIndex; // Broadcast that this card is being dragged
      targetDropIndex.value = cardIndex; // Initial target is current position
      runOnJS(onDragStart)();
    })
    .onUpdate((event) => {
      translateY.value = event.translationY;

      // Update absolute Y position for edge detection
      // Use absoluteY from event if available, otherwise calculate
      if (event.absoluteY !== undefined) {
        dragAbsoluteY.value = event.absoluteY;
        // Log occasionally to track position (every 50px movement)
        if (Math.abs(event.translationY) % 50 < 5) {
          console.log(`👆 [DRAG] absoluteY: ${event.absoluteY.toFixed(1)}, translationY: ${event.translationY.toFixed(1)}`);
        }
      } else {
        // Log if absoluteY is not available
        console.log('⚠️ [DRAG] event.absoluteY is undefined - edge detection may not work');
      }

      // Calculate target index based on drag distance
      const dragDistance = event.translationY;
      const positionChange = Math.round(dragDistance / ITEM_HEIGHT);
      const newTargetIndex = Math.max(0, Math.min(totalItems - 1, originalIndex.value + positionChange));

      // Broadcast target index to all cards for coordinated shifting
      if (newTargetIndex !== targetDropIndex.value) {
        console.log(`🎯 [DRAG] Target index changed: ${targetDropIndex.value} → ${newTargetIndex}`);
        targetDropIndex.value = newTargetIndex;
      }
    })
    .onEnd((event) => {
      console.log(`🏁 [DRAG] Ended dragging card ${cardIndex}`);

      // Stop auto-scroll when drag ends
      runOnJS(stopAutoScroll)();
      dragAbsoluteY.value = -1;

      // Calculate the drag distance and check if it exceeds the threshold
      const dragDistance = Math.abs(event.translationY);
      const hasExceededThreshold = dragDistance >= (ITEM_HEIGHT * MOVEMENT_THRESHOLD);

      // Only trigger reorder if:
      // 1. The target position is different from original position
      // 2. The drag distance exceeds the movement threshold
      if (targetDropIndex.value !== originalIndex.value && hasExceededThreshold) {
        runOnJS(onMove)(originalIndex.value, targetDropIndex.value);

        // Animate back to default position after reordering
        translateY.value = withSpring(0, {
          damping: 15,
          stiffness: 150,
        });
        translateX.value = withSpring(0);
        scale.value = withSpring(1);
        isDragging.value = false;
        zIndex.value = 0;

        // Reset shared drag state
        activeDragIndex.value = -1;
        targetDropIndex.value = -1;

        runOnJS(onDragEnd)();
        runOnJS(setIsGripPressed)(false); // Reset grip state
      } else {

        // IMPORTANT: Cancel any ongoing animations and reset immediately
        // This prevents the card from staying in a moved position
        translateY.value = 0;
        translateX.value = 0;
        scale.value = 1;
        isDragging.value = false;
        zIndex.value = 0;

        // Reset shared drag state
        activeDragIndex.value = -1;
        targetDropIndex.value = -1;

        runOnJS(onDragEnd)();
        runOnJS(setIsGripPressed)(false); // Reset grip state
      }
    })
    .onFinalize(() => {
      // Called on cancel, end, or fail - ensure cleanup
      console.log(`🧹 [DRAG] Finalized (cleanup) for card ${cardIndex}`);
      runOnJS(stopAutoScroll)();
      dragAbsoluteY.value = -1;
    });

  const animatedStyle = useAnimatedStyle(() => {
    const isBeingDragged = activeDragIndex.value === cardIndex;

    return {
      transform: [
        { translateX: translateX.value },
        {
          translateY: isBeingDragged
            ? translateY.value        // Dragged card: follow finger
            : shiftOffset.value       // Other cards: shift to make space
        },
        { scale: scale.value },
      ],
      zIndex: isBeingDragged ? 9999 : cardIndex,
      elevation: isBeingDragged ? 9999 : cardIndex,
    } as any;
  });

  // Route card animated style - shifts with activity card but doesn't follow drag
  const routeCardAnimatedStyle = useAnimatedStyle(() => {
    const isBeingDragged = activeDragIndex.value === cardIndex;
    const isAnyCardBeingDragged = activeDragIndex.value !== -1;

    // Route card only shifts when parent activity shifts
    // Don't follow drag, only follow shift
    // Hide all route cards when any card is being dragged
    return {
      transform: [
        { translateY: isBeingDragged ? 0 : shiftOffset.value }
      ],
      opacity: withTiming(isAnyCardBeingDragged ? 0 : 1, {
        duration: 150, // Fast fade out/in
      }),
      height: isAnyCardBeingDragged ? 0 : undefined,
    };
  });

  const composedGesture = Gesture.Simultaneous(longPressGesture, panGesture);

  return (
    <View style={[styles.draggableContainer, isDraggingThisItem && styles.draggingContainer]}>
      <GestureDetector gesture={composedGesture}>
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
            enableDragDrop={true}
            onGripPress={handleGripPress}
            useInlineSelectionLayout={useInlineSelectionLayout}
          />
        </Animated.View>
      </GestureDetector>

      {/* Route info card - rendered separately with shift animation */}
      {!hideRouteInfo && !isLastActivity && (
        <Animated.View style={[routeCardAnimatedStyle]}>
          <RouteInfoCard
            nextActivityDistance={nextActivityDistance || 0}
            nextActivityDuration={nextActivityDuration || ''}
            nextActivity={nextActivity}
            currentActivity={currentActivity}
            travelMode={travelMode}
            isLoading={isLoadingRoute}
          />
        </Animated.View>
      )}
    </View>
  );
});

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