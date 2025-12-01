import { Activity } from '../../types/activity.types';
import { ActivityList } from './activity/activity_list';

interface WishlistActivitiesProps {
  activities: Activity[];
  selectedActivities?: string[];
  onActivitySelect?: (activityId: string) => void;
  onActivityDeselect?: (activityId: string) => void;
  onDescriptionCardPress?: (activity: Activity) => void;
  showSelectionIndicator?: boolean;
  wishlistActivities?: Activity[]; // Activities already in the wishlist for "On list" tag
  onDuplicate?: (activity: Activity, targetDayNumber?: number) => void; // Callback for duplicating an activity
  activeTab?: string; // Current active tab (wishlist or day#)
  hideNotesButton?: boolean; // Hide the notes button (e.g., in CategoryModal)
  currentUserRole?: 'owner' | 'editor' | 'viewer'; // User's role for permission control
}

export function WishlistActivities({
  activities,
  selectedActivities,
  onActivitySelect,
  onActivityDeselect,
  onDescriptionCardPress,
  showSelectionIndicator = false,
  wishlistActivities,
  onDuplicate,
  activeTab = 'wishlist',
  hideNotesButton = false,
  currentUserRole,
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
      activeTab={activeTab}
      hideNotesButton={hideNotesButton}
      currentUserRole={currentUserRole}
    />
  );
}
 