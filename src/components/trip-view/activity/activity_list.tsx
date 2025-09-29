import React, { useCallback, useState } from 'react';
import { ScrollView, View, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { RouteLeg } from '../../../services/getRoute_graphQL_call';
import { Activity, ActivityListProps } from '../../../types/activity.types';
import { ActivityCard } from './activity_card';
import { NoActivities } from './no_activities';

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
  onReorder
}: EnhancedActivityListProps) {
  // Always initialize state and callbacks (fix for hooks rule violation)
  const [currentActivities, setCurrentActivities] = useState(activities);

  // Update local state when activities prop changes
  React.useEffect(() => {
    setCurrentActivities(activities);
  }, [activities]);

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
      };

      if (enableDragDrop && scrollable) {
        return (
          <DraggableActivityCard
            {...commonProps}
            onMove={moveItem}
            totalItems={currentActivities.length}
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
  travelMode?: string;
  onMove: (fromIndex: number, toIndex: number) => void;
  totalItems: number;
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
  travelMode,
  onMove,
  totalItems,
}: DraggableActivityCardProps) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const isDragging = useSharedValue(false);
  const scale = useSharedValue(1);
  const zIndex = useSharedValue(0);

  // State to control route info visibility
  const [hideRouteInfo, setHideRouteInfo] = useState(false);

  const ITEM_HEIGHT = 120; // Approximate height of activity card including margin

  const panGesture = Gesture.Pan()
    .onStart(() => {
      isDragging.value = true;
      scale.value = withSpring(1.05);
      zIndex.value = 1000;
      // Hide route info when dragging starts
      runOnJS(setHideRouteInfo)(true);
    })
    .onUpdate((event) => {
      translateY.value = event.translationY;

      // Calculate which position we're hovering over
      const currentPosition = index * ITEM_HEIGHT + translateY.value;
      const newIndex = Math.round(currentPosition / ITEM_HEIGHT);
      const clampedIndex = Math.max(0, Math.min(totalItems - 1, newIndex));

      // If we've moved to a new position, trigger reorder
      if (clampedIndex !== index) {
        runOnJS(onMove)(index, clampedIndex);
      }
    })
    .onEnd(() => {
      translateY.value = withSpring(0);
      translateX.value = withSpring(0);
      scale.value = withSpring(1);
      isDragging.value = false;
      zIndex.value = 0;
      // Show route info again when dragging ends
      runOnJS(setHideRouteInfo)(false);
    });

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: scale.value },
      ],
      zIndex: zIndex.value,
      elevation: isDragging.value ? 5 : 0,
    } as any;
  });

  return (
    <View style={styles.draggableContainer}>
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
            hideRouteInfo={hideRouteInfo}
          />
        </Animated.View>
      </GestureDetector>
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
  draggableCard: {
    // No margin since parent container handles it
  },
});