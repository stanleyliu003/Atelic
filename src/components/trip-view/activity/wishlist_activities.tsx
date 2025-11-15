import { Activity } from '../../../types/activity.types';
import { ActivityList } from './activity_list';

interface WishlistActivitiesProps {
  activities: Activity[];
  selectedActivities?: string[];
  onActivitySelect?: (activityId: string) => void;
  onActivityDeselect?: (activityId: string) => void;
  onDescriptionCardPress?: (activity: Activity) => void;
  showSelectionIndicator?: boolean;
  wishlistActivities?: Activity[]; // Activities already in the wishlist for "On list" tag
  onDuplicate?: (activity: Activity, targetDayNumber?: number) => void; // Callback for duplicating an activity
}

export function WishlistActivities({
  activities,
  selectedActivities,
  onActivitySelect,
  onActivityDeselect,
  onDescriptionCardPress,
  showSelectionIndicator = false,
  wishlistActivities,
  onDuplicate
}: WishlistActivitiesProps) {
  return (
    <ActivityList
      activities={activities}
      selectedActivities={selectedActivities}
      onActivitySelect={onActivitySelect}
      onActivityDeselect={onActivityDeselect}
      onDescriptionCardPress={onDescriptionCardPress}
      showSelectionIndicator={showSelectionIndicator}
      variant="selectable"
      hideRouteInfo={true}
      wishlistActivities={wishlistActivities}
      useInlineSelectionLayout={true}
      onDuplicate={onDuplicate}
    />
  );
}
