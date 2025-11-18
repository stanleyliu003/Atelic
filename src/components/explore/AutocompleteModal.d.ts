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
   * Callback fired when a place selection begins/ends.
   * Useful for showing external loading indicators in parent screens.
   */
  onAddingPlaceChange?: (isAdding: boolean) => void;
  /**
   * Controls how activities are selected from search results:
   * - 'multi' (default): user selects multiple items then taps "Save to ..."
   * - 'single': tapping an activity immediately saves it and closes the modal
   */
  selectionMode?: 'multi' | 'single';
  /**
   * Whether to show the "Adding place..." loading state after selecting a suggestion.
   * Defaults to true (show loading). Set to false for flows where the modal should
   * close immediately without showing a loading spinner (e.g. create_trip_explore).
   */
  showAddingPlaceLoading?: boolean;
}

export const AutocompleteModal: FC<AutocompleteModalProps>;
