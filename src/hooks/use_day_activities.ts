import { useCallback, useState } from 'react';
import { Activity, DayWithPolyline } from '../types/activity.types';

export function useDayActivities() {
  const [dayActivities, setDayActivities] = useState<{ [dayNumber: number]: DayWithPolyline }>({
    1: { dayNumber: 1, activities: [], encodedPolyline: undefined },
  });

  const addActivityToDay = useCallback((activity: Activity, dayNumber: number) => {
    setDayActivities(prev => ({
      ...prev,
      [dayNumber]: {
        ...prev[dayNumber],
        activities: [...(prev[dayNumber]?.activities || []), activity],
      },
    }));
  }, []);

  const removeActivityFromDay = useCallback((activityId: string, dayNumber: number) => {
    setDayActivities(prev => ({
      ...prev,
      [dayNumber]: {
        ...prev[dayNumber],
        activities: (prev[dayNumber]?.activities || []).filter(activity => activity.place_id !== activityId),
      },
    }));
  }, []);

  const removeActivitiesFromAllDays = useCallback((activityIds: string[]) => {
    setDayActivities(prev => {
      const newDayActivities: { [dayNumber: number]: DayWithPolyline } = {};
      Object.entries(prev).forEach(([day, dayObj]) => {
        newDayActivities[Number(day)] = {
          ...dayObj,
          activities: dayObj.activities.filter(act => !act.place_id || !activityIds.includes(act.place_id)),
        };
      });
      return newDayActivities;
    });
  }, []);

  const transferActivitiesToDay = useCallback((activities: Activity[], dayNumber: number) => {
    setDayActivities(prev => {
      const transferIds = activities.map(a => a.place_id).filter(Boolean);
      const newDayActivities: { [dayNumber: number]: DayWithPolyline } = {};
      Object.entries(prev).forEach(([day, dayObj]) => {
        newDayActivities[Number(day)] = {
          ...dayObj,
          activities: dayObj.activities.filter(act => !transferIds.includes(act.place_id)),
        };
      });
      newDayActivities[dayNumber] = {
        ...newDayActivities[dayNumber],
        activities: [
          ...(newDayActivities[dayNumber]?.activities || []),
          ...activities,
        ],
      };
      return newDayActivities;
    });
  }, []);

  const transferActivitiesToWishlist = useCallback((activityIds: string[], dayNumber: number) => {
    setDayActivities(prev => {
      const dayObj = prev[dayNumber] || { dayNumber, activities: [] };
      return {
        ...prev,
        [dayNumber]: {
          ...dayObj,
          activities: dayObj.activities.filter(activity => !activity.place_id || !activityIds.includes(activity.place_id)),
        },
      };
    });
    return dayActivities[dayNumber]?.activities.filter(activity => activity.place_id && activityIds.includes(activity.place_id)) || [];
  }, [dayActivities]);

  const getDayActivities = useCallback((dayNumber: number): Activity[] => {
    return dayActivities[dayNumber]?.activities || [];
  }, [dayActivities]);

  const getAllDayActivities = useCallback((): Activity[] => {
    return Object.values(dayActivities).flatMap(dayObj => dayObj.activities);
  }, [dayActivities]);

  const reorderDayActivities = useCallback((dayNumber: number, newOrder: Activity[]) => {
    setDayActivities(prev => ({
      ...prev,
      [dayNumber]: {
        ...prev[dayNumber],
        activities: newOrder,
      },
    }));
  }, []);

  const setDayPolyline = useCallback((dayNumber: number, encodedPolyline: string) => {
    setDayActivities(prev => ({
      ...prev,
      [dayNumber]: {
        ...prev[dayNumber],
        encodedPolyline,
      },
    }));
  }, []);

  const clearDay = useCallback((dayNumber: number) => {
    setDayActivities(prev => ({
      ...prev,
      [dayNumber]: {
        ...prev[dayNumber],
        activities: [],
        encodedPolyline: undefined,
      },
    }));
  }, []);

  const getDayCount = useCallback(() => {
    return Object.keys(dayActivities).length;
  }, [dayActivities]);

  const addNewDay = useCallback(() => {
    const newDayNumber = getDayCount() + 1;
    setDayActivities(prev => ({
      ...prev,
      [newDayNumber]: { dayNumber: newDayNumber, activities: [], encodedPolyline: undefined },
    }));
    return newDayNumber;
  }, [getDayCount]);

  return {
    dayActivities,
    addActivityToDay,
    removeActivityFromDay,
    removeActivitiesFromAllDays,
    transferActivitiesToDay,
    transferActivitiesToWishlist,
    reorderDayActivities,
    setDayPolyline,
    clearDay,
    addNewDay,
    getDayActivities,
    getAllDayActivities,
    getDayCount,
  };
} 