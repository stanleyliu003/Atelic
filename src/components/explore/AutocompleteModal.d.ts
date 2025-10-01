import { FC } from 'react';
import { Activity } from '../../types/activity.types';

interface AutocompleteModalProps {
  visible: boolean;
  query: string;
  filters: string[];
  selectedCity: string;
  onSuggestionSelect?: (suggestion: string) => void;
  onClose: () => void;
  onFilterToggle: (filterId: string) => void;
  onQueryChange: (text: string) => void;
  onSearchActivities: (query: string, filters: string[], existingActivities: any[]) => Promise<Activity[]>;
  onSaveActivities: (selectedActivities: Activity[]) => void;
  wishlistActivities?: Activity[];
}

export const AutocompleteModal: FC<AutocompleteModalProps>;
