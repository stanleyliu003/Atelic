import { Activity } from '../../types/activity.types';
import { ActivityList } from './activity/activity_list';

interface WishlistActivitiesProps {
  activities: Activity[];
  selectedActivities?: string[];
  onActivitySelect?: (activityId: string) => void;
  onActivityDeselect?: (activityId: string) => void;
  showSelectionIndicator?: boolean;
}

export function WishlistActivities({ 
  activities,
  selectedActivities,
  onActivitySelect,
  onActivityDeselect,
  showSelectionIndicator = false
}: WishlistActivitiesProps) {
  return (
    <ActivityList
      activities={activities}
      selectedActivities={selectedActivities}
      onActivitySelect={onActivitySelect}
      onActivityDeselect={onActivityDeselect}
      showSelectionIndicator={showSelectionIndicator}
      variant="selectable"
    />
  );
}
 