import { useState } from 'react';
import { Activity, TabType } from '../types/activity.types';

type DayOption = number | 'wishlist';

interface UseTransferActivitiesArgs {
  activities: Activity[];
  activeTab: TabType;
  getSelectedActivities: (allActivities: Activity[]) => Activity[];
  transferActivitiesToDay: (activities: Activity[], dayNumber: number) => void;
  transferActivitiesToWishlist: (activityIds: string[], dayNumber: number) => Activity[];
  clearSelection: () => void;
  getDayCount: () => number;
  onTabChange?: (tab: TabType) => void;
  updateWishlistActivities?: (newActivities: Activity[]) => void;
}

export function useTransferActivities({
  activities,
  activeTab,
  getSelectedActivities,
  transferActivitiesToDay,
  transferActivitiesToWishlist,
  clearSelection,
  getDayCount,
  onTabChange,
  updateWishlistActivities,
}: UseTransferActivitiesArgs) {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedDay, setSelectedDay] = useState<DayOption>(1);

  // Get all available days as an array, with 'wishlist' as the first option
  const dayCount = getDayCount();
  const daysArray: DayOption[] = ['wishlist', ...Array.from({ length: dayCount }, (_, i) => i + 1)];

  // Open modal and set default selected day based on current tab
  const handleOpenTransferModal = () => {
    if (activeTab === 'wishlist') {
      setSelectedDay('wishlist');
    } else if (activeTab.startsWith('day')) {
      const dayNumber = parseInt(activeTab.replace('day', ''));
      setSelectedDay(dayNumber);
    } else {
      setSelectedDay(1); // fallback
    }
    setIsModalVisible(true);
  };

  // Transfer activities to wishlist
  const handleTransferToWishlist = (activityIds: string[]) => {
    let currentDayNumber = 1;
    if (activeTab.startsWith('day')) {
      currentDayNumber = parseInt(activeTab.replace('day', ''));
    }

    const transferredActivities = transferActivitiesToWishlist(activityIds, currentDayNumber);

    // Add the transferred activities back to the wishlist if updateWishlistActivities is available
    if (updateWishlistActivities && transferredActivities.length > 0) {
      updateWishlistActivities(transferredActivities);
    }

    clearSelection();
  };

  // Confirm transfer to selected day or wishlist
  const handleConfirmTransfer = () => {
    const selectedActivitiesList = getSelectedActivities(activities || []);

    if (selectedActivitiesList.length > 0) {
      if (selectedDay === 'wishlist') {
        // Transfer to wishlist from the current day
        let currentDayNumber = 1;
        if (activeTab.startsWith('day')) {
          currentDayNumber = parseInt(activeTab.replace('day', ''));
        }
        const activityIds = selectedActivitiesList
          .map(a => a.place_id)
          .filter((id): id is string => typeof id === 'string');

        const transferredActivities = transferActivitiesToWishlist(activityIds, currentDayNumber);

        // Add the transferred activities back to the wishlist if updateWishlistActivities is available
        if (updateWishlistActivities && transferredActivities.length > 0) {
          updateWishlistActivities(transferredActivities);
        }

        // Navigate to wishlist tab
        if (onTabChange) {
          onTabChange('wishlist');
        }
      } else {
        transferActivitiesToDay(selectedActivitiesList, selectedDay);

        // Navigate to the selected day tab
        if (onTabChange) {
          onTabChange(`day${selectedDay}`);
        }
      }
      clearSelection();
    }
    setIsModalVisible(false);
  };

  return {
    isModalVisible,
    setIsModalVisible,
    selectedDay,
    setSelectedDay,
    daysArray,
    handleOpenTransferModal,
    handleConfirmTransfer,
    handleTransferToWishlist,
  };
} 