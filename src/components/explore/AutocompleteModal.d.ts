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
  onSaveActivities: (selectedActivities: Activity[], deselectedWishlistActivityIds?: string[]) => void;
  wishlistActivities?: Activity[];
  activeTab?: string;
  /**
   * Controls how activities are selected from search results:
   * - 'multi' (default): user selects multiple items then taps "Save to ..."
   * - 'single': tapping an activity immediately saves it and closes the modal
   */
  selectionMode?: 'multi' | 'single';
}

export const AutocompleteModal: FC<AutocompleteModalProps>;
