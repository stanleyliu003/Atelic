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
 * 🔄 SCROLL COMPENSATION:
 * - When autoscroll occurs, the dragged card's position must compensate for the scroll delta
 * - Track initialScrollY when drag starts, calculate scrollDelta = currentScrollY - initialScrollY
 * - Apply: translateY = gestureTranslation + scrollDelta (ADD, not subtract!)
 * - When scrolling DOWN (scrollY↑), content moves UP → add positive delta to move card DOWN
 * - When scrolling UP (scrollY↓), content moves DOWN → add negative delta to move card UP
 * - This keeps the card locked under the user's finger even as content scrolls
 * - CRITICAL: Target index calculation must use effectiveDragDistance = translationY + scrollDelta
 * - Otherwise, visual position and reorder logic are out of sync!
 * 
 * 📊 MAX SCROLL CALCULATION:
 * - maxScroll = contentHeight - viewHeight (includes SearchBar at bottom)
 * - SearchBar is scrollable content, not a boundary restriction
 * - Previous bug: Excluding SearchBar caused currentScrollY > maxScroll, breaking compensation
 * - Fix: Include all content in maxScroll to prevent clamping issues
 * 
 * 📐 ARCHITECTURE:
 * - Edge detection: useAnimatedReaction (UI thread) → detects when drag enters edge zones
 * - Auto-scroll loop: requestAnimationFrame (JS thread) → calculates scroll position
 * - Scroll execution: runOnUI → performScrollWorklet (UI thread) → Reanimated scrollTo
 * - Position compensation: animatedStyle → add scrollDelta to translateY
 * 
 * ✅ VERIFIED BY TESTS:
 * - Test 1: Manual button scrolling works (no active gesture)
 * - Test 2: Ref properly attached, RAF loop runs correctly
 * - Test 3: During drag, RN's scrollTo was blocked (no onScroll events)
 * - Solution: Reanimated's scrollTo works during active gesture!
 */
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, View, StyleSheet, TouchableOpacity, Text, Linking, findNodeHandle, UIManager, Platform, ActionSheetIOS } from 'react-native';
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
import { Activity, ActivityListProps, EnhancedRouteLeg } from '../../../types/activity.types';
import { ActivityCard } from './activity_card';
import { NoActivities } from './no_activities';
import { Colors } from '../../../../constants/Colors';
import { formatDistance, formatDuration } from '../../../utils/routeUtils';
import { SearchBar } from '../../explore/SearchBar';
import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import Ionicons from '@expo/vector-icons/Ionicons';

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
  activityIndex: number;
  onOpenSettings: (legIndex: number) => void;
}

function RouteInfoCard({
  nextActivityDistance,
  nextActivityDuration,
  nextActivity,
  currentActivity,
  travelMode,
  isLoading = false,
  activityIndex,
  onOpenSettings,
}: RouteInfoCardProps) {
  const openGoogleMaps = async () => {
    try {
      if (!currentActivity || !nextActivity) {
        console.error('[RouteCard] Missing origin or destination');
        return;
      }

      if (!currentActivity.lat || !currentActivity.lng || !nextActivity.lat || !nextActivity.lng) {
        console.error('[RouteCard] Missing coordinates');
        return;
      }

      const googleMapsTravelMode = getGoogleMapsTravelMode(travelMode);

      // Google Maps URL scheme accepts: "lat,lng" OR "address string"
      // Priority: formatted_address (shows readable names) > coordinates (precision)
      // formatted_address provides better UX in Google Maps UI
      const originParam = currentActivity.formatted_address
        ? encodeURIComponent(currentActivity.formatted_address)
        : `${currentActivity.lat},${currentActivity.lng}`;
      const destinationParam = nextActivity.formatted_address
        ? encodeURIComponent(nextActivity.formatted_address)
        : `${nextActivity.lat},${nextActivity.lng}`;

      // Try Google Maps app first
      const googleMapsAppUrl = `comgooglemaps://?saddr=${originParam}&daddr=${destinationParam}&directionsmode=${googleMapsTravelMode}`;
      console.log('[RouteCard] Google Maps App URL:', googleMapsAppUrl);

      const canOpenGoogleMaps = await Linking.canOpenURL(googleMapsAppUrl);

      if (canOpenGoogleMaps) {
        await Linking.openURL(googleMapsAppUrl);
        console.log('[RouteCard] Opened Google Maps app');
      } else {
        // Fallback to Google Maps web - hierarchy: place_id > coordinates
        let webUrl;
        if (currentActivity.place_id && nextActivity.place_id) {
          // Best: Use place_id for most accurate results (avoids ambiguity with chain stores)
          webUrl = `https://www.google.com/maps/dir/?api=1&origin=place_id:${currentActivity.place_id}&destination=place_id:${nextActivity.place_id}&travelmode=${googleMapsTravelMode}`;
          console.log('[RouteCard] Using place_id for Google Maps web');
        } else {
          // Use coordinates for precision - formatted_address is ambiguous for chain stores/restaurants
          webUrl = `https://www.google.com/maps/dir/?api=1&origin=${currentActivity.lat},${currentActivity.lng}&destination=${nextActivity.lat},${nextActivity.lng}&travelmode=${googleMapsTravelMode}`;
          console.log('[RouteCard] Using coordinates for Google Maps web (no place_id available)');
        }
        console.log('[RouteCard] Google Maps Web URL:', webUrl);
        await Linking.openURL(webUrl);
        console.log('[RouteCard] Opened Google Maps web');
      }
    } catch (error) {
      console.error('[RouteCard] Error opening Google Maps:', error);
    }
  };

  const openAppleMaps = async () => {
    try {
      if (!currentActivity || !nextActivity) {
        console.error('[RouteCard] Missing origin or destination');
        return;
      }

      if (!currentActivity.lat || !currentActivity.lng || !nextActivity.lat || !nextActivity.lng) {
        console.error('[RouteCard] Missing coordinates');
        return;
      }

      // Use coordinates for precision - Apple Maps auto-resolves to place names
      const originParam = `${currentActivity.lat},${currentActivity.lng}`;
      const destinationParam = `${nextActivity.lat},${nextActivity.lng}`;

      // Convert travel mode to direction flag
      const directionFlag = travelMode === 'DRIVE' ? 'd' : travelMode === 'WALK' ? 'w' : 'r';
      const appleMapsUrl = `maps://?saddr=${originParam}&daddr=${destinationParam}&dirflg=${directionFlag}`;
      console.log('[RouteCard] Apple Maps URL:', appleMapsUrl);

      await Linking.openURL(appleMapsUrl);
      console.log('[RouteCard] Opened Apple Maps');
    } catch (error) {
      console.error('[RouteCard] Error opening Apple Maps:', error);
    }
  };

  const handleRoutePress = () => {
    if (!nextActivity || !currentActivity) return;

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Google Maps', 'Apple Maps'],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) {
            // Add delay to allow ActionSheet to fully dismiss before opening external app
            // Longer delay (400ms) to ensure smooth transition and prevent UI freeze
            setTimeout(() => {
              openGoogleMaps().catch(err => console.error('[RouteCard] Error in delayed Google Maps open:', err));
            }, 400);
          } else if (buttonIndex === 2) {
            setTimeout(() => {
              openAppleMaps().catch(err => console.error('[RouteCard] Error in delayed Apple Maps open:', err));
            }, 400);
          }
        }
      );
    } else {
      // Default to Google Maps on Android
      openGoogleMaps();
    }
  };

  const handleSettingsPress = () => {
    // Open the transportation mode selector modal
    onOpenSettings(activityIndex);
  };

  return (
    <View style={styles.routeCard}>
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      ) : (
        <>
          {/* Left: Route Info + Dropdown Button */}
          <TouchableOpacity
            style={styles.routeMainButton}
            onPress={handleSettingsPress}
            activeOpacity={0.7}
          >
            {getTravelModeIcon(travelMode)}
            <Text style={styles.routeInfoValue}>{formatDuration(nextActivityDuration)}</Text>
            <Text style={styles.routeMidDotLabel}>•</Text>
            <Text style={styles.routeInfoValue}>{formatDistance(nextActivityDistance)}</Text>
            <FontAwesome5 name="chevron-down" size={14} color="#8E8E93" style={styles.chevronIcon} />
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.routeDivider} />

          {/* Right: Directions Button */}
          <TouchableOpacity
            style={styles.directionsButton}
            onPress={handleRoutePress}
            activeOpacity={0.7}
          >
            <Text style={styles.directionsText}>Directions</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

interface EnhancedActivityListProps extends ActivityListProps {
  onActivityPress?: (activity: Activity) => void;
  onActivityLongPress?: (activity: Activity) => void;
  onDescriptionCardPress?: (activity: Activity) => void;
  showSelectionIndicator?: boolean;
  emptyStateActionPress?: () => void; // Action button callback for empty state
  emptyStateActionText?: string; // Action button text for empty state
  routeLegs?: EnhancedRouteLeg[];
  scrollable?: boolean;
  travelMode?: string;
  enableDragDrop?: boolean; // New prop to enable drag and drop
  onReorder?: (newOrder: Activity[]) => void; // Callback for when activities are reordered
  routeLoading?: boolean; // Loading state for route recalculation
  hideRouteInfo?: boolean; // Hide route info cards
  wishlistActivities?: Activity[]; // Activities already in the wishlist for "On list" tag
  onOpenSettings?: (legIndex: number) => void; // Callback for opening transportation settings
  useInlineSelectionLayout?: boolean; // Use inline layout for wishlist (not absolute positioned)
  parentScrollViewRef?: React.RefObject<ScrollView> | AnimatedRef<Animated.ScrollView>; // External ScrollView ref for nested scroll control
  onAddPlace?: () => void; // Search bar trigger
  searchQuery?: string; // Search query value
  onSearchQueryChange?: (text: string) => void; // Search query change handler
  onDuplicate?: (activity: Activity, targetDayNumber?: number) => void; // Callback for duplicating an activity
  isAddingPlaceFromAutocomplete?: boolean; // Show inline loading row below last activity
  activeTab?: string; // Current active tab (wishlist or day#)
  hideNotesButton?: boolean; // Hide the notes button (e.g., in CategoryModal)
  currentUserRole?: 'owner' | 'editor' | 'viewer'; // User's role for permission control
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
  parentScrollViewRef,
  onAddPlace,
  searchQuery = '',
  onSearchQueryChange,
  onDuplicate,
  isAddingPlaceFromAutocomplete = false,
  activeTab,
  hideNotesButton = false,
  currentUserRole,
  onOpenSettings,
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
  const scrollViewContentSize = useSharedValue({ width: 0, height: 0 }); // Track actual content size
  const currentScrollY = useSharedValue(0);
  const dragAbsoluteY = useSharedValue(-1);
  const dragVelocity = useSharedValue(0); // Track drag velocity to cap scroll speed
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
        cancelAnimationFrame(autoScrollInterval.current);
        autoScrollInterval.current = null;
      }
    }

    autoScrollDirection.current = direction;
    autoScrollSpeed.current = speed;

    let scrollFrameCount = 0; // Track frames for logging

    const scroll = () => {
      const now = Date.now();
      const deltaTime = (now - lastScrollTime.current) / 16.67; // Normalize to 60fps
      lastScrollTime.current = now;

      const currentOffset = currentScrollY.value;
      const currentSpeed = autoScrollSpeed.current;
      const currentDirection = autoScrollDirection.current;

      // Calculate content bounds using actual measured content size
      // This adapts automatically when route cards collapse during drag (height: 0)
      const useMeasured = scrollViewContentSize.value.height > 0;
      const contentHeight = useMeasured
        ? scrollViewContentSize.value.height
        : currentActivities.length * 230; // Fallback to estimated height if not measured yet
      const viewHeight = scrollViewLayout.value.height;
      
      // Include SearchBar in maxScroll calculation
      // Even though SearchBar is not draggable, users can scroll to it normally,
      // so currentScrollY can legitimately exceed a "SearchBar-excluded" maxScroll.
      // This was causing issues when dragging last activity upward from bottom.
      const maxScroll = Math.max(0, contentHeight - viewHeight);

      scrollFrameCount++;

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

      autoScrollInterval.current = requestAnimationFrame(scroll);
    };

    lastScrollTime.current = Date.now();
    scroll();
  }, [currentActivities.length, performScrollWorklet]);

  const stopAutoScroll = useCallback(() => {
    if (autoScrollInterval.current !== null) {
      cancelAnimationFrame(autoScrollInterval.current);
      autoScrollInterval.current = null;
      autoScrollDirection.current = 'none';
      autoScrollSpeed.current = 0;
    }
  }, []);

  // Cleanup on unmount
  React.useEffect(() => {
    return () => stopAutoScroll();
  }, [stopAutoScroll]);

  // ScrollView handlers
  const handleScrollViewLayout = useCallback((event: any) => {
    const { height: layoutHeight } = event.nativeEvent.layout;

    // Measure actual screen position using UIManager
    const handle = findNodeHandle(scrollViewRef.current);
    if (handle) {
      UIManager.measureInWindow(handle, (_x: number, y: number, width: number, measuredHeight: number) => {
        // IMPORTANT: Use layoutHeight (parent's constraint), not measuredHeight (content's natural size)
        // The parent container clips the ScrollView, so we need to respect that constraint
        const visibleHeight = layoutHeight;
        scrollViewLayout.value = { y, height: visibleHeight };

        // Use actual content size if available, otherwise estimate
        const contentHeight = scrollViewContentSize.value.height > 0
          ? scrollViewContentSize.value.height
          : currentActivities.length * 230; // Fallback estimate
        
        // Include SearchBar in maxScroll (it's scrollable content)
        const maxScroll = Math.max(0, contentHeight - visibleHeight);
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

  // Handle empty state
  if (!activities || activities.length === 0) {
    // If onAddPlace is provided, show SearchBar instead of action button
    if (onAddPlace) {
      return (
        <View style={styles.emptyWithSearchContainer}>
          <SearchBar
            value={searchQuery}
            onChangeText={onSearchQueryChange || (() => {})}
            onPress={onAddPlace}
            placeholder="Add places"
          />
        </View>
      );
    }
    // Otherwise, show the traditional empty state with action button (for backward compatibility)
    if (emptyStateActionPress) {
      return (
        <NoActivities
          onActionPress={emptyStateActionPress}
          actionButtonText={emptyStateActionText}
        />
      );
    }
    // Return empty view if no props provided
    return <View />;
  }

  const handleActivityPress = (activity: Activity) => {
    if (variant === 'selectable') {
      // Use instanceId if available, otherwise fall back to place_id for category activities
      const activityId = activity.instanceId || activity.place_id;
      if (activityId) {
        const isSelected = selectedActivities.includes(activityId);
        if (isSelected && onActivityDeselect) {
          onActivityDeselect(activityId);
        } else if (!isSelected && onActivitySelect) {
          onActivitySelect(activityId);
        }
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
      // Use instanceId if available, otherwise fall back to place_id for category activities
      const activityId = activity.instanceId || activity.place_id;
      const isSelected = activityId ? selectedActivities.includes(activityId) : false;
      const isLastActivity = index === currentActivities.length - 1;
      const routeLeg = routeLegs[index];

      // Extract distance and duration from EnhancedRouteLeg structure
      const enhancedLeg = routeLeg as any as EnhancedRouteLeg | undefined;
      const selectedModeData = enhancedLeg?.selectedMode ? enhancedLeg.modeData[enhancedLeg.selectedMode] : undefined;
      const nextActivityDistance = selectedModeData?.distance || (routeLeg as any)?.distance;
      const nextActivityDuration = selectedModeData?.duration || (routeLeg as any)?.duration;
      const legTravelMode = enhancedLeg?.selectedMode || travelMode;

      const nextActivity = currentActivities[index + 1];

      // Check if this activity is already in the wishlist
      const isInWishlist = wishlistActivities.some(
        (wishlistActivity) => wishlistActivity.instanceId === activity.instanceId
      );

      // Calculate activity number for day tabs (starts at 1 after first hotel, continues sequentially)
      // Find the first hotel in the list
      const firstHotelIndex = currentActivities.findIndex(
        a => a.isLodging === true || a.primaryType === 'lodging'
      );
      // Count non-hotel activities from after the first hotel up to current activity
      const startIndex = firstHotelIndex >= 0 ? firstHotelIndex + 1 : 0;
      const activityNumber = currentActivities
        .slice(startIndex, index + 1)
        .filter(a => !(a.isLodging === true || a.primaryType === 'lodging'))
        .length;
      // Pass 0-based index (activityNumber - 1) since ActivityCard adds 1 for display
      const displayIndex = activityNumber > 0 ? activityNumber - 1 : index;

      // Common props for both draggable and regular cards
      const commonProps = {
        key: `activity-${index}-${activity.instanceId || activity.place_id || 'no-id'}`,
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
        travelMode: legTravelMode,
        index: displayIndex,
        hideRouteInfo,
        duplicateActivityIndicator: isInWishlist,
        useInlineSelectionLayout,
        onDuplicate: onDuplicate ? () => onDuplicate(activity) : undefined,
        activeTab,
        hideNotesButton,
        currentUserRole,
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
            dragVelocity={dragVelocity}
            scrollViewLayout={scrollViewLayout}
            currentScrollY={currentScrollY}
            startAutoScroll={startAutoScroll}
            stopAutoScroll={stopAutoScroll}
            scrollViewRef={scrollViewRef}
            onOpenSettings={onOpenSettings}
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
          style={[styles.container]} // TEMP: Force scrolling for testing
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
          onLayout={handleScrollViewLayout}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          onContentSizeChange={(width, height) => {
            runOnUI(() => {
              'worklet';
              scrollViewContentSize.value = { width, height };
            })();
          }}
        >
          {renderActivities()}
          
          {/* Inline loading indicator when adding a place from AutocompleteModal */}
          {isAddingPlaceFromAutocomplete && (
            <View style={styles.autocompleteLoadingContainer}>
              <ActivityIndicator size="small" color={Colors.PRIMARY} />
              <Text style={styles.autocompleteLoadingText}>Activity Loading</Text>
            </View>
          )}

          {/* SearchBar - visible at bottom of list */}
          {onAddPlace && activities.length > 0 && (
            <View style={{ marginTop: 0, paddingHorizontal: 16 }}>
              <SearchBar
                value={searchQuery}
                onChangeText={onSearchQueryChange || (() => {})}
                onPress={onAddPlace}
                placeholder="Add places"
              />
            </View>
          )}
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
      
      {/* Inline loading indicator when adding a place from AutocompleteModal */}
      {isAddingPlaceFromAutocomplete && (
        <View style={styles.autocompleteLoadingContainer}>
          <ActivityIndicator size="small" color={Colors.PRIMARY} />
          <Text style={styles.autocompleteLoadingText}>Activity Loading</Text>
        </View>
      )}

      {/* SearchBar - visible at bottom of list */}
      {onAddPlace && activities.length > 0 && (
        <View style={{ marginTop: 0, paddingHorizontal: 16 }}>
          <SearchBar
            value={searchQuery}
            onChangeText={onSearchQueryChange || (() => {})}
            onPress={onAddPlace}
            placeholder="Add more activities"
          />
        </View>
      )}
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
  dragVelocity: Animated.SharedValue<number>; // Drag velocity for capping scroll speed
  scrollViewLayout: Animated.SharedValue<{ y: number; height: number }>; // ScrollView position and size
  currentScrollY: Animated.SharedValue<number>; // Current scroll offset
  startAutoScroll: (direction: 'up' | 'down', speed: number) => void; // Start auto-scroll
  stopAutoScroll: () => void; // Stop auto-scroll
  scrollViewRef: AnimatedRef<Animated.ScrollView>; // Reference to ScrollView for scroll compensation
  activeTab?: string; // Current active tab (wishlist or day#)
  hideNotesButton?: boolean; // Hide the notes button (e.g., in CategoryModal)
  onOpenSettings?: (legIndex: number) => void; // Callback for opening transportation settings
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
  dragVelocity,
  scrollViewLayout,
  currentScrollY,
  startAutoScroll,
  stopAutoScroll,
  scrollViewRef,
  activeTab,
  hideNotesButton = false,
  onOpenSettings,
}: DraggableActivityCardProps) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const isDragging = useSharedValue(false);
  const scale = useSharedValue(1);
  const zIndex = useSharedValue(0);
  // Use shared value instead of state to avoid race condition with gesture system
  const isGripPressed = useSharedValue(false);

  // Shift offset for non-dragged cards to make space
  const shiftOffset = useSharedValue(0);

  // Track the original position
  const originalIndex = useSharedValue(index);

  // Track scroll offset when drag starts to compensate for autoscroll
  const initialScrollY = useSharedValue(0);

  const ITEM_HEIGHT = 169; // Total height: activity card (110px) + route info card (~54px) + margins (5px)
  const MOVEMENT_THRESHOLD = 0.3; // Card must be dragged at least 30% of ITEM_HEIGHT to trigger reorder (~51px)

  // Update original index when component re-renders with new index
  React.useEffect(() => {
    if (!isDragging.value) {
      originalIndex.value = cardIndex;
    }
  }, [cardIndex]);

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
        damping: 16,      // Smooth but responsive
        stiffness: 190,   // Slightly snappy
        mass: 0.7,        // Light feel
      });
    }
  );

  // Edge detection and auto-scroll trigger
  useAnimatedReaction(
    () => {
      const isBeingDragged = activeDragIndex.value === cardIndex;
      if (!isBeingDragged) return { direction: 'none' as const, speed: 0, debug: '' };

      const EDGE_ZONE = 120;  // 120px from top/bottom triggers scroll (larger for better UX)
      const MAX_SPEED = 8;  // Maximum scroll speed (px per frame)
      const MIN_SPEED = 2;   // Minimum scroll speed

      const dragY = dragAbsoluteY.value;
      const svTop = scrollViewLayout.value.y;
      const svBottom = svTop + scrollViewLayout.value.height;

      const distFromTop = dragY - svTop;
      const distFromBottom = svBottom - dragY;

      // Check top zone (scroll up)
      if (distFromTop < EDGE_ZONE && distFromTop > 0) {
        const linearRatio = 1 - (distFromTop / EDGE_ZONE);
        // Apply quadratic easing for gentler acceleration (ratio²)
        // This keeps speed much lower until very close to edge
        const ratio = linearRatio * linearRatio;
        let speed = Math.max(MIN_SPEED, MAX_SPEED * ratio *0.8);

        // Cap speed to drag velocity + small buffer (1.5x) to prevent scrolling away from drag
        const currentDragSpeed = dragVelocity.value;
        if (currentDragSpeed > 0) {
          speed = Math.min(speed, currentDragSpeed * 1.2);
        }

        return {
          direction: 'up' as const,
          speed,
          debug: `dragY: ${dragY.toFixed(1)}, svTop: ${svTop.toFixed(1)}, distFromTop: ${distFromTop.toFixed(1)}, linearRatio: ${linearRatio.toFixed(2)}, easedRatio: ${ratio.toFixed(2)}, dragSpeed: ${currentDragSpeed.toFixed(1)}`
        };
      }

      // Check bottom zone (scroll down)
      if (distFromBottom < EDGE_ZONE && distFromBottom > 0) {
        const linearRatio = 1 - (distFromBottom / EDGE_ZONE);
        // Apply quadratic easing for gentler acceleration (ratio²)
        // This keeps speed much lower until very close to edge
        const ratio = linearRatio * linearRatio;
        let speed = Math.max(MIN_SPEED, MAX_SPEED * ratio)*0.65;

        // Cap speed to drag velocity + small buffer (1.5x) to prevent scrolling away from drag
        const currentDragSpeed = dragVelocity.value;
        if (currentDragSpeed > 0) {
          speed = Math.min(speed, currentDragSpeed * 1.2);
        }

        return {
          direction: 'down' as const,
          speed,
          debug: `dragY: ${dragY.toFixed(1)}, svBottom: ${svBottom.toFixed(1)}, distFromBottom: ${distFromBottom.toFixed(1)}, linearRatio: ${linearRatio.toFixed(2)}, easedRatio: ${ratio.toFixed(2)}, dragSpeed: ${currentDragSpeed.toFixed(1)}`
        };
      }

      return { direction: 'none' as const, speed: 0, debug: `dragY: ${dragY.toFixed(1)}, svTop: ${svTop.toFixed(1)}, svBottom: ${svBottom.toFixed(1)}, distTop: ${distFromTop.toFixed(1)}, distBottom: ${distFromBottom.toFixed(1)}` };
    },
    (result, previous) => {
      // Only trigger start/stop when direction CHANGES (not every frame!)
      const directionChanged = result.direction !== previous?.direction;

      if (directionChanged) {
        if (result.direction !== 'none') {
          // Start auto-scroll
          runOnJS(startAutoScroll)(result.direction, result.speed);
        } else {
          // Stop auto-scroll
          runOnJS(stopAutoScroll)();
        }
      } else if (result.direction !== 'none') {
        // Direction hasn't changed but we're still in a zone - update speed
        runOnJS(startAutoScroll)(result.direction, result.speed);
      }
    }
  );

  const longPressGesture = Gesture.LongPress()
    .minDuration(150) // 150ms for immediate response
    .onStart(() => {
      'worklet';
      // Set shared value directly in worklet - no async state update needed
      isGripPressed.value = true;
    });

  const panGesture = Gesture.Pan()
    .manualActivation(true) // Enable manual activation
    .minDistance(5) // Reduced threshold since grip is intentional
    .onTouchesMove((event, state) => {
      'worklet';
      // Only activate pan gesture if grip is pressed (from long press)
      if (isGripPressed.value) {
        state.activate();
      } else {
        state.fail();
      }
    })
    .onStart(() => {
      isDragging.value = true;
      scale.value = withSpring(1.05, {
        damping: 12,
        stiffness: 200,
      });
      zIndex.value = 1000;
      originalIndex.value = cardIndex;
      activeDragIndex.value = cardIndex; // Broadcast that this card is being dragged
      targetDropIndex.value = cardIndex; // Initial target is current position

      // Capture initial scroll position to compensate for autoscroll during drag
      initialScrollY.value = currentScrollY.value;

      // SCROLL COMPENSATION: When route cards collapse (height: 0), all items shift up
      // Calculate how much to scroll up so the dragged card stays under the user's finger
      // Based on ITEM_HEIGHT = 169px (activity 110px + route ~54px + margins 5px)
      // Route card total height including margins: ~59px
      // BUT empirically tested, the actual collapse is closer to ITEM_HEIGHT - activity card height
      const ROUTE_CARD_WITH_MARGINS = ITEM_HEIGHT - 110; // ~59px from ITEM_HEIGHT calculation
      const numRouteCardsAbove = Math.max(0, cardIndex); // All cards before this one have route info
      const compensationOffset = numRouteCardsAbove * ROUTE_CARD_WITH_MARGINS;

      if (compensationOffset > 0) {
        const targetScrollY = Math.max(0, currentScrollY.value - compensationOffset);

        // Apply scroll compensation immediately with smooth animation
        scrollTo(scrollViewRef, 0, targetScrollY, true); // true = animated

        // Update the tracked scroll position
        currentScrollY.value = targetScrollY;

        // Update initial scroll to reflect the compensation
        // This ensures future autoscroll calculations remain correct
        initialScrollY.value = targetScrollY;
      }

      runOnJS(onDragStart)();
    })
    .onUpdate((event) => {
      translateY.value = event.translationY;

      // Track drag velocity to cap auto-scroll speed
      // velocityY is in px/ms, convert to px/frame (60fps = 16.67ms per frame)
      if (event.velocityY !== undefined) {
        dragVelocity.value = Math.abs(event.velocityY * 16.67);
      }

      // Update absolute Y position for edge detection
      // Use absoluteY from event if available, otherwise calculate
      if (event.absoluteY !== undefined) {
        dragAbsoluteY.value = event.absoluteY;
      }

      // Calculate target index based on drag distance INCLUDING scroll compensation
      // The visual position is event.translationY + scrollDelta, so target calculation must match
      const scrollDelta = currentScrollY.value - initialScrollY.value;
      const effectiveDragDistance = event.translationY + scrollDelta;
      const positionChange = Math.round(effectiveDragDistance / ITEM_HEIGHT);
      const newTargetIndex = Math.max(0, Math.min(totalItems - 1, originalIndex.value + positionChange));

      // Broadcast target index to all cards for coordinated shifting
      if (newTargetIndex !== targetDropIndex.value) {
        targetDropIndex.value = newTargetIndex;
      }
    })
    .onEnd((event) => {
      const finalScrollDelta = currentScrollY.value - initialScrollY.value;
      const effectiveDragDistance = event.translationY + finalScrollDelta;

      // Stop auto-scroll when drag ends
      runOnJS(stopAutoScroll)();
      dragAbsoluteY.value = -1;

      // REVERSE SCROLL COMPENSATION: Route cards will expand back to full height
      // Scroll back down by the same amount we scrolled up at drag start
      const ROUTE_CARD_WITH_MARGINS = ITEM_HEIGHT - 110;
      const numRouteCardsAbove = Math.max(0, cardIndex);
      const reverseCompensationOffset = numRouteCardsAbove * ROUTE_CARD_WITH_MARGINS;

      if (reverseCompensationOffset > 0) {
        const targetScrollY = currentScrollY.value + reverseCompensationOffset;

        // Apply reverse compensation with smooth animation
        scrollTo(scrollViewRef, 0, targetScrollY, true); // true = animated
        currentScrollY.value = targetScrollY;
      }

      // Calculate the drag distance and check if it exceeds the threshold
      // Use effective drag distance (including scroll compensation) for threshold check
      // This ensures reordering works correctly when autoscroll is involved
      const effectiveDragDistanceForThreshold = Math.abs(effectiveDragDistance);
      const hasExceededThreshold = effectiveDragDistanceForThreshold >= (ITEM_HEIGHT * MOVEMENT_THRESHOLD);

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
        isGripPressed.value = false; // Reset grip state

        runOnJS(onDragEnd)();
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
        isGripPressed.value = false; // Reset grip state

        runOnJS(onDragEnd)();
      }
    })
    .onFinalize(() => {
      // Called on cancel, end, or fail - ensure cleanup
      runOnJS(stopAutoScroll)();
      dragAbsoluteY.value = -1;
    });

  const animatedStyle = useAnimatedStyle(() => {
    const isBeingDragged = activeDragIndex.value === cardIndex;

    // Calculate scroll compensation for dragged card
    // When content scrolls, the card moves with it, but gesture translation doesn't account for this
    // 
    // Scroll DOWN (scrollY increases): content moves UP on screen
    //   - Card's base position moves UP
    //   - Need to move card DOWN to compensate (add positive delta)
    // 
    // Scroll UP (scrollY decreases): content moves DOWN on screen
    //   - Card's base position moves DOWN
    //   - Need to move card UP to compensate (add negative delta)
    //
    // Formula: translateY = gestureTranslation + scrollDelta
    const scrollDelta = isBeingDragged ? (currentScrollY.value - initialScrollY.value) : 0;

    const finalTranslateY = isBeingDragged
      ? translateY.value + scrollDelta  // Dragged card: gesture + scroll compensation
      : shiftOffset.value;              // Other cards: shift to make space

    return {
      transform: [
        { translateX: translateX.value },
        { translateY: finalTranslateY },
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
            useInlineSelectionLayout={useInlineSelectionLayout}
            activeTab={activeTab}
            hideNotesButton={hideNotesButton}
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
            activityIndex={index}
            onOpenSettings={onOpenSettings || (() => {})}
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
  emptyWithSearchContainer: {
    flex: 1,
    paddingHorizontal: 16,
    marginTop: -5,
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
  routeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    marginTop: 6,
    marginBottom: 2,
    borderWidth: 1,
    borderColor: '#E5E5E7',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
    overflow: 'hidden',
  },
  routeMainButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  routeDivider: {
    width: 1,
    height: 32,
    backgroundColor: '#E5E5E7',
  },
  directionsButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  directionsText: {
    fontFamily: 'outfit-medium',
    fontSize: 14,
    color: '#007AFF',
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
  },
  routeMidDotLabel: {
    fontFamily: 'outfit',
    fontSize: 13,
    color: '#8E8E93',
    marginHorizontal: 6,
  },
  routeInfoValue: {
    fontFamily: 'outfit',
    fontSize: 14,
    color: '#1C1C1E',
    marginLeft: 4,
  },
  chevronIcon: {
    marginLeft: 10,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  loadingText: {
    fontFamily: 'outfit',
    fontSize: 14,
    color: Colors.GRAY,
  },
  autocompleteLoadingContainer: {
    marginTop:  10,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  autocompleteLoadingText: {
    fontFamily: 'outfit',
    fontSize: 14,
    color: Colors.GRAY,
    marginLeft: 8,
  },
});