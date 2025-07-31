import React from 'react';
import { ScrollView, View, StyleSheet } from 'react-native';
import { RouteLeg } from '../../../services/getRoute_graphQL_call';
import { Activity, ActivityListProps } from '../../../types/activity.types';
import { ActivityCard } from './activity_card';
import { NoActivities } from './no_activities';

interface EnhancedActivityListProps extends ActivityListProps {
  onActivityPress?: (activity: Activity) => void;
  onActivityLongPress?: (activity: Activity) => void;
  showSelectionIndicator?: boolean;
  emptyStateTitle?: string;
  emptyStateSubtitle?: string;
  routeLegs?: RouteLeg[];
  scrollable?: boolean; // <-- new prop
}

export function ActivityList({ 
  activities,
  selectedActivities = [],
  onActivitySelect,
  onActivityDeselect,
  onActivityPress,
  onActivityLongPress,
  variant = 'default',
  disabled = false,
  showSelectionIndicator = false,
  emptyStateTitle,
  emptyStateSubtitle,
  routeLegs = [],
  scrollable = true, // <-- default true
}: EnhancedActivityListProps) {
  if (!activities || activities.length === 0) {
    return (
      <NoActivities 
        title={emptyStateTitle}
        subtitle={emptyStateSubtitle}
      />
    );
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
            key={activity.place_id || index}
            activity={activity}
            isSelected={isSelected}
            onPress={handleActivityPress}
            onLongPress={handleActivityLongPress}
            showSelectionIndicator={shouldShowSelectionIndicator}
            disabled={disabled}
            style={styles.activityCard}
            index={index}
            nextActivityDistance={nextActivityDistance}
            nextActivityDuration={nextActivityDuration}
            isLastActivity={isLastActivity}
            nextActivity={nextActivity}
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