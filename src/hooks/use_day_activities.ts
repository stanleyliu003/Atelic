import { useCallback, useState } from 'react';
import { Activity, DayActivities } from '../types/activity.types';

export function useDayActivities() {
  const [dayActivities, setDayActivities] = useState<DayActivities>({
    1: [], // Start with Day 1 empty
  });

  const addActivityToDay = useCallback((activity: Activity, dayNumber: number) => {
    setDayActivities(prev => ({
      ...prev,
      [dayNumber]: [...(prev[dayNumber] || []), activity],
    }));
  }, []);

  const removeActivityFromDay = useCallback((activityId: string, dayNumber: number) => {
    setDayActivities(prev => ({
      ...prev,
      [dayNumber]: (prev[dayNumber] || []).filter(activity => activity.place_id !== activityId),
    }));
  }, []);

  const removeActivitiesFromAllDays = useCallback((activityIds: string[]) => {
    setDayActivities(prev => {
      const newDayActivities: DayActivities = {};
      Object.entries(prev).forEach(([day, acts]) => {
        newDayActivities[Number(day)] = acts.filter(act => 
          !act.place_id || !activityIds.includes(act.place_id)
        );
      });
      return newDayActivities;
    });
  }, []);

  const transferActivitiesToDay = useCallback((activities: Activity[], dayNumber: number) => {
    setDayActivities(prev => {
      // Get the place_ids of activities to transfer
      const transferIds = activities.map(a => a.place_id).filter(Boolean);
      // Remove these activities from all days
      const newDayActivities: DayActivities = {};
      Object.entries(prev).forEach(([day, acts]) => {
        newDayActivities[Number(day)] = acts.filter(act => !transferIds.includes(act.place_id));
      });
      // Add them to the target day
      newDayActivities[dayNumber] = [
        ...(newDayActivities[dayNumber] || []),
        ...activities
      ];
      return newDayActivities;
    });
  }, []);

  const transferActivitiesToWishlist = useCallback((activityIds: string[], dayNumber: number) => {
    setDayActivities(prev => {
      const dayActivities = prev[dayNumber] || [];
      const activitiesToTransfer = dayActivities.filter(activity => 
        activity.place_id && activityIds.includes(activity.place_id)
      );
      
      return {
        ...prev,
        [dayNumber]: dayActivities.filter(activity => 
          !activity.place_id || !activityIds.includes(activity.place_id)
        ),
      };
    });
    
    // Return the activities that were transferred (for wishlist management)
    return dayActivities[dayNumber]?.filter(activity => 
      activity.place_id && activityIds.includes(activity.place_id)
    ) || [];
  }, [dayActivities]);

  const getDayActivities = useCallback((dayNumber: number): Activity[] => {
    return dayActivities[dayNumber] || [];
  }, [dayActivities]);

  const getAllDayActivities = useCallback((): Activity[] => {
    return Object.values(dayActivities).flat();
  }, [dayActivities]);

  const reorderDayActivities = useCallback((dayNumber: number, newOrder: Activity[]) => {
    setDayActivities(prev => ({
      ...prev,
      [dayNumber]: newOrder,
    }));
  }, []);

  const clearDay = useCallback((dayNumber: number) => {
    setDayActivities(prev => ({
      ...prev,
      [dayNumber]: [],
    }));
  }, []);

  const getDayCount = useCallback(() => {
    return Object.keys(dayActivities).length;
  }, [dayActivities]);

  const addNewDay = useCallback(() => {
    const newDayNumber = getDayCount() + 1;
    setDayActivities(prev => ({
      ...prev,
      [newDayNumber]: [],
    }));
    return newDayNumber;
  }, [getDayCount]);

  return {
    // State
    dayActivities,
    
    // Actions
    addActivityToDay,
    removeActivityFromDay,
    removeActivitiesFromAllDays,
    transferActivitiesToDay,
    transferActivitiesToWishlist,
    reorderDayActivities,
    clearDay,
    addNewDay,
    
    // Utilities
    getDayActivities,
    getAllDayActivities,
    getDayCount,
  };
} 