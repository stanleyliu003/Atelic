import { useCallback, useState } from 'react';
import { Activity, ActivitySelectionState } from '../types/activity.types';

export function useActivitySelection() {
  const [selectionState, setSelectionState] = useState<ActivitySelectionState>({
    selectedActivities: [],
    isSelectionMode: false,
  });

  const toggleActivitySelection = useCallback((activityInstanceId: string) => {
    setSelectionState(prev => {
      const isSelected = prev.selectedActivities.includes(activityInstanceId);

      const newSelectedActivities = isSelected
        ? prev.selectedActivities.filter(id => id !== activityInstanceId)
        : [...prev.selectedActivities, activityInstanceId];

      const newState = {
        ...prev,
        selectedActivities: newSelectedActivities,
        isSelectionMode: newSelectedActivities.length > 0,
      };

      return newState;
    });
  }, []);

  const selectActivity = useCallback((activityInstanceId: string) => {
    setSelectionState(prev => ({
      ...prev,
      selectedActivities: [...prev.selectedActivities, activityInstanceId],
      isSelectionMode: true,
    }));
  }, []);

  const deselectActivity = useCallback((activityInstanceId: string) => {
    setSelectionState(prev => ({
      ...prev,
      selectedActivities: prev.selectedActivities.filter(id => id !== activityInstanceId),
      isSelectionMode: prev.selectedActivities.length > 1,
    }));
  }, []);

  const selectMultipleActivities = useCallback((activityIds: string[]) => {
    setSelectionState(prev => ({
      ...prev,
      selectedActivities: [...new Set([...prev.selectedActivities, ...activityIds])],
      isSelectionMode: true,
    }));
  }, []);

  const clearSelection = useCallback(() => {
    setSelectionState({
      selectedActivities: [],
      isSelectionMode: false,
    });
  }, []);

  const getSelectedActivities = useCallback((allActivities: Activity[]) => {
    return (allActivities || []).filter(activity =>
      activity.instanceId && selectionState.selectedActivities.includes(activity.instanceId)
    );
  }, [selectionState.selectedActivities]);

  const isActivitySelected = useCallback((activityInstanceId: string) => {
    return selectionState.selectedActivities.includes(activityInstanceId);
  }, [selectionState.selectedActivities]);

  const getSelectedCount = useCallback(() => {
    return selectionState.selectedActivities.length;
  }, [selectionState.selectedActivities]);

  return {
    // State
    selectedActivities: selectionState.selectedActivities,
    isSelectionMode: selectionState.isSelectionMode,
    
    // Actions
    toggleActivitySelection,
    selectActivity,
    deselectActivity,
    selectMultipleActivities,
    clearSelection,
    
    // Utilities
    getSelectedActivities,
    isActivitySelected,
    getSelectedCount,
  };
}