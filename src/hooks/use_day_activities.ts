import { useCallback } from 'react';
import { Activity, DayWithPolyline } from '../types/activity.types';
import { useCreateTrip } from '../../context/CreateTripContext';
import { findRelatedLodgingInstances, enforceLodgingAnchors } from '../utils/lodging_enforcement';

export function useDayActivities() {
  const {
    dayActivities,
    setAllDayActivities,
    setDayActivities,
  } = useCreateTrip();

  const addActivityToDay = useCallback((activity: Activity, dayNumber: number, position?: 'start' | 'end') => {
    setDayActivities((prev: any) => {
      const currentActivities = prev[dayNumber]?.activities || [];
      const updatedActivities = position === 'start'
        ? [activity, ...currentActivities]
        : [...currentActivities, activity];
      const totalDays = Object.keys(prev).length;
      // Enforce lodging anchors when adding new activities (e.g., from "add places" button)
      const enforcedActivities = enforceLodgingAnchors(updatedActivities, dayNumber, totalDays);

      return {
        ...prev,
        [dayNumber]: {
          ...prev[dayNumber],
          activities: enforcedActivities,
        },
      };
    });
  }, [setDayActivities]);

  const removeActivityFromDay = useCallback((activityInstanceId: string, dayNumber: number) => {
    setDayActivities((prev: any) => {
      const currentActivities = prev[dayNumber]?.activities || [];
      const filteredActivities = currentActivities.filter((activity: Activity) => activity.instanceId !== activityInstanceId);
      const updatedActivities = filteredActivities;

      return {
        ...prev,
        [dayNumber]: {
          ...prev[dayNumber],
          activities: updatedActivities,
        },
      };
    });
  }, [setDayActivities]);

  const removeActivitiesFromAllDays = useCallback((activityInstanceIds: string[]) => {
    setDayActivities((prev: any) => {
      const newDayActivities: { [dayNumber: number]: DayWithPolyline } = {};
      Object.entries(prev).forEach(([day, dayObj]: any) => {
        const filteredActivities = dayObj.activities.filter((act: Activity) => !act.instanceId || !activityInstanceIds.includes(act.instanceId));
        const updatedActivities = filteredActivities;

        newDayActivities[Number(day)] = {
          ...dayObj,
          activities: updatedActivities,
        };
      });
      return newDayActivities;
    });
  }, [setDayActivities]);

  const transferActivitiesToDay = useCallback((activities: Activity[], dayNumber: number) => {
    setDayActivities((prev: any) => {
      const transferIds = activities.map(a => a.instanceId).filter(Boolean);
      const newDayActivities: { [dayNumber: number]: DayWithPolyline } = {};

      // First, remove transferred activities from all other days
      Object.entries(prev).forEach(([day, dayObj]: any) => {
        const filteredActivities = dayObj.activities.filter((act: Activity) => !transferIds.includes(act.instanceId));
        const updatedActivities = filteredActivities;

        newDayActivities[Number(day)] = {
          ...dayObj,
          activities: updatedActivities,
        };
      });

      // Then, add activities to the target day and enforce anchors
      const targetDayActivities = [
        ...(newDayActivities[dayNumber]?.activities || []),
        ...activities,
      ];
      // Enforce lodging anchors when transferring activities (e.g., from different tabs)
      const totalDays = Object.keys(newDayActivities).length;
      const updatedTargetActivities = enforceLodgingAnchors(targetDayActivities, dayNumber, totalDays);

      newDayActivities[dayNumber] = {
        ...newDayActivities[dayNumber],
        activities: updatedTargetActivities,
      };

      return newDayActivities;
    });
  }, [setDayActivities]);

  const transferActivitiesToWishlist = useCallback((activityInstanceIds: string[], dayNumber: number) => {
    setDayActivities((prev: any) => {
      const dayObj = prev[dayNumber] || { dayNumber, activities: [] };
      const filteredActivities = dayObj.activities.filter((activity: Activity) => !activity.instanceId || !activityInstanceIds.includes(activity.instanceId));
      const updatedActivities = filteredActivities;

      const newDayActivities = {
        ...prev,
        [dayNumber]: {
          ...dayObj,
          activities: updatedActivities,
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
    return (dayActivities[dayNumber]?.activities || []).filter((a: Activity) => a && a.name);
  }, [dayActivities]);

  const getAllDayActivities = useCallback((): Activity[] => {
    return Object.values(dayActivities)
      .flatMap(dayObj => Array.isArray((dayObj as any).activities) ? (dayObj as any).activities : []);
  }, [dayActivities]);

  const reorderDayActivities = useCallback((dayNumber: number, newOrder: Activity[]) => {
    setDayActivities((prev: any) => {
      // Use the new order directly without enforcing lodging anchors
      // Users can now freely reorder hotels anywhere in the day
      return {
        ...prev,
        [dayNumber]: {
          ...prev[dayNumber],
          activities: newOrder.filter((a: Activity) => a && a.name),
        },
      };
    });
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

        // Keep activities as-is after day deletion
        const enforcedActivities = dayObj.activities || [];

        newDayActivities[newDayNum] = {
          ...dayObj,
          dayNumber: newDayNum,
          activities: enforcedActivities,
        };
      });

      return newDayActivities;
    });

    // Return the activities from the deleted day
    return deletedDayActivities;
  }, [setDayActivities, dayActivities]);

  const removeLodgingStayByPlaceId = useCallback((placeId: string) => {
    // Find all instances of this lodging across all days
    const instanceIdsToRemove = findRelatedLodgingInstances(placeId, dayActivities);

    if (instanceIdsToRemove.length === 0) {
      console.log('[useDayActivities] No lodging instances found for place_id:', placeId);
      return [];
    }

    console.log('[useDayActivities] Removing', instanceIdsToRemove.length, 'lodging instances for place_id:', placeId);

    // Remove all instances from all days
    setDayActivities((prev: any) => {
      const newDayActivities: { [dayNumber: number]: DayWithPolyline } = {};

      Object.entries(prev).forEach(([day, dayObj]: any) => {
        const filteredActivities = dayObj.activities.filter((act: Activity) =>
          !instanceIdsToRemove.includes(act.instanceId || '')
        );
        const updatedActivities = filteredActivities;

        newDayActivities[Number(day)] = {
          ...dayObj,
          activities: updatedActivities,
        };
      });

      return newDayActivities;
    });

    return instanceIdsToRemove;
  }, [dayActivities, setDayActivities]);

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
    removeLodgingStayByPlaceId,
  };
} 