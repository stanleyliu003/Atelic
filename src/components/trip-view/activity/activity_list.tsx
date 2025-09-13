import React from 'react';
import { ScrollView, View, StyleSheet } from 'react-native';
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
  scrollable?: boolean; // <-- new prop
  travelMode?: string; // Travel mode from route calculation
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
  scrollable = true, // <-- default true
  travelMode
}: EnhancedActivityListProps) {
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

  const Container = scrollable ? ScrollView : View;
  const containerProps = scrollable
    ? { style: styles.container, contentContainerStyle: styles.contentContainer, showsVerticalScrollIndicator: false }
    : { style: styles.container };

  return (
    <Container {...containerProps}>
      {activities.map((activity: Activity, index: number) => {
        const isSelected = activity.place_id ? selectedActivities.includes(activity.place_id) : false;
        const isLastActivity = index === activities.length - 1;
        // Get route info for this activity (distance/duration to next activity)
        const routeLeg = routeLegs[index];
        const nextActivityDistance = routeLeg?.distance;
        const nextActivityDuration = routeLeg?.duration;
        const nextActivity = activities[index + 1];
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
}); 