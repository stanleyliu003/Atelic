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
  // State for drag-and-drop
  const [currentActivities, setCurrentActivities] = useState(activities);

  // Update local state when activities prop changes
  React.useEffect(() => {
    setCurrentActivities(activities);
  }, [activities]);

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

  // Drag and drop handlers
  const moveItem = useCallback((fromIndex: number, toIndex: number) => {
    const newActivities = [...currentActivities];
    const [movedItem] = newActivities.splice(fromIndex, 1);
    newActivities.splice(toIndex, 0, movedItem);
    setCurrentActivities(newActivities);
    if (onReorder) {
      onReorder(newActivities);
    }
  }, [currentActivities, onReorder]);

  const shouldShowSelectionIndicator = showSelectionIndicator || variant === 'selectable';

  // If drag and drop is enabled and scrollable, use special draggable list
  if (enableDragDrop && scrollable) {
    return (
      <GestureHandlerRootView style={styles.container}>
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          {currentActivities.map((activity: Activity, index: number) => {
            const isSelected = activity.place_id ? selectedActivities.includes(activity.place_id) : false;
            const isLastActivity = index === currentActivities.length - 1;
            const routeLeg = routeLegs[index];
            const nextActivityDistance = routeLeg?.distance;
            const nextActivityDuration = routeLeg?.duration;
            const nextActivity = currentActivities[index + 1];
            return (
              <DraggableActivityCard
                key={`activity-${index}-${activity.place_id || 'no-place-id'}`}
                activity={activity}
                index={index}
                isSelected={isSelected}
                onPress={handleActivityPress}
                onLongPress={handleActivityLongPress}
                onDescriptionCardPress={onDescriptionCardPress}
                showSelectionIndicator={shouldShowSelectionIndicator}
                disabled={disabled}
                nextActivityDistance={nextActivityDistance}
                nextActivityDuration={nextActivityDuration}
                isLastActivity={isLastActivity}
                nextActivity={nextActivity}
                travelMode={travelMode}
                onMove={moveItem}
                totalItems={currentActivities.length}
              />
            );
          })}
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
      {currentActivities.map((activity: Activity, index: number) => {
        const isSelected = activity.place_id ? selectedActivities.includes(activity.place_id) : false;
        const isLastActivity = index === currentActivities.length - 1;
        // Get route info for this activity (distance/duration to next activity)
        const routeLeg = routeLegs[index];
        const nextActivityDistance = routeLeg?.distance;
        const nextActivityDuration = routeLeg?.duration;
        const nextActivity = currentActivities[index + 1];
        return (
          <ActivityCard
            key={`activity-${index}-${activity.place_id || 'no-place-id'}`}
            activity={activity}
            isSelected={isSelected}
            onPress={handleActivityPress}
            onLongPress={handleActivityLongPress}
            onDescriptionCardPress={onDescriptionCardPress}
            showSelectionIndicator={shouldShowSelectionIndicator}
            disabled={disabled}
            style={styles.activityCard}
            index={index}
            nextActivityDistance={nextActivityDistance}
            nextActivityDuration={nextActivityDuration}
            isLastActivity={isLastActivity}
            nextActivity={nextActivity}
            travelMode={travelMode}
          />
        );
      })}
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

  const ITEM_HEIGHT = 120; // Approximate height of activity card including margin

  const panGesture = Gesture.Pan()
    .onStart(() => {
      isDragging.value = true;
      scale.value = withSpring(1.05);
      zIndex.value = 1000;
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
        />
      </Animated.View>
    </GestureDetector>
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
  draggableCard: {
    marginBottom: 12,
  },
});