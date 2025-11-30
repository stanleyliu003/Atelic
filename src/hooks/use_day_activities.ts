import { useCallback } from 'react';
import { Activity, DayWithPolyline } from '../types/activity.types';
import { useCreateTrip } from '../../context/CreateTripContext';

export function useDayActivities() {
  const {
    dayActivities,
    setAllDayActivities,
    setDayActivities,
  } = useCreateTrip();

  const addActivityToDay = useCallback((activity: Activity, dayNumber: number) => {
    setDayActivities((prev: any) => ({
      ...prev,
      [dayNumber]: {
        ...prev[dayNumber],
        activities: [...(prev[dayNumber]?.activities || []), activity],
      },
    }));
  }, [setDayActivities]);

  const removeActivityFromDay = useCallback((activityInstanceId: string, dayNumber: number) => {
    setDayActivities((prev: any) => ({
      ...prev,
      [dayNumber]: {
        ...prev[dayNumber],
        activities: (prev[dayNumber]?.activities || []).filter((activity: Activity) => activity.instanceId !== activityInstanceId),
      },
    }));
  }, [setDayActivities]);

  const removeActivitiesFromAllDays = useCallback((activityInstanceIds: string[]) => {
    setDayActivities((prev: any) => {
      const newDayActivities: { [dayNumber: number]: DayWithPolyline } = {};
      Object.entries(prev).forEach(([day, dayObj]: any) => {
        newDayActivities[Number(day)] = {
          ...dayObj,
          activities: dayObj.activities.filter((act: Activity) => !act.instanceId || !activityInstanceIds.includes(act.instanceId)),
        };
      });
      return newDayActivities;
    });
  }, [setDayActivities]);

  const transferActivitiesToDay = useCallback((activities: Activity[], dayNumber: number) => {
    setDayActivities((prev: any) => {
      const transferIds = activities.map(a => a.instanceId).filter(Boolean);
      const newDayActivities: { [dayNumber: number]: DayWithPolyline } = {};
      Object.entries(prev).forEach(([day, dayObj]: any) => {
        newDayActivities[Number(day)] = {
          ...dayObj,
          activities: dayObj.activities.filter((act: Activity) => !transferIds.includes(act.instanceId)),
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
  }, [setDayActivities]);

  const transferActivitiesToWishlist = useCallback((activityInstanceIds: string[], dayNumber: number) => {
    setDayActivities((prev: any) => {
      const dayObj = prev[dayNumber] || { dayNumber, activities: [] };
      const newDayActivities = {
        ...prev,
        [dayNumber]: {
          ...dayObj,
          activities: dayObj.activities.filter((activity: Activity) => !activity.instanceId || !activityInstanceIds.includes(activity.instanceId)),
        },
      };
      return newDayActivities;
    });
    const transferredActivities = dayActivities[dayNumber]?.activities.filter((activity: Activity) => activity.instanceId && activityInstanceIds.includes(activity.instanceId)) || [];

    // Clear startTime and endTime when moving to wishlist
    const clearedActivities = transferredActivities.map(activity => ({
      ...activity,
      startTime: '',
      endTime: '',
    }));

    return clearedActivities;
  }, [setDayActivities, dayActivities]);

  const getDayActivities = useCallback((dayNumber: number): Activity[] => {
    return dayActivities[dayNumber]?.activities || [];
  }, [dayActivities]);

  const getAllDayActivities = useCallback((): Activity[] => {
    return Object.values(dayActivities)
      .flatMap(dayObj => Array.isArray((dayObj as any).activities) ? (dayObj as any).activities : []);
  }, [dayActivities]);

  const reorderDayActivities = useCallback((dayNumber: number, newOrder: Activity[]) => {
    setDayActivities((prev: any) => ({
      ...prev,
      [dayNumber]: {
        ...prev[dayNumber],
        activities: newOrder,
      },
    }));
  }, [setDayActivities]);

  const setDayPolyline = useCallback((dayNumber: number, encodedPolyline: string) => {
    setDayActivities((prev: any) => ({
      ...prev,
      [dayNumber]: {
        ...prev[dayNumber],
        encodedPolyline,
      },
    }));
  }, [setDayActivities]);

  const clearDay = useCallback((dayNumber: number) => {
    setDayActivities((prev: any) => ({
      ...prev,
      [dayNumber]: {
        ...prev[dayNumber],
        activities: [],
        encodedPolyline: undefined,
      },
    }));
  }, [setDayActivities]);

  const getDayCount = useCallback(() => {
    return Object.keys(dayActivities).length;
  }, [dayActivities]);

  const addNewDay = useCallback(() => {
    const newDayNumber = getDayCount() + 1;
    setDayActivities((prev: any) => ({
      ...prev,
      [newDayNumber]: { dayNumber: newDayNumber, activities: [], encodedPolyline: undefined },
    }));
    return newDayNumber;
  }, [getDayCount, setDayActivities]);

  const addMultipleDays = useCallback((numberOfDays: number) => {
    setDayActivities((prev: any) => {
      const newDayActivities = { ...prev };
      const currentDayCount = Object.keys(prev).length;
      
      for (let i = 1; i <= numberOfDays; i++) {
        const dayNumber = currentDayCount + i;
        newDayActivities[dayNumber] = {
          dayNumber,
          activities: [],
          encodedPolyline: undefined,
        };
      }
      
      return newDayActivities;
    });
  }, [setDayActivities]);

  const deleteDayAndRenumber = useCallback((dayToDelete: number) => {
    // Get activities from the day being deleted
    const deletedDayActivities = dayActivities[dayToDelete]?.activities || [];
    
    setDayActivities((prev: any) => {
      const newDayActivities: { [dayNumber: number]: DayWithPolyline } = {};
      
      // Go through all days and renumber them
      Object.entries(prev).forEach(([dayStr, dayObj]: any) => {
        const dayNum = Number(dayStr);
        
        // Skip the day we're deleting
        if (dayNum === dayToDelete) return;
        
        // Renumber days that come after the deleted day
        const newDayNum = dayNum > dayToDelete ? dayNum - 1 : dayNum;
        newDayActivities[newDayNum] = {
          ...dayObj,
          dayNumber: newDayNum,
        };
      });
      
      return newDayActivities;
    });
    
    // Return the activities from the deleted day
    return deletedDayActivities;
  }, [setDayActivities, dayActivities]);

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
    addMultipleDays,
    getDayActivities,
    getAllDayActivities,
    getDayCount,
    deleteDayAndRenumber,
  };
} 