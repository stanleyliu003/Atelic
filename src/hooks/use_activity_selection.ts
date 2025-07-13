import { useCallback, useState } from 'react';
import { Activity, ActivitySelectionState } from '../types/activity.types';

export function useActivitySelection() {
  const [selectionState, setSelectionState] = useState<ActivitySelectionState>({
    selectedActivities: [],
    isSelectionMode: false,
  });

  const toggleActivitySelection = useCallback((activityId: string) => {
    setSelectionState(prev => {
      const isSelected = prev.selectedActivities.includes(activityId);
      
      const newSelectedActivities = isSelected
        ? prev.selectedActivities.filter(id => id !== activityId)
        : [...prev.selectedActivities, activityId];
      
      const newState = {
        ...prev,
        selectedActivities: newSelectedActivities,
        isSelectionMode: newSelectedActivities.length > 0,
      };
      
      return newState;
    });
  }, []);

  const selectActivity = useCallback((activityId: string) => {
    setSelectionState(prev => ({
      ...prev,
      selectedActivities: [...prev.selectedActivities, activityId],
      isSelectionMode: true,
    }));
  }, []);

  const deselectActivity = useCallback((activityId: string) => {
    setSelectionState(prev => ({
      ...prev,
      selectedActivities: prev.selectedActivities.filter(id => id !== activityId),
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
    return allActivities.filter(activity => 
      activity.place_id && selectionState.selectedActivities.includes(activity.place_id)
    );
  }, [selectionState.selectedActivities]);

  const isActivitySelected = useCallback((activityId: string) => {
    return selectionState.selectedActivities.includes(activityId);
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